// Edge Function: gmail-sync
// Lê a caixa da conta monitorada, captura os e-mails da MAGALOG
// ("Novo Condutor - MAGALOG" e "Reenvio de Senha - MAGALOG")
// e grava em public.mensagens_magalog.
//
// Pode ser chamada de duas formas:
//   1) Pelo Supabase Cron (header x-sync-secret = GMAIL_SYNC_SECRET)
//   2) Pelo sistema, autenticado como admin (Authorization: Bearer <token>)
// Deve ser publicada com verify_jwt = false.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-sync-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const REMETENTE = 'sistema@gflogistica.com.br';
const ASSUNTOS = ['Novo Condutor - MAGALOG', 'Reenvio de Senha - MAGALOG'];

const HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  ccedil: 'ç',
  Ccedil: 'Ç',
  atilde: 'ã',
  Atilde: 'Ã',
  aacute: 'á',
  Aacute: 'Á',
  agrave: 'à',
  Agrave: 'À',
  acirc: 'â',
  Acirc: 'Â',
  eacute: 'é',
  Eacute: 'É',
  ecirc: 'ê',
  Ecirc: 'Ê',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  ocirc: 'ô',
  Ocirc: 'Ô',
  otilde: 'õ',
  Otilde: 'Õ',
  uacute: 'ú',
  Uacute: 'Ú',
};

