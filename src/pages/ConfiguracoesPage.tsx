import { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon, Users, Plus, Trash2, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { dbConfig, dbUsuarios } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { isAdmin } from '@/store/auth';
import type { ThresholdsOcupacao, Usuario } from '@/types';
import type { PerfilUsuario } from '@/types';

const DEFAULT_THRESHOLDS: ThresholdsOcupacao = { vermelho: 70, amarelo: 100, verde: 100 };

export function ConfiguracoesPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = isAdmin(user?.perfil);

  const [thresholds, setThresholds] = useState<ThresholdsOcupacao>(DEFAULT_THRESHOLDS);
  const [intervalo, setIntervalo] = useState(60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Gestão de usuários
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formUser, setFormUser] = useState({ nome: '', email: '', senha: '', perfil: 'operador' as PerfilUsuario });
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null);

  const loadUsuarios = async () => {
    setLoadingUsers(true);
    const { data } = await dbUsuarios.list();
    setUsuarios((data as Usuario[]) || []);
    setLoadingUsers(false);
  };

  useEffect(() => {
    (async () => {
      const { data: t } = await dbConfig.get('thresholds_ocupacao');
      if (t?.valor) setThresholds(t.valor as ThresholdsOcupacao);
      const { data: i } = await dbConfig.get('intervalo_conflito_minutos');
      if (i?.valor) setIntervalo(Number(i.valor));
    })();
    if (canEdit) loadUsuarios();
  }, [canEdit]);

  const openUserModal = (u?: Usuario) => {
    setEditingUser(u || null);
    setUserError(null);
    if (u) {
      setFormUser({ nome: u.nome, email: u.email || '', senha: '', perfil: (u.perfil as PerfilUsuario) || 'operador' });
    } else {
      setFormUser({ nome: '', email: '', senha: '', perfil: 'operador' });
    }
    setModalOpen(true);
  };

  const salvarUsuario = async () => {
    if (!formUser.nome || !formUser.email) {
      setUserError('Nome e email são obrigatórios');
      return;
    }
    if (!editingUser && !formUser.senha) {
      setUserError('Senha é obrigatória para novo usuário');
      return;
    }
    setSavingUser(true);
    setUserError(null);
    try {
      if (editingUser) {
        // Atualiza perfil/nome na tabela usuarios
        const update: Partial<Usuario> = { nome: formUser.nome, perfil: formUser.perfil };
        const { error } = await dbUsuarios.update(editingUser.id, update);
        if (error) {
          setUserError(error.message);
          return;
        }
      } else {
        const { error } = await dbUsuarios.create({
          nome: formUser.nome,
          email: formUser.email.trim().toLowerCase(),
          password: formUser.senha,
          perfil: formUser.perfil,
        });
        if (error) {
          setUserError(error.message);
          return;
        }
      }
      setModalOpen(false);
      loadUsuarios();
    } catch (err: any) {
      setUserError(err?.message || 'Erro inesperado ao salvar usuário');
    } finally {
      setSavingUser(false);
    }
  };

  const excluirUsuario = async () => {
    if (!deleteTarget) return;
    const { error } = await dbUsuarios.remove(deleteTarget.id);
    if (error) {
      setUserError(error.message);
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    loadUsuarios();
  };

  const salvar = async () => {
    setSaving(true);
    await dbConfig.update('thresholds_ocupacao', thresholds);
    await dbConfig.update('intervalo_conflito_minutos', intervalo);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Parâmetros do sistema"
        actions={
          <button className="btn-primary" onClick={salvar} disabled={saving}>
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        }
      />

      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
          Configurações salvas com sucesso!
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">Thresholds de ocupação</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Define as cores dos cartões de coleta com base no percentual de ocupação.
          </p>
          <div className="space-y-4">
            <div>
              <label className="label">Vermelho (abaixo de %)</label>
              <input
                type="number"
                className="input"
                value={thresholds.vermelho}
                onChange={(e) => setThresholds({ ...thresholds, vermelho: Number(e.target.value) })}
              />
              <p className="text-xs text-slate-400 mt-1">Abaixo deste valor = cartão vermelho</p>
            </div>
            <div>
              <label className="label">Amarelo (até %)</label>
              <input
                type="number"
                className="input"
                value={thresholds.amarelo}
                onChange={(e) => setThresholds({ ...thresholds, amarelo: Number(e.target.value) })}
              />
              <p className="text-xs text-slate-400 mt-1">Entre vermelho e este valor = cartão amarelo</p>
            </div>
            <div>
              <label className="label">Verde (a partir de %)</label>
              <input
                type="number"
                className="input"
                value={thresholds.verde}
                onChange={(e) => setThresholds({ ...thresholds, verde: Number(e.target.value) })}
              />
              <p className="text-xs text-slate-400 mt-1">Acima deste valor = cartão verde (meta atingida)</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">Intervalo de conflito</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Intervalo mínimo (em minutos) entre coletas para considerar um agendamento como conflitante para o mesmo condutor.
          </p>
          <div>
            <label className="label">Minutos</label>
            <input
              type="number"
              className="input"
              value={intervalo}
              onChange={(e) => setIntervalo(Number(e.target.value))}
            />
            <p className="text-xs text-slate-400 mt-1">Ex: 60 = condutor não pode ter 2 coletas com menos de 60 min de diferença</p>
          </div>
        </div>
      </div>

      {/* Pré-visualização */}
      <div className="card p-5 mt-6">
        <h2 className="font-semibold text-slate-800 mb-4">Pré-visualização das cores</h2>
        <div className="flex flex-wrap gap-3">
          <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {`< ${thresholds.vermelho}% — Vermelho`}
          </div>
          <div className="px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
            {`${thresholds.vermelho}% – ${thresholds.amarelo}% — Amarelo`}
          </div>
          <div className="px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
            {`≥ ${thresholds.verde}% — Verde (meta atingida)`}
          </div>
          <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
            Em andamento
          </div>
          <div className="px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-sm font-medium">
            Finalizada
          </div>
        </div>
      </div>

      {/* Gestão de Usuários */}
      {canEdit && (
        <div className="card p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-slate-500" />
              <h2 className="font-semibold text-slate-800">Usuários ({usuarios.length})</h2>
            </div>
            <button className="btn-primary" onClick={() => openUserModal()}>
              <Plus size={16} /> Novo usuário
            </button>
          </div>

          {!modalOpen && userError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
              {userError}
            </div>
          )}

          {loadingUsers ? (
            <div className="p-8 text-center text-slate-400">Carregando...</div>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum usuário cadastrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                    <th className="text-left px-3 py-2">Nome</th>
                    <th className="text-left px-3 py-2">E-mail</th>
                    <th className="text-left px-3 py-2">Perfil</th>
                    <th className="text-right px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium text-slate-800">{u.nome}</td>
                      <td className="px-3 py-2.5 text-slate-600">{u.email || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`badge ${
                          u.perfil === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.perfil === 'supervisor' ? 'bg-blue-100 text-blue-700' :
                          u.perfil === 'operador' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {u.perfil}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          className="p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded mr-1"
                          onClick={() => openUserModal(u)}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        {u.id !== user?.id && (
                          <button
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                            onClick={() => setDeleteTarget(u)}
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de usuário */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? 'Editar usuário' : 'Novo usuário'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input
              className="input"
              value={formUser.nome}
              onChange={(e) => setFormUser({ ...formUser, nome: e.target.value })}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              className="input"
              value={formUser.email}
              onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
              placeholder="usuario@email.com"
              disabled={!!editingUser}
            />
          </div>
          <div>
            <label className="label">
              {editingUser ? 'Nova senha (deixe vazio para manter)' : 'Senha'}
            </label>
            <input
              type="password"
              className="input"
              value={formUser.senha}
              onChange={(e) => setFormUser({ ...formUser, senha: e.target.value })}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="label">Perfil</label>
            <select
              className="input"
              value={formUser.perfil}
              onChange={(e) => setFormUser({ ...formUser, perfil: e.target.value as PerfilUsuario })}
            >
              <option value="admin">Admin</option>
              <option value="supervisor">Supervisor</option>
              <option value="operador">Operador</option>
              <option value="visualizador">Visualizador</option>
            </select>
          </div>

          {userError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
              {userError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button className="btn-primary flex-1" onClick={salvarUsuario} disabled={savingUser}>
              {savingUser ? 'Salvando...' : editingUser ? 'Salvar' : 'Criar usuário'}
            </button>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={excluirUsuario}
        title="Excluir usuário"
        message={`Deseja excluir o usuário ${deleteTarget?.nome}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}
