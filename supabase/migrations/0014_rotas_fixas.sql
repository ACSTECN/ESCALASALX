-- ============================================================
-- 0014_rotas_fixas.sql
-- Area de rotas fixas: cadastro de rotas (ex.: Campinas) e
-- vinculo da rota no cadastro do condutor/entregador.
-- Execute no SQL Editor do Supabase (ou via supabase db push)
-- ============================================================

-- ------------------------------------------------------------
-- Tabela: rotas_fixas
-- ------------------------------------------------------------
create table if not exists public.rotas_fixas (
  id uuid primary key default gen_random_uuid(),
  sigla text not null,
  nome text,
  hub_id uuid references public.hubs(id) on delete set null,
  ativo boolean not null default true,
  observacao text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rotas_fixas is 'Rotas fixas dos entregadores; a sigla e usada nas exportacoes';
comment on column public.rotas_fixas.sigla is 'Sigla da rota fixa exibida junto ao nome nos agendamentos';

-- Evita duas rotas com a mesma sigla (ignora maiusculas/minusculas)
create unique index if not exists uq_rotas_fixas_sigla on public.rotas_fixas (upper(sigla));

-- ------------------------------------------------------------
-- Vinculo da rota fixa no condutor
-- ------------------------------------------------------------
alter table public.condutores
  add column if not exists rota_fixa_id uuid references public.rotas_fixas(id) on delete set null;

create index if not exists idx_condutores_rota_fixa on public.condutores(rota_fixa_id);

-- ------------------------------------------------------------
-- Trigger de updated_at
-- ------------------------------------------------------------
drop trigger if exists trg_rotas_fixas_updated on public.rotas_fixas;
create trigger trg_rotas_fixas_updated before update on public.rotas_fixas
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.rotas_fixas enable row level security;

drop policy if exists "rotas_fixas_select" on public.rotas_fixas;
create policy "rotas_fixas_select" on public.rotas_fixas
  for select using (true);

drop policy if exists "rotas_fixas_write" on public.rotas_fixas;
create policy "rotas_fixas_write" on public.rotas_fixas
  for all using (public.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (public.get_user_perfil() in ('admin', 'supervisor', 'operador'));
