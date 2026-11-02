import { create } from 'zustand';

export type Tema = 'light' | 'dark';

const TEMA_KEY = 'escalas:tema';

const lerTemaSalvo = (): Tema => {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(TEMA_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const aplicarTema = (tema: Tema) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', tema === 'dark');
  try {
    window.localStorage.setItem(TEMA_KEY, tema);
  } catch {
    // Ignora falhas de armazenamento (ex.: modo privado)
  }
};

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (b: boolean) => void;

  // Tema claro / escuro
  tema: Tema;
  setTema: (tema: Tema) => void;
  toggleTema: () => void;

  // Filtros do calendário
  filtroCidadeId: string | null;
  filtroHubId: string | null;
  filtroStatus: string | null;
  setFiltroCidade: (id: string | null) => void;
  setFiltroHub: (id: string | null) => void;
  setFiltroStatus: (s: string | null) => void;
}

const temaInicial = lerTemaSalvo();
aplicarTema(temaInicial);

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (b) => set({ sidebarOpen: b }),

  tema: temaInicial,
  setTema: (tema) => {
    aplicarTema(tema);
    set({ tema });
  },
  toggleTema: () => get().setTema(get().tema === 'dark' ? 'light' : 'dark'),

  filtroCidadeId: null,
  filtroHubId: null,
  filtroStatus: null,
  setFiltroCidade: (id) => set({ filtroCidadeId: id }),
  setFiltroHub: (id) => set({ filtroHubId: id }),
  setFiltroStatus: (s) => set({ filtroStatus: s }),
}));
