import { useEffect, useState, useMemo } from 'react';
import {
  RefreshCw,
  Download,
  CheckSquare,
  Square,
  X,
  Check,
  Ban,
  Trash2,
  Clock,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Hourglass,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  dbInteresses,
  dbCidades,
  dbHubs,
  dbColetas,
  dbCondutores,
  dbAgendamentos,
  calcColetaStats,
} from '@/lib/db';
import { toCSV, downloadFile, formatDateBR, formatTime } from '@/utils';
import type {
  InteresseEntregador,
  StatusInteresse,
  Cidade,
  Hub,
  Coleta,
} from '@/types';
import { DIAS_SEMANA, STATUS_INTERESSE_LABELS } from '@/types';
import { useAuthStore, canWrite } from '@/store/auth';

const badgeVariant: Record<StatusInteresse, 'warning' | 'success' | 'danger'> = {
  pendente: 'warning',
  aprovado: 'success',
  recusado: 'danger',
};

const diaSemana = (data: string) => {
  if (!data) return '';
  return DIAS_SEMANA[new Date(data + 'T00:00:00').getDay()];
};

const normalizarNome = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const labelIntegracao = (fezIntegracao: boolean | null) => {
  if (fezIntegracao === true) return 'Já fez';
  if (fezIntegracao === false) return 'Não fez';
  return 'Não informado';
};

