import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

// Inicializa e mantém o estado de autenticação
export const useInitAuth = () => {
  const { refreshProfile, setUser, initialized } = useAuthStore();

  useEffect(() => {
    if (initialized) return;
    refreshProfile();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (session) {
        refreshProfile();
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [initialized, refreshProfile, setUser]);
};

export { useAuthStore };
