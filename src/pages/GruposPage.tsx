import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  X,
  Layers,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { dbGrupos, dbCondutores, dbHubs } from '@/lib/db';
import type { Grupo, Condutor, Hub, GrupoCondutor } from '@/types';
import { DIAS_SEMANA_CURTO, TURNOS, turnoLabel } from '@/types';
import { useAuthStore, canWrite } from '@/store/auth';

const apenasDigitos = (v: string | null | undefined) => (v || '').replace(/\D/g, '');

const normalizarCpf = (v: string) => {
  const d = v.replace(/\D/g, '');
  return d.length === 11 ? d : null;
};

interface GrupoComVinculos extends Grupo {
  vinculos?: { condutor_id: string }[];
}

export function GruposPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = canWrite(user?.perfil);

  const [grupos, setGrupos] = useState<GrupoComVinculos[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [condutores, setCondutores] = useState<Condutor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<string[]>([]);

  // Modal criar/editar grupo
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Grupo | null>(null);
  const [form, setForm] = useState<{
    nome: string;
    hub_id: string;
    dias: number[];
    turnos: number[];
    ativo: boolean;
    observacao: string;
  }>({ nome: '', hub_id: '', dias: [], turnos: [], ativo: true, observacao: '' });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Exclusão
  const [deleteTarget, setDeleteTarget] = useState<Grupo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal vincular entregadores (colar CPFs)
  const [gerirGrupo, setGerirGrupo] = useState<Grupo | null>(null);
  const [vinculados, setVinculados] = useState<GrupoCondutor[]>([]);
  const [loadingVinculos, setLoadingVinculos] = useState(false);
  const [colarCpfs, setColarCpfs] = useState('');
  const [salvandoVinculos, setSalvandoVinculos] = useState(false);
  const [resultadoVinculo, setResultadoVinculo] = useState<{
    vinculados: number;
    naoEncontrados: string[];
  } | null>(null);
  const [buscaVinculado, setBuscaVinculado] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [g, h, c] = await Promise.all([
      dbGrupos.list(),
      dbHubs.listAtivos(),
      dbCondutores.list(),
    ]);
    setGrupos((g.data as GrupoComVinculos[]) || []);
    setHubs((h.data as Hub[]) || []);
    setCondutores((c.data as Condutor[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const condutorPorCpf = useMemo(() => {
    const map = new Map<string, Condutor>();
    for (const c of condutores) {
      const d = apenasDigitos(c.cpf);
      if (d.length === 11) map.set(d, c);
    }
    return map;
  }, [condutores]);

  const gruposFiltrados = useMemo(() => {
    const termo = search.trim().toLowerCase();
    if (!termo) return grupos;
    return grupos.filter(
      (g) =>
        g.nome.toLowerCase().includes(termo) ||
        (g.hub?.sigla || '').toLowerCase().includes(termo) ||
        (g.hub?.nome || '').toLowerCase().includes(termo)
    );
  }, [grupos, search]);

  const toggleAberto = (id: string) =>
    setAbertos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const openModal = (grupo?: Grupo) => {
    setErro(null);
    setEditing(grupo || null);
    setForm(
      grupo
        ? {
            nome: grupo.nome,
            hub_id: grupo.hub_id,
            dias: [...(grupo.dias || [])],
            turnos: [...(grupo.turnos || [])],
            ativo: grupo.ativo,
            observacao: grupo.observacao || '',
          }
        : { nome: '', hub_id: '', dias: [], turnos: [1], ativo: true, observacao: '' }
    );
    setModalOpen(true);
  };

  const toggleDia = (dia: number) =>
    setForm((f) => ({
      ...f,
      dias: f.dias.includes(dia) ? f.dias.filter((d) => d !== dia) : [...f.dias, dia].sort(),
    }));

  const toggleTurno = (turno: number) =>
    setForm((f) => ({
      ...f,
      turnos: f.turnos.includes(turno)
        ? f.turnos.filter((t) => t !== turno)
        : [...f.turnos, turno].sort(),
    }));

  const save = async () => {
    if (!form.nome.trim()) return setErro('Informe o nome do grupo.');
    if (!form.hub_id) return setErro('Selecione o HUB do grupo.');
    if (form.dias.length === 0) return setErro('Selecione ao menos um dia da semana.');
    if (form.turnos.length === 0) return setErro('Selecione ao menos um turno.');

    setSaving(true);
    setErro(null);
    const payload = {
      nome: form.nome.trim(),
      hub_id: form.hub_id,
      dias: form.dias,
      turnos: form.turnos,
      ativo: form.ativo,
      observacao: form.observacao.trim() || null,
    };
    const { error } = editing
      ? await dbGrupos.update(editing.id, payload)
      : await dbGrupos.create(payload);
    setSaving(false);

    if (error) {
      setErro(error.message);
      return;
    }
    setModalOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await dbGrupos.remove(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    loadData();
  };

  const abrirVincular = async (grupo: Grupo) => {
    setGerirGrupo(grupo);
    setColarCpfs('');
    setResultadoVinculo(null);
    setBuscaVinculado('');
    setLoadingVinculos(true);
    const { data } = await dbGrupos.listCondutores(grupo.id);
    setVinculados((data as GrupoCondutor[]) || []);
    setLoadingVinculos(false);
  };

  const aplicarLista = async () => {
    if (!gerirGrupo) return;
    const tokens = colarCpfs
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      setResultadoVinculo({ vinculados: 0, naoEncontrados: [] });
      return;
    }

    const ids = new Set<string>();
    const naoEncontrados: string[] = [];
    for (const token of tokens) {
      const cpf = normalizarCpf(token);
      const condutor = cpf ? condutorPorCpf.get(cpf) : undefined;
      if (condutor) ids.add(condutor.id);
      else naoEncontrados.push(token);
    }

    if (ids.size === 0) {
      setResultadoVinculo({ vinculados: 0, naoEncontrados });
      return;
    }

    setSalvandoVinculos(true);
    await dbGrupos.addCondutores(gerirGrupo.id, Array.from(ids));
    const { data } = await dbGrupos.listCondutores(gerirGrupo.id);
    setVinculados((data as GrupoCondutor[]) || []);
    setSalvandoVinculos(false);
    setColarCpfs('');
    setResultadoVinculo({ vinculados: ids.size, naoEncontrados });
    loadData();
  };

  const removerVinculo = async (condutorId: string) => {
    if (!gerirGrupo) return;
    await dbGrupos.removeCondutor(gerirGrupo.id, condutorId);
    setVinculados((prev) => prev.filter((v) => v.condutor_id !== condutorId));
    loadData();
  };

  const vinculadosFiltrados = useMemo(() => {
    const termo = buscaVinculado.trim().toLowerCase();
    if (!termo) return vinculados;
    return vinculados.filter((v) => {
      const c = v.condutor;
      return (
        (c?.nome_completo || '').toLowerCase().includes(termo) ||
        (c?.cpf || '').includes(termo) ||
        (c?.codigo || '').toLowerCase().includes(termo)
      );
    });
  }, [vinculados, buscaVinculado]);

  return (
    <div>
      <PageHeader
        title="Grupos de Entregadores"
        description="Defina o HUB, os dias e os turnos elegíveis. O entregador só vê e pega o que estiver liberado para o grupo dele."
        actions={
          canEdit && (
            <button className="btn-primary" onClick={() => openModal()}>
              <Plus size={16} /> Novo Grupo
            </button>
          )
        }
      />

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nome do grupo ou HUB..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : gruposFiltrados.length === 0 ? (
          <EmptyState
            icon={<Layers size={36} />}
            title="Nenhum grupo criado"
            description="Crie um grupo, defina HUB, dias e turnos e cole a lista de CPFs dos entregadores."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {gruposFiltrados.map((grupo) => {
              const qtd = grupo.vinculos?.length || 0;
              const aberto = abertos.includes(grupo.id);
              return (
                <div key={grupo.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                        <Layers size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{grupo.nome}</span>
                          <Badge variant={grupo.ativo ? 'success' : 'gray'}>
                            {grupo.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                            HUB {grupo.hub?.sigla || '—'}
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {(grupo.dias || [])
                              .slice()
                              .sort()
                              .map((d) => (
                                <span
                                  key={d}
                                  className="rounded-md bg-cyan-50 px-1.5 py-0.5 font-medium text-cyan-700"
                                >
                                  {DIAS_SEMANA_CURTO[d]}
                                </span>
                              ))}
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {(grupo.turnos || [])
                              .slice()
                              .sort()
                              .map((t) => (
                                <span
                                  key={t}
                                  className="rounded-md bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700"
                                >
                                  {turnoLabel(t)}
                                </span>
                              ))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                        onClick={() => toggleAberto(grupo.id)}
                      >
                        <Users size={14} /> {qtd} entregador(es)
                        <span className="text-slate-400">{aberto ? '▲' : '▼'}</span>
                      </button>
                      {canEdit && (
                        <>
                          <button
                            className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                            onClick={() => abrirVincular(grupo)}
                          >
                            <UserPlus size={14} /> Colar CPFs
                          </button>
                          <button className="btn-ghost p-1.5" onClick={() => openModal(grupo)}>
                            <Pencil size={16} />
                          </button>
                          <button
                            className="btn-ghost p-1.5 text-red-500"
                            onClick={() => setDeleteTarget(grupo)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {aberto && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {qtd === 0 ? (
                        <p className="text-xs text-slate-500">
                          Nenhum entregador vinculado. Use "Colar CPFs" para liberar a agenda.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {qtd} entregador(es) elegível(is). Abra "Colar CPFs" para ver e gerenciar a lista.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal criar/editar grupo */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Grupo' : 'Novo Grupo'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nome do grupo</label>
              <input
                className="input"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Grupo Manhã HUB 01"
              />
            </div>
            <div>
              <label className="label">HUB</label>
              <select
                className="input"
                value={form.hub_id}
                onChange={(e) => setForm({ ...form, hub_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.sigla} — {h.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Dias da semana elegíveis</label>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA_CURTO.map((label, dia) => {
                const ativo = form.dias.includes(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDia(dia)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      ativo
                        ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
                        : 'border-slate-200 text-slate-600 hover:border-cyan-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Turnos elegíveis</label>
            <div className="flex flex-wrap gap-2">
              {TURNOS.map((turno) => {
                const ativo = form.turnos.includes(turno);
                return (
                  <button
                    key={turno}
                    type="button"
                    onClick={() => toggleTurno(turno)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      ativo
                        ? 'border-violet-300 bg-violet-50 text-violet-700'
                        : 'border-slate-200 text-slate-600 hover:border-violet-300'
                    }`}
                  >
                    {turnoLabel(turno)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Observação</label>
            <textarea
              className="input"
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Detalhes do grupo..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="grupo-ativo"
              type="checkbox"
              className="h-4 w-4"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            <label htmlFor="grupo-ativo" className="text-sm text-slate-700">
              Grupo ativo (libera a agenda para os vinculados)
            </label>
          </div>

          {erro && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal vincular entregadores por CPF */}
      <Modal
        open={!!gerirGrupo}
        onClose={() => setGerirGrupo(null)}
        title={gerirGrupo ? `Entregadores do grupo ${gerirGrupo.nome}` : 'Entregadores do grupo'}
        size="lg"
      >
        {gerirGrupo && (
          <div className="space-y-5">
            <div>
              <label className="label">Colar lista de CPFs</label>
              <textarea
                className="input font-mono text-xs"
                rows={5}
                value={colarCpfs}
                onChange={(e) => setColarCpfs(e.target.value)}
                placeholder={'Cole aqui os CPFs (um por linha, ou separados por vírgula/espaço)\nEx.:\n123.456.789-00\n98765432100'}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Só entram os CPFs que já existem no cadastro de condutores. Os demais são listados como não encontrados.
                </p>
                <button
                  className="btn-primary !py-1.5 !px-3 text-xs whitespace-nowrap"
                  onClick={aplicarLista}
                  disabled={salvandoVinculos || !colarCpfs.trim()}
                >
                  {salvandoVinculos ? 'Vinculando...' : 'Vincular CPFs'}
                </button>
              </div>

              {resultadoVinculo && (
                <div className="mt-3 space-y-2">
                  {resultadoVinculo.vinculados > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{resultadoVinculo.vinculados} entregador(es) vinculado(s) ao grupo.</span>
                    </div>
                  )}
                  {resultadoVinculo.naoEncontrados.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                      <div>
                        <p>{resultadoVinculo.naoEncontrados.length} CPF(s) não encontrado(s) no cadastro:</p>
                        <p className="mt-1 break-all font-mono text-xs">
                          {resultadoVinculo.naoEncontrados.join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vinculados ({vinculados.length})
                </div>
                <div className="relative w-56">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input py-1.5 pl-8 text-xs"
                    placeholder="Buscar vinculado..."
                    value={buscaVinculado}
                    onChange={(e) => setBuscaVinculado(e.target.value)}
                  />
                </div>
              </div>

              {loadingVinculos ? (
                <p className="text-xs text-slate-500">Carregando...</p>
              ) : vinculadosFiltrados.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum entregador vinculado a este grupo.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {vinculadosFiltrados.map((v) => (
                    <span
                      key={v.condutor_id}
                      className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs text-brand-800"
                    >
                      <span>
                        {v.condutor?.nome_completo || 'Condutor'}
                        {v.condutor?.cpf ? ` · ${v.condutor.cpf}` : ''}
                      </span>
                      {canEdit && (
                        <button
                          className="text-brand-400 hover:text-red-500"
                          title="Remover do grupo"
                          onClick={() => removerVinculo(v.condutor_id)}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button className="btn-secondary" onClick={() => setGerirGrupo(null)}>
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir grupo"
        message={`Cuidado: excluir o grupo ${deleteTarget?.nome || ''}? Os entregadores continuam cadastrados, mas deixam de ver essa agenda. Essa ação é definitiva.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </div>
  );
}
