-- ============================================================
-- 0002_rls.sql - Row Level Security e Políticas
-- Execute após 0001_schema.sql
-- ============================================================

-- Habilitar RLS em todas as tabelas
alter table public.usuarios enable row level security;
alter table public.cidades enable row level security;
alter table public.hubs enable row level security;
alter table public.usuario_hubs enable row level security;
alter table public.condutores enable row level security;
alter table public.coletas enable row level security;
alter table public.metas_coletas enable row level security;
alter table public.agendamentos enable row level security;
alter table public.historico_alteracoes enable row level security;
alter table public.configuracoes enable row level security;

-- ============================================================
-- Funções auxiliares para políticas
-- ============================================================

-- Retorna o perfil do usuário autenticado
create or replace function public.get_user_perfil()
returns perfil_usuario
language sql
stable
security definer
set search_path = public
as $$
  select perfil from public.usuarios where id = auth.uid() limit 1;
$$;

-- Retorna true se o usuário é admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_user_perfil() = 'admin', false);
$$;

-- Retorna os HUBs autorizados para o usuário (admin = todos)
create or replace function public.get_user_hub_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_admin() then (select array_agg(id) from public.hubs)
    else (
      select coalesce(array_agg(hub_id), array[]::uuid[])
      from public.usuario_hubs
      where usuario_id = auth.uid()
    )
  end;
$$;

-- Verifica se o usuário tem acesso a um HUB
create or replace function public.user_can_access_hub(hub uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or hub = any(public.get_user_hub_ids());
$$;

-- ============================================================
-- Políticas: USUARIOS
-- ============================================================
-- Admin vê/edita todos; usuário vê o próprio
create policy "usuarios_select" on public.usuarios
  for select using (public.is_admin() or id = auth.uid());

create policy "usuarios_update" on public.usuarios
  for update using (public.is_admin() or id = auth.uid());

create policy "usuarios_insert_admin" on public.usuarios
  for insert with check (public.is_admin());

-- ============================================================
-- Políticas: CIDADES
-- ============================================================
create policy "cidades_select" on public.cidades
  for select using (true);

create policy "cidades_write_admin" on public.cidades
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Políticas: HUBS
-- ============================================================
create policy "hubs_select" on public.hubs
  for select using (true);

create policy "hubs_write_admin" on public.hubs
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Políticas: USUARIO_HUBS
-- ============================================================
create policy "usuario_hubs_admin" on public.usuario_hubs
  for all using (public.is_admin()) with check (public.is_admin());

create policy "usuario_hubs_self_read" on public.usuario_hubs
  for select using (usuario_id = auth.uid());

-- ============================================================
-- Políticas: CONDUTORES
-- ============================================================
create policy "condutores_select" on public.condutores
  for select using (true);

create policy "condutores_write" on public.condutores
  for all using (public.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (public.get_user_perfil() in ('admin', 'supervisor', 'operador'));

-- ============================================================
-- Políticas: COLETAS
-- ============================================================
create policy "coletas_select" on public.coletas
  for select using (public.user_can_access_hub(hub_id));

create policy "coletas_write" on public.coletas
  for all using (
    public.get_user_perfil() in ('admin', 'supervisor')
    and public.user_can_access_hub(hub_id)
  )
  with check (
    public.get_user_perfil() in ('admin', 'supervisor')
    and public.user_can_access_hub(hub_id)
  );

-- ============================================================
-- Políticas: METAS_COLETAS
-- ============================================================
create policy "metas_select" on public.metas_coletas
  for select using (public.user_can_access_hub(hub_id));

create policy "metas_write" on public.metas_coletas
  for all using (
    public.get_user_perfil() in ('admin', 'supervisor')
    and public.user_can_access_hub(hub_id)
  )
  with check (
    public.get_user_perfil() in ('admin', 'supervisor')
    and public.user_can_access_hub(hub_id)
  );

-- ============================================================
-- Políticas: AGENDAMENTOS
-- ============================================================
create policy "agendamentos_select" on public.agendamentos
  for select using (
    exists (
      select 1 from public.coletas c
      where c.id = agendamentos.coleta_id
      and public.user_can_access_hub(c.hub_id)
    )
  );

create policy "agendamentos_write" on public.agendamentos
  for all using (
    public.get_user_perfil() in ('admin', 'supervisor', 'operador')
    and exists (
      select 1 from public.coletas c
      where c.id = agendamentos.coleta_id
      and public.user_can_access_hub(c.hub_id)
    )
  )
  with check (
    public.get_user_perfil() in ('admin', 'supervisor', 'operador')
    and exists (
      select 1 from public.coletas c
      where c.id = agendamentos.coleta_id
      and public.user_can_access_hub(c.hub_id)
    )
  );

-- ============================================================
-- Políticas: HISTORICO_ALTERACOES
-- ============================================================
create policy "historico_select" on public.historico_alteracoes
  for select using (public.get_user_perfil() in ('admin', 'supervisor'));

create policy "historico_insert" on public.historico_alteracoes
  for insert with check (auth.uid() is not null);

-- ============================================================
-- Políticas: CONFIGURACOES
-- ============================================================
create policy "configuracoes_select" on public.configuracoes
  for select using (true);

create policy "configuracoes_admin" on public.configuracoes
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Trigger: criar perfil automaticamente ao cadastrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'perfil')::perfil_usuario, 'operador')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
