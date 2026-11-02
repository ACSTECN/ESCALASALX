import { create } from 'zustand';
import type { Usuario, PerfilUsuario } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: Usuario | null;
  loading: boolean;
  initialized: boolean;
  setUser: (u: Usuario | null) => void;
  setLoading: (b: boolean) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (u) => set({ user: u }),
  setLoading: (b) => set({ loading: b }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
  refreshProfile: async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      set({ user: null, loading: false, initialized: true });
      return;
    }
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.session.user.id)
      .single();
    set({ user: (data as Usuario) || null, loading: false, initialized: true });
  },
}));

export const hasPermission = (
  perfil: PerfilUsuario | undefined,
  required: PerfilUsuario[]
): boolean => {
  if (!perfil) return false;
  return required.includes(perfil);
};

export const canWrite = (perfil: PerfilUsuario | undefined): boolean =>
  hasPermission(perfil, ['admin', 'supervisor', 'operador']);

export const canManageGoals = (perfil: PerfilUsuario | undefined): boolean =>
  hasPermission(perfil, ['admin', 'supervisor']);

export const isAdmin = (perfil: PerfilUsuario | undefined): boolean =>
  hasPermission(perfil, ['admin']);
