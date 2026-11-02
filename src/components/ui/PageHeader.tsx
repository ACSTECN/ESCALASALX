import type { ReactNode } from 'react';
import { branding } from '@/lib/branding';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-700/80">
          {branding.fullName}
        </div>
        <h1 className="text-2xl font-black tracking-[0.04em] text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
