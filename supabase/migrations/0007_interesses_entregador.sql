-- ============================================================
-- 0007_interesses_entregador.sql
-- Lista de espera: interesses de entregadores (link público)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ------------------------------------------------------------
-- Tabela: interesses_entregador
-- Registra o interesse de um entregador em uma data/HUB
-- ------------------------------------------------------------
create table if not exists public.interesses_entregador (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  telefone text,
  hub_id uuid not null references public.hubs(id) on delete cascade,
  data_interesse date not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'recusado')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index if not exists idx_interesses_hub_data
  on public.interesses_entregador(hub_id, data_interesse);
create index if not exists idx_interesses_cpf
  on public.interesses_entregador(cpf);
create index if not exists idx_interesses_status
  on public.interesses_entregador(status);

-- Evita cadastro repetido: mesmo CPF no mesmo HUB e data
create unique index if not exists uq_interesses_cpf_hub_data
  on public.interesses_entregador(cpf, hub_id, data_interesse);

-- ------------------------------------------------------------
-- Trigger de updated_at (função já existe na migração 0004)
-- ------------------------------------------------------------
drop trigger if exists trg_interesses_updated on public.interesses_entregador;
create trigger trg_interesses_updated before update on public.interesses_entregador
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.interesses_entregador enable row level security;

-- Público (anon): só pode INSERIR um interesse (envio do link)
drop policy if exists "interesses_insert_public" on public.interesses_entregador;
create policy "interesses_insert_public" on public.interesses_entregador
  for insert with check (true);

-- Usuários internos: visualizar a lista de espera
drop policy if exists "interesses_select_interno" on public.interesses_entregador;
create policy "interesses_select_interno" on public.interesses_entregador
  for select using (public.get_user_perfil() in ('admin', 'supervisor', 'operador', 'visualizador'));

-- Usuários internos com escrita: aprovar / recusar
drop policy if exists "interesses_update_interno" on public.interesses_entregador;
create policy "interesses_update_interno" on public.interesses_entregador
  for update using (public.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (public.get_user_perfil() in ('admin', 'supervisor', 'operador'));

-- Usuários internos com escrita: excluir
drop policy if exists "interesses_delete_interno" on public.interesses_entregador;
create policy "interesses_delete_interno" on public.interesses_entregador
  for delete using (public.get_user_perfil() in ('admin', 'supervisor', 'operador'));

comment on table public.interesses_entregador is 'Interesses (lista de espera) enviados pelos entregadores via link público';
