-- ============================================================
-- 0001_schema.sql - Estrutura do Banco de Dados
-- Sistema de Escalas e Agendamento de Coletas por HUB
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Extensões
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type perfil_usuario as enum ('admin', 'supervisor', 'operador', 'visualizador');
  exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_agendamento as enum ('agendado', 'confirmado', 'compareceu', 'ausente', 'cancelado', 'concluido');
  exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_coleta as enum ('programada', 'em_andamento', 'finalizada', 'cancelada');
  exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- Tabela: usuarios (perfil do usuário, vinculado ao auth.users)
-- ------------------------------------------------------------
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  perfil perfil_usuario not null default 'operador',
  cidade_id uuid,
  ativo boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: cidades
-- ------------------------------------------------------------
create table if not exists public.cidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  estado text,
  ativo boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: hubs
-- ------------------------------------------------------------
create table if not exists public.hubs (
  id uuid primary key default gen_random_uuid(),
  sigla text not null,
  nome text not null,
  cidade_id uuid not null references public.cidades(id) on delete restrict,
  ativo boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: usuario_hubs (escopo de HUBs por usuário)
-- ------------------------------------------------------------
create table if not exists public.usuario_hubs (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  hub_id uuid not null references public.hubs(id) on delete cascade,
  primary key (usuario_id, hub_id)
);

-- ------------------------------------------------------------
-- Tabela: condutores
-- ------------------------------------------------------------
create table if not exists public.condutores (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  telefone text,
  cidade_id uuid references public.cidades(id) on delete set null,
  hub_id uuid references public.hubs(id) on delete set null,
  status text not null default 'ativo',
  observacoes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: coletas (evento de coleta agendado)
-- ------------------------------------------------------------
create table if not exists public.coletas (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs(id) on delete restrict,
  data_coleta date not null,
  horario time not null,
  meta integer not null default 0,
  status status_coleta not null default 'programada',
  is_demo boolean not null default false,
  created_by uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: metas_coletas (templates recorrentes por dia da semana)
-- ------------------------------------------------------------
create table if not exists public.metas_coletas (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs(id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6),
  horario time not null,
  meta integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: agendamentos
-- ------------------------------------------------------------
create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  coleta_id uuid not null references public.coletas(id) on delete cascade,
  condutor_id uuid not null references public.condutores(id) on delete cascade,
  status status_agendamento not null default 'agendado',
  is_demo boolean not null default false,
  created_by uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Não permitir o mesmo condutor na mesma coleta
  unique (coleta_id, condutor_id)
);

-- ------------------------------------------------------------
-- Tabela: historico_alteracoes
-- ------------------------------------------------------------
create table if not exists public.historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  entidade_id uuid,
  acao text not null check (acao in ('create', 'update', 'delete')),
  antes jsonb,
  depois jsonb,
  usuario_id uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: configuracoes (thresholds e parâmetros)
-- ------------------------------------------------------------
create table if not exists public.configuracoes (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  valor jsonb not null,
  descricao text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_hubs_cidade on public.hubs(cidade_id);
create index if not exists idx_condutores_hub on public.condutores(hub_id);
create index if not exists idx_condutores_cidade on public.condutores(cidade_id);
create index if not exists idx_coletas_hub_data on public.coletas(hub_id, data_coleta);
create index if not exists idx_coletas_data on public.coletas(data_coleta);
create index if not exists idx_agendamentos_coleta on public.agendamentos(coleta_id);
create index if not exists idx_agendamentos_condutor on public.agendamentos(condutor_id);
create index if not exists idx_historico_entidade on public.historico_alteracoes(entidade, entidade_id);
create index if not exists idx_metas_hub_dia on public.metas_coletas(hub_id, dia_semana);

-- ============================================================
-- Comentários
-- ============================================================
comment on table public.coletas is 'Evento de coleta agendado por HUB, data e horário, com meta de condutores';
comment on table public.metas_coletas is 'Template recorrente de meta por dia da semana (usado para gerar coletas automaticamente)';
comment on column public.coletas.meta is 'Meta de condutores para a coleta';