const ARTEFATOS_TEXTO_RE =
  /&(?:[a-z]+|#\d+|#x[a-f0-9]+);|(?:tilde|acute|grave|circ|cedil|nbsp|quot|apos);|=[0-9A-F]{2}/gi;

const decodificarEntidadesHtml = (texto: string): string => {
  let atual = texto;

  for (let i = 0; i < 3; i += 1) {
    const proximo = atual.replace(/&([a-zA-Z#0-9]+);/g, (match, entity) => {
      if (entity.startsWith('#x')) {
        const code = Number.parseInt(entity.slice(2), 16);
        return Number.isNaN(code) ? match : String.fromCodePoint(code);
      }
      if (entity.startsWith('#')) {
        const code = Number.parseInt(entity.slice(1), 10);
        return Number.isNaN(code) ? match : String.fromCodePoint(code);
      }
      return HTML_ENTITIES[entity] ?? match;
    });

    if (proximo === atual) break;
    atual = proximo;
  }

  return atual;
};

const decodificarQuotedPrintable = (texto: string): string => {
  if (!/=([0-9A-F]{2}|\r?\n)/i.test(texto)) {
    return texto;
  }

  const semSoftBreak = texto.replace(/=\r?\n/g, '');
  const bytes: number[] = [];

  for (let i = 0; i < semSoftBreak.length; i += 1) {
    const atual = semSoftBreak[i];
    const hex = semSoftBreak.slice(i + 1, i + 3);

    if (atual === '=' && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      i += 2;
      continue;
    }

    bytes.push(semSoftBreak.charCodeAt(i));
  }

  return new TextDecoder('utf-8').decode(Uint8Array.from(bytes));
};

const pontuarQualidadeTexto = (texto: string): number => {
  const artefatos = texto.match(ARTEFATOS_TEXTO_RE)?.length ?? 0;
  const linhas = texto.split('\n').filter((linha) => linha.trim()).length;
  return texto.length + linhas * 12 - artefatos * 80;
};

const limparTextoEmail = (texto: string): string =>
  decodificarEntidadesHtml(decodificarQuotedPrintable(texto))
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// ------------------------------------------------------------
// Helpers de parsing
// ------------------------------------------------------------
const decodeBase64Url = (data: string): string => {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
};

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}

const extrairTexto = (payload: GmailPart | undefined): { texto: string; html: string } => {
  let texto = '';
  let html = '';

  const percorrer = (part?: GmailPart) => {
    if (!part) return;
    const mime = part.mimeType ?? '';
    if (part.body?.data) {
      if (mime === 'text/plain') texto += decodeBase64Url(part.body.data) + '\n';
      else if (mime === 'text/html') html += decodeBase64Url(part.body.data) + '\n';
    }
    (part.parts ?? []).forEach(percorrer);
  };

  percorrer(payload);
  return { texto, html };
};

const htmlParaTexto = (html: string): string =>
  limparTextoEmail(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );

const escolherMelhorCorpoEmail = (texto: string, html: string): string => {
  const textoLimpo = limparTextoEmail(texto);
  const htmlLimpo = htmlParaTexto(html);

  if (!textoLimpo) return htmlLimpo;
  if (!htmlLimpo) return textoLimpo;

  return pontuarQualidadeTexto(htmlLimpo) >= pontuarQualidadeTexto(textoLimpo)
    ? htmlLimpo
    : textoLimpo;
};

const capturar = (texto: string, padroes: RegExp[]): string | null => {
  for (const re of padroes) {
    const m = texto.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
};

const classificar = (assunto: string): 'novo_condutor' | 'reenvio_senha' | 'outro' => {
  const a = (assunto || '').toLowerCase();
  if (a.includes('reenvio de senha')) return 'reenvio_senha';
  if (a.includes('novo condutor')) return 'novo_condutor';
  return 'outro';
};

const extrairCampos = (assunto: string, corpo: string) => ({
  nome: capturar(corpo, [
    /nome\s*(?:completo|do\s+condutor|do\s+entregador)?\s*[:\-]\s*([^\n\r<]+)/i,
    /(?:condutor|entregador|colaborador)\s*[:\-]\s*([^\n\r<]+)/i,
  ]),
  cpf: capturar(corpo, [/(\d{3}\.?\d{3}\.?\d{3}\s*-?\s*\d{2})/]),
  telefone: capturar(corpo, [
    /(?:telefone|celular|fone|whatsapp|contato)\s*[:\-]?\s*(\+?\d[\d\s().-]{7,})/i,
  ]),
  senha: capturar(corpo, [
    /(?:senha|password|chave\s*(?:de\s*acesso)?)\s*[:\-]?\s*([A-Za-z0-9@#$%&*!._-]{3,40})/i,
    // assunto do reenvio pode confirmar que existe senha no corpo
    assunto.toLowerCase().includes('senha') ? /([A-Za-z0-9@#$%&*!._-]{6,40})/ : /(?!)/,
  ]),
});

// ------------------------------------------------------------
// Handler
// ------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const registrarFalha = async (mensagem: string) => {
    await supabase
      .from('gmail_sync_state')
      .update({
        last_sync_at: new Date().toISOString(),
        last_status: 'erro',
        last_error: mensagem,
      })
      .eq('id', 1);
  };

  try {
    // ---- Autorização: cron secret OU admin autenticado ----
    const syncSecret = Deno.env.get('GMAIL_SYNC_SECRET') ?? '';
    const enviado = req.headers.get('x-sync-secret') ?? '';
    const viaCron = !!syncSecret && enviado === syncSecret;

    if (!viaCron) {
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
        return json({ error: 'Apenas administradores podem sincronizar' }, 403);
      }
    }

    // ---- Credenciais ----
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      await registrarFalha('Secrets GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados.');
      return json({ error: 'Credenciais do Google não configuradas.' }, 500);
    }

    const { data: cred } = await supabase
      .from('gmail_tokens')
      .select('id, email, refresh_token, access_token, expires_at')
      .order('conectado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cred?.refresh_token) {
      await registrarFalha('Conta Gmail não conectada.');
      return json({ error: 'Conta Gmail não conectada. Autorize a conta no sistema.' }, 400);
    }

    // ---- Renova o access_token quando necessário ----
    let accessToken = cred.access_token ?? '';
    const expirado = !cred.expires_at || new Date(cred.expires_at).getTime() - 120000 < Date.now();

    if (expirado || !accessToken) {
      const refreshRes = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: cred.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const dados = await refreshRes.json();

      if (!refreshRes.ok || !dados.access_token) {
        const detalhe = dados.error === 'invalid_grant'
          ? 'Autorização expirada ou revogada. Conecte a conta Gmail novamente.'
          : dados.error_description || dados.error || 'Falha ao renovar o token.';
        await registrarFalha(detalhe);
        return json({ error: detalhe }, 400);
      }

      accessToken = dados.access_token;
      await supabase
        .from('gmail_tokens')
        .update({
          access_token: accessToken,
          token_type: dados.token_type ?? 'Bearer',
          scope: dados.scope ?? undefined,
          expires_at: new Date(Date.now() + (dados.expires_in ?? 3600) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', cred.id);
    }

    // ---- Monta a busca ----
    let corpoReq: Record<string, unknown> = {};
    try {
      corpoReq = await req.json();
    } catch {
      corpoReq = {};
    }

    const { data: estado } = await supabase
      .from('gmail_sync_state')
      .select('last_sync_at')
      .eq('id', 1)
      .maybeSingle();

    const dias = estado?.last_sync_at ? 3 : 60;
    const assuntosOr = ASSUNTOS.map((a) => `subject:"${a}"`).join(' ');
    const query =
      (corpoReq?.query as string) ||
      `from:${REMETENTE} {${assuntosOr}} newer_than:${dias}d`;

    const listRes = await fetch(
      `${GMAIL_API}/messages?maxResults=100&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const lista = await listRes.json();

    if (!listRes.ok) {
      const detalhe = lista?.error?.message || 'Falha ao consultar a Gmail API.';
      await registrarFalha(detalhe);
      return json({ error: detalhe, query }, 400);
    }

    const ids: string[] = (lista.messages ?? []).map((m: { id: string }) => m.id);
    let novas = 0;
    let atualizadas = 0;
    const erros: string[] = [];

    for (const id of ids) {
      try {
        const msgRes = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!msgRes.ok) {
          erros.push(`Mensagem ${id}: HTTP ${msgRes.status}`);
          continue;
        }
        const msg = await msgRes.json();

        const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
        const header = (nome: string) =>
          headers.find((h) => h.name.toLowerCase() === nome.toLowerCase())?.value ?? '';

        const assunto = header('Subject');
        const { texto, html } = extrairTexto(msg.payload);
        const corpo = escolherMelhorCorpoEmail(texto, html);
        const campos = extrairCampos(assunto, corpo);

        const registro = {
          gmail_message_id: msg.id,
          gmail_thread_id: msg.threadId ?? null,
          tipo: classificar(assunto),
          assunto: assunto || null,
          remetente: header('From') || null,
          nome: campos.nome,
          cpf: campos.cpf,
          telefone: campos.telefone,
          senha: campos.senha,
          corpo: corpo.slice(0, 20000),
          recebido_em: header('Date') ? new Date(header('Date')).toISOString() : null,
        };

        const { data: salvo, error } = await supabase
          .from('mensagens_magalog')
          .upsert(registro, { onConflict: 'gmail_message_id', ignoreDuplicates: false })
          .select('id, created_at, updated_at');

        if (error) {
          erros.push(`Mensagem ${id}: ${error.message}`);
          continue;
        }
        const linha = salvo?.[0];
        if (linha && linha.created_at === linha.updated_at) novas++;
        else atualizadas++;
      } catch (e) {
        erros.push(`Mensagem ${id}: ${e instanceof Error ? e.message : 'erro'}`);
      }
    }

    const { count: total } = await supabase
      .from('mensagens_magalog')
      .select('id', { count: 'exact', head: true });

    await supabase
      .from('gmail_sync_state')
      .update({
        last_sync_at: new Date().toISOString(),
        last_status: erros.length > 0 ? 'parcial' : 'ok',
        last_error: erros.length > 0 ? erros.slice(0, 3).join(' | ') : null,
        total_mensagens: total ?? 0,
      })
      .eq('id', 1);

    return json({
      success: true,
      query,
      encontradas: ids.length,
      novas,
      atualizadas,
      erros,
      total_mensagens: total ?? 0,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro inesperado';
    await registrarFalha(mensagem);
    return json({ error: mensagem }, 500);
  }
});
