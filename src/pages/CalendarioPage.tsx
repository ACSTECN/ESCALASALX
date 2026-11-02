import { useEffect, useState, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { Home, Filter, AlertTriangle } from 'lucide-react';
import { WeeklyCalendar } from '@/components/calendar/WeeklyCalendar';
import { PageHeader } from '@/components/ui/PageHeader';
import { dbColetas, dbHubs, dbCidades, dbConfig } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Coleta, Hub, Cidade, ThresholdsOcupacao } from '@/types';
import { useUIStore } from '@/store/ui';
import { BrandLogo } from '@/components/ui/BrandLogo';

const DEFAULT_THRESHOLDS: ThresholdsOcupacao = { vermelho: 70, amarelo: 100, verde: 100 };

export function CalendarioPage() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdsOcupacao>(DEFAULT_THRESHOLDS);
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay() || 7; // domingo=0 -> 7
    return addDays(now, 1 - day); // volta para segunda
  });
  const [loading, setLoading] = useState(true);

  const filtroCidadeId = useUIStore((s) => s.filtroCidadeId);
  const filtroHubId = useUIStore((s) => s.filtroHubId);
  const filtroStatus = useUIStore((s) => s.filtroStatus);
  const setFiltroCidade = useUIStore((s) => s.setFiltroCidade);
  const setFiltroHub = useUIStore((s) => s.setFiltroHub);
  const setFiltroStatus = useUIStore((s) => s.setFiltroStatus);

  const loadColetas = useCallback(async () => {
    setLoading(true);
    const start = format(weekStart, 'yyyy-MM-dd');
    const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
    const { data } = await dbColetas.listByDateRange(start, end);
    setColetas((data as Coleta[]) || []);
    setLoading(false);
  }, [weekStart]);

  const loadRefData = async () => {
    const [h, c, cfg] = await Promise.all([dbHubs.listAtivos(), dbCidades.listAtivas(), dbConfig.get('thresholds_ocupacao')]);
    setHubs((h.data as Hub[]) || []);
    setCidades((c.data as Cidade[]) || []);
    if (cfg.data?.valor) {
      setThresholds(cfg.data.valor as ThresholdsOcupacao);
    }
  };

  useEffect(() => {
    loadRefData();
  }, []);

  useEffect(() => {
    loadColetas();
  }, [loadColetas]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('coletas_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coletas' },
        () => loadColetas()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadColetas]);

  const goToToday = () => {
    const now = new Date();
    const day = now.getDay() || 7;
    setWeekStart(addDays(now, 1 - day));
  };

  // Aplicar filtros
  const coletasFiltradas = coletas.filter((c) => {
    if (filtroCidadeId && c.hub?.cidade_id !== filtroCidadeId) return false;
    if (filtroHubId && c.hub_id !== filtroHubId) return false;
    if (filtroStatus && c.status !== filtroStatus) return false;
    return true;
  });

  // HUBs abaixo da meta
  const abaixoMeta = coletasFiltradas.filter((c) => {
    const ativos = (c.agendamentos || []).filter((a) => a.status !== 'cancelado').length;
    return ativos < c.meta && c.status !== 'finalizada' && c.status !== 'cancelada';
  });

  const hubsFiltrados = filtroCidadeId ? hubs.filter((h) => h.cidade_id === filtroCidadeId) : hubs;

  return (
    <div>
      <PageHeader
        title="Calendário de Coletas"
        description="Acompanhe a programação semanal por HUB"
        actions={
          <button className="btn-secondary" onClick={goToToday}>
            <Home size={16} /> Hoje
          </button>
        }
      />

      <div className="tech-panel tech-grid relative mb-5 overflow-hidden p-5 text-slate-900 dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(12,20,38,0.92),rgba(15,23,42,0.82))] dark:text-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.18),_transparent_32%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.10),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.10),_transparent_30%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <BrandLogo compact subtitle="Painel Semanal" />
            <h2 className="mt-4 text-2xl font-black tracking-[0.08em] text-slate-950 dark:text-slate-100">
              Controle visual de escala com leitura rapida de ocupacao.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              A semana fica toda visivel, com filtros e acompanhamento direto de HUB, metas e agendamentos.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-3xl border border-slate-200/80 bg-white/75 px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">Coletas</div>
              <div className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">{coletasFiltradas.length}</div>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white/75 px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">HUBs</div>
              <div className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">{new Set(coletasFiltradas.map((c) => c.hub_id)).size}</div>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white/75 px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">Abaixo meta</div>
              <div className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">{abaixoMeta.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de meta não atingida */}
      {abaixoMeta.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-amber-800">
            <strong>{abaixoMeta.length} coleta(s)</strong> ainda não atingiram a meta nesta semana.
            {' '}
            {abaixoMeta.slice(0, 3).map((c) => c.hub?.sigla).join(', ')}
            {abaixoMeta.length > 3 && '...'}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Cidade</label>
            <select
              className="input"
              value={filtroCidadeId || ''}
              onChange={(e) => { setFiltroCidade(e.target.value || null); setFiltroHub(null); }}
            >
              <option value="">Todas as cidades</option>
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">HUB</label>
            <select
              className="input"
              value={filtroHubId || ''}
              onChange={(e) => setFiltroHub(e.target.value || null)}
            >
              <option value="">Todos os HUBs</option>
              {hubsFiltrados.map((h) => <option key={h.id} value={h.id}>{h.sigla}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status da coleta</label>
            <select
              className="input"
              value={filtroStatus || ''}
              onChange={(e) => setFiltroStatus(e.target.value || null)}
            >
              <option value="">Todos</option>
              <option value="programada">Programada</option>
              <option value="em_andamento">Em andamento</option>
              <option value="finalizada">Finalizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              className="btn-secondary w-full"
              onClick={() => { setFiltroCidade(null); setFiltroHub(null); setFiltroStatus(null); }}
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> Meta atingida</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> Próximo da meta</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> Abaixo da meta</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Em andamento</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-400" /> Finalizada</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <WeeklyCalendar
          coletas={coletasFiltradas}
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          thresholds={thresholds}
          onColetaUpdated={loadColetas}
        />
      )}
    </div>
  );
}
