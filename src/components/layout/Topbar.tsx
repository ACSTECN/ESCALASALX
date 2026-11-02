import { Menu, LogOut, Bell, Mail, KeyRound, UserPlus, X, Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useMensagensStore } from '@/store/mensagens';
import { supabase } from '@/lib/supabase';
import { getGreeting } from '@/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { TIPO_MENSAGEM_MAGALOG_LABELS } from '@/types';
import { features } from '@/lib/branding';

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const tema = useUIStore((s) => s.tema);
  const toggleTema = useUIStore((s) => s.toggleTema);
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  const naoLidas = useMensagensStore((s) => s.naoLidas);
  const alerta = useMensagensStore((s) => s.alerta);
  const carregarMensagens = useMensagensStore((s) => s.carregar);
  const limparAlerta = useMensagensStore((s) => s.limparAlerta);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Contador de mensagens MAGALOG: carga inicial + realtime + polling de segurança
  useEffect(() => {
    if (!user || !features.gmail) return;
    carregarMensagens();

    const canal = supabase
      .channel('mensagens-magalog-topbar')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_magalog' },
        () => carregarMensagens()
      )
      .subscribe();

    const intervalo = setInterval(carregarMensagens, 60000);

    return () => {
      supabase.removeChannel(canal);
      clearInterval(intervalo);
    };
  }, [user, carregarMensagens]);

  // Esconde o aviso automaticamente
  useEffect(() => {
    if (!alerta) return;
    const t = setTimeout(limparAlerta, 12000);
    return () => clearTimeout(t);
  }, [alerta, limparAlerta]);

  const abrirMensagens = () => {
    limparAlerta();
    navigate('/mensagens');
  };

  const IconeAlerta =
    alerta?.tipo === 'reenvio_senha' ? KeyRound : alerta?.tipo === 'novo_condutor' ? UserPlus : Mail;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 px-4 lg:px-6 backdrop-blur-xl">
        <div className="flex h-20 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden btn-ghost p-2"
              onClick={toggleSidebar}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <div className="hidden xl:block">
              <BrandLogo compact light subtitle="Painel Operacional" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {getGreeting()}, {user?.nome?.split(' ')[0] || 'Usuário'} 👋
              </p>
              <p className="truncate text-xs text-slate-400">
                {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} •{' '}
                {format(now, 'HH:mm')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-white/5 px-3 py-2 shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.8)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Tempo real</span>
            </div>
            <button
              className="btn-ghost p-2 text-slate-300 hover:bg-white/5 hover:text-white"
              onClick={toggleTema}
              title={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              aria-label={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {features.gmail && (
              <button
                className="btn-ghost p-2 relative text-slate-300 hover:bg-white/5 hover:text-white"
                onClick={abrirMensagens}
                title="Mensagens MAGALOG"
              >
                <Bell size={20} />
                {naoLidas > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {naoLidas > 99 ? '99+' : naoLidas}
                  </span>
                )}
              </button>
            )}
            <button onClick={signOut} className="btn-ghost p-2 text-slate-300 hover:bg-white/5 hover:text-white" title="Sair">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Notificação de nova mensagem MAGALOG */}
      {features.gmail && alerta && (
        <div className="fixed bottom-6 right-6 z-50 w-[340px] max-w-[calc(100vw-3rem)] animate-slide-up">
          <div className="rounded-2xl border border-cyan-400/30 bg-slate-900/95 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.6)] backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
                <IconeAlerta size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Nova mensagem MAGALOG
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {TIPO_MENSAGEM_MAGALOG_LABELS[alerta.tipo]}
                  {alerta.nome ? ` · ${alerta.nome}` : ''}
                </p>
                {alerta.senha ? (
                  <p className="mt-1 font-mono text-xs text-amber-300">Senha: {alerta.senha}</p>
                ) : (
                  <p className="mt-1 truncate text-xs text-slate-400">{alerta.assunto}</p>
                )}
                <button
                  className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                  onClick={abrirMensagens}
                >
                  Ver mensagem →
                </button>
              </div>
              <button className="text-slate-500 hover:text-white" onClick={limparAlerta}>
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
