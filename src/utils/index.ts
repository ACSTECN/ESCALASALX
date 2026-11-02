import {
  startOfWeek,
  addDays,
  format,
  isSameDay,
  parseISO,
  endOfWeek,
  isWithinInterval,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ThresholdsOcupacao } from '@/types';

// Formata data ISO (yyyy-MM-dd) para dd/MM/yyyy
export const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
};

// Formata horario "HH:mm:ss" para "HH:mm"
export const formatTime = (time: string): string => {
  if (!time) return '';
  return time.slice(0, 5);
};

// Retorna array de 7 dias (segunda a domingo) da semana de uma data
export const getWeekDays = (date: Date): Date[] => {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // segunda
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const isToday = (date: Date): boolean => isSameDay(date, new Date());

export const isWithinWeek = (date: Date, weekStart: Date): boolean => {
  const start = startOfWeek(weekStart, { weekStartsOn: 1 });
  const end = endOfWeek(weekStart, { weekStartsOn: 1 });
  return isWithinInterval(date, { start, end });
};

export const formatWeekLabel = (weekStart: Date): string => {
  const days = getWeekDays(weekStart);
  const first = days[0];
  const last = days[6];
  if (first.getMonth() === last.getMonth()) {
    return `${format(first, "dd", { locale: ptBR })} a ${format(last, "dd 'de' MMMM", { locale: ptBR })}`;
  }
  return `${format(first, "dd 'de' MMM", { locale: ptBR })} a ${format(last, "dd 'de' MMM", { locale: ptBR })}`;
};

// Cor do cartão conforme ocupação
export const getOccupancyColor = (
  ocupacao: number,
  status: string,
  thresholds: ThresholdsOcupacao = { vermelho: 70, amarelo: 100, verde: 100 }
): 'green' | 'yellow' | 'red' | 'blue' | 'gray' => {
  if (status === 'finalizada') return 'gray';
  if (status === 'em_andamento') return 'blue';
  if (status === 'cancelada') return 'gray';
  if (ocupacao >= thresholds.verde) return 'green';
  if (ocupacao >= thresholds.vermelho) return 'yellow';
  return 'red';
};

export const colorClasses: Record<
  string,
  { bar: string; bg: string; text: string; border: string; badge: string }
> = {
  green: {
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  yellow: {
    bar: 'bg-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  red: {
    bar: 'bg-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  blue: {
    bar: 'bg-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  gray: {
    bar: 'bg-slate-400',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-600',
  },
};

// Saudação dinâmica
export const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

// Download de arquivo (CSV/Excel)
export const downloadFile = (
  content: string | Blob,
  filename: string,
  type = 'text/csv;charset=utf-8;'
) => {
  const blob = content instanceof Blob ? content : new Blob(['\uFEFF' + content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Gerar CSV a partir de array de objetos
export const toCSV = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const separator = ';';
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    if (s.includes(separator) || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const csv = [
    `sep=${separator}`,
    headers.map((h) => escape(h)).join(separator),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(separator)),
  ];
  return csv.join('\n');
};
