import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { Mail, Lock, Loader2, ShieldCheck, RadioTower, Sparkles } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { branding } from '@/lib/branding';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const from = (location.state as { from?: string })?.from || '/';
  const emailNormalizado = email.trim().toLowerCase();
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValido) {
      setError('Informe um e-mail valido.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: emailNormalizado, password });
      if (error) throw error;
      await refreshProfile();
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || (err && typeof err === 'object' ? JSON.stringify(err) : 'Erro ao entrar'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!emailNormalizado || !password) {
      setError('Informe email e senha para cadastrar');
      return;
    }
    if (!emailValido) {
      setError('Informe um e-mail valido.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailNormalizado,
        password,
        options: { data: { nome: emailNormalizado.split('@')[0], perfil: 'operador' } },
      });
      if (error) throw error;

      if (data.session) {
        await refreshProfile();
        navigate(from, { replace: true });
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({ email: emailNormalizado, password });
      if (!loginError) {
        await refreshProfile();
        navigate(from, { replace: true });
        return;
      }

      setError(
        'Conta criada, mas o Supabase ainda exige confirmação de e-mail. Desative "Confirm email" em Authentication > Sign In / Providers > Email.'
      );
    } catch (err: any) {
      setError(err?.message || (err && typeof err === 'object' ? JSON.stringify(err) : 'Erro ao cadastrar'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen tech-surface p-4 lg:p-8">
      <div className="mx-auto grid min-h-full w-full max-w-7xl items-center gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="tech-hero relative hidden overflow-hidden rounded-[32px] border border-white/10 p-10 text-white shadow-[0_30px_90px_rgba(2,6,23,0.32)] lg:block">
          <div className="absolute inset-0 tech-grid opacity-20" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="space-y-8">
              <BrandLogo light subtitle="Sistema de Escalas" />
              <div className="max-w-xl">
                <h1 className="text-4xl font-black leading-tight tracking-[0.08em] text-white">
                  Operacao de escala com cara de plataforma de logistica premium.
                </h1>
                <p className="mt-4 text-base text-slate-300">
                  Painel com leitura rapida, identidade neon e foco total em produtividade de HUB,
                  calendarizacao e agendamento em tempo real.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <ShieldCheck className="text-cyan-300" size={22} />
                <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">Acesso</div>
                <div className="mt-2 text-sm font-semibold text-white">Perfil centralizado e seguro</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <RadioTower className="text-cyan-300" size={22} />
                <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">Status</div>
                <div className="mt-2 text-sm font-semibold text-white">Atualizacao em tempo real</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <Sparkles className="text-cyan-300" size={22} />
                <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">Visual</div>
                <div className="mt-2 text-sm font-semibold text-white">Interface mais marcante e sofisticada</div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-xl">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLogo light subtitle="Sistema de Escalas" />
          </div>

          <div className="tech-panel overflow-hidden p-8 lg:p-10">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Acessar sistema</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Entre no ambiente operacional para acompanhar metas, agenda e ocupacao dos HUBs.
                </p>
              </div>
              <div className="hidden sm:block rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
                {branding.fullName}
              </div>
            </div>

            {!isSupabaseConfigured && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                ⚠️ Supabase não configurado. Crie um arquivo <code className="rounded bg-amber-100 px-1">.env</code> com <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> e <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code>.
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="label">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    className="input pl-10"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    className="input pl-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Entrar'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={handleSignUp}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                disabled={loading}
              >
                Criar nova conta
              </button>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
              <p>
                Após criar a conta, peça a um administrador para elevar seu perfil.
                <br />
                Para tornar um usuário admin, execute no Supabase SQL:
              </p>
              <code className="mt-3 block rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
                update alx.usuarios set perfil = 'admin' where email = 'seu@email.com';
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
