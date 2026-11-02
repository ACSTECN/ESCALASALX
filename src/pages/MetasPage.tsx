import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, RefreshCw, History, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { dbMetas, dbHubs, dbCidades, dbHistorico, dbColetas } from '@/lib/db';
import { toCSV, downloadFile } from '@/utils';
import type { MetaColeta, Hub, Cidade, HistoricoAlteracao } from '@/types';
import { DIAS_SEMANA, TURNOS, turnoLabel } from '@/types';
import { formatTime } from '@/utils';
import { formatISO, startOfWeek, addDays } from 'date-fns';
import { useAuthStore } from '@/store/auth';
import { canManageGoals } from '@/store/auth';

type TurnoForm = { turno: number; horario: string; meta: number; ativo: boolean };

const HORARIOS_PADRAO = ['08:00', '14:00', '18:00'];

const turnosPadrao = (): TurnoForm[] =>
  TURNOS.map((turno, i) => ({ turno, horario: HORARIOS_PADRAO[i] || '08:00', meta: 20, ativo: true }));

export function MetasPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = canManageGoals(user?.perfil);

  const [metas, setMetas] = useState<MetaColeta[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroCidade, setFiltroCidade] = useState<string>('');
  const [filtroHub, setFiltroHub] = useState<string>('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MetaColeta | null>(null);
  const [form, setForm] = useState({ hub_id: '' });
  const [turnos, setTurnos] = useState<TurnoForm[]>(turnosPadrao());
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([1]);
  const [periodo, setPeriodo] = useState({
    data_inicio: formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }), { representation: 'date' }),
    data_fim: formatISO(addDays(new Date(), 30), { representation: 'date' }),
  });

  // Replicar
  const [replicarMeta, setReplicarMeta] = useState<MetaColeta | null>(null);
  const [replicarDias, setReplicarDias] = useState<number[]>([]);

  // Histórico modal
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoMeta, setHistoricoMeta] = useState<MetaColeta | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<MetaColeta | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [m, h, c] = await Promise.all([dbMetas.list(), dbHubs.list(), dbCidades.list()]);
    setMetas((m.data as MetaColeta[]) || []);
    setHubs((h.data as Hub[]) || []);
    setCidades((c.data as Cidade[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (meta?: MetaColeta) => {
    setEditing(meta || null);
    if (meta) {
      const doDia = metas.filter((m) => m.hub_id === meta.hub_id && m.dia_semana === meta.dia_semana);
      setForm({ hub_id: meta.hub_id });
      setTurnos(
        TURNOS.map((turno, i) => {
          const existente = doDia.find((m) => m.turno === turno);
          return existente
            ? { turno, horario: existente.horario, meta: existente.meta, ativo: existente.ativo }
            : { turno, horario: HORARIOS_PADRAO[i] || '08:00', meta: 20, ativo: false };
        })
      );
      setDiasSelecionados([meta.dia_semana]);
    } else {
      setForm({ hub_id: hubs[0]?.id || '' });
      setTurnos(turnosPadrao());
      setDiasSelecionados([1]);
    }
    setModalOpen(true);
  };

  const setTurno = (turno: number, patch: Partial<TurnoForm>) => {
    setTurnos((prev) => prev.map((t) => (t.turno === turno ? { ...t, ...patch } : t)));
  };

  const save = async () => {
    if (!form.hub_id) return;
    if (diasSelecionados.length === 0) {
      alert('Selecione pelo menos um dia da semana.');
      return;
    }

    for (const dia of diasSelecionados) {
      for (const t of turnos) {
        const existente = metas.find(
          (m) => m.hub_id === form.hub_id && m.dia_semana === dia && m.turno === t.turno
        );

        if (existente) {
          if (existente.horario !== t.horario || existente.meta !== t.meta) {
            // Remove apenas as coletas ainda sem agendamento para recriar com o novo horário/meta
            await dbColetas.removeEmptyByMetaCriteriaInRange(
              form.hub_id,
              dia,
              t.turno,
              periodo.data_inicio,
              periodo.data_fim
            );
          }
          await dbMetas.update(existente.id, {
            hub_id: form.hub_id,
            dia_semana: dia,
            turno: t.turno,
            horario: t.horario,
            meta: t.meta,
            ativo: t.ativo,
          });
        } else if (t.ativo) {
          await dbMetas.create({
            hub_id: form.hub_id,
            dia_semana: dia,
            turno: t.turno,
            horario: t.horario,
            meta: t.meta,
            ativo: true,
          });
        }
      }
    }

    // Gera coletas automaticamente para o período selecionado
    await dbMetas.gerarRecorrentes(form.hub_id, periodo.data_inicio, periodo.data_fim);
    setModalOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Remove também as coletas geradas a partir desta meta
    await dbColetas.removeByMetaCriteria(deleteTarget.hub_id, deleteTarget.dia_semana, deleteTarget.turno);
    await dbMetas.remove(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    loadData();
  };

  const handleReplicar = async () => {
    if (!replicarMeta || replicarDias.length === 0) return;
    const origem = metas.filter(
      (m) => m.hub_id === replicarMeta.hub_id && m.dia_semana === replicarMeta.dia_semana
    );
    for (const dia of replicarDias) {
      if (dia === replicarMeta.dia_semana) continue;
      for (const t of origem) {
        const existente = metas.find(
          (m) => m.hub_id === replicarMeta.hub_id && m.dia_semana === dia && m.turno === t.turno
        );
        if (existente) {
          await dbMetas.update(existente.id, {
            horario: t.horario,
            meta: t.meta,
            ativo: t.ativo,
          });
        } else {
          await dbMetas.create({
            hub_id: replicarMeta.hub_id,
            dia_semana: dia,
            turno: t.turno,
            horario: t.horario,
            meta: t.meta,
            ativo: t.ativo,
          });
        }
      }
    }
    // Gera coletas automaticamente após replicar
    await dbMetas.gerarRecorrentes(replicarMeta.hub_id);
    setReplicarMeta(null);
    setReplicarDias([]);
    loadData();
  };

  const gerarColetas = async () => {
    await dbMetas.gerarRecorrentes(undefined, undefined, undefined);
    alert('Coletas geradas/atualizadas para os próximos 30 dias.');
  };

  const verHistorico = async (meta: MetaColeta) => {
    setHistoricoMeta(meta);
    const { data } = await dbHistorico.listByEntidade('metas_coletas', meta.id);
    setHistorico((data as HistoricoAlteracao[]) || []);
    setHistoricoOpen(true);
  };

  const hubsFiltrados = filtroCidade ? hubs.filter((h) => h.cidade_id === filtroCidade) : hubs;
  const metasFiltradas = metas.filter(
    (m) => (!filtroCidade || m.hub?.cidade_id === filtroCidade) && (!filtroHub || m.hub_id === filtroHub)
  );

  const exportarMetas = () => {
    const linhas = metasFiltradas.map((m) => ({
      'HUB': m.hub?.sigla || '',
      'Cidade': m.hub?.cidade?.nome || '',
      'Dia da semana': DIAS_SEMANA[m.dia_semana || 0],
      'Turno': turnoLabel(m.turno),
      'Horário': formatTime(m.horario),
      'Meta': m.meta,
      'Ativo': m.ativo ? 'Sim' : 'Não',
    }));
    downloadFile(toCSV(linhas), `metas_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div>
      <PageHeader
        title="Gestão de Metas"
        description="Defina metas de condutores por HUB, dia da semana e turno"
        actions={
          <>
            <button className="btn-secondary" onClick={exportarMetas}>
              <Download size={16} /> Exportar
            </button>
            {canEdit && (
              <>
                <button className="btn-secondary" onClick={gerarColetas}>
                  <RefreshCw size={16} /> Gerar Coletas
                </button>
                <button className="btn-primary" onClick={() => openModal()}>
                  <Plus size={16} /> Nova Meta
                </button>
              </>
            )}
          </>
        }
      />

      {/* Filtros */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Cidade</label>
            <select className="input" value={filtroCidade} onChange={(e) => { setFiltroCidade(e.target.value); setFiltroHub(''); }}>
              <option value="">Todas as cidades</option>
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">HUB</label>
            <select className="input" value={filtroHub} onChange={(e) => setFiltroHub(e.target.value)}>
              <option value="">Todos os HUBs</option>
              {hubsFiltrados.map((h) => <option key={h.id} value={h.id}>{h.sigla}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-secondary w-full" onClick={() => { setFiltroCidade(''); setFiltroHub(''); }}>
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Lista de metas */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : metasFiltradas.length === 0 ? (
          <EmptyState title="Nenhuma meta cadastrada" description="Crie uma meta de condutores para um HUB" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3">HUB</th>
                  <th className="text-left px-5 py-3">Cidade</th>
                  <th className="text-left px-5 py-3">Dia</th>
                  <th className="text-left px-5 py-3">Turno</th>
                  <th className="text-left px-5 py-3">Horário</th>
                  <th className="text-left px-5 py-3">Meta</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metasFiltradas.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{m.hub?.sigla}</td>
                    <td className="px-5 py-3 text-slate-600">{m.hub?.cidade?.nome}</td>
                    <td className="px-5 py-3 text-slate-600">{DIAS_SEMANA[m.dia_semana]}</td>
                    <td className="px-5 py-3">
                      <Badge variant="info">{turnoLabel(m.turno)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatTime(m.horario)}</td>
                    <td className="px-5 py-3">
                      <Badge variant="info">{m.meta} condutores</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={m.ativo ? 'success' : 'gray'}>{m.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn-ghost p-1.5" title="Histórico" onClick={() => verHistorico(m)}>
                          <History size={16} />
                        </button>
                        {canEdit && (
                          <>
                            <button className="btn-ghost p-1.5" title="Replicar para outros dias" onClick={() => { setReplicarMeta(m); setReplicarDias([]); }}>
                              <Copy size={16} />
                            </button>
                            <button className="btn-ghost p-1.5" onClick={() => openModal(m)}>
                              <Pencil size={16} />
                            </button>
                            <button className="btn-ghost p-1.5 text-red-500" onClick={() => setDeleteTarget(m)}>
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nova/Editar Meta */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Metas do Dia' : 'Nova Meta'}>
        <div className="space-y-4">
          <div>
            <label className="label">HUB</label>
            <select className="input" value={form.hub_id} onChange={(e) => setForm({ ...form, hub_id: e.target.value })}>
              <option value="">Selecione...</option>
              {hubs.map((h) => <option key={h.id} value={h.id}>{h.sigla} — {h.nome}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Dias da semana</label>
              {!editing && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => setDiasSelecionados(diasSelecionados.length === 7 ? [] : [0,1,2,3,4,5,6])}
                >
                  {diasSelecionados.length === 7 ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DIAS_SEMANA.map((d, i) => (
                <label key={i} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition ${
                  diasSelecionados.includes(i) ? 'bg-blue-50 border-blue-300' : 'hover:bg-slate-50'
                } ${editing && i !== diasSelecionados[0] ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={diasSelecionados.includes(i)}
                    onChange={(e) => {
                      if (editing) {
                        // Na edição, só permite um dia
                        setDiasSelecionados([i]);
                      } else {
                        setDiasSelecionados(e.target.checked ? [...diasSelecionados, i] : diasSelecionados.filter((x) => x !== i));
                      }
                    }}
                  />
                  <span className="text-sm text-slate-700">{d}</span>
                </label>
              ))}
            </div>
            {!editing && (
              <p className="text-xs text-slate-500 mt-1">Serão criadas as metas de cada turno ativo para todos os dias selecionados.</p>
            )}
          </div>
          <div>
            <label className="label">Período de vigência</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Data início</label>
                <input
                  type="date"
                  className="input mt-1"
                  value={periodo.data_inicio}
                  onChange={(e) => setPeriodo({ ...periodo, data_inicio: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Data fim</label>
                <input
                  type="date"
                  className="input mt-1"
                  value={periodo.data_fim}
                  onChange={(e) => setPeriodo({ ...periodo, data_fim: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              {[
                { label: 'Esta semana', dias: 7 },
                { label: '15 dias', dias: 15 },
                { label: '30 dias', dias: 30 },
                { label: '60 dias', dias: 60 },
              ].map((p) => (
                <button
                  key={p.dias}
                  type="button"
                  className="px-2.5 py-1 text-xs rounded-full border bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  onClick={() => {
                    const inicio = formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }), { representation: 'date' });
                    const fim = formatISO(addDays(new Date(), p.dias), { representation: 'date' });
                    setPeriodo({ data_inicio: inicio, data_fim: fim });
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">As coletas serão geradas apenas para os dias selecionados dentro deste período.</p>
          </div>
          <div>
            <label className="label">Turnos do dia</label>
            <div className="space-y-2">
              {turnos.map((t) => (
                <div
                  key={t.turno}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition ${
                    t.ativo ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-slate-50/60 opacity-80'
                  }`}
                >
                  <label className="flex items-center gap-2 min-w-[110px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={t.ativo}
                      onChange={(e) => setTurno(t.turno, { ativo: e.target.checked })}
                    />
                    <span className="text-sm font-semibold text-slate-700">{turnoLabel(t.turno)}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Horário</span>
                    <input
                      type="time"
                      className="input w-32"
                      value={t.horario}
                      disabled={!t.ativo}
                      onChange={(e) => setTurno(t.turno, { horario: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Meta</span>
                    <input
                      type="number"
                      min={0}
                      className="input w-24"
                      value={t.meta}
                      disabled={!t.ativo}
                      onChange={(e) => setTurno(t.turno, { meta: Number(e.target.value) })}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Cada turno ativo gera uma coleta por dia da semana, com o seu próprio horário e a sua própria meta.
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Horários:</span>
                {[
                  { label: '08 / 14 / 18', horarios: ['08:00', '14:00', '18:00'] },
                  { label: '07 / 13 / 19', horarios: ['07:00', '13:00', '19:00'] },
                  { label: '06 / 12 / 21', horarios: ['06:00', '12:00', '21:00'] },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="px-2.5 py-1 text-xs rounded-full border bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    onClick={() => setTurnos((prev) => prev.map((t, i) => ({ ...t, horario: p.horarios[i] || t.horario })))}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Meta:</span>
                {[10, 15, 20, 25, 28, 30, 32, 35, 40].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="px-2.5 py-1 text-xs rounded-full border bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    onClick={() => setTurnos((prev) => prev.map((t) => ({ ...t, meta: m })))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </div>
        </div>
      </Modal>

      {/* Modal Replicar */}
      <Modal open={!!replicarMeta} onClose={() => setReplicarMeta(null)} title="Replicar meta para outros dias">
        {replicarMeta && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Replicar as metas de <strong>{replicarMeta.hub?.sigla} — {DIAS_SEMANA[replicarMeta.dia_semana]}</strong> (todos os turnos do dia) para:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DIAS_SEMANA.map((d, i) => (
                <label key={i} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={replicarDias.includes(i)}
                    onChange={(e) => {
                      setReplicarDias(e.target.checked ? [...replicarDias, i] : replicarDias.filter((x) => x !== i));
                    }}
                    disabled={i === replicarMeta.dia_semana}
                  />
                  <span className={`text-sm ${i === replicarMeta.dia_semana ? 'text-slate-400' : 'text-slate-700'}`}>
                    {d}{i === replicarMeta.dia_semana && ' (atual)'}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setReplicarMeta(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleReplicar} disabled={replicarDias.length === 0}>Replicar</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Histórico */}
      <Modal open={historicoOpen} onClose={() => setHistoricoOpen(false)} title="Histórico de alterações" size="lg">
        {historicoMeta && historico.length === 0 ? (
          <EmptyState title="Sem alterações registradas" />
        ) : (
          <div className="space-y-3">
            {historico.map((h) => (
              <div key={h.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant={h.acao === 'create' ? 'success' : h.acao === 'delete' ? 'danger' : 'info'}>{h.acao}</Badge>
                  <span className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-xs text-slate-600">Usuário: {h.usuario?.nome || 'Sistema'}</p>
                {h.depois && (
                  <pre className="mt-2 text-xs bg-slate-50 p-2 rounded overflow-x-auto">{JSON.stringify(h.depois, null, 2).slice(0, 500)}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir meta"
        message={`Deseja excluir a meta ${deleteTarget?.hub?.sigla} - ${DIAS_SEMANA[deleteTarget?.dia_semana || 0]} - ${turnoLabel(deleteTarget?.turno)} às ${deleteTarget ? formatTime(deleteTarget.horario) : ''}? Todas as coletas geradas a partir desta meta também serão removidas.`}
        confirmLabel="Excluir tudo"
        loading={deleting}
      />
    </div>
  );
}
