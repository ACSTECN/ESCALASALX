// Edge Function: gmail-oauth-callback
// Recebe o "code" do Google, troca por tokens e grava o refresh_token.
// Deve ser publicada com verify_jwt = false (chamada pelo Google, sem JWT).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

const paginaResultado = (titulo: string, mensagem: string, ok: boolean) =>
  new Response(
    `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#020617;color:#e2e8f0}
  .card{max-width:460px;padding:32px;border-radius:20px;border:1px solid rgba(34,211,238,.25);
        background:rgba(15,23,42,.9);box-shadow:0 24px 70px rgba(2,6,23,.6);text-align:center}
  h1{font-size:18px;margin:0 0 12px;color:${ok ? '#67e8f9' : '#fca5a5'}}
  p{font-size:14px;line-height:1.6;color:#94a3b8;margin:0}
</style></head>
<body><div class="card"><h1>${titulo}</h1><p>${mensagem}</p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

Deno.serve(async (req) => {
  const appUrl = Deno.env.get('APP_URL') ?? '';
  const destino = (query: string) =>
    appUrl ? Response.redirect(`${appUrl.replace(/\/$/, '')}${query}`, 302) : null;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    if (oauthError) {
      return (
        destino(`/?gmail=erro&motivo=${encodeURIComponent(oauthError)}`) ??
        paginaResultado('Autorização negada', `O Google retornou: ${oauthError}`, false)
      );
    }

    if (!code || !state) {
      return paginaResultado(
        'Requisição inválida',
        'Parâmetros "code" ou "state" ausentes no retorno do Google.',
        false
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Valida o state (proteção CSRF) e o consome
    const { data: stateRow } = await supabase
      .from('gmail_oauth_state')
      .select('state, usado')
      .eq('state', state)
      .maybeSingle();

    if (!stateRow || stateRow.usado) {
      return paginaResultado(
        'Sessão expirada',
        'O link de autorização expirou ou já foi utilizado. Inicie a conexão novamente pelo sistema.',
        false
      );
    }
    await supabase.from('gmail_oauth_state').update({ usado: true }).eq('state', state);

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      return paginaResultado(
        'Configuração incompleta',
        'Os secrets GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI não estão configurados.',
        false
      );
    }

    // Troca o code pelos tokens
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      return paginaResultado(
        'Falha ao obter tokens',
        tokens.error_description || tokens.error || 'O Google recusou a troca do código.',
        false
      );
    }

    // Descobre qual conta foi autorizada
    let email = Deno.env.get('GMAIL_ACCOUNT') ?? 'conta-gmail';
    try {
      const perfilRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      if (perfilRes.ok) {
        const perfil = await perfilRes.json();
        if (perfil?.emailAddress) email = perfil.emailAddress;
      }
    } catch {
      // mantém o e-mail padrão
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    // Preserva o refresh_token anterior caso o Google não envie um novo
    const { data: existente } = await supabase
      .from('gmail_tokens')
      .select('refresh_token')
      .eq('email', email)
      .maybeSingle();

    const { error: upsertError } = await supabase.from('gmail_tokens').upsert(
      {
        email,
        refresh_token: tokens.refresh_token ?? existente?.refresh_token ?? null,
        access_token: tokens.access_token,
        token_type: tokens.token_type ?? 'Bearer',
        scope: tokens.scope ?? null,
        expires_at: expiresAt,
        conectado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    if (upsertError) {
      return paginaResultado('Erro ao salvar credenciais', upsertError.message, false);
    }

    return (
      destino('/?gmail=conectado') ??
      paginaResultado(
        'Gmail conectado',
        `A conta ${email} foi autorizada com sucesso. Você já pode voltar ao sistema.`,
        true
      )
    );
  } catch (err) {
    return paginaResultado(
      'Erro inesperado',
      err instanceof Error ? err.message : 'Não foi possível concluir a autorização.',
      false
    );
  }
});
