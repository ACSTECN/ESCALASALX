// Edge Function: gmail-status
// Retorna o estado da conexão com o Gmail (sem expor tokens). Requer admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autorizado' }, 401);

    const { data: caller } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!caller?.user) return json({ error: 'Token inválido' }, 401);

    const { data: callerProfile } = await supabase
      .from('usuarios')
      .select('perfil')
      .eq('id', caller.user.id)
      .single();

    if (callerProfile?.perfil !== 'admin') {
      return json({ error: 'Apenas administradores podem ver o status da integração' }, 403);
    }

    const { data: token } = await supabase
      .from('gmail_tokens')
      .select('email, scope, conectado_em, expires_at, updated_at, refresh_token')
      .order('conectado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: sync } = await supabase
      .from('gmail_sync_state')
      .select('last_sync_at, last_status, last_error, total_mensagens')
      .eq('id', 1)
      .maybeSingle();

    const { count: naoLidas } = await supabase
      .from('mensagens_magalog')
      .select('id', { count: 'exact', head: true })
      .eq('lida', false);

    const { count: total } = await supabase
      .from('mensagens_magalog')
      .select('id', { count: 'exact', head: true });

    return json({
      conectado: !!token?.refresh_token,
      email: token?.email ?? null,
      escopo: token?.scope ?? null,
      conectado_em: token?.conectado_em ?? null,
      sincronizado_em: sync?.last_sync_at ?? null,
      ultimo_status: sync?.last_status ?? null,
      ultimo_erro: sync?.last_error ?? null,
      total_mensagens: total ?? sync?.total_mensagens ?? 0,
      nao_lidas: naoLidas ?? 0,
      sync_configurado: !!Deno.env.get('GMAIL_SYNC_SECRET'),
      url_callback: Deno.env.get('GOOGLE_REDIRECT_URI') ?? null,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro inesperado' }, 500);
  }
});
