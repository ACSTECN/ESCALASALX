import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { dbMensagensMagalog } from '@/lib/db';
import type { MensagemMagalog } from '@/types';

interface MensagensState {
  naoLidas: number;
  alerta: MensagemMagalog | null;
  carregar: () => Promise<void>;
  limparAlerta: () => void;
  atualizarContador: () => Promise<void>;
}

// Controle em memória (nunca persistido) para detectar mensagens novas
let ultimaMensagemVista: string | null = null;
let primeiraCarga = true;

export const useMensagensStore = create<MensagensState>((set) => ({
  naoLidas: 0,
  alerta: null,

  // Recarrega o contador e dispara o alerta quando chega uma mensagem nova
  carregar: async () => {
    const { count } = await dbMensagensMagalog.countNaoLidas();

    const { data } = await supabase
      .from('mensagens_magalog')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const maisRecente = (data as MensagemMagalog) || null;

    if (primeiraCarga) {
      ultimaMensagemVista = maisRecente?.id ?? null;
      primeiraCarga = false;
    } else if (maisRecente && maisRecente.id !== ultimaMensagemVista) {
      ultimaMensagemVista = maisRecente.id;
      if (!maisRecente.lida) {
        set({ alerta: maisRecente });
      }
    }

    set({ naoLidas: count ?? 0 });
  },

  atualizarContador: async () => {
    const { count } = await dbMensagensMagalog.countNaoLidas();
    set({ naoLidas: count ?? 0 });
  },

  limparAlerta: () => set({ alerta: null }),
}));
