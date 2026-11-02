import { useEffect, useState } from 'react';
import { X, Clock, Users, Target, Plus, Trash2, Pencil, Check, Upload, Download, Square, CheckSquare, ArrowRightLeft, Search } from 'lucide-react';
import type { Coleta, Condutor, Agendamento, StatusAgendamento } from '@/types';
import { calcColetaStats, dbAgendamentos, dbCondutores, dbColetas } from '@/lib/db';
import { formatDateBR, formatTime, getOccupancyColor, colorClasses, toCSV, downloadFile } from '@/utils';
import { STATUS_AGENDAMENTO_LABELS, STATUS_COLETA_LABELS } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store/auth';
import { canWrite } from '@/store/auth';

interface ColetaDetailDrawerProps {
  coleta: Coleta | null;
  onClose: () => void;
  onUpdated: () => void;
}

const statusColor: Record<StatusAgendamento, string> = {
  agendado: 'bg-blue-100 text-blue-700',
  confirmado: 'bg-emerald-100 text-emerald-700',
  compareceu: 'bg-green-100 text-green-700',
  ausente: 'bg-red-100 text-red-700',
  cancelado: 'bg-slate-100 text-slate-600',
  concluido: 'bg-purple-100 text-purple-700',
};

const statusBorder: Record<StatusAgendamento, string> = {
  agendado: 'border-l-blue-400',
  confirmado: 'border-l-emerald-500',
  compareceu: 'border-l-green-500',
  ausente: 'border-l-red-500',
  cancelado: 'border-l-slate-400',
  concluido: 'border-l-purple-500',
};

