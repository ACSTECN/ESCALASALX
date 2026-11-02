-- ============================================================
-- 0012_gmail_integracao.sql
-- Integração com a Gmail API (conta contatocrlogistics@gmail.com)
-- Monitora e-mails de sistema@gflogistica.com.br (MAGALOG):
--   - "Novo Condutor - MAGALOG"
--   - "Reenvio de Senha - MAGALOG"
-- Execute no SQL Editor do Supabase (ou via supabase db push)
-- ============================================================

-- ------------------------------------------------------------
-- Tabela: gmail_tokens
-- Guarda as credenciais OAuth (refresh_token / access_token).
-- Acesso EXCLUSIVO via Edge Function com servaice_role:
-- RLS habilitado e SEM policies públicas.
-- ------------------------------------------------------------
create table if not exists public.gmail_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  refresh_token text,
  access_token text,
  token_type text default 'Bearer',
  scope text,
  expires_at timestamptz,
  conectado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_tokens enable row level security;

-- ------------------------------------------------------------
-- Tabela: gmail_oauth_state
-- Controla o parâmetro "state" do fluxo OAuth (proteção CSRF).
-- Uso apenas server-side (Edge Functions).
-- ------------------------------------------------------------
create table if not exists public.gmail_oauth_state (
  state text primary key,
  usado boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.gmail_oauth_state enable row level security;

-- ------------------------------------------------------------
-- Tabela: gmail_sync_state
-- Estado da última sincronização (linha única).
-- ------------------------------------------------------------
create table if not exists public.gmail_sync_state (
  id int primary key default 1,
  last_sync_at timestamptz,
  last_status text,
  last_error text,
  total_mensagens int not null default 0,
  constraint gmail_sync_state_single_row check (id = 1)
);

insert into public.gmail_sync_state (id) values (1)
  on conflict (id) do nothing;

alter table public.gmail_sync_state enable row level security;

drop policy if exists "gmail_sync_state_select_admin" on public.gmail_sync_state;
create policy "gmail_sync_state_select_admin" on public.gmail_sync_state
  for select using (public.is_admin());

-- ------------------------------------------------------------
-- Tabela: mensagens_magalog
-- Cada e-mail capturado da MAGALOG (novo condutor / reenvio de senha).
-- ------------------------------------------------------------
create table if not exists public.mensagens_magalog (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id text,
  tipo text not null default 'outro'
    check (tipo in ('novo_condutor', 'reenvio_senha', 'outro')),
  assunto text,
  remetente text,
  nome text,
  cpf text,
  telefone text,
  senha text,
  corpo text,
  recebido_em timestamptz,
  lida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mensagens_magalog_recebido
  on public.mensagens_magalog(recebido_em desc);
create index if not exists idx_mensagens_magalog_tipo
  on public.mensagens_magalog(tipo);
create index if not exists idx_mensagens_magalog_lida
  on public.mensagens_magalog(lida);

drop trigger if exists trg_mensagens_magalog_updated on public.mensagens_magalog;
create trigger trg_mensagens_magalog_updated before update on public.mensagens_magalog
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security: mensagens_magalog
-- ============================================================
alter table public.mensagens_magalog enable row level security;

-- Leitura: todos os perfis internos
drop policy if exists "mensagens_magalog_select" on public.mensagens_magalog;
create policy "mensagens_magalog_select" on public.mensagens_magalog
  for select using (
    public.get_user_perfil() in ('admin', 'supervisor', 'operador', 'visualizador')
  );

-- Marcar como lida: admin / supervisor / operador
drop policy if exists "mensagens_magalog_update" on public.mensagens_magalog;
create policy "mensagens_magalog_update" on public.mensagens_magalog
  for update using (public.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (public.get_user_perfil() in ('admin', 'supervisor', 'operador'));

-- Excluir: admin / supervisor
drop policy if exists "mensagens_magalog_delete" on public.mensagens_magalog;
create policy "mensagens_magalog_delete" on public.mensagens_magalog
  for delete using (public.get_user_perfil() in ('admin', 'supervisor'));

-- ============================================================
-- Realtime (opcional): permite notificação em tempo real no front
-- ============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.mensagens_magalog;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

comment on table public.mensagens_magalog is 'E-mails MAGALOG capturados via Gmail API (novo condutor / reenvio de senha)';
comment on column public.mensagens_magalog.senha is 'Senha recebida por e-mail (campo isolado para consulta rápida)';
comment on table public.gmail_tokens is 'Credenciais OAuth da conta Gmail monitorada (acesso apenas service_role)';
