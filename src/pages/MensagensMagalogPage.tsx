import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  Download,
  Search,
  Mail,
  KeyRound,
  UserPlus,
  Copy,
  Check,
  Trash2,
  CheckCheck,
  Link2,
  Link2Off,
  Inbox,
  Clock,
  X,
  Eye,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { dbGmail, dbMensagensMagalog } from '@/lib/db';
import { useAuthStore, isAdmin } from '@/store/auth';
import { useMensagensStore } from '@/store/mensagens';
import { toCSV, downloadFile } from '@/utils';
import type { GmailStatus, MensagemMagalog, TipoMensagemMagalog } from '@/types';
import { TIPO_MENSAGEM_MAGALOG_LABELS } from '@/types';

type Aba = 'todas' | 'senhas' | 'condutores';

const formatarDataHora = (valor: string | null) => {
  if (!valor) return '—';
  try {
    return new Date(valor).toLocaleString('pt-BR');
  } catch {
    return valor;
  }
};

const badgeTipo: Record<TipoMensagemMagalog, 'warning' | 'info' | 'gray'> = {
  reenvio_senha: 'warning',
  novo_condutor: 'info',
  outro: 'gray',
};

export function MensagensMagalogPage() {
  const user = useAuthStore((s) => s.user);
  const admin = isAdmin(user?.perfil);
  const carregarContador = useMensagensStore((s) => s.carregar);

  const [searchParams, setSearchParams] = useSearchParams();
  const [mensagens, setMensagens] = useState<MensagemMagalog[]>([]);
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  const [aba, setAba] = useState<Aba>('todas');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState<MensagemMagalog | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmExcluir, setConfirmExcluir] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, gmail] = await Promise.all([
      dbMensagensMagalog.list(),
      admin ? dbGmail.status() : Promise.resolve({ data: null, error: null }),
    ]);
    setMensagens((data as MensagemMagalog[]) || []);
    if (gmail.data) setStatus(gmail.data);
    setLoading(false);
    carregarContador();
  }, [admin, carregarContador]);

  useEffect(() => {
    load();
  }, [load]);

  // Retorno do OAuth do Google (?gmail=conectado | ?gmail=erro)
  useEffect(() => {
    const retorno = searchParams.get('gmail');
    if (!retorno) return;
    if (retorno === 'conectado') {
      setAviso({ texto: 'Conta Gmail conectada com sucesso.', ok: true });
    } else if (retorno === 'erro') {
      setAviso({
        texto: `Não foi possível conectar: ${searchParams.get('motivo') || 'autorização negada'}.`,
        ok: false,
      });
    }
    const proximo = new URLSearchParams(searchParams);
    proximo.delete('gmail');
    proximo.delete('motivo');
    setSearchParams(proximo, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 8000);
    return () => clearTimeout(t);
  }, [aviso]);

  const conectar = async () => {
    setConectando(true);
    setAviso(null);
    const { data, error } = await dbGmail.gerarUrlAutorizacao();
    setConectando(false);
    if (error || !data?.url) {
      setAviso({ texto: error?.message || 'Não foi possível gerar a URL de autorização.', ok: false });
      return;
    }
    window.location.href = data.url;
  };

  const desconectar = async () => {
    const { error } = await dbGmail.desconectar();
    if (error) {
      setAviso({ texto: error.message, ok: false });
      return;
    }
    setAviso({ texto: 'Conta Gmail desconectada.', ok: true });
    load();
  };

  const sincronizar = async () => {
    setSincronizando(true);
    setAviso(null);
    const { data, error } = await dbGmail.sincronizar();
    setSincronizando(false);
    if (error) {
      setAviso({ texto: error.message, ok: false });
      load();
      return;
    }
    setAviso({
      texto: `Sincronização concluída: ${data?.encontradas ?? 0} e-mail(s) encontrado(s), ${
        data?.novas ?? 0
      } novo(s).`,
      ok: true,
    });
    load();
  };

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return mensagens.filter((m) => {
      if (aba === 'senhas' && m.tipo !== 'reenvio_senha') return false;
      if (aba === 'condutores' && m.tipo !== 'novo_condutor') return false;
      if (termo) {
        const alvo = `${m.nome || ''} ${m.cpf || ''} ${m.telefone || ''} ${m.assunto || ''} ${
          m.senha || ''
        }`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [mensagens, aba, busca]);

  const kpis = useMemo(
    () => ({
      total: mensagens.length,
      naoLidas: mensagens.filter((m) => !m.lida).length,
      senhas: mensagens.filter((m) => m.tipo === 'reenvio_senha').length,
      condutores: mensagens.filter((m) => m.tipo === 'novo_condutor').length,
    }),
    [mensagens]
  );

  const abrirDetalhe = async (m: MensagemMagalog) => {
    setDetalhe(m);
    if (!m.lida) {
      await dbMensagensMagalog.marcarLida(m.id, true);
      setMensagens((prev) => prev.map((x) => (x.id === m.id ? { ...x, lida: true } : x)));
      carregarContador();
    }
  };

  const marcarTodasLidas = async () => {
    await dbMensagensMagalog.marcarTodasLidas();
    setMensagens((prev) => prev.map((m) => ({ ...m, lida: true })));
    carregarContador();
  };

  const copiar = async (texto: string, chave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      setAviso({ texto: 'Não foi possível copiar automaticamente.', ok: false });
    }
  };

  const excluirSelecionados = async () => {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;
    await dbMensagensMagalog.removeMany(ids);
    setMensagens((prev) => prev.filter((m) => !selecionados.has(m.id)));
    setSelecionados(new Set());
    setConfirmExcluir(false);
    carregarContador();
  };

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportar = () => {
    if (filtradas.length === 0) return;
    const linhas = filtradas.map((m) => ({
      'Recebido em': formatarDataHora(m.recebido_em || m.created_at),
      Tipo: TIPO_MENSAGEM_MAGALOG_LABELS[m.tipo],
      Nome: m.nome || '',
      CPF: m.cpf || '',
      Telefone: m.telefone || '',
      Senha: m.senha || '',
      Assunto: m.assunto || '',
      Lida: m.lida ? 'Sim' : 'Não',
    }));
    downloadFile(toCSV(linhas), `mensagens-magalog-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mensagens MAGALOG"
        description="E-mails capturados automaticamente da conta Gmail monitorada (novo condutor e reenvio de senha)."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button className="btn-secondary" onClick={exportar} disabled={filtradas.length === 0}>
              <Download size={16} />
              Exportar
            </button>
            {admin && (
              <button className="btn-primary" onClick={sincronizar} disabled={sincronizando}>
                <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
                {sincronizando ? 'Sincronizando...' : 'Sincronizar agora'}
              </button>
            )}
          </div>
        }
      />

      {aviso && (
        <div
          className={`p-3 rounded-xl text-sm border ${
            aviso.ok
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {/* Status da integração */}
      <div className="card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                status?.conectado ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-slate-500" />
                <h2 className="font-semibold text-slate-800">Integração Gmail</h2>
                <Badge variant={status?.conectado ? 'success' : 'warning'}>
                  {status?.conectado ? 'Conectado' : 'Não conectado'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {status?.email
                  ? `Conta monitorada: ${status.email}`
                  : 'Nenhuma conta Gmail autorizada ainda.'}
                {status?.sincronizado_em && ` · Última sincronização: ${formatarDataHora(status.sincronizado_em)}`}
              </p>
              {!status?.sync_configurado && (
                <p className="text-xs text-amber-600 mt-1">
                  Defina o secret GMAIL_SYNC_SECRET para habilitar a sincronização automática.
                </p>
              )}
            </div>
          </div>

          {admin && (
            <div className="flex items-center gap-2">
              <button className="btn-primary" onClick={conectar} disabled={conectando}>
                <Link2 size={16} />
                {conectando ? 'Abrindo...' : status?.conectado ? 'Reconectar Gmail' : 'Conectar Gmail'}
              </button>
              {status?.conectado && (
                <button className="btn-secondary" onClick={desconectar}>
                  <Link2Off size={16} />
                  Desconectar
                </button>
              )}
            </div>
          )}
        </div>
        {status?.url_callback && (
          <p className="mt-3 text-[11px] text-slate-400 break-all">
            Redirect URI configurado: {status.url_callback}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <Inbox size={14} /> Total
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{kpis.total}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-cyan-600 text-xs font-medium">
            <Mail size={14} /> Não lidas
          </div>
          <div className="text-2xl font-bold text-cyan-600 mt-1">{kpis.naoLidas}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-medium">
            <KeyRound size={14} /> Senhas recebidas
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{kpis.senhas}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-blue-600 text-xs font-medium">
            <UserPlus size={14} /> Novos condutores
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{kpis.condutores}</div>
        </div>
      </div>

      {/* Abas + busca */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {(
              [
                { id: 'todas' as Aba, label: 'Todas', icon: Inbox },
                { id: 'senhas' as Aba, label: 'Senhas recebidas', icon: KeyRound },
                { id: 'condutores' as Aba, label: 'Novos condutores', icon: UserPlus },
              ]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setAba(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  aba === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9 w-full md:w-72"
                placeholder="Nome, CPF, telefone ou senha"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            {kpis.naoLidas > 0 && (
              <button className="btn-secondary" onClick={marcarTodasLidas} title="Marcar todas como lidas">
                <CheckCheck size={16} />
                Ler todas
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={aba === 'senhas' ? <KeyRound size={32} /> : <Inbox size={32} />}
            title="Nenhuma mensagem encontrada"
            description={
              status?.conectado
                ? 'Use "Sincronizar agora" para buscar os e-mails mais recentes da MAGALOG.'
                : 'Conecte a conta Gmail para começar a capturar as mensagens da MAGALOG.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <button
                      onClick={() =>
                        setSelecionados(
                          selecionados.size === filtradas.length
                            ? new Set()
                            : new Set(filtradas.map((m) => m.id))
                        )
                      }
                      className="text-slate-400 hover:text-brand-600"
                    >
                      <CheckCheck size={16} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Recebido</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Condutor</th>
                  <th className="px-4 py-3 text-left font-medium">Senha</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((m) => (
                  <tr
                    key={m.id}
                    className={`${!m.lida ? 'bg-cyan-50/40' : ''} hover:bg-slate-50`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={selecionados.has(m.id)}
                        onChange={() => toggleSelecionado(m.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        {formatarDataHora(m.recebido_em || m.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={badgeTipo[m.tipo]}>{TIPO_MENSAGEM_MAGALOG_LABELS[m.tipo]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-medium ${m.lida ? 'text-slate-700' : 'text-slate-900'}`}>
                        {m.nome || '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {m.cpf ? `CPF ${m.cpf}` : ''}
                        {m.telefone ? `${m.cpf ? ' · ' : ''}${m.telefone}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.senha ? (
                        <button
                          onClick={() => copiar(m.senha!, m.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          title="Copiar senha"
                        >
                          {copiado === m.id ? <Check size={13} /> : <Copy size={13} />}
                          {m.senha}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Ver mensagem"
                          onClick={() => abrirDetalhe(m)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                          title="Excluir"
                          onClick={async () => {
                            await dbMensagensMagalog.remove(m.id);
                            setMensagens((prev) => prev.filter((x) => x.id !== m.id));
                            carregarContador();
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Barra de seleção */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selecionados.size} selecionada(s)</span>
          <div className="w-px h-6 bg-slate-700" />
          <button
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700"
            onClick={() => setConfirmExcluir(true)}
          >
            <Trash2 size={15} /> Excluir
          </button>
          <button className="text-slate-400 hover:text-white" onClick={() => setSelecionados(new Set())}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Detalhe */}
      <Modal open={!!detalhe} onClose={() => setDetalhe(null)} title="Mensagem MAGALOG" size="lg">
        {detalhe && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={badgeTipo[detalhe.tipo]}>{TIPO_MENSAGEM_MAGALOG_LABELS[detalhe.tipo]}</Badge>
              <span className="text-xs text-slate-500">
                {formatarDataHora(detalhe.recebido_em || detalhe.created_at)}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-1">
              <div className="font-semibold text-slate-800">{detalhe.nome || 'Nome não identificado'}</div>
              <div className="text-slate-500">
                {detalhe.cpf ? `CPF ${detalhe.cpf}` : 'CPF não identificado'}
                {detalhe.telefone ? ` · ${detalhe.telefone}` : ''}
              </div>
              <div className="text-xs text-slate-400 break-all">{detalhe.assunto}</div>
            </div>

            {/* Campo isolado da senha */}
            <div>
              <label className="label">Senha recebida</label>
              {detalhe.senha ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-mono text-base font-bold tracking-wider text-amber-900">
                    {detalhe.senha}
                  </div>
                  <button
                    className="btn-secondary"
                    onClick={() => copiar(detalhe.senha!, `det-${detalhe.id}`)}
                  >
                    {copiado === `det-${detalhe.id}` ? <Check size={16} /> : <Copy size={16} />}
                    Copiar
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                  Nenhuma senha identificada nesta mensagem.
                </div>
              )}
            </div>

            <div>
              <label className="label">Conteúdo do e-mail</label>
              <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-[13px] leading-6 text-slate-100 whitespace-pre-wrap break-words">
                {detalhe.corpo || 'Sem conteúdo disponível.'}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmExcluir}
        title="Excluir mensagens"
        message={`Cuidado: ${selecionados.size} mensagem(ns) serão removidas definitivamente. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={excluirSelecionados}
        onClose={() => setConfirmExcluir(false)}
      />
    </div>
  );
}