const normalizarNome = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export function ColetaDetailDrawer({ coleta, onClose, onUpdated }: ColetaDetailDrawerProps) {
  const user = useAuthStore((s) => s.user);
  const canEdit = canWrite(user?.perfil);

  const [condutores, setCondutores] = useState<Condutor[]>([]);
  const [selectedCondutor, setSelectedCondutor] = useState('');
  const [condutorSearch, setCondutorSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Agendamento | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [novaMeta, setNovaMeta] = useState(0);
  const [deleteColeta, setDeleteColeta] = useState(false);

  // Importar condutores
  const [importOpen, setImportOpen] = useState(false);
  const [importColumns, setImportColumns] = useState({
    nomes: '',
    cpfs: '',
    telefones: '',
    integracoes: '',
  });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    agendados: number;
    criados: number;
    erros: string[];
  } | null>(null);

  const [filtroStatus, setFiltroStatus] = useState<StatusAgendamento | ''>('');
  const [buscaNome, setBuscaNome] = useState('');

  // Seleção múltipla
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<StatusAgendamento>('agendado');
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [updatingIntegrationId, setUpdatingIntegrationId] = useState<string | null>(null);

  // Transferência de escala (mover selecionados para outro dia)
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferDate, setTransferDate] = useState('');
  const [transferColetas, setTransferColetas] = useState<Coleta[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState<string | null>(null);

  useEffect(() => {
    if (coleta) {
      dbCondutores.listAtivos().then(({ data }) => setCondutores((data as Condutor[]) || []));
      setEditingMeta(false);
      setSelectedIds(new Set());
      setCondutorSearch('');
      setSelectedCondutor('');
      setBuscaNome('');
      setFiltroStatus('');
    }
  }, [coleta]);

  if (!coleta) return null;

  const { agendados, vagas, ocupacao } = calcColetaStats(coleta);
  const color = getOccupancyColor(ocupacao, coleta.status);
  const c = colorClasses[color];

  const agendamentosAtuais = coleta.agendamentos || [];
  const agendamentosAtivos = agendamentosAtuais.filter((a) => a.status !== 'cancelado');

  const agendar = async () => {
    if (!selectedCondutor || !coleta) return;
    setLoading(true);

    const condutorSelecionado = condutores.find((c) => c.id === selectedCondutor);
    const nomeSelecionado = normalizarNome(condutorSelecionado?.nome_completo || '');
    const nomeJaAgendado = agendamentosAtivos.some(
      (a) => normalizarNome(a.condutor?.nome_completo || '') === nomeSelecionado
    );

    if (nomeSelecionado && nomeJaAgendado) {
      alert('Já existe um agendamento com este nome nesta coleta.');
      setLoading(false);
      return;
    }

    const agendamentoExistente = agendamentosAtuais.find((a) => a.condutor_id === selectedCondutor);
    let error: { message: string } | null = null;

    if (agendamentoExistente?.status === 'cancelado') {
      const result = await dbAgendamentos.updateStatus(agendamentoExistente.id, 'agendado');
      error = result.error;
    } else if (agendamentoExistente) {
      error = { message: 'Condutor já está agendado nesta coleta.' };
    } else {
      const result = await dbAgendamentos.create({
        coleta_id: coleta.id,
        condutor_id: selectedCondutor,
        status: 'agendado',
        created_by: user?.id,
      });
      error = result.error;
    }

    if (error) {
      alert(error.message);
    } else {
      setSelectedCondutor('');
      onUpdated();
    }
    setLoading(false);
  };

  const alterarStatus = async (ag: Agendamento, status: StatusAgendamento) => {
    if (status === 'cancelado') {
      await dbAgendamentos.remove(ag.id);
    } else {
      await dbAgendamentos.updateStatus(ag.id, status);
    }
    onUpdated();
  };

  const atualizarObservacaoIntegracao = (observacoes: string | null | undefined, fezIntegracao: boolean) => {
    const partes = (observacoes || '')
      .split('|')
      .map((parte) => parte.trim())
      .filter(Boolean)
      .filter((parte) => !/^integração:/i.test(parte) && !/^integracao:/i.test(parte));

    partes.unshift(`Integração: ${fezIntegracao ? 'Sim' : 'Não'}`);
    return partes.join(' | ');
  };

  const alterarIntegracao = async (ag: Agendamento, value: 'sim' | 'nao') => {
    if (!ag.condutor?.id) return;

    setUpdatingIntegrationId(ag.id);
    const fezIntegracao = value === 'sim';
    await dbCondutores.update(ag.condutor.id, {
      fez_integracao: fezIntegracao,
      observacoes: atualizarObservacaoIntegracao(ag.condutor.observacoes, fezIntegracao),
    });
    setUpdatingIntegrationId(null);
    onUpdated();
  };

  const confirmarCancelamento = async () => {
    if (!cancelTarget) return;
    await dbAgendamentos.remove(cancelTarget.id);
    setCancelTarget(null);
    onUpdated();
  };

  const salvarMeta = async () => {
    if (!coleta) return;
    await dbColetas.update(coleta.id, { meta: novaMeta });
    setEditingMeta(false);
    onUpdated();
  };

  const iniciarEdicaoMeta = () => {
    setNovaMeta(coleta.meta);
    setEditingMeta(true);
  };

  const excluirColeta = async () => {
    if (!coleta) return;
    await dbColetas.remove(coleta.id);
    setDeleteColeta(false);
    onClose();
    onUpdated();
  };

  const limparImportacao = () => {
    setImportColumns({ nomes: '', cpfs: '', telefones: '', integracoes: '' });
  };

  const parseImportColumns = (cols: typeof importColumns) => {
    const splitRows = (text: string) => text.replace(/\r/g, '').split('\n');
    const toBoolIntegracao = (value: string) => /^(integracao|integração|sim|s|x|1|true)$/i.test(value.trim());
    const nomes = splitRows(cols.nomes);
    const cpfs = splitRows(cols.cpfs);
    const telefones = splitRows(cols.telefones);
    const integracoes = splitRows(cols.integracoes);
    const maxRows = Math.max(nomes.length, cpfs.length, telefones.length, integracoes.length);
    const resultados: { nome: string; cpf: string; telefone: string; fezIntegracao: boolean }[] = [];
    const erros: string[] = [];
    let total = 0;

    for (let i = 0; i < maxRows; i++) {
      const nome = (nomes[i] || '').trim();
      const cpfBruto = (cpfs[i] || '').trim();
      const cpfNormalizado = cpfBruto.replace(/\D/g, '');
      const telefoneBruto = (telefones[i] || '').trim();
      const telefoneNormalizado = telefoneBruto.replace(/\D/g, '');
      const integracao = (integracoes[i] || '').trim();
      const linha = i + 1;

      if (!nome && !cpfNormalizado && !telefoneBruto && !integracao) continue;
      total++;
      if (!nome) {
        erros.push(`Linha ${linha}: nome não informado.`);
        continue;
      }

      const cpf = cpfNormalizado.length === 11 ? cpfNormalizado : '';
      const telefone =
        telefoneNormalizado.length === 10 || telefoneNormalizado.length === 11
          ? telefoneNormalizado
          : '';

      resultados.push({
        nome,
        cpf,
        telefone,
        fezIntegracao: toBoolIntegracao(integracao),
      });
    }

    return { total, resultados, erros };
  };

  const handleImport = async () => {
    if (!importColumns.nomes.trim() || !coleta) return;
    setImporting(true);
    setImportResult(null);

    const { total, resultados: parsed, erros: errosValidacao } = parseImportColumns(importColumns);
    if (parsed.length === 0) {
      setImportResult({
        total,
        agendados: 0,
        criados: 0,
        erros: errosValidacao.length > 0
          ? errosValidacao
          : ['Nenhum registro válido encontrado. Preencha ao menos a coluna Nome.'],
      });
      setImporting(false);
      return;
    }

    // Reaproveita cadastro apenas quando CPF e nome baterem juntos.
    // Se o mesmo CPF vier com nome diferente, tratamos como outro registro
    // para não derrubar a quantidade importada.
    const { data: todosCondutores } = await dbCondutores.list();
    const condutoresList = (todosCondutores as Condutor[]) || [];
    const cpfMap = new Map<string, Condutor[]>();
    for (const cd of condutoresList) {
      if (!cd.cpf) continue;
      const cpf = cd.cpf.replace(/\D/g, '');
      const atuais = cpfMap.get(cpf) || [];
      atuais.push(cd);
      cpfMap.set(cpf, atuais);
    }

    let criados = 0;
    let agendados = 0;
    const erros: string[] = [];
    const agendamentoMap = new Map(agendamentosAtuais.map((a) => [a.condutor_id, a]));
    const nomesAgendados = new Set(
      agendamentosAtivos.map((a) => normalizarNome(a.condutor?.nome_completo || '')).filter(Boolean)
    );

    for (const item of parsed) {
      const nomeNormalizado = normalizarNome(item.nome);
      if (nomeNormalizado && nomesAgendados.has(nomeNormalizado)) {
        erros.push(`${item.nome}: já existe um agendamento com este nome nesta coleta`);
        continue;
      }

      let condutor = item.cpf
        ? (cpfMap.get(item.cpf) || []).find(
            (cd) => normalizarNome(cd.nome_completo || '') === nomeNormalizado
          )
        : undefined;
      // Cria o condutor se não existir
      if (!condutor) {
        const { data: novo, error: erroCriacao } = await dbCondutores.create({
          nome_completo: item.nome,
          cpf: item.cpf || null,
          telefone: item.telefone || null,
          fez_integracao: item.fezIntegracao,
          cidade_id: coleta.hub?.cidade_id || null,
          hub_id: coleta.hub_id,
          status: 'ativo',
        });
        if (erroCriacao) {
          erros.push(`${item.nome}: não foi possível criar o condutor (${erroCriacao.message})`);
          continue;
        }
        if (novo) {
          condutor = novo as Condutor;
          criados++;
          if (item.cpf) {
            const atuais = cpfMap.get(item.cpf) || [];
            atuais.push(condutor);
            cpfMap.set(item.cpf, atuais);
          }
        } else {
          erros.push(`${item.nome}: não foi possível criar o condutor.`);
          continue;
        }
      } else {
        const updateData: Partial<Condutor> = {};
        if (item.telefone && !condutor.telefone) updateData.telefone = item.telefone;
        if ((condutor.fez_integracao ?? false) !== item.fezIntegracao) {
          updateData.fez_integracao = item.fezIntegracao;
        }
        if (Object.keys(updateData).length > 0) {
          const { error: erroAtualizacao } = await dbCondutores.update(condutor.id, updateData);
          if (erroAtualizacao) {
            erros.push(`${item.nome}: não foi possível atualizar o cadastro (${erroAtualizacao.message})`);
            continue;
          }
          condutor = { ...condutor, ...updateData };
        }
      }
      if (condutor) {
        const agendamentoExistente = agendamentoMap.get(condutor.id);
        let error: { message: string } | null = null;

        if (agendamentoExistente?.status === 'cancelado') {
          const result = await dbAgendamentos.updateStatus(agendamentoExistente.id, 'agendado');
          error = result.error;
        } else if (agendamentoExistente) {
          error = { message: 'condutor já está agendado nesta coleta' };
        } else {
          const result = await dbAgendamentos.create({
            coleta_id: coleta.id,
            condutor_id: condutor.id,
            status: 'agendado',
            created_by: user?.id,
          });
          error = result.error;
        }

        if (error) {
          erros.push(`${item.nome}: ${error.message}`);
        } else {
          agendamentoMap.set(condutor.id, {
            ...(agendamentoExistente || {}),
            condutor_id: condutor.id,
            status: 'agendado',
          } as Agendamento);
          nomesAgendados.add(nomeNormalizado);
          agendados++;
        }
      }
    }

    setImportResult({ total, agendados, criados, erros: [...errosValidacao, ...erros] });
    limparImportacao();
    setImporting(false);
    onUpdated();
    // Recarrega lista de condutores
    dbCondutores.listAtivos().then(({ data }) => setCondutores((data as Condutor[]) || []));
  };

  const statusCounts: Record<StatusAgendamento, number> = {
    agendado: 0,
    confirmado: 0,
    compareceu: 0,
    ausente: 0,
    cancelado: 0,
    concluido: 0,
  };
  agendamentosAtivos.forEach((a) => { statusCounts[a.status]++; });

  const compareceram = statusCounts.compareceu + statusCounts.concluido;
  const taxaComparecimento = agendamentosAtivos.length > 0
    ? Math.round((compareceram / agendamentosAtivos.length) * 100)
    : 0;

  const agendamentosFiltrados = (filtroStatus
    ? agendamentosAtivos.filter((a) => a.status === filtroStatus)
    : agendamentosAtivos
  ).filter((a) => {
    const termo = normalizarNome(buscaNome);
    if (!termo) return true;
    const nome = normalizarNome(a.condutor?.nome_completo || '');
    const rota = normalizarNome(a.condutor?.rota_fixa?.sigla || '');
    return nome.includes(termo) || rota.includes(termo);
  });

  const condutoresDisponiveis = condutores
    .filter((cd) => !coleta.agendamentos?.some((a) => a.condutor_id === cd.id && a.status !== 'cancelado'))
    .filter((cd) => {
      if (!condutorSearch.trim()) return true;
      const termo = condutorSearch.toLowerCase();
      const cpf = (cd.cpf || '').replace(/\D/g, '');
      const telefone = (cd.telefone || '').replace(/\D/g, '');
      const haystack = `${cd.nome_completo} ${cd.cpf || ''} ${cpf} ${cd.telefone || ''} ${telefone} ${cd.observacoes || ''}`.toLowerCase();
      return haystack.includes(termo);
    });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltrados = () => {
    if (agendamentosFiltrados.length > 0 && agendamentosFiltrados.every((a) => selectedIds.has(a.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(agendamentosFiltrados.map((a) => a.id)));
    }
  };

  const aplicarStatusEmLote = async () => {
    if (selectedIds.size === 0) return;
    if (bulkStatus === 'cancelado') {
      await dbAgendamentos.bulkRemove(Array.from(selectedIds));
    } else {
      await dbAgendamentos.bulkUpdateStatus(Array.from(selectedIds), bulkStatus);
    }
    setSelectedIds(new Set());
    onUpdated();
  };

  const removerSelecionados = async () => {
    if (selectedIds.size === 0) return;
    await dbAgendamentos.bulkRemove(Array.from(selectedIds));
    setConfirmBulkRemove(false);
    setSelectedIds(new Set());
    onUpdated();
  };

  const carregarColetasDestino = async (date: string) => {
    if (!coleta || !date) {
      setTransferColetas([]);
      setTransferTargetId('');
      return;
    }
    setTransferLoading(true);
    const { data } = await dbColetas.listByDate(date);
    const lista = ((data as Coleta[]) || []).filter(
      (c) => c.hub_id === coleta.hub_id && c.id !== coleta.id
    );
    setTransferColetas(lista);
    setTransferTargetId(lista[0]?.id || '');
    setTransferLoading(false);
  };

  const transferirSelecionados = async () => {
    if (!coleta || !transferTargetId || selectedIds.size === 0) return;
    setTransferring(true);
    setTransferMsg(null);

    const destino = transferColetas.find((c) => c.id === transferTargetId);
    const destinoMap = new Map((destino?.agendamentos || []).map((a) => [a.condutor_id, a]));
    const nomesDestino = new Set(
      (destino?.agendamentos || [])
        .filter((a) => a.status !== 'cancelado')
        .map((a) => normalizarNome(a.condutor?.nome_completo || ''))
        .filter(Boolean)
    );

    const selecionados = agendamentosAtuais.filter((a) => selectedIds.has(a.id));
    let adicionados = 0;
    const ignorados: string[] = [];

    for (const ag of selecionados) {
      const nome = normalizarNome(ag.condutor?.nome_completo || '');
      if (nome && nomesDestino.has(nome)) {
        ignorados.push(`${ag.condutor?.nome_completo}: já agendado neste dia`);
        continue;
      }

      const existenteDestino = destinoMap.get(ag.condutor_id);
      let error: { message: string } | null = null;

      if (existenteDestino) {
        if (existenteDestino.status === 'cancelado') {
          const result = await dbAgendamentos.updateStatus(existenteDestino.id, ag.status);
          error = result.error;
        } else {
          ignorados.push(`${ag.condutor?.nome_completo}: já agendado neste dia`);
          continue;
        }
      } else {
        const result = await dbAgendamentos.create({
          coleta_id: transferTargetId,
          condutor_id: ag.condutor_id,
          status: ag.status,
          created_by: user?.id,
        });
        error = result.error;
      }

      if (error) {
        ignorados.push(`${ag.condutor?.nome_completo}: ${error.message}`);
        continue;
      }

      destinoMap.set(ag.condutor_id, (existenteDestino || {}) as Agendamento);
      if (nome) nomesDestino.add(nome);
      adicionados++;
    }

    setTransferring(false);
    setSelectedIds(new Set());
    onUpdated();

    if (ignorados.length > 0) {
      setTransferMsg(
        `${adicionados} adicionado(s) no novo dia. A escala atual foi mantida. Não adicionados: ${ignorados.join(' | ')}`
      );
    } else {
      setTransferMsg(
        `${adicionados} condutor(es) também agendado(s) no novo dia. A escala atual foi mantida.`
      );
      setTimeout(() => {
        setTransferOpen(false);
        setTransferMsg(null);
      }, 1500);
    }
  };

  const exportarAgendamentos = () => {
    if (!coleta) return;
    const linhas = agendamentosAtivos.map((a, index) => ({
      '#': index + 1,
      'Condutor': a.condutor?.nome_completo || '',
      'Rota': a.condutor?.rota_fixa?.sigla || '',
      'CPF': a.condutor?.cpf || '',
      'Telefone': a.condutor?.telefone || '',
      'Integração': a.condutor?.fez_integracao ? 'Sim' : 'Não',
      'Observação': a.condutor?.observacoes || '',
      'Status': STATUS_AGENDAMENTO_LABELS[a.status],
      'HUB': coleta.hub?.sigla || '',
      'Data': formatDateBR(coleta.data_coleta),
      'Horário': formatTime(coleta.horario),
    }));
    const csv = toCSV(linhas);
    downloadFile(csv, `agendamentos_${coleta.hub?.sigla}_${coleta.data_coleta}.csv`);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[1120px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className={`${c.bg} ${c.border} border-b px-6 py-5`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800">{coleta.hub?.sigla}</h2>
                {coleta.is_demo && <Badge variant="warning">DEMO</Badge>}
              </div>
              <p className="text-sm text-slate-600">{coleta.hub?.nome} • {coleta.hub?.cidade?.nome}</p>
            </div>
            <div className="flex items-center gap-1">
              {canEdit && (
                <button
                  onClick={() => setDeleteColeta(true)}
                  className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                  title="Excluir coleta"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-white/50 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
            <span className="flex items-center gap-1 text-slate-700">
              <Clock size={14} /> {formatDateBR(coleta.data_coleta)} • {formatTime(coleta.horario)}
            </span>
            <Badge variant={coleta.status === 'finalizada' ? 'gray' : 'info'}>{STATUS_COLETA_LABELS[coleta.status]}</Badge>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-y-auto border-b border-slate-200 lg:border-b-0 lg:border-r lg:border-slate-200">
            <div className="grid grid-cols-3 gap-4 px-6 py-5 border-b border-slate-200">
              <div className="text-center">
                <div className="text-xs text-slate-500">Meta</div>
                {editingMeta ? (
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min={0}
                      className="w-16 text-center text-lg font-bold text-slate-800 border border-slate-300 rounded px-1 py-0.5"
                      value={novaMeta}
                      onChange={(e) => setNovaMeta(Number(e.target.value))}
                      autoFocus
                    />
                    <button className="p-1 text-green-600 hover:bg-green-50 rounded" onClick={salvarMeta} title="Salvar">
                      <Check size={16} />
                    </button>
                    <button className="p-1 text-slate-400 hover:bg-slate-100 rounded" onClick={() => setEditingMeta(false)} title="Cancelar">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="text-lg font-bold text-slate-800 flex items-center justify-center gap-1">
                    <Target size={14} className="text-brand-500" /> {coleta.meta}
                    {canEdit && (
                      <button className="p-0.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded" onClick={iniciarEdicaoMeta} title="Editar meta">
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500">Agendados</div>
                <div className={`text-lg font-bold flex items-center justify-center gap-1 ${c.text}`}>
                  <Users size={14} /> {agendados}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500">Vagas</div>
                <div className="text-lg font-bold text-slate-800">{vagas}</div>
              </div>
            </div>

            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Ocupação</span>
                <span className="font-semibold">{ocupacao}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${Math.min(ocupacao, 100)}%` }} />
              </div>
            </div>

            {agendamentosAtivos.length > 0 && (
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Efetividade</span>
                  <span className={`text-sm font-bold ${taxaComparecimento >= 80 ? 'text-green-600' : taxaComparecimento >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {taxaComparecimento}% comparecimento
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {([
                    { key: 'agendado', label: 'Agendados', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                    { key: 'confirmado', label: 'Confirmados', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    { key: 'compareceu', label: 'Compareceram', color: 'text-green-600 bg-green-50 border-green-200' },
                    { key: 'ausente', label: 'Ausentes', color: 'text-red-600 bg-red-50 border-red-200' },
                  ] as const).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setFiltroStatus(filtroStatus === s.key ? '' : s.key)}
                      className={`p-2.5 rounded-lg border text-center transition ${s.color} ${filtroStatus === s.key ? 'ring-2 ring-offset-1 ring-slate-400' : 'hover:opacity-80'}`}
                    >
                      <div className="text-base font-bold leading-none">{statusCounts[s.key]}</div>
                      <div className="text-[10px] mt-0.5 font-medium opacity-80">{s.label}</div>
                    </button>
                  ))}
                </div>
                {filtroStatus && (
                  <button
                    className="text-[11px] text-blue-600 hover:underline"
                    onClick={() => setFiltroStatus('')}
                  >
                    ← Ver todos ({agendamentosAtivos.length})
                  </button>
                )}
              </div>
            )}

            {canEdit && (
              <div className="px-6 py-4">
                <label className="label">Agendar condutor</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="input pl-9"
                    value={condutorSearch}
                    onChange={(e) => setCondutorSearch(e.target.value)}
                    placeholder="Pesquisar por nome, CPF, telefone ou observação..."
                  />
                </div>
                <div className="mb-2 text-xs text-slate-500">
                  {condutoresDisponiveis.length} condutor(es) disponível(is) na base
                </div>
                <div className="flex gap-2 mb-2">
                  <select
                    className="input min-w-0"
                    value={selectedCondutor}
                    onChange={(e) => setSelectedCondutor(e.target.value)}
                  >
                    <option value="">Selecione um condutor...</option>
                    {condutoresDisponiveis
                      .slice(0, 200)
                      .map((cd) => (
                        <option key={cd.id} value={cd.id}>
                          {cd.nome_completo}
                          {cd.cpf ? ` • ${cd.cpf}` : ''}
                          {cd.telefone ? ` • ${cd.telefone}` : ''}
                        </option>
                      ))}
                  </select>
                  <button className="btn-primary flex-shrink-0 min-w-[52px]" onClick={agendar} disabled={!selectedCondutor || loading}>
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  className="btn-secondary w-full"
                  onClick={() => {
                    setImportOpen(true);
                    setImportResult(null);
                    limparImportacao();
                  }}
                >
                  <Upload size={16} /> Importar e agendar em lote
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Condutores {filtroStatus ? STATUS_AGENDAMENTO_LABELS[filtroStatus].toLowerCase() + 's' : 'agendados'} ({agendamentosFiltrados.length})
            </h3>
            <div className="flex items-center gap-1">
              {canEdit && agendamentosFiltrados.length > 0 && (
                <button
                  onClick={selectAllFiltrados}
                  title="Selecionar todos"
                  className="p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded"
                >
                  {agendamentosFiltrados.every((a) => selectedIds.has(a.id)) ? (
                    <CheckSquare size={16} className="text-brand-600" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              )}
              <button
                onClick={exportarAgendamentos}
                title="Exportar CSV"
                className="p-1 text-slate-400 hover:text-green-600 hover:bg-slate-100 rounded"
              >
                <Download size={16} />
              </button>
            </div>
          </div>

          {/* Busca de condutores escalados */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="input pl-9 pr-9"
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
              placeholder="Pesquisar condutor por nome (ou rota)..."
            />
            {buscaNome && (
              <button
                onClick={() => setBuscaNome('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Barra de ações em lote */}
          {canEdit && selectedIds.size > 0 && (
            <div className="sticky top-0 z-10 mb-4 p-3 rounded-xl bg-brand-50 border border-brand-200 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-brand-700 whitespace-nowrap">
                {selectedIds.size} selecionado(s)
              </span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as StatusAgendamento)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-2 bg-white flex-1 min-w-[180px]"
              >
                {Object.entries(STATUS_AGENDAMENTO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button
                onClick={aplicarStatusEmLote}
                className="btn-primary !py-1 !px-2 text-xs whitespace-nowrap"
              >
                Aplicar
              </button>
              <button
                onClick={() => {
                  setTransferOpen(true);
                  setTransferMsg(null);
                  setTransferDate('');
                  setTransferColetas([]);
                  setTransferTargetId('');
                }}
                className="btn-secondary !py-1 !px-2 text-xs whitespace-nowrap inline-flex items-center gap-1"
                title="Adicionar selecionados em outro dia (mantém esta escala)"
              >
                <ArrowRightLeft size={13} /> Outro dia
              </button>
              <button
                onClick={() => setConfirmBulkRemove(true)}
                className="btn-danger !py-1 !px-2 text-xs whitespace-nowrap"
              >
                Remover
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1 text-slate-400 hover:text-red-500 rounded"
                title="Limpar seleção"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {agendamentosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              {buscaNome.trim()
                ? 'Nenhum condutor encontrado para esta busca.'
                : filtroStatus
                  ? 'Nenhum condutor com este status.'
                  : 'Nenhum condutor agendado'}
            </p>
          ) : (
            <div className="space-y-2">
              {agendamentosFiltrados.map((ag) => (
                <div
                  key={ag.id}
                  className={`flex flex-col gap-3 rounded-xl bg-slate-50 border border-slate-100 border-l-4 p-3.5 md:flex-row md:items-center md:justify-between ${statusBorder[ag.status]} ${selectedIds.has(ag.id) ? 'ring-2 ring-brand-400 bg-brand-50' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {canEdit && (
                      <button onClick={() => toggleSelect(ag.id)} className="flex-shrink-0">
                        {selectedIds.has(ag.id) ? (
                          <CheckSquare size={16} className="text-brand-600" />
                        ) : (
                          <Square size={16} className="text-slate-300" />
                        )}
                      </button>
                    )}
                    <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {ag.condutor?.nome_completo.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm md:text-base font-medium text-slate-800 truncate">{ag.condutor?.nome_completo}</span>
                        {ag.condutor?.rota_fixa?.sigla && (
                          <span className="badge bg-cyan-100 text-cyan-800" title="Rota fixa">
                            {ag.condutor.rota_fixa.sigla}
                          </span>
                        )}
                        <span
                          className={`badge ${
                            ag.condutor?.fez_integracao
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {ag.condutor?.fez_integracao ? 'Integração' : 'Sem integração'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                        <span>{ag.condutor?.telefone || 'Sem telefone'}</span>
                        {canEdit && <span className={`badge ${statusColor[ag.status]}`}>{STATUS_AGENDAMENTO_LABELS[ag.status]}</span>}
                      </div>
                      {ag.condutor?.observacoes && (
                        <div className="mt-1 text-xs italic text-slate-500 break-words">
                          Obs.: {ag.condutor.observacoes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto">
                    {canEdit ? (
                      <div className="flex flex-col gap-2 md:items-end">
                        <select
                          value={ag.condutor?.fez_integracao ? 'sim' : 'nao'}
                          onChange={(e) => alterarIntegracao(ag, e.target.value as 'sim' | 'nao')}
                          disabled={updatingIntegrationId === ag.id}
                          className="text-xs border border-amber-200 rounded-lg px-2 py-2 bg-amber-50 text-amber-800 min-w-[140px]"
                        >
                          <option value="nao">Sem integração</option>
                          <option value="sim">Com integração</option>
                        </select>
                        <select
                          value={ag.status}
                          onChange={(e) => alterarStatus(ag, e.target.value as StatusAgendamento)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white min-w-[140px]"
                        >
                          {Object.entries(STATUS_AGENDAMENTO_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className={`badge ${statusColor[ag.status]}`}>{STATUS_AGENDAMENTO_LABELS[ag.status]}</span>
                    )}
                    {canEdit && (
                      <button className="p-1 text-red-500 hover:bg-red-50 rounded" onClick={() => setCancelTarget(ag)} title="Cancelar">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmarCancelamento}
        title="Remover agendamento"
        message={`Cuidado: deseja remover manualmente o agendamento de ${cancelTarget?.condutor?.nome_completo}? A vaga será liberada.`}
        confirmLabel="Remover agendamento"
      />

      <ConfirmDialog
        open={deleteColeta}
        onClose={() => setDeleteColeta(false)}
        onConfirm={excluirColeta}
        title="Excluir coleta"
        message={`Cuidado: deseja excluir manualmente a coleta ${coleta?.hub?.sigla} de ${coleta ? formatDateBR(coleta.data_coleta) : ''} às ${coleta ? formatTime(coleta.horario) : ''}? Todos os agendamentos desta coleta também serão removidos.`}
        confirmLabel="Excluir coleta"
      />

      <ConfirmDialog
        open={confirmBulkRemove}
        onClose={() => setConfirmBulkRemove(false)}
        onConfirm={removerSelecionados}
        title="Remover agendamentos selecionados"
        message={`Cuidado: deseja remover manualmente ${selectedIds.size} agendamento(s) selecionado(s)? Essa ação libera as vagas desta coleta.`}
        confirmLabel="Remover selecionados"
      />

      <Modal
        open={transferOpen}
        onClose={() => {
          setTransferOpen(false);
          setTransferMsg(null);
        }}
        title="Adicionar em outro dia"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Adicionar <strong>{selectedIds.size}</strong> condutor(es) selecionado(s) em outra escala do
            mesmo HUB ({coleta?.hub?.sigla}).
          </p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
            Os condutores <strong>continuam agendados nesta escala</strong> e também serão agendados no dia escolhido.
          </div>

          <div>
            <label className="label">Dia de destino</label>
            <input
              type="date"
              className="input"
              value={transferDate}
              onChange={(e) => {
                setTransferDate(e.target.value);
                setTransferMsg(null);
                carregarColetasDestino(e.target.value);
              }}
            />
          </div>

          {transferLoading && <p className="text-sm text-slate-400">Buscando escalas do dia...</p>}

          {transferDate && !transferLoading && transferColetas.length === 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
              Nenhuma escala encontrada para esse HUB no dia selecionado.
            </div>
          )}

          {transferColetas.length > 0 && (
            <div>
              <label className="label">Escala / horário de destino</label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transferColetas.map((c) => {
                  const stats = calcColetaStats(c);
                  const selecionada = transferTargetId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTransferTargetId(c.id)}
                      className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm text-left transition ${
                        selecionada
                          ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-300'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium text-slate-700">
                        <Clock size={14} className="text-slate-400" />
                        {formatTime(c.horario)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {stats.agendados} agendado(s) / meta {c.meta}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {transferMsg && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
              {transferMsg}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
              onClick={transferirSelecionados}
              disabled={!transferTargetId || transferring || selectedIds.size === 0}
            >
              <ArrowRightLeft size={16} />
              {transferring ? 'Adicionando...' : 'Adicionar no novo dia'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setTransferOpen(false);
                setTransferMsg(null);
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportResult(null);
        }}
        title="Importar e agendar condutores"
        size="xl"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Cole cada coluna separadamente, como em um Excel simples. As linhas precisam ficar na mesma ordem em todas as colunas.
            Somente <strong>Nome</strong> é obrigatório.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            CPF, telefone e integração podem ficar em branco. Em <strong>Integração</strong>, deixe em branco quando não for integração.
            Escreva <strong>integração</strong> quando for. Se CPF ou telefone vierem incompletos, o nome ainda será importado e o dado inválido será ignorado.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-1">
              <label className="label">Colar nomes *</label>
              <textarea
                className="input h-56 font-mono text-sm"
                placeholder={'João Silva\nMaria Santos\nCarlos Souza'}
                value={importColumns.nomes}
                onChange={(e) => setImportColumns((prev) => ({ ...prev, nomes: e.target.value }))}
              />
            </div>
            <div className="lg:col-span-1">
              <label className="label">Colar CPFs</label>
              <textarea
                className="input h-56 font-mono text-sm"
                placeholder={'123.456.789-00\n987.654.321-00\n111.222.333-44'}
                value={importColumns.cpfs}
                onChange={(e) => setImportColumns((prev) => ({ ...prev, cpfs: e.target.value }))}
              />
            </div>
            <div className="lg:col-span-1">
              <label className="label">Colar telefones</label>
              <textarea
                className="input h-56 font-mono text-sm"
                placeholder={'(11) 91234-5678\n21998765432\n'}
                value={importColumns.telefones}
                onChange={(e) => setImportColumns((prev) => ({ ...prev, telefones: e.target.value }))}
              />
            </div>
            <div className="lg:col-span-1">
              <label className="label">Colar integração</label>
              <textarea
                className="input h-56 font-mono text-sm"
                placeholder={'integração\n\nintegração'}
                value={importColumns.integracoes}
                onChange={(e) => setImportColumns((prev) => ({ ...prev, integracoes: e.target.value }))}
              />
            </div>
          </div>

          {importResult && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm space-y-1">
              {importResult.agendados > 0 && <div className="text-green-700">✓ {importResult.agendados} condutor(es) agendado(s)</div>}
              {importResult.criados > 0 && <div className="text-blue-700">+ {importResult.criados} condutor(es) criado(s)</div>}
              <div className="text-slate-700">
                {importResult.total} linha(s) lida(s) · {importResult.agendados} agendada(s) · {importResult.total - importResult.agendados} não agendada(s)
              </div>
              {importResult.erros.length > 0 && (
                <div className="text-red-600">
                  <div className="font-semibold mb-1">⚠ {importResult.erros.length} erro(s):</div>
                  <ul className="list-disc list-inside text-xs">
                    {importResult.erros.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              className="btn-primary flex-1"
              onClick={handleImport}
              disabled={!importColumns.nomes.trim() || importing}
            >
              {importing ? 'Processando...' : 'Importar e agendar'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setImportOpen(false);
                setImportResult(null);
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
