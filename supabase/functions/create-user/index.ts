// Edge Function: create-user
// Cria um novo usuário no auth.users e na tabela public.usuarios.
// Requer que o chamador seja admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    // Obtém o usuário autenticado (chamador)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: caller } = await supabase.auth.getUser(token);
    if (!caller?.user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verifica se o chamador é admin
    const { data: callerProfile } = await supabase
      .from('usuarios')
      .select('perfil')
      .eq('id', caller.user.id)
      .single();

    if (!callerProfile || callerProfile.perfil !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem criar usuários' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, password, nome, perfil = 'operador' } = await req.json();

    if (!email || !password || !nome) {
      return new Response(JSON.stringify({ error: 'Email, senha e nome são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cria usuario no auth. O trigger on_auth_user_created ja insere o perfil
    // em public.usuarios, por isso usamos upsert para aplicar o perfil escolhido.
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, perfil },
    });

    if (authError || !newUser?.user) {
      return new Response(JSON.stringify({ error: authError?.message || 'Erro ao criar usuário' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cria ou atualiza o perfil na tabela public.usuarios
    const { error: profileError } = await supabase
      .from('usuarios')
      .upsert(
        {
          id: newUser.user.id,
          nome,
          email,
          perfil,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: newUser.user.id, email, nome, perfil },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
