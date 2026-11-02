// Edge Function: gmail-disconnect
// Remove as credenciais OAuth salvas (revoga o acesso no Google e limpa o banco).
// Requer que o chamador seja admin.

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

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('perfil')
      .eq('id', caller.user.id)
      .single();

    if (perfil?.perfil !== 'admin') {
      return json({ error: 'Apenas administradores podem desconectar a conta Gmail' }, 403);
    }

    // Revoga o acesso no Google (melhor esforço)
    const { data: cred } = await supabase
      .from('gmail_tokens')
      .select('refresh_token, access_token')
      .order('conectado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    const tokenParaRevogar = cred?.refresh_token || cred?.access_token;
    if (tokenParaRevogar) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenParaRevogar)}`,
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
      } catch {
        // segue com a remoção local mesmo se a revogação falhar
      }
    }

    const { error } = await supabase
      .from('gmail_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) return json({ error: error.message }, 400);

    await supabase
      .from('gmail_sync_state')
      .update({ last_status: 'desconectado', last_error: null })
      .eq('id', 1);

    return json({ success: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro inesperado' }, 500);
  }
});
