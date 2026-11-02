import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Power, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { dbCidades, dbHubs } from '@/lib/db';
import { toCSV, downloadFile } from '@/utils';
import type { Cidade, Hub } from '@/types';
import { useAuthStore } from '@/store/auth';
import { isAdmin } from '@/store/auth';

export function CidadesHubsPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = isAdmin(user?.perfil);

  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);

  // Cidade modal
  const [cidadeModal, setCidadeModal] = useState(false);
  const [editingCidade, setEditingCidade] = useState<Cidade | null>(null);
  const [cidadeForm, setCidadeForm] = useState({ nome: '', estado: '', ativo: true });

  // Hub modal
  const [hubModal, setHubModal] = useState(false);
  const [editingHub, setEditingHub] = useState<Hub | null>(null);
  const [hubForm, setHubForm] = useState({ sigla: '', nome: '', cidade_id: '', ativo: true });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'cidade' | 'hub'; id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [c, h] = await Promise.all([dbCidades.list(), dbHubs.list()]);
    setCidades((c.data as Cidade[]) || []);
    setHubs((h.data as Hub[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCidadeModal = (c?: Cidade) => {
    setEditingCidade(c || null);
    setCidadeForm(c ? { nome: c.nome, estado: c.estado || '', ativo: c.ativo } : { nome: '', estado: '', ativo: true });
    setCidadeModal(true);
  };

  const saveCidade = async () => {
    if (!cidadeForm.nome.trim()) return;
    if (editingCidade) {
      await dbCidades.update(editingCidade.id, cidadeForm);
    } else {
      await dbCidades.create(cidadeForm);
    }
    setCidadeModal(false);
    loadData();
  };

  const openHubModal = (h?: Hub) => {
    setEditingHub(h || null);
    setHubForm(h ? { sigla: h.sigla, nome: h.nome, cidade_id: h.cidade_id, ativo: h.ativo } : { sigla: '', nome: '', cidade_id: cidades[0]?.id || '', ativo: true });
    setHubModal(true);
  };

  const saveHub = async () => {
    if (!hubForm.sigla.trim() || !hubForm.nome.trim() || !hubForm.cidade_id) return;
    if (editingHub) {
      await dbHubs.update(editingHub.id, hubForm);
    } else {
      await dbHubs.create(hubForm);
    }
    setHubModal(false);
    loadData();
  };

  const toggleAtivo = async (type: 'cidade' | 'hub', item: Cidade | Hub) => {
    if (type === 'cidade') {
      await dbCidades.update(item.id, { ativo: !item.ativo });
    } else {
      await dbHubs.update(item.id, { ativo: !item.ativo });
    }
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    if (deleteTarget.type === 'cidade') {
      await dbCidades.remove(deleteTarget.id);
    } else {
      await dbHubs.remove(deleteTarget.id);
    }
    setDeleting(false);
    setDeleteTarget(null);
    loadData();
  };

  const exportarHubs = () => {
    const cidadeMap = new Map(cidades.map((c) => [c.id, c.nome]));
    const linhas = hubs.map((h) => ({
      'HUB': h.sigla,
      'Nome': h.nome,
      'Cidade': cidadeMap.get(h.cidade_id) || '',
      'Ativo': h.ativo ? 'Sim' : 'Não',
    }));
    downloadFile(toCSV(linhas), `hubs_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div>
      <PageHeader
        title="Cidades & HUBs"
        description="Gerencie a estrutura geográfica da operação"
        actions={
          <>
            <button className="btn-secondary" onClick={exportarHubs}>
              <Download size={16} /> Exportar
            </button>
            {canEdit && (
              <>
                <button className="btn-secondary" onClick={() => openCidadeModal()}>
                  <Plus size={16} /> Nova Cidade
                </button>
                <button className="btn-primary" onClick={() => openHubModal()}>
                  <Plus size={16} /> Novo HUB
                </button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cidades */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Cidades ({cidades.length})</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Carregando...</div>
          ) : cidades.length === 0 ? (
            <EmptyState title="Nenhuma cidade" description="Cadastre a primeira cidade" />
          ) : (
            <div className="divide-y divide-slate-100">
              {cidades.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-slate-800 flex items-center gap-2">
                        {c.nome}
                        {c.is_demo && <Badge variant="warning">DEMO</Badge>}
                      </div>
                      <div className="text-xs text-slate-500">{c.estado || '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={c.ativo ? 'success' : 'gray'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    {canEdit && (
                      <>
                        <button className="btn-ghost p-1.5" onClick={() => toggleAtivo('cidade', c)} title="Ativar/Desativar">
                          <Power size={16} />
                        </button>
                        <button className="btn-ghost p-1.5" onClick={() => openCidadeModal(c)}>
                          <Pencil size={16} />
                        </button>
                        <button className="btn-ghost p-1.5 text-red-500" onClick={() => setDeleteTarget({ type: 'cidade', id: c.id, nome: c.nome })}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HUBs */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">HUBs ({hubs.length})</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Carregando...</div>
          ) : hubs.length === 0 ? (
            <EmptyState title="Nenhum HUB" description="Cadastre o primeiro HUB" />
          ) : (
            <div className="divide-y divide-slate-100">
              {hubs.map((h) => (
                <div key={h.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                      {h.sigla.slice(0, 4)}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800 flex items-center gap-2">
                        {h.sigla} — {h.nome}
                        {h.is_demo && <Badge variant="warning">DEMO</Badge>}
                      </div>
                      <div className="text-xs text-slate-500">{h.cidade?.nome || '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={h.ativo ? 'success' : 'gray'}>{h.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    {canEdit && (
                      <>
                        <button className="btn-ghost p-1.5" onClick={() => toggleAtivo('hub', h)}>
                          <Power size={16} />
                        </button>
                        <button className="btn-ghost p-1.5" onClick={() => openHubModal(h)}>
                          <Pencil size={16} />
                        </button>
                        <button className="btn-ghost p-1.5 text-red-500" onClick={() => setDeleteTarget({ type: 'hub', id: h.id, nome: h.sigla })}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cidade Modal */}
      <Modal open={cidadeModal} onClose={() => setCidadeModal(false)} title={editingCidade ? 'Editar Cidade' : 'Nova Cidade'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={cidadeForm.nome} onChange={(e) => setCidadeForm({ ...cidadeForm, nome: e.target.value })} placeholder="São Paulo" />
          </div>
          <div>
            <label className="label">Estado (UF)</label>
            <input className="input" value={cidadeForm.estado} onChange={(e) => setCidadeForm({ ...cidadeForm, estado: e.target.value.toUpperCase() })} placeholder="SP" maxLength={2} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cidadeForm.ativo} onChange={(e) => setCidadeForm({ ...cidadeForm, ativo: e.target.checked })} />
            <span className="text-sm text-slate-700">Ativo</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setCidadeModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveCidade}>Salvar</button>
          </div>
        </div>
      </Modal>

      {/* Hub Modal */}
      <Modal open={hubModal} onClose={() => setHubModal(false)} title={editingHub ? 'Editar HUB' : 'Novo HUB'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Sigla</label>
              <input className="input" value={hubForm.sigla} onChange={(e) => setHubForm({ ...hubForm, sigla: e.target.value.toUpperCase() })} placeholder="HGRU" />
            </div>
            <div>
              <label className="label">Cidade</label>
              <select className="input" value={hubForm.cidade_id} onChange={(e) => setHubForm({ ...hubForm, cidade_id: e.target.value })}>
                <option value="">Selecione...</option>
                {cidades.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nome completo</label>
            <input className="input" value={hubForm.nome} onChange={(e) => setHubForm({ ...hubForm, nome: e.target.value })} placeholder="HUB Guarulhos" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hubForm.ativo} onChange={(e) => setHubForm({ ...hubForm, ativo: e.target.checked })} />
            <span className="text-sm text-slate-700">Ativo</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setHubModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveHub}>Salvar</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Confirmar exclusão"
        message={`Deseja realmente excluir ${deleteTarget?.nome}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </div>
  );
}