export function ListaEsperaPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = canWrite(user?.perfil);

  const [interesses, setInteresses] = useState<InteresseEntregador[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroHub, setFiltroHub] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusInteresse | ''>('');
  const [busca, setBusca] = useState('');

  // Seleção múltipla
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Aprovação
  const [approveTarget, setApproveTarget] = useState<InteresseEntregador | null>(null);
  const [coletasDisponiveis, setColetasDisponiveis] = useState<Coleta[]>([]);
  const [loadingColetas, setLoadingColetas] = useState(false);
  const [selectedColetaId, setSelectedColetaId] = useState('');
  const [erroAprovacao, setErroAprovacao] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [i, cid, h] = await Promise.all([
      dbInteresses.list(),
      dbCidades.listAtivas(),
      dbHubs.listAtivos(),
    ]);
    setInteresses((i.data as InteresseEntregador[]) || []);
    setCidades((cid.data as Cidade[]) || []);
    setHubs((h.data as Hub[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const hubsFiltro = filtroCidade ? hubs.filter((h) => h.cidade_id === filtroCidade) : hubs;
  const cidadeMap = useMemo(() => new Map(cidades.map((c) => [c.id, c.nome])), [cidades]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return interesses.filter((it) => {
      if (filtroCidade && it.hub?.cidade_id !== filtroCidade) return false;
      if (filtroHub && it.hub_id !== filtroHub) return false;
      if (filtroData && it.data_interesse !== filtroData) return false;
      if (filtroStatus && it.status !== filtroStatus) return false;
      if (termo) {
        const hay = `${it.nome} ${it.cpf} ${it.telefone || ''} ${labelIntegracao(it.fez_integracao)}`.toLowerCase();
        if (!hay.includes(termo)) return false;
      }
      return true;
    });
  }, [interesses, filtroCidade, filtroHub, filtroData, filtroStatus, busca]);

  const kpis = useMemo(() => {
    return {
      total: filtrados.length,
      pendentes: filtrados.filter((i) => i.status === 'pendente').length,
      aprovados: filtrados.filter((i) => i.status === 'aprovado').length,
      recusados: filtrados.filter((i) => i.status === 'recusado').length,
    };
  }, [filtrados]);

  const limparFiltros = () => {
    setFiltroCidade('');
    setFiltroHub('');
    setFiltroData('');
    setFiltroStatus('');
    setBusca('');
  };

  const temFiltro = !!(filtroCidade || filtroHub || filtroData || filtroStatus || busca);

  // ---- Seleção múltipla ----
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtrados.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtrados.map((i) => i.id)));
  };

  const recusar = async (id: string) => {
    const { error } = await dbInteresses.updateStatus(id, 'recusado');
    if (!error) setInteresses((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'recusado' } : i)));
  };

  const excluir = async (id: string) => {
    const { error } = await dbInteresses.remove(id);
    if (!error) setInteresses((prev) => prev.filter((i) => i.id !== id));
  };

  const aplicarRecusaEmLote = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setProcessing(true);
    await Promise.all(ids.map((id) => dbInteresses.updateStatus(id, 'recusado')));
    setInteresses((prev) => prev.map((i) => (selectedIds.has(i.id) ? { ...i, status: 'recusado' } : i)));
    setSelectedIds(new Set());
    setSelectionMode(false);
    setProcessing(false);
  };

  const removerSelecionados = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setProcessing(true);
    await Promise.all(ids.map((id) => dbInteresses.remove(id)));
    setInteresses((prev) => prev.filter((i) => !selectedIds.has(i.id)));
    setSelectedIds(new Set());
    setSelectionMode(false);
    setProcessing(false);
    setConfirmBulkRemove(false);
  };

  // ---- Aprovação ----
  const abrirAprovar = async (item: InteresseEntregador) => {
    setApproveTarget(item);
    setSelectedColetaId('');
    setErroAprovacao('');
    setColetasDisponiveis([]);
    setLoadingColetas(true);
    const { data } = await dbColetas.listByDate(item.data_interesse);
    const doHub = ((data as Coleta[]) || []).filter((c) => c.hub_id === item.hub_id);
    setColetasDisponiveis(doHub);
    if (doHub.length === 1) setSelectedColetaId(doHub[0].id);
    setLoadingColetas(false);
  };

  const confirmarAprovacao = async () => {
    if (!approveTarget || !selectedColetaId) return;
    setProcessing(true);
    setErroAprovacao('');

    // 1. Localizar ou criar condutor pelo CPF
    let condutorId: string;
    const { data: existente } = await dbCondutores.findByCpf(approveTarget.cpf);
    if (existente) {
      condutorId = existente.id;
      // Completa telefone se estiver vazio
      if (!existente.telefone && approveTarget.telefone) {
        await dbCondutores.update(existente.id, { telefone: approveTarget.telefone });
      }
    } else {
      const { data: novo, error } = await dbCondutores.create({
        nome_completo: approveTarget.nome,
        cpf: approveTarget.cpf,
        telefone: approveTarget.telefone,
        hub_id: approveTarget.hub_id,
        cidade_id: approveTarget.hub?.cidade_id || null,
        status: 'ativo',
      });
      if (error || !novo) {
        setErroAprovacao('Não foi possível cadastrar o condutor. Tente novamente.');
        setProcessing(false);
        return;
      }
      condutorId = novo.id;
    }

    // 2. Evitar agendamento duplicado na coleta
    const { data: ags } = await dbAgendamentos.listByColeta(selectedColetaId);
    const agendamentosColeta = (ags as { condutor_id: string; status: string; condutor?: { nome_completo?: string } }[]) || [];
    const nomeJaExiste = agendamentosColeta.some(
      (a) =>
        a.status !== 'cancelado' &&
        normalizarNome(a.condutor?.nome_completo || '') === normalizarNome(approveTarget.nome)
    );

    if (nomeJaExiste) {
      setErroAprovacao('Já existe um agendamento com este nome nesta coleta.');
      setProcessing(false);
      return;
    }

    const jaTem = agendamentosColeta.some(
      (a) => a.condutor_id === condutorId && a.status !== 'cancelado'
    );

    if (!jaTem) {
      const { error: errAg } = await dbAgendamentos.create({
        coleta_id: selectedColetaId,
        condutor_id: condutorId,
        status: 'agendado',
      });
      if (errAg) {
        setErroAprovacao('Não foi possível gerar o agendamento. Tente novamente.');
        setProcessing(false);
        return;
      }
    }

    // 3. Marcar interesse como aprovado
    await dbInteresses.updateStatus(approveTarget.id, 'aprovado');
    setInteresses((prev) =>
      prev.map((i) => (i.id === approveTarget.id ? { ...i, status: 'aprovado' } : i))
    );

    setProcessing(false);
    setApproveTarget(null);
  };

  const exportar = () => {
    const linhas = filtrados.map((i) => ({
      Nome: i.nome,
      CPF: i.cpf,
      Telefone: i.telefone || '',
      'Primeira Integração': labelIntegracao(i.fez_integracao),
      Cidade: i.hub?.cidade?.nome || cidadeMap.get(i.hub?.cidade_id || '') || '',
      HUB: i.hub?.sigla || '',
      Data: formatDateBR(i.data_interesse),
      'Dia da Semana': diaSemana(i.data_interesse),
      Status: STATUS_INTERESSE_LABELS[i.status],
      Observação: i.observacao || '',
      'Registrado em': new Date(i.created_at).toLocaleString('pt-BR'),
    }));
    if (linhas.length === 0) return;
    downloadFile(toCSV(linhas), `lista-espera-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lista de Espera"
        description="Interesses enviados pelos entregadores no link público de coletas."
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={loadData} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button className="btn-secondary" onClick={exportar} disabled={filtrados.length === 0}>
              <Download size={16} />
              Exportar
            </button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <Users size={14} /> Total
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{kpis.total}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-medium">
            <Hourglass size={14} /> Pendentes
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{kpis.pendentes}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
            <CheckCircle2 size={14} /> Aprovados
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{kpis.aprovados}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-red-600 text-xs font-medium">
            <XCircle size={14} /> Recusados
          </div>
          <div className="text-2xl font-bold text-red-600 mt-1">{kpis.recusados}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Nome, CPF ou telefone"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <select
            className="input"
            value={filtroCidade}
            onChange={(e) => {
              setFiltroCidade(e.target.value);
              setFiltroHub('');
            }}
          >
            <option value="">Todas as cidades</option>
            {cidades.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select className="input" value={filtroHub} onChange={(e) => setFiltroHub(e.target.value)}>
            <option value="">Todos os HUBs</option>
            {hubsFiltro.map((h) => (
              <option key={h.id} value={h.id}>{h.sigla} — {h.nome}</option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
          />
          <select
            className="input"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as StatusInteresse | '')}
          >
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option>
          </select>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{filtrados.length} registro(s)</span>
            {temFiltro && (
              <button className="text-brand-600 hover:underline" onClick={limparFiltros}>
                Limpar filtros
              </button>
            )}
          </div>
          {canEdit && filtrados.length > 0 && (
            <button
              className="btn-ghost text-sm"
              onClick={() => {
                setSelectionMode((v) => !v);
                setSelectedIds(new Set());
              }}
            >
              {selectionMode ? <><X size={16} /> Cancelar seleção</> : <><CheckSquare size={16} /> Selecionar vários</>}
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<Users size={32} />}
            title="Nenhum interesse encontrado"
            description={temFiltro ? 'Ajuste os filtros para ver outros resultados.' : 'Ainda não há interesses registrados.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  {selectionMode && (
                    <th className="px-3 py-3 w-10">
                      <button onClick={toggleSelectAll} className="text-slate-500 hover:text-brand-600">
                        {selectedIds.size === filtrados.length && filtrados.length > 0 ? (
                          <CheckSquare size={18} />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-medium">Entregador</th>
                  <th className="px-4 py-3 text-left font-medium">Integração</th>
                  <th className="px-4 py-3 text-left font-medium">HUB</th>
                  <th className="px-4 py-3 text-left font-medium">Cidade</th>
                  <th className="px-4 py-3 text-left font-medium">Dia</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((i) => {
                  const selected = selectedIds.has(i.id);
                  return (
                    <tr key={i.id} className={selected ? 'bg-brand-50/60' : 'hover:bg-slate-50'}>
                      {selectionMode && (
                        <td className="px-3 py-3">
                          <button onClick={() => toggleSelect(i.id)} className="text-slate-500 hover:text-brand-600">
                            {selected ? <CheckSquare size={18} className="text-brand-600" /> : <Square size={18} />}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{i.nome}</div>
                        <div className="text-xs text-slate-500">
                          CPF {i.cpf}
                          {i.telefone ? ` · ${i.telefone}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{labelIntegracao(i.fez_integracao)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-700">{i.hub?.sigla || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {i.hub?.cidade?.nome || cidadeMap.get(i.hub?.cidade_id || '') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{formatDateBR(i.data_interesse)}</div>
                        <div className="text-xs text-slate-500">{diaSemana(i.data_interesse)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant[i.status]}>{STATUS_INTERESSE_LABELS[i.status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && i.status !== 'aprovado' && (
                            <button
                              className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
                              title="Aprovar e agendar"
                              onClick={() => abrirAprovar(i)}
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {canEdit && i.status !== 'recusado' && (
                            <button
                              className="p-2 rounded-lg text-amber-600 hover:bg-amber-50"
                              title="Recusar"
                              onClick={() => recusar(i.id)}
                            >
                              <Ban size={16} />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                              title="Excluir"
                              onClick={() => excluir(i.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Barra flutuante de seleção */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
          <div className="w-px h-6 bg-slate-700" />
          <button
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600"
            onClick={aplicarRecusaEmLote}
            disabled={processing}
          >
            <Ban size={15} /> Recusar
          </button>
          <button
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700"
            onClick={() => setConfirmBulkRemove(true)}
            disabled={processing}
          >
            <Trash2 size={15} /> Excluir
          </button>
          <button className="text-slate-400 hover:text-white" onClick={() => setSelectedIds(new Set())}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Modal de aprovação */}
      <Modal open={!!approveTarget} onClose={() => setApproveTarget(null)} title="Aprovar interesse" size="md">
        {approveTarget && (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
              <div className="font-semibold text-slate-800">{approveTarget.nome}</div>
              <div className="text-slate-500">CPF {approveTarget.cpf}{approveTarget.telefone ? ` · ${approveTarget.telefone}` : ''}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-brand-600" />
                  {approveTarget.hub?.sigla} — {approveTarget.hub?.nome}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-brand-600" />
                  {formatDateBR(approveTarget.data_interesse)} · {diaSemana(approveTarget.data_interesse)}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Integração: {labelIntegracao(approveTarget.fez_integracao)}
                </span>
              </div>
            </div>

            <div>
              <label className="label">Selecione o horário (coleta) *</label>
              {loadingColetas ? (
                <div className="text-sm text-slate-500 py-3">Carregando horários...</div>
              ) : coletasDisponiveis.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                  Não há coleta cadastrada para este HUB nesta data. Crie a coleta no calendário antes de aprovar.
                </div>
              ) : (
                <div className="space-y-2">
                  {coletasDisponiveis
                    .slice()
                    .sort((a, b) => a.horario.localeCompare(b.horario))
                    .map((c) => {
                      const { agendados, vagas } = calcColetaStats(c);
                      const selecionada = selectedColetaId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedColetaId(c.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                            selecionada
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <Clock size={15} />
                            {formatTime(c.horario)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {agendados}/{c.meta} agendados · {vagas} vaga(s)
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {erroAprovacao && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {erroAprovacao}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setApproveTarget(null)} disabled={processing}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={confirmarAprovacao}
                disabled={processing || !selectedColetaId}
              >
                <Check size={16} />
                Aprovar e agendar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmBulkRemove}
        title="Excluir interesses"
        message={`Deseja excluir permanentemente ${selectedIds.size} interesse(s)? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={removerSelecionados}
        onClose={() => setConfirmBulkRemove(false)}
      />
    </div>
  );
}
