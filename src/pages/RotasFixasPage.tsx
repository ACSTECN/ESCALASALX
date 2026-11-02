import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Users, X, Route as RouteIcon, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { dbRotasFixas, dbCondutores, dbHubs } from '@/lib/db';
import type { RotaFixa, Condutor, Hub } from '@/types';
import { useAuthStore, canWrite } from '@/store/auth';

export function RotasFixasPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = canWrite(user?.perfil);

  const [rotas, setRotas] = useState<RotaFixa[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [condutores, setCondutores] = useState<Condutor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal criar/editar rota
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RotaFixa | null>(null);
  const [form, setForm] = useState({
    sigla: '',
    nome: '',
    hub_id: '',
    ativo: true,
    observacao: '',
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Exclusão
  const [deleteTarget, setDeleteTarget] = useState<RotaFixa | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Gestão de entregadores da rota
  const [gerirRota, setGerirRota] = useState<RotaFixa | null>(null);
  const [buscaCondutor, setBuscaCondutor] = useState('');
  const [rotaAbertaIds, setRotaAbertaIds] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    const [r, h, c] = await Promise.all([
      dbRotasFixas.list(),
      dbHubs.listAtivos(),
      dbCondutores.listAtivos(),
    ]);
    setRotas(
      ((r.data as (RotaFixa & { condutores?: { id: string }[] })[]) || []).map((rota) => ({
        ...rota,
        condutores_count: rota.condutores?.length || 0,
      }))
    );
    setHubs((h.data as Hub[]) || []);
    setCondutores((c.data as Condutor[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const rotasFiltradas = useMemo(() => {
    const termo = search.trim().toLowerCase();
    if (!termo) return rotas;
    return rotas.filter(
      (r) =>
        r.sigla.toLowerCase().includes(termo) ||
        (r.nome || '').toLowerCase().includes(termo) ||
        (r.hub?.sigla || '').toLowerCase().includes(termo)
    );
  }, [rotas, search]);

  const condutoresDaRota = useMemo(() => {
    const map = new Map<string, Condutor[]>();
    for (const c of condutores) {
      if (!c.rota_fixa_id) continue;
      const lista = map.get(c.rota_fixa_id) || [];
      lista.push(c);
      map.set(c.rota_fixa_id, lista);
    }
    return map;
  }, [condutores]);

  const openModal = (rota?: RotaFixa) => {
    setErro(null);
    setEditing(rota || null);
    setForm(
      rota
        ? {
            sigla: rota.sigla,
            nome: rota.nome || '',
            hub_id: rota.hub_id || '',
            ativo: rota.ativo,
            observacao: rota.observacao || '',
          }
        : { sigla: '', nome: '', hub_id: '', ativo: true, observacao: '' }
    );
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.sigla.trim()) {
      setErro('Informe a sigla da rota.');
      return;
    }
    setSaving(true);
    setErro(null);

    const payload = {
      sigla: form.sigla.trim().toUpperCase(),
      nome: form.nome.trim() || null,
      hub_id: form.hub_id || null,
      ativo: form.ativo,
      observacao: form.observacao.trim() || null,
    };

    const { error } = editing
      ? await dbRotasFixas.update(editing.id, payload)
      : await dbRotasFixas.create(payload);

    setSaving(false);

    if (error) {
      setErro(
        error.message.toLowerCase().includes('uq_rotas_fixas_sigla') || error.code === '23505'
          ? 'Já existe uma rota com essa sigla.'
          : error.message
      );
      return;
    }

    setModalOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await dbRotasFixas.remove(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    loadData();
  };

  const vincularCondutor = async (condutorId: string, rotaId: string) => {
    await dbCondutores.update(condutorId, { rota_fixa_id: rotaId });
    loadData();
  };

  const desvincularCondutor = async (condutorId: string) => {
    await dbCondutores.update(condutorId, { rota_fixa_id: null });
    loadData();
  };

  const toggleRotaAberta = (rotaId: string) => {
    setRotaAbertaIds((prev) =>
      prev.includes(rotaId) ? prev.filter((id) => id !== rotaId) : [...prev, rotaId]
    );
  };

  const candidatos = useMemo(() => {
    if (!gerirRota) return [];
    const termo = buscaCondutor.trim().toLowerCase();
    return condutores
      .filter((c) => c.rota_fixa_id !== gerirRota.id)
      .filter(
        (c) =>
          !termo ||
          c.nome_completo.toLowerCase().includes(termo) ||
          (c.cpf || '').includes(termo) ||
          (c.telefone || '').includes(termo)
      )
      .slice(0, 40);
  }, [condutores, gerirRota, buscaCondutor]);

  return (
    <div>
      <PageHeader
        title="Rotas Fixas"
        description="Cadastre as rotas fixas, defina a sigla e vincule os entregadores de cada rota"
        actions={
          canEdit && (
            <button className="btn-primary" onClick={() => openModal()}>
              <Plus size={16} /> Nova Rota
            </button>
          )
        }
      />

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por sigla, nome ou HUB..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : rotasFiltradas.length === 0 ? (
          <EmptyState
            icon={<RouteIcon size={36} />}
            title="Nenhuma rota fixa"
            description="Cadastre a primeira rota fixa e vincule os entregadores"
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {rotasFiltradas.map((rota) => {
              const daRota = condutoresDaRota.get(rota.id) || [];
              const aberta = rotaAbertaIds.includes(rota.id);
              return (
                <div key={rota.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-black text-sm">
                        {rota.sigla}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{rota.nome || rota.sigla}</span>
                          <Badge variant={rota.ativo ? 'success' : 'gray'}>
                            {rota.ativo ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500">
                          Sigla: <strong>{rota.sigla}</strong>
                          {rota.hub?.sigla ? ` · HUB ${rota.hub.sigla}` : ''}
                          {rota.observacao ? ` · ${rota.observacao}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                        onClick={() => toggleRotaAberta(rota.id)}
                      >
                        <Users size={14} /> {daRota.length} entregador(es)
                        <span className="text-slate-400">{aberta ? '▲' : '▼'}</span>
                      </button>
                      {canEdit && (
                        <>
                          <button
                            className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                            onClick={() => {
                              setGerirRota(rota);
                              setBuscaCondutor('');
                            }}
                          >
                            <UserPlus size={14} /> Vincular
                          </button>
                          <button className="btn-ghost p-1.5" onClick={() => openModal(rota)}>
                            <Pencil size={16} />
                          </button>
                          <button
                            className="btn-ghost p-1.5 text-red-500"
                            onClick={() => setDeleteTarget(rota)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {aberta && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {daRota.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhum entregador vinculado a esta rota.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {daRota.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                            >
                              {c.nome_completo}
                              {canEdit && (
                                <button
                                  className="text-slate-400 hover:text-red-500"
                                  title="Remover da rota"
                                  onClick={() => desvincularCondutor(c.id)}
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal criar/editar rota */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Rota Fixa' : 'Nova Rota Fixa'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Sigla</label>
              <input
                className="input uppercase"
                value={form.sigla}
                onChange={(e) => setForm({ ...form, sigla: e.target.value })}
                placeholder="Ex.: R01"
                maxLength={12}
              />
            </div>
            <div>
              <label className="label">HUB (opcional)</label>
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
            <label className="label">Nome da rota</label>
            <input
              className="input"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Rota Campinas Centro"
            />
          </div>
          <div>
            <label className="label">Observação</label>
            <textarea
              className="input"
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Detalhes da rota..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="rota-ativa"
              type="checkbox"
              className="h-4 w-4"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            <label htmlFor="rota-ativa" className="text-sm text-slate-700">
              Rota ativa
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

      {/* Modal vincular entregadores */}
      <Modal
        open={!!gerirRota}
        onClose={() => setGerirRota(null)}
        title={gerirRota ? `Entregadores da rota ${gerirRota.sigla}` : 'Entregadores da rota'}
        size="lg"
      >
        {gerirRota && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Vinculados ({condutoresDaRota.get(gerirRota.id)?.length || 0})
              </div>
              <div className="flex flex-wrap gap-2">
                {(condutoresDaRota.get(gerirRota.id) || []).length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum entregador vinculado.</p>
                ) : (
                  (condutoresDaRota.get(gerirRota.id) || []).map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs text-brand-800"
                    >
                      {c.nome_completo}
                      <button
                        className="text-brand-400 hover:text-red-500"
                        title="Remover da rota"
                        onClick={() => desvincularCondutor(c.id)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <label className="label">Adicionar entregador</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Buscar por nome, CPF ou telefone..."
                  value={buscaCondutor}
                  onChange={(e) => setBuscaCondutor(e.target.value)}
                />
              </div>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {candidatos.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">Nenhum entregador encontrado.</p>
                ) : (
                  candidatos.map((c) => (
                    <button
                      key={c.id}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => vincularCondutor(c.id, gerirRota.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-slate-800">{c.nome_completo}</span>
                        <span className="block text-xs text-slate-500">
                          {c.telefone || 'Sem telefone'}
                          {c.rota_fixa?.sigla ? ` · rota atual: ${c.rota_fixa.sigla}` : ''}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-brand-700">
                        <UserPlus size={14} /> Adicionar
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button className="btn-secondary" onClick={() => setGerirRota(null)}>
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
        title="Excluir rota fixa"
        message={`Cuidado: excluir a rota ${deleteTarget?.sigla || ''}? Os entregadores continuam cadastrados, mas ficam sem rota vinculada. Essa ação é definitiva.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </div>
  );
}
