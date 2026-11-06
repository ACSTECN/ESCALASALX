import type { Coleta, MipontoDispatchPayload, MipontoDispatchResponse } from '@/types';

const env = import.meta.env as Record<string, string | undefined>;

const normalizarBaseUrl = (value: string) => value.replace(/\/+$/, '');
const limparCpf = (value: string | null | undefined) => (value || '').replace(/\D/g, '') || null;

// O MiPonto exibe o turno com inicio e fim (ex.: 18:00 -> 22:00).
// O sistema guarda apenas o inicio, entao o fim e inicio + 4h.
const TURNO_DURACAO_HORAS = 4;

const calcularHorarioFim = (horario: string | null | undefined): string | null => {
  if (!horario) return null;
  const partes = horario.split(':');
  const hora = parseInt(partes[0], 10);
  const minuto = parseInt(partes[1] ?? '0', 10);
  if (Number.isNaN(hora)) return null;
  const horaFim = ((hora + TURNO_DURACAO_HORAS) % 24 + 24) % 24;
  return `${String(horaFim).padStart(2, '0')}:${String(Number.isNaN(minuto) ? 0 : minuto).padStart(2, '0')}`;
};

export const mipontoBridgeUrl = normalizarBaseUrl(
  env.VITE_MIPONTO_BRIDGE_URL || 'http://127.0.0.1:8765'
);

export const buildMipontoPayload = (coleta: Coleta): MipontoDispatchPayload => {
  const motoristas = (coleta.agendamentos || [])
    .filter((ag) => ag.status !== 'cancelado')
    .filter((ag) => ag.condutor?.nome_completo || ag.condutor?.cpf)
    .map((ag) => ({
      agendamento_id: ag.id,
      condutor_id: ag.condutor_id,
      nome: ag.condutor?.nome_completo || 'Sem nome',
      cpf: limparCpf(ag.condutor?.cpf),
      codigo: ag.condutor?.codigo || null,
      telefone: ag.condutor?.telefone || null,
      status: ag.status,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    coleta_id: coleta.id,
    data_coleta: coleta.data_coleta,
    turno: coleta.turno,
    horario: coleta.horario,
    horario_fim: calcularHorarioFim(coleta.horario),
    hub_id: coleta.hub_id,
    hub_sigla: coleta.hub?.sigla || '',
    hub_nome: coleta.hub?.nome || '',
    motoristas,
  };
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
};

export const enviarColetaParaMiponto = async (coleta: Coleta) => {
  const payload = buildMipontoPayload(coleta);

  const response = await fetch(`${mipontoBridgeUrl}/miponto/dispatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await parseResponse<MipontoDispatchResponse & { detail?: string }>(response);

  if (!response.ok) {
    throw new Error(body.detail || body.message || 'Falha ao enviar a escala para o MiPonto.');
  }

  return body;
};

export const verificarServicoMiponto = async () => {
  const response = await fetch(`${mipontoBridgeUrl}/health`);
  const body = await parseResponse<{ ok?: boolean; detail?: string }>(response);

  if (!response.ok || !body.ok) {
    throw new Error(body.detail || 'Servico local do MiPonto indisponivel.');
  }

  return body;
};
