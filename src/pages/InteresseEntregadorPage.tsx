import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ArrowLeft,
  Ticket,
  UserPlus,
} from 'lucide-react';
import { dbCidades, dbHubs, dbInteresses, dbEntregador } from '@/lib/db';
import type { Cidade, Hub, EntregadorAgenda, EntregadorSlot } from '@/types';
import { DIAS_SEMANA, turnoLabel } from '@/types';
import { formatDateBR } from '@/utils';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { branding } from '@/lib/branding';

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskTelefone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const hoje = () => new Date().toISOString().slice(0, 10);

const diaSemanaDe = (data: string) => DIAS_SEMANA[new Date(data + 'T00:00:00').getDay()];

export function InteresseEntregadorPage() {
  // Modo: identificar (novo fluxo) ou cadastro (lista de espera legado)
  const [modo, setModo] = useState<'identificar' | 'cadastro'>('identificar');

  // ---- Fluxo de identificação / auto-agendamento ----
  const [idNome, setIdNome] = useState('');
  const [idCpf, setIdCpf] = useState('');
  const [idTelefone, setIdTelefone] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [erroId, setErroId] = useState('');
  const [agenda, setAgenda] = useState<EntregadorAgenda | null>(null);
  const [acaoEm, setAcaoEm] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // ---- Cadastro / lista de espera (legado) ----
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);

  const [legNome, setLegNome] = useState('');
  const [legCpf, setLegCpf] = useState('');
  const [legTelefone, setLegTelefone] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [hubId, setHubId] = useState('');
  const [data, setData] = useState('');
  const [confirmouDisponibilidade, setConfirmouDisponibilidade] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState<{ hub: Hub; data: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [c, h] = await Promise.all([dbCidades.listAtivas(), dbHubs.listAtivos()]);
      setCidades((c.data as Cidade[]) || []);
      setHubs((h.data as Hub[]) || []);
      setLoading(false);
    })();
  }, []);

  const hubsFiltrados = cidadeId ? hubs.filter((h) => h.cidade_id === cidadeId) : hubs;

  const porData = useMemo(() => {
    const map = new Map<string, EntregadorSlot[]>();
    for (const s of agenda?.slots || []) {
      const arr = map.get(s.data_coleta) || [];
      arr.push(s);
      map.set(s.data_coleta, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [agenda]);

  const consultar = async () => {
    setErroId('');
    setFeedback(null);
    if (idCpf.replace(/\D/g, '').length !== 11) return setErroId('Informe um CPF válido (11 dígitos).');
    if (idNome.trim().length < 3) return setErroId('Informe o nome completo.');

    setConsultando(true);
    const { data: res, error } = await dbEntregador.agenda(
      idNome.trim(),
      idCpf.replace(/\D/g, ''),
      idTelefone.trim()
    );
    setConsultando(false);

    if (error) {
      setErroId('Não foi possível consultar agora. Tente novamente.');
      return;
    }

    const resultado = res as EntregadorAgenda;
    if (!resultado?.encontrado) {
      setAgenda(null);
      if (resultado?.motivo === 'cpf_invalido') setErroId('CPF inválido.');
      else setErroId('Não encontramos seu cadastro. Fale com a operação para ser incluído em um grupo.');
      return;
    }

    setAgenda(resultado);
  };

  const pegarVaga = async (slot: EntregadorSlot) => {
    setAcaoEm(slot.coleta_id);
    setFeedback(null);
    const { data: res, error } = await dbEntregador.agendar(idCpf.replace(/\D/g, ''), slot.coleta_id);
    setAcaoEm(null);

    const resultado = res as { ok: boolean; motivo: string } | null;
    if (error) {
      setFeedback({ tipo: 'erro', texto: 'Não foi possível concluir agora. Tente novamente.' });
      return;
    }

    if (resultado?.ok) {
      setAgenda((prev) =>
        prev
          ? {
              ...prev,
              slots: (prev.slots || []).map((s) =>
                s.coleta_id === slot.coleta_id ? { ...s, ja_agendado: true } : s
              ),
            }
          : prev
      );
      setFeedback({
        tipo: 'ok',
        texto: `Agendado em ${formatDateBR(slot.data_coleta)} · ${turnoLabel(slot.turno)} (${slot.horario}).`,
      });
      return;
    }

    switch (resultado?.motivo) {
      case 'sem_vaga':
        setAgenda((prev) =>
          prev
            ? {
                ...prev,
                slots: (prev.slots || []).map((s) =>
                  s.coleta_id === slot.coleta_id ? { ...s, disponivel: false } : s
                ),
              }
            : prev
        );
        setFeedback({ tipo: 'erro', texto: 'As vagas acabaram. Você pode entrar na lista de espera.' });
        break;
      case 'ja_agendado':
        setAgenda((prev) =>
          prev
            ? {
                ...prev,
                slots: (prev.slots || []).map((s) =>
                  s.coleta_id === slot.coleta_id ? { ...s, ja_agendado: true } : s
                ),
              }
            : prev
        );
        setFeedback({ tipo: 'erro', texto: 'Você já está agendado neste turno.' });
        break;
      case 'nao_elegivel':
        setFeedback({ tipo: 'erro', texto: 'Este turno não está liberado para você.' });
        break;
      default:
        setFeedback({ tipo: 'erro', texto: 'Não foi possível pegar a vaga. Tente novamente.' });
    }
  };

  const entrarListaEspera = async (slot: EntregadorSlot) => {
    setAcaoEm(slot.coleta_id);
    setFeedback(null);
    const { data: res, error } = await dbEntregador.listaEspera(
      idNome.trim(),
      idCpf.replace(/\D/g, ''),
      idTelefone.trim(),
      slot.coleta_id
    );
    setAcaoEm(null);

    const resultado = res as { ok: boolean; motivo: string } | null;
    if (error) {
      setFeedback({ tipo: 'erro', texto: 'Não foi possível entrar na lista de espera. Tente novamente.' });
      return;
    }

    if (resultado?.ok) {
      setAgenda((prev) =>
        prev
          ? {
              ...prev,
              slots: (prev.slots || []).map((s) =>
                s.coleta_id === slot.coleta_id ? { ...s, disponivel: false, na_lista_espera: true } : s
              ),
            }
          : prev
      );
      setFeedback({
        tipo: 'ok',
        texto: `Você entrou na lista de espera para ${formatDateBR(slot.data_coleta)} · ${turnoLabel(slot.turno)}.`,
      });
    } else if (resultado?.motivo === 'ja_na_lista') {
      setAgenda((prev) =>
        prev
          ? {
              ...prev,
              slots: (prev.slots || []).map((s) =>
                s.coleta_id === slot.coleta_id ? { ...s, disponivel: false, na_lista_espera: true } : s
              ),
            }
          : prev
      );
      setFeedback({ tipo: 'erro', texto: 'Você já está na lista de espera para este dia.' });
    } else {
      setFeedback({ tipo: 'erro', texto: 'Não foi possível entrar na lista de espera.' });
    }
  };

  const reiniciar = () => {
    setAgenda(null);
    setFeedback(null);
    setErroId('');
  };

  // ---- Cadastro / lista de espera (legado) ----
  const salvar = async () => {
    setErro('');
    if (legNome.trim().length < 3) return setErro('Informe o nome completo.');
    if (legCpf.replace(/\D/g, '').length !== 11) return setErro('Informe um CPF válido (11 dígitos).');
    if (!hubId) return setErro('Selecione o HUB onde quer fazer coleta.');
    if (!data) return setErro('Selecione o dia de interesse.');
    if (data < hoje()) return setErro('A data não pode ser anterior a hoje.');
    if (!confirmouDisponibilidade) {
      return setErro('Confirme que só está demonstrando interesse se realmente puder comparecer.');
    }

    setSalvando(true);
    const { error } = await dbInteresses.create({
      nome: legNome.trim(),
      cpf: legCpf.replace(/\D/g, ''),
      telefone: legTelefone.trim() || null,
      fez_integracao: null,
      hub_id: hubId,
      data_interesse: data,
      status: 'pendente',
    });
    setSalvando(false);

    if (error) {
      if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
        setErro('Você já registrou interesse neste HUB para esta data.');
      } else {
        setErro('Não foi possível registrar o interesse. Tente novamente.');
      }
      return;
    }

    const hub = hubs.find((h) => h.id === hubId)!;
    setSucesso({ hub, data });
  };

  const novoInteresse = () => {
    setSucesso(null);
    setLegNome('');
    setLegCpf('');
    setLegTelefone('');
    setCidadeId('');
    setHubId('');
    setData('');
    setConfirmouDisponibilidade(false);
    setErro('');
  };

  return (
    <div className="min-h-screen tech-surface flex items-center justify-center p-4 lg:p-8">
      <div className="grid w-full max-w-7xl items-center gap-6 lg:grid-cols-[1fr_1.05fr]">
        <section className="tech-hero relative hidden overflow-hidden rounded-[32px] border border-white/10 p-10 text-white shadow-[0_30px_90px_rgba(2,6,23,0.32)] lg:block">
          <div className="absolute inset-0 tech-grid opacity-20" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <BrandLogo light subtitle="" />
              <h1 className="mt-10 max-w-xl text-4xl font-black leading-tight tracking-[0.08em] text-white">
                Veja os dias liberados e garanta seu turno.
              </h1>
              <p className="mt-4 max-w-xl text-base text-slate-300">
                Identifique-se com seu CPF para ver os dias e turnos liberados para você. Ao pegar,
                a vaga é sua na hora.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Disponibilidade</div>
                <div className="mt-2 text-sm text-slate-200">
                  Você vê apenas se está disponível. A quantidade de vagas é controlada pela operação.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Sem vaga?</div>
                <div className="mt-2 text-sm text-slate-200">
                  Se o turno lotar, você pode entrar na lista de espera direto por aqui.
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="w-full">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLogo light subtitle="" />
          </div>

          <div className="tech-panel overflow-hidden">
            {modo === 'cadastro' ? (
              // ============================================================
              // CADASTRO / LISTA DE ESPERA (legado)
              // ============================================================
              sucesso ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="text-emerald-600" size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Interesse registrado!</h2>
                  <p className="text-sm text-slate-500 mt-2">
                    Você demonstrou interesse em fazer coleta em:
                  </p>
                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin size={16} className="text-brand-600" />
                      <span className="font-semibold">{sucesso.hub.sigla}</span>
                      <span className="text-slate-500">{sucesso.hub.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <CalendarDays size={16} className="text-brand-600" />
                      <span>
                        {formatDateBR(sucesso.data)} · {diaSemanaDe(sucesso.data)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-4">
                    Isso não garante seu agendamento na data interessada. Entraremos em contato para
                    fazer uma breve confirmação antes de agendar.
                  </p>
                  <button className="btn-primary w-full mt-6" onClick={novoInteresse}>
                    Registrar outro interesse
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 pt-6 pb-4">
                    <div>
                      <h1 className="text-lg font-bold text-slate-900">Registrar interesse</h1>
                      <p className="mt-1 text-sm text-slate-500">
                        Ainda não está em um grupo? Deixe seu interesse e a operação entra em contato.
                      </p>
                    </div>
                    <button className="btn-ghost" onClick={() => setModo('identificar')}>
                      <ArrowLeft size={16} /> Voltar
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="label">Nome completo *</label>
                      <input
                        className="input"
                        value={legNome}
                        onChange={(e) => setLegNome(e.target.value)}
                        placeholder="Seu nome completo"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">CPF *</label>
                        <input
                          className="input"
                          value={legCpf}
                          onChange={(e) => setLegCpf(maskCpf(e.target.value))}
                          placeholder="000.000.000-00"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <label className="label">Telefone</label>
                        <input
                          className="input"
                          value={legTelefone}
                          onChange={(e) => setLegTelefone(maskTelefone(e.target.value))}
                          placeholder="(00) 00000-0000"
                          inputMode="numeric"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">Cidade</label>
                      <select
                        className="input"
                        value={cidadeId}
                        onChange={(e) => {
                          setCidadeId(e.target.value);
                          setHubId('');
                        }}
                      >
                        <option value="">Todas as cidades</option>
                        {cidades.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">HUB onde quer fazer coleta *</label>
                      <select className="input" value={hubId} onChange={(e) => setHubId(e.target.value)} disabled={loading}>
                        <option value="">{loading ? 'Carregando...' : 'Selecione o HUB...'}</option>
                        {hubsFiltrados.map((h) => (
                          <option key={h.id} value={h.id}>{h.sigla} — {h.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Dia de interesse *</label>
                      <input
                        type="date"
                        className="input"
                        min={hoje()}
                        value={data}
                        onChange={(e) => setData(e.target.value)}
                      />
                      {data && (
                        <p className="text-xs text-slate-500 mt-1">{diaSemanaDe(data)}</p>
                      )}
                    </div>

                    {erro && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        <span>{erro}</span>
                      </div>
                    )}

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-2">
                      <p className="font-medium">Isso não garante seu agendamento na data interessada.</p>
                      <p>Entraremos em contato para fazer uma breve confirmação antes de agendar.</p>
                    </div>

                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={confirmouDisponibilidade}
                        onChange={(e) => setConfirmouDisponibilidade(e.target.checked)}
                      />
                      <span>
                        Confirmo que só estou dando interesse se realmente eu puder comparecer nessa data.
                      </span>
                    </label>

                    <button className="btn-primary w-full" onClick={salvar} disabled={salvando}>
                      {salvando ? (
                        <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                      ) : (
                        'Confirmar interesse'
                      )}
                    </button>
                  </div>
                </>
              )
            ) : agenda ? (
              // ============================================================
              // RESULTADO: DIAS E TURNOS LIBERADOS
              // ============================================================
              <>
                <div className="flex items-center justify-between border-b border-slate-200 px-6 pt-6 pb-4">
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-slate-900 truncate">
                      Olá, {agenda.condutor?.nome?.split(' ')[0] || 'entregador'}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      Estes são os dias e turnos liberados para você.
                    </p>
                  </div>
                  <button className="btn-ghost" onClick={reiniciar}>
                    <ArrowLeft size={16} /> Trocar
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {feedback && (
                    <div
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                        feedback.tipo === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {feedback.tipo === 'ok' ? (
                        <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                      )}
                      <span>{feedback.texto}</span>
                    </div>
                  )}

                  {porData.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                      <p className="text-sm text-slate-600">
                        Sem agendas disponiveis.
                      </p>
                    </div>
                  ) : (
                    porData.map(([dia, slots]) => (
                      <div key={dia} className="rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                          <CalendarDays size={16} className="text-brand-600" />
                          <span className="font-semibold text-slate-800">{diaSemanaDe(dia)}</span>
                          <span className="text-slate-500">{formatDateBR(dia)}</span>
                          <span className="ml-auto rounded-md bg-slate-200/70 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {slots[0]?.hub_sigla}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {slots.map((slot) => {
                            const processando = acaoEm === slot.coleta_id;
                            return (
                              <div
                                key={slot.coleta_id}
                                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
                                    <Clock size={16} />
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-800">{slot.horario}</span>
                                      <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                        {turnoLabel(slot.turno)}
                                      </span>
                                    </div>
                                    <span className="text-xs text-slate-500">{slot.hub_nome}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {slot.ja_agendado ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                      <CheckCircle2 size={14} /> Você já está agendado
                                    </span>
                                  ) : slot.disponivel ? (
                                    <button
                                      className="btn-primary !py-1.5 !px-4 text-xs inline-flex items-center gap-1.5"
                                      disabled={processando}
                                      onClick={() => pegarVaga(slot)}
                                    >
                                      {processando ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <Ticket size={14} />
                                      )}
                                      Pegar vaga
                                    </button>
                                  ) : (
                                    <div className="flex flex-col items-end gap-2">
                                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-right">
                                        <div className="text-xs font-semibold text-amber-800">
                                          Sem vagas para o turno
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-amber-700">
                                          Entre na fila e a operação chama você se abrir vaga.
                                        </div>
                                      </div>
                                      {slot.na_lista_espera ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                          <CheckCircle2 size={14} /> Você já está na fila
                                        </span>
                                      ) : (
                                        <button
                                          className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
                                          disabled={processando}
                                          onClick={() => entrarListaEspera(slot)}
                                        >
                                          {processando ? (
                                            <Loader2 size={14} className="animate-spin" />
                                          ) : (
                                            <UserPlus size={14} />
                                          )}
                                          Entrar na fila
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              // ============================================================
              // IDENTIFICACAO
              // ============================================================
              <>
                <div className="px-6 pt-6 pb-4 border-b border-slate-200">
                  <h1 className="text-lg font-bold text-slate-900">Ver minhas vagas</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Informe seu nome, CPF e telefone para ver os dias e turnos liberados para você.
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="label">Nome completo *</label>
                    <input
                      className="input"
                      value={idNome}
                      onChange={(e) => setIdNome(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">CPF *</label>
                      <input
                        className="input"
                        value={idCpf}
                        onChange={(e) => setIdCpf(maskCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <label className="label">Telefone</label>
                      <input
                        className="input"
                        value={idTelefone}
                        onChange={(e) => setIdTelefone(maskTelefone(e.target.value))}
                        placeholder="(00) 00000-0000"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  {erroId && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{erroId}</span>
                    </div>
                  )}

                  <button className="btn-primary w-full" onClick={consultar} disabled={consultando}>
                    {consultando ? (
                      <><Loader2 size={16} className="animate-spin" /> Consultando...</>
                    ) : (
                      'Ver minhas vagas'
                    )}
                  </button>

                </div>
              </>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">{branding.footerLabel}</p>
        </div>
      </div>
    </div>
  );
}
