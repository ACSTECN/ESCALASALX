-- ============================================================
-- 0015_alx_schema.sql
-- Estrutura isolada do ALX no mesmo projeto Supabase, sem
-- alterar nem reutilizar as tabelas public.* do CR.
-- ============================================================

create extension if not exists "pgcrypto";

create schema if not exists alx;

grant usage on schema alx to anon, authenticated, service_role;

do $$ begin
  create type alx.perfil_usuario as enum ('admin', 'supervisor', 'operador', 'visualizador');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type alx.status_agendamento as enum ('agendado', 'confirmado', 'compareceu', 'ausente', 'cancelado', 'concluido');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type alx.status_coleta as enum ('programada', 'em_andamento', 'finalizada', 'cancelada');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- TABELAS
-- ============================================================

create table if not exists alx.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  perfil alx.perfil_usuario not null default 'operador',
  cidade_id uuid,
  ativo boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alx.cidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  estado text,
  ativo boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table alx.usuarios
  drop constraint if exists usuarios_cidade_id_fkey;

alter table alx.usuarios
  add constraint usuarios_cidade_id_fkey
  foreign key (cidade_id) references alx.cidades(id) on delete set null;

create table if not exists alx.hubs (
  id uuid primary key default gen_random_uuid(),
  sigla text not null,
  nome text not null,
  cidade_id uuid not null references alx.cidades(id) on delete restrict,
  ativo boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alx.usuario_hubs (
  usuario_id uuid not null references alx.usuarios(id) on delete cascade,
  hub_id uuid not null references alx.hubs(id) on delete cascade,
  primary key (usuario_id, hub_id)
);

create table if not exists alx.rotas_fixas (
  id uuid primary key default gen_random_uuid(),
  sigla text not null,
  nome text,
  hub_id uuid references alx.hubs(id) on delete set null,
  ativo boolean not null default true,
  observacao text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alx.condutores (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  cpf text,
  telefone text,
  fez_integracao boolean not null default false,
  cidade_id uuid references alx.cidades(id) on delete set null,
  hub_id uuid references alx.hubs(id) on delete set null,
  rota_fixa_id uuid references alx.rotas_fixas(id) on delete set null,
  status text not null default 'ativo',
  observacoes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alx.coletas (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references alx.hubs(id) on delete restrict,
  data_coleta date not null,
  horario time not null,
  meta integer not null default 0,
  status alx.status_coleta not null default 'programada',
  is_demo boolean not null default false,
  created_by uuid references alx.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alx.metas_coletas (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references alx.hubs(id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6),
  horario time not null,
  meta integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alx.agendamentos (
  id uuid primary key default gen_random_uuid(),
  coleta_id uuid not null references alx.coletas(id) on delete cascade,
  condutor_id uuid not null references alx.condutores(id) on delete cascade,
  status alx.status_agendamento not null default 'agendado',
  is_demo boolean not null default false,
  created_by uuid references alx.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coleta_id, condutor_id)
);

create table if not exists alx.interesses_entregador (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  telefone text,
  fez_integracao boolean,
  hub_id uuid not null references alx.hubs(id) on delete cascade,
  data_interesse date not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'recusado')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alx.historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  entidade_id uuid,
  acao text not null check (acao in ('create', 'update', 'delete')),
  antes jsonb,
  depois jsonb,
  usuario_id uuid references alx.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists alx.configuracoes (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  valor jsonb not null,
  descricao text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDICES
-- ============================================================

create index if not exists idx_alx_hubs_cidade on alx.hubs(cidade_id);
create index if not exists idx_alx_condutores_hub on alx.condutores(hub_id);
create index if not exists idx_alx_condutores_cidade on alx.condutores(cidade_id);
create index if not exists idx_alx_condutores_cpf on alx.condutores(cpf);
create index if not exists idx_alx_condutores_rota_fixa on alx.condutores(rota_fixa_id);
create index if not exists idx_alx_coletas_hub_data on alx.coletas(hub_id, data_coleta);
create index if not exists idx_alx_coletas_data on alx.coletas(data_coleta);
create index if not exists idx_alx_agendamentos_coleta on alx.agendamentos(coleta_id);
create index if not exists idx_alx_agendamentos_condutor on alx.agendamentos(condutor_id);
create index if not exists idx_alx_historico_entidade on alx.historico_alteracoes(entidade, entidade_id);
create index if not exists idx_alx_metas_hub_dia on alx.metas_coletas(hub_id, dia_semana);
create index if not exists idx_alx_interesses_hub_data on alx.interesses_entregador(hub_id, data_interesse);
create index if not exists idx_alx_interesses_cpf on alx.interesses_entregador(cpf);
create index if not exists idx_alx_interesses_status on alx.interesses_entregador(status);

create unique index if not exists uq_alx_rotas_fixas_sigla on alx.rotas_fixas (upper(sigla));
create unique index if not exists uq_alx_metas_hub_dia_semana on alx.metas_coletas(hub_id, dia_semana);
create unique index if not exists uq_alx_coletas_hub_data on alx.coletas(hub_id, data_coleta);
create unique index if not exists uq_alx_interesses_cpf_hub_data
  on alx.interesses_entregador(cpf, hub_id, data_interesse);

-- ============================================================
-- GRANTS
-- ============================================================

grant select, insert, update, delete on all tables in schema alx to authenticated;
grant insert on alx.interesses_entregador to anon;
grant select on alx.hubs to anon;
grant select on alx.cidades to anon;
grant all on all tables in schema alx to service_role;

-- ============================================================
-- FUNCOES AUXILIARES
-- ============================================================

create or replace function alx.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function alx.get_user_perfil()
returns alx.perfil_usuario
language sql
stable
security definer
set search_path = alx, public
as $$
  select perfil from alx.usuarios where id = auth.uid() limit 1;
$$;

create or replace function alx.is_admin()
returns boolean
language sql
stable
security definer
set search_path = alx, public
as $$
  select coalesce(alx.get_user_perfil() = 'admin', false);
$$;

create or replace function alx.get_user_hub_ids()
returns uuid[]
language sql
stable
security definer
set search_path = alx, public
as $$
  select case
    when alx.is_admin() then (select coalesce(array_agg(id), array[]::uuid[]) from alx.hubs)
    else (
      select coalesce(array_agg(hub_id), array[]::uuid[])
      from alx.usuario_hubs
      where usuario_id = auth.uid()
    )
  end;
$$;

create or replace function alx.user_can_access_hub(hub uuid)
returns boolean
language sql
stable
security definer
set search_path = alx, public
as $$
  select alx.is_admin() or hub = any(alx.get_user_hub_ids());
$$;

create or replace function alx.count_agendamentos_ativos(coleta uuid)
returns integer
language sql
stable
security definer
set search_path = alx, public
as $$
  select count(*)::integer
  from alx.agendamentos
  where coleta_id = coleta
    and status <> 'cancelado';
$$;

create or replace function alx.count_vagas_disponiveis(coleta uuid)
returns integer
language sql
stable
security definer
set search_path = alx, public
as $$
  select greatest(c.meta - alx.count_agendamentos_ativos(coleta), 0)
  from alx.coletas c
  where c.id = coleta;
$$;

create or replace function alx.log_alteracao()
returns trigger
language plpgsql
security definer
set search_path = alx, public
as $$
declare
  v_entidade text;
  v_antes jsonb;
  v_depois jsonb;
  v_acao text;
  v_id uuid;
begin
  v_entidade = tg_table_name;

  if tg_op = 'INSERT' then
    v_acao = 'create';
    v_antes = null;
    v_depois = to_jsonb(new);
    v_id = new.id;
  elsif tg_op = 'UPDATE' then
    v_acao = 'update';
    v_antes = to_jsonb(old);
    v_depois = to_jsonb(new);
    v_id = new.id;
  elsif tg_op = 'DELETE' then
    v_acao = 'delete';
    v_antes = to_jsonb(old);
    v_depois = null;
    v_id = old.id;
  end if;

  if v_antes is not null and v_depois is not null then
    v_antes = v_antes - 'updated_at';
    v_depois = v_depois - 'updated_at';
    if v_antes = v_depois then
      return coalesce(new, old);
    end if;
  end if;

  insert into alx.historico_alteracoes (entidade, entidade_id, acao, antes, depois, usuario_id)
  values (v_entidade, v_id, v_acao, v_antes, v_depois, auth.uid());

  return coalesce(new, old);
end;
$$;

create or replace function alx.gerar_coletas_recorrentes(
  p_hub_id uuid default null,
  p_data_inicio date default current_date,
  p_data_fim date default (current_date + interval '14 days')::date
)
returns integer
language plpgsql
security definer
set search_path = alx, public
as $$
declare
  v_meta record;
  v_data date;
  v_dia_semana integer;
  v_count integer := 0;
begin
  for v_meta in
    select *
    from alx.metas_coletas
    where ativo = true
      and (p_hub_id is null or hub_id = p_hub_id)
  loop
    v_data := p_data_inicio;
    while v_data <= p_data_fim loop
      v_dia_semana := extract(dow from v_data)::integer;
      if v_dia_semana = v_meta.dia_semana then
        insert into alx.coletas (hub_id, data_coleta, horario, meta)
        values (v_meta.hub_id, v_data, v_meta.horario, v_meta.meta)
        on conflict (hub_id, data_coleta) do update
          set horario = excluded.horario,
              meta = excluded.meta,
              updated_at = now();
        v_count := v_count + 1;
      end if;
      v_data := v_data + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

create or replace function alx.upsert_usuario(
  p_user_id uuid,
  p_nome text,
  p_email text,
  p_perfil alx.perfil_usuario default 'operador',
  p_cidade_id uuid default null,
  p_ativo boolean default true
)
returns alx.usuarios
language plpgsql
security definer
set search_path = alx, public
as $$
declare
  v_admin boolean;
  v_perfil alx.perfil_usuario;
  v_usuario alx.usuarios;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  v_admin := alx.is_admin();

  if not v_admin and auth.uid() <> p_user_id then
    raise exception 'Sem permissao para criar ou atualizar este perfil';
  end if;

  v_perfil := case
    when v_admin then coalesce(p_perfil, 'operador'::alx.perfil_usuario)
    else 'operador'::alx.perfil_usuario
  end;

  insert into alx.usuarios (id, nome, email, perfil, cidade_id, ativo)
  values (
    p_user_id,
    p_nome,
    p_email,
    v_perfil,
    case when v_admin then p_cidade_id else null end,
    case when v_admin then p_ativo else true end
  )
  on conflict (id) do update
    set nome = excluded.nome,
        email = excluded.email,
        perfil = excluded.perfil,
        cidade_id = excluded.cidade_id,
        ativo = excluded.ativo,
        updated_at = now()
  returning * into v_usuario;

  return v_usuario;
end;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

drop trigger if exists trg_usuarios_updated on alx.usuarios;
create trigger trg_usuarios_updated before update on alx.usuarios
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_cidades_updated on alx.cidades;
create trigger trg_cidades_updated before update on alx.cidades
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_hubs_updated on alx.hubs;
create trigger trg_hubs_updated before update on alx.hubs
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_rotas_fixas_updated on alx.rotas_fixas;
create trigger trg_rotas_fixas_updated before update on alx.rotas_fixas
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_condutores_updated on alx.condutores;
create trigger trg_condutores_updated before update on alx.condutores
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_coletas_updated on alx.coletas;
create trigger trg_coletas_updated before update on alx.coletas
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_metas_updated on alx.metas_coletas;
create trigger trg_metas_updated before update on alx.metas_coletas
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_agendamentos_updated on alx.agendamentos;
create trigger trg_agendamentos_updated before update on alx.agendamentos
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_interesses_updated on alx.interesses_entregador;
create trigger trg_interesses_updated before update on alx.interesses_entregador
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_config_updated on alx.configuracoes;
create trigger trg_config_updated before update on alx.configuracoes
  for each row execute function alx.set_updated_at();

drop trigger if exists trg_log_coletas on alx.coletas;
create trigger trg_log_coletas
  after insert or update or delete on alx.coletas
  for each row execute function alx.log_alteracao();

drop trigger if exists trg_log_agendamentos on alx.agendamentos;
create trigger trg_log_agendamentos
  after insert or update or delete on alx.agendamentos
  for each row execute function alx.log_alteracao();

drop trigger if exists trg_log_metas on alx.metas_coletas;
create trigger trg_log_metas
  after insert or update or delete on alx.metas_coletas
  for each row execute function alx.log_alteracao();

-- ============================================================
-- RLS
-- ============================================================

alter table alx.usuarios enable row level security;
alter table alx.cidades enable row level security;
alter table alx.hubs enable row level security;
alter table alx.usuario_hubs enable row level security;
alter table alx.rotas_fixas enable row level security;
alter table alx.condutores enable row level security;
alter table alx.coletas enable row level security;
alter table alx.metas_coletas enable row level security;
alter table alx.agendamentos enable row level security;
alter table alx.interesses_entregador enable row level security;
alter table alx.historico_alteracoes enable row level security;
alter table alx.configuracoes enable row level security;

drop policy if exists "usuarios_select" on alx.usuarios;
create policy "usuarios_select" on alx.usuarios
  for select using (alx.is_admin() or id = auth.uid());

drop policy if exists "usuarios_update" on alx.usuarios;
create policy "usuarios_update" on alx.usuarios
  for update using (alx.is_admin() or id = auth.uid());

drop policy if exists "usuarios_insert_admin" on alx.usuarios;
create policy "usuarios_insert_admin" on alx.usuarios
  for insert with check (alx.is_admin());

drop policy if exists "cidades_select" on alx.cidades;
create policy "cidades_select" on alx.cidades
  for select using (true);

drop policy if exists "cidades_write_admin" on alx.cidades;
create policy "cidades_write_admin" on alx.cidades
  for all using (alx.is_admin()) with check (alx.is_admin());

drop policy if exists "hubs_select" on alx.hubs;
create policy "hubs_select" on alx.hubs
  for select using (true);

drop policy if exists "hubs_write_admin" on alx.hubs;
create policy "hubs_write_admin" on alx.hubs
  for all using (alx.is_admin()) with check (alx.is_admin());

drop policy if exists "usuario_hubs_admin" on alx.usuario_hubs;
create policy "usuario_hubs_admin" on alx.usuario_hubs
  for all using (alx.is_admin()) with check (alx.is_admin());

drop policy if exists "usuario_hubs_self_read" on alx.usuario_hubs;
create policy "usuario_hubs_self_read" on alx.usuario_hubs
  for select using (usuario_id = auth.uid());

drop policy if exists "rotas_fixas_select" on alx.rotas_fixas;
create policy "rotas_fixas_select" on alx.rotas_fixas
  for select using (true);

drop policy if exists "rotas_fixas_write" on alx.rotas_fixas;
create policy "rotas_fixas_write" on alx.rotas_fixas
  for all using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'));

drop policy if exists "condutores_select" on alx.condutores;
create policy "condutores_select" on alx.condutores
  for select using (true);

drop policy if exists "condutores_write" on alx.condutores;
create policy "condutores_write" on alx.condutores
  for all using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'));

drop policy if exists "coletas_select" on alx.coletas;
create policy "coletas_select" on alx.coletas
  for select using (alx.user_can_access_hub(hub_id));

drop policy if exists "coletas_write" on alx.coletas;
create policy "coletas_write" on alx.coletas
  for all using (
    alx.get_user_perfil() in ('admin', 'supervisor')
    and alx.user_can_access_hub(hub_id)
  )
  with check (
    alx.get_user_perfil() in ('admin', 'supervisor')
    and alx.user_can_access_hub(hub_id)
  );

drop policy if exists "metas_select" on alx.metas_coletas;
create policy "metas_select" on alx.metas_coletas
  for select using (alx.user_can_access_hub(hub_id));

drop policy if exists "metas_write" on alx.metas_coletas;
create policy "metas_write" on alx.metas_coletas
  for all using (
    alx.get_user_perfil() in ('admin', 'supervisor')
    and alx.user_can_access_hub(hub_id)
  )
  with check (
    alx.get_user_perfil() in ('admin', 'supervisor')
    and alx.user_can_access_hub(hub_id)
  );

drop policy if exists "agendamentos_select" on alx.agendamentos;
create policy "agendamentos_select" on alx.agendamentos
  for select using (
    exists (
      select 1
      from alx.coletas c
      where c.id = agendamentos.coleta_id
        and alx.user_can_access_hub(c.hub_id)
    )
  );

drop policy if exists "agendamentos_write" on alx.agendamentos;
create policy "agendamentos_write" on alx.agendamentos
  for all using (
    alx.get_user_perfil() in ('admin', 'supervisor', 'operador')
    and exists (
      select 1
      from alx.coletas c
      where c.id = agendamentos.coleta_id
        and alx.user_can_access_hub(c.hub_id)
    )
  )
  with check (
    alx.get_user_perfil() in ('admin', 'supervisor', 'operador')
    and exists (
      select 1
      from alx.coletas c
      where c.id = agendamentos.coleta_id
        and alx.user_can_access_hub(c.hub_id)
    )
  );

drop policy if exists "interesses_insert_public" on alx.interesses_entregador;
create policy "interesses_insert_public" on alx.interesses_entregador
  for insert with check (true);

drop policy if exists "interesses_select_interno" on alx.interesses_entregador;
create policy "interesses_select_interno" on alx.interesses_entregador
  for select using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador', 'visualizador'));

drop policy if exists "interesses_update_interno" on alx.interesses_entregador;
create policy "interesses_update_interno" on alx.interesses_entregador
  for update using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'));

drop policy if exists "interesses_delete_interno" on alx.interesses_entregador;
create policy "interesses_delete_interno" on alx.interesses_entregador
  for delete using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'));

drop policy if exists "historico_select" on alx.historico_alteracoes;
create policy "historico_select" on alx.historico_alteracoes
  for select using (alx.get_user_perfil() in ('admin', 'supervisor'));

drop policy if exists "historico_insert" on alx.historico_alteracoes;
create policy "historico_insert" on alx.historico_alteracoes
  for insert with check (auth.uid() is not null);

drop policy if exists "configuracoes_select" on alx.configuracoes;
create policy "configuracoes_select" on alx.configuracoes
  for select using (true);

drop policy if exists "configuracoes_admin" on alx.configuracoes;
create policy "configuracoes_admin" on alx.configuracoes
  for all using (alx.is_admin()) with check (alx.is_admin());

-- ============================================================
-- CONFIGURACOES INICIAIS
-- ============================================================

insert into alx.configuracoes (chave, valor, descricao)
values
  (
    'threshold_ocupacao',
    '{"vermelho": 50, "amarelo": 80, "verde": 100}'::jsonb,
    'Limiares de cor para ocupacao dos slots do ALX'
  )
on conflict (chave) do nothing;

comment on schema alx is 'Estrutura isolada do cliente ALX dentro do mesmo projeto Supabase';
comment on table alx.agendamentos is
'Agendamentos do ALX por coleta; bloqueio automatico por meta e conflito de horario nao foi habilitado';
comment on function alx.upsert_usuario(uuid, text, text, alx.perfil_usuario, uuid, boolean) is
'Cria ou atualiza o perfil do usuario no schema ALX para um auth.users ja existente';
