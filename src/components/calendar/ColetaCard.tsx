import type { Coleta } from '@/types';
import { calcColetaStats } from '@/lib/db';
import { formatTime, getOccupancyColor, colorClasses } from '@/utils';
import type { ThresholdsOcupacao } from '@/types';
import { STATUS_COLETA_LABELS } from '@/types';
import { Clock, Users, CheckCircle2, CheckSquare, Square } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface ColetaCardProps {
  coleta: Coleta;
  thresholds: ThresholdsOcupacao;
  onClick: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function ColetaCard({ coleta, thresholds, onClick, selectable, selected, onToggleSelect }: ColetaCardProps) {
  const { agendados, vagas, ocupacao } = calcColetaStats(coleta);
  const color = getOccupancyColor(ocupacao, coleta.status, thresholds);
  const c = colorClasses[color];

  return (
    <button
      onClick={onClick}
      className={`w-full overflow-hidden text-left p-3 rounded-2xl border border-slate-300/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(226,232,240,0.92))] shadow-[0_18px_44px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,23,42,0.18)] transition-all cursor-pointer group relative dark:border-slate-700/80 dark:bg-[linear-gradient(165deg,rgba(30,41,59,0.88),rgba(15,23,42,0.82))] dark:shadow-[0_18px_44px_rgba(2,6,23,0.34)] dark:hover:shadow-[0_24px_54px_rgba(2,6,23,0.42)] ${
        selected ? 'ring-2 ring-cyan-400/80 shadow-[0_0_0_1px_rgba(34,211,238,0.24),0_24px_54px_rgba(15,23,42,0.18)]' : ''
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${c.bar}`} />
      {selectable && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onToggleSelect?.();
            }
          }}
          className="absolute top-2 right-2 cursor-pointer"
        >
          {selected ? (
            <CheckSquare size={18} className="text-cyan-500" />
          ) : (
            <Square size={18} className="text-slate-500 dark:text-slate-400" />
          )}
        </span>
      )}
      <div className="flex items-center justify-between mb-1.5 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{coleta.hub?.sigla}</span>
          {coleta.is_demo && <Badge variant="warning">DEMO</Badge>}
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${c.border} ${c.badge}`}>
          {STATUS_COLETA_LABELS[coleta.status]}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
        <Clock size={12} />
        <span>{formatTime(coleta.horario)}</span>
      </div>

      <div className="flex items-baseline gap-1 mb-1">
        <span className={`text-lg font-bold ${c.text}`}>{agendados}</span>
        <span className="text-xs text-slate-600 dark:text-slate-400">/ {coleta.meta} agendados</span>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Users size={12} />
          {vagas} vagas
        </span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">{ocupacao}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden bg-slate-300/70 dark:bg-slate-700/80">
        <div
          className={`h-full ${c.bar} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(ocupacao, 100)}%` }}
        />
      </div>

      {ocupacao >= 100 && (
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-emerald-700">
          <CheckCircle2 size={12} /> Meta atingida
        </div>
      )}
    </button>
  );
}
