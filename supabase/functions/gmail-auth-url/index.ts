// Edge Function: gmail-auth-url
// Gera a URL de consentimento OAuth 2.0 do Google (escopo gmail.readonly).
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

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

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

    const token = authHeader.replace('Bearer ', '');
    const { data: caller } = await supabase.auth.getUser(token);
    if (!caller?.user) return json({ error: 'Token inválido' }, 401);

    const { data: callerProfile } = await supabase
      .from('usuarios')
      .select('perfil')
      .eq('id', caller.user.id)
      .single();

    if (!callerProfile || callerProfile.perfil !== 'admin') {
      return json({ error: 'Apenas administradores podem conectar a conta Gmail' }, 403);
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      return json(
        {
          error:
            'Credenciais ausentes. Configure os secrets GOOGLE_CLIENT_ID e GOOGLE_REDIRECT_URI nas Edge Functions.',
        },
        500
      );
    }

    // Limpa states antigos (mais de 1h) e gera um novo
    const umHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase.from('gmail_oauth_state').delete().lt('created_at', umHoraAtras);

    const state = crypto.randomUUID();
    const { error: stateError } = await supabase
      .from('gmail_oauth_state')
      .insert({ state });
    if (stateError) return json({ error: stateError.message }, 400);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
      login_hint: Deno.env.get('GMAIL_ACCOUNT') ?? 'contatocrlogistics@gmail.com',
    });

    return json({
      success: true,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro inesperado' }, 500);
  }
});
