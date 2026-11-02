import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray';
  className?: string;
}

const variants = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  gray: 'bg-slate-100 text-slate-600',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return <span className={`badge ${variants[variant]} ${className}`}>{children}</span>;
}
