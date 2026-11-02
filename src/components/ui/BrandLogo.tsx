import { CalendarCheck2, Clock3 } from 'lucide-react';
import { branding } from '@/lib/branding';

interface BrandLogoProps {
  compact?: boolean;
  light?: boolean;
  subtitle?: string;
  className?: string;
}

export function BrandLogo({
  compact = false,
  light = false,
  subtitle = branding.tagline,
  className = '',
}: BrandLogoProps) {
  const frameClass = light
    ? 'border-cyan-400/25 bg-slate-950/70'
    : 'border-cyan-300/25 bg-slate-950';
  const titleClass = light ? 'text-cyan-100' : 'text-slate-950';
  const subClass = light ? 'text-cyan-200/85' : 'text-cyan-700';
  const logisticsClass = light ? 'text-slate-300' : 'text-slate-700';

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border ${frameClass} shadow-[0_0_28px_rgba(37,99,235,0.35)]`}>
          <div className="absolute inset-[1px] rounded-[15px] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.5),_transparent_40%),linear-gradient(145deg,_rgba(2,6,23,1),_rgba(15,23,42,0.96))]" />
          <div className="absolute inset-0 flex items-center justify-center text-lg font-black tracking-[-0.12em] text-white [text-shadow:0_0_20px_rgba(56,189,248,0.8)]">
            {branding.initials}
          </div>
          <div className="absolute bottom-1 right-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-1 text-cyan-200">
            <CalendarCheck2 size={9} />
          </div>
        </div>
        <div className="min-w-0 leading-none">
          <div className={`truncate text-[8px] font-semibold uppercase tracking-[0.42em] ${logisticsClass}`}>
            {branding.wordmark}
          </div>
          <div className={`truncate text-base font-black tracking-[0.28em] ${titleClass}`}>
            {branding.initials}
          </div>
          <div className={`truncate text-[9px] font-semibold uppercase tracking-[0.28em] ${subClass}`}>
            {subtitle}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-5 ${className}`}>
      <div className="relative min-w-[220px]">
        <div className="relative h-28">
          <div className="absolute left-0 top-0 text-[5.6rem] font-black leading-none tracking-[-0.16em] text-slate-950 [text-shadow:0_0_30px_rgba(37,99,235,0.55),0_0_12px_rgba(56,189,248,0.6)]">
            <span className="bg-[linear-gradient(180deg,_#111827_0%,_#020617_45%,_#2563eb_120%)] bg-clip-text text-transparent">
              {branding.initials}
            </span>
          </div>
          <div className={`absolute right-0 top-1 flex h-20 w-20 items-center justify-center rounded-[26px] border ${frameClass} shadow-[0_0_30px_rgba(37,99,235,0.32)]`}>
            <div className="absolute inset-[1px] rounded-[25px] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.5),_transparent_36%),linear-gradient(145deg,_rgba(2,6,23,1),_rgba(15,23,42,0.96))]" />
            <CalendarCheck2 className="relative text-cyan-300 [filter:drop-shadow(0_0_10px_rgba(56,189,248,0.8))]" size={28} />
            <div className="absolute -bottom-2 -right-2 rounded-full border border-cyan-400/30 bg-slate-950 p-2 text-cyan-300 shadow-[0_0_24px_rgba(37,99,235,0.36)]">
              <Clock3 size={14} />
            </div>
          </div>
        </div>
        <div className={`mt-1 text-[0.92rem] font-semibold uppercase tracking-[0.85em] ${logisticsClass}`}>
          {branding.wordmark}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/0 via-cyan-400/80 to-cyan-400/0" />
          <span className={`text-sm font-black uppercase tracking-[0.44em] ${subClass}`}>
            {subtitle}
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/0 via-cyan-400/80 to-cyan-400/0" />
        </div>
      </div>
    </div>
  );
}
