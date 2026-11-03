-- ============================================================
-- 0019_alx_grupos.sql
-- Grupos de entregadores + liberacao de agenda (elegibilidade).
--
-- Regra de negocio (revisada):
--  - O GRUPO e apenas um "balde" de pessoas: nome + lista de entregadores.
--  - A elegibilidade e definida na COLETA (no calendario): o operador
--    marca uma coleta/turno como LIBERADA para um ou mais grupos.
--  - Quando liberada (com data/hora de abertura), os entregadores daquele
--    grupo ja visualizam o horario no link /entregador e podem pegar.
--  - O entregador NUNCA ve a QUANTIDADE de vagas, apenas se esta DISPONIVEL.
--  - Ao pegar, ele e agendado automaticamente no turno escolhido.
--  - Se nao houver vaga, ele recebe aviso e pode entrar na lista de espera.
--
-- Nao altera nada do CR (public.*).
-- ============================================================

-- ============================================================
-- 1) UTILITARIO: apenas digitos (para comparar CPF com/sem mascara)
-- ============================================================
create or replace function alx.only_digits(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '');
$$;

-- ============================================================
-- 2) TABELAS
-- ============================================================

-- Grupo = nome + membros (sem HUB/dias/turnos: isso agora e na coleta)
create table if not exists alx.grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  observacao text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Normaliza caso a versao anterior (grupo com HUB/dias/turnos) ja tenha rodado
alter table alx.grupos drop column if exists hub_id;
alter table alx.grupos drop column if exists dias;
alter table alx.grupos drop column if exists turnos;

create table if not exists alx.grupo_condutores (
  grupo_id uuid not null references alx.grupos(id) on delete cascade,
  condutor_id uuid not null references alx.condutores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (grupo_id, condutor_id)
);

-- Elegibilidade: quais grupos podem pegar cada coleta
create table if not exists alx.coleta_grupos (
  coleta_id uuid not null references alx.coletas(id) on delete cascade,
  grupo_id uuid not null references alx.grupos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coleta_id, grupo_id)
);

-- Liberacao da coleta
alter table alx.coletas add column if not exists liberado boolean not null default false;
alter table alx.coletas add column if not exists liberado_em timestamptz;

-- Lista de espera com turno
alter table alx.interesses_entregador add column if not exists turno smallint;

-- ============================================================
-- 3) INDICES
-- ============================================================
create index if not exists idx_alx_grupo_condutores_condutor on alx.grupo_condutores(condutor_id);
create index if not exists idx_alx_coleta_grupos_grupo on alx.coleta_grupos(grupo_id);
create index if not exists idx_alx_coleta_grupos_coleta on alx.coleta_grupos(coleta_id);
create index if not exists idx_alx_coletas_liberado on alx.coletas(liberado);
create index if not exists idx_alx_condutores_cpf_digits on alx.condutores(alx.only_digits(cpf));

-- ============================================================
-- 4) GRANTS
-- ============================================================
grant select, insert, update, delete on alx.grupos to authenticated;
grant select, insert, update, delete on alx.grupo_condutores to authenticated;
grant select, insert, update, delete on alx.coleta_grupos to authenticated;
grant all on alx.grupos, alx.grupo_condutores, alx.coleta_grupos to service_role;

-- ============================================================
-- 5) TRIGGERS
-- ============================================================
drop trigger if exists trg_grupos_updated on alx.grupos;
create trigger trg_grupos_updated before update on alx.grupos
  for each row execute function alx.set_updated_at();

-- ============================================================
-- 6) RLS
-- ============================================================
alter table alx.grupos enable row level security;
alter table alx.grupo_condutores enable row level security;
alter table alx.coleta_grupos enable row level security;

drop policy if exists "grupos_select" on alx.grupos;
create policy "grupos_select" on alx.grupos
  for select using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador', 'visualizador'));

drop policy if exists "grupos_write" on alx.grupos;
create policy "grupos_write" on alx.grupos
  for all using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'));

drop policy if exists "grupo_condutores_select" on alx.grupo_condutores;
create policy "grupo_condutores_select" on alx.grupo_condutores
  for select using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador', 'visualizador'));

drop policy if exists "grupo_condutores_write" on alx.grupo_condutores;
create policy "grupo_condutores_write" on alx.grupo_condutores
  for all using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'));

drop policy if exists "coleta_grupos_select" on alx.coleta_grupos;
create policy "coleta_grupos_select" on alx.coleta_grupos
  for select using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador', 'visualizador'));

drop policy if exists "coleta_grupos_write" on alx.coleta_grupos;
create policy "coleta_grupos_write" on alx.coleta_grupos
  for all using (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'))
  with check (alx.get_user_perfil() in ('admin', 'supervisor', 'operador'));

-- ============================================================
-- 7) FUNCOES PUBLICAS DO ENTREGADOR (SECURITY DEFINER -> anon)
-- ============================================================

-- 7.1) Agenda visivel: somente coletas LIBERADAS para algum grupo do entregador.
--      Nao expoe meta nem quantidade de agendamentos, apenas "disponivel".
create or replace function alx.entregador_agenda(
  p_nome text,
  p_cpf text,
  p_telefone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = alx, public
as $$
declare
  v_cpf text := alx.only_digits(p_cpf);
  v_cond alx.condutores;
  v_slots jsonb;
begin
  if v_cpf is null or length(v_cpf) < 11 then
    return jsonb_build_object('encontrado', false, 'motivo', 'cpf_invalido');
  end if;

  select * into v_cond
  from alx.condutores
  where alx.only_digits(cpf) = v_cpf
  limit 1;

  if v_cond.id is null then
    return jsonb_build_object('encontrado', false, 'motivo', 'nao_cadastrado');
  end if;

  select coalesce(jsonb_agg(s order by s->>'data_coleta', (s->>'turno')::int, s->>'horario'), '[]'::jsonb)
  into v_slots
  from (
    select jsonb_build_object(
      'coleta_id', c.id,
      'data_coleta', c.data_coleta,
      'turno', c.turno,
      'horario', to_char(c.horario, 'HH24:MI'),
      'hub_id', c.hub_id,
      'hub_sigla', h.sigla,
      'hub_nome', h.nome,
      'disponivel', alx.count_vagas_disponiveis(c.id) > 0,
      'ja_agendado', exists (
        select 1 from alx.agendamentos a
        where a.coleta_id = c.id
          and a.condutor_id = v_cond.id
          and a.status <> 'cancelado'
      )
    ) as s
    from alx.coletas c
    join alx.hubs h on h.id = c.hub_id
    where c.liberado = true
      and c.data_coleta >= current_date
      and c.status <> 'cancelada'
      and exists (
        select 1
        from alx.coleta_grupos cg
        join alx.grupo_condutores gc on gc.grupo_id = cg.grupo_id
        join alx.grupos g on g.id = cg.grupo_id
        where cg.coleta_id = c.id
          and gc.condutor_id = v_cond.id
          and g.ativo = true
      )
  ) t;

  return jsonb_build_object(
    'encontrado', true,
    'condutor', jsonb_build_object(
      'id', v_cond.id,
      'nome', v_cond.nome_completo,
      'cpf', v_cond.cpf,
      'telefone', v_cond.telefone,
      'hub_id', v_cond.hub_id
    ),
    'slots', v_slots
  );
end;
$$;

-- 7.2) O entregador pega a vaga -> agendamento automatico.
--      Valida liberacao, elegibilidade, duplicidade e vagas disponiveis.
create or replace function alx.entregador_agendar(
  p_cpf text,
  p_coleta_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = alx, public
as $$
declare
  v_cpf text := alx.only_digits(p_cpf);
  v_cond alx.condutores;
  v_coleta alx.coletas;
  v_elegivel boolean;
begin
  select * into v_cond from alx.condutores where alx.only_digits(cpf) = v_cpf limit 1;
  if v_cond.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_cadastrado');
  end if;

  select * into v_coleta from alx.coletas where id = p_coleta_id;
  if v_coleta.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'coleta_invalida');
  end if;

  if v_coleta.status = 'cancelada' then
    return jsonb_build_object('ok', false, 'motivo', 'coleta_indisponivel');
  end if;

  if v_coleta.liberado = false then
    return jsonb_build_object('ok', false, 'motivo', 'nao_elegivel');
  end if;

  select exists (
    select 1
    from alx.coleta_grupos cg
    join alx.grupo_condutores gc on gc.grupo_id = cg.grupo_id
    join alx.grupos g on g.id = cg.grupo_id
    where cg.coleta_id = p_coleta_id
      and gc.condutor_id = v_cond.id
      and g.ativo = true
  ) into v_elegivel;

  if not v_elegivel then
    return jsonb_build_object('ok', false, 'motivo', 'nao_elegivel');
  end if;

  if exists (
    select 1 from alx.agendamentos a
    where a.coleta_id = p_coleta_id
      and a.condutor_id = v_cond.id
      and a.status <> 'cancelado'
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'ja_agendado');
  end if;

  if alx.count_vagas_disponiveis(p_coleta_id) <= 0 then
    return jsonb_build_object('ok', false, 'motivo', 'sem_vaga');
  end if;

  insert into alx.agendamentos (coleta_id, condutor_id, status)
  values (p_coleta_id, v_cond.id, 'agendado');

  return jsonb_build_object('ok', true, 'motivo', 'agendado');
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'ja_agendado');
end;
$$;

-- 7.3) Sem vaga -> entra na lista de espera existente.
create or replace function alx.entregador_lista_espera(
  p_nome text,
  p_cpf text,
  p_telefone text,
  p_coleta_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = alx, public
as $$
declare
  v_cpf text := alx.only_digits(p_cpf);
  v_coleta alx.coletas;
  v_existe boolean;
begin
  select * into v_coleta from alx.coletas where id = p_coleta_id;
  if v_coleta.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'coleta_invalida');
  end if;

  select exists (
    select 1 from alx.interesses_entregador
    where alx.only_digits(cpf) = v_cpf
      and hub_id = v_coleta.hub_id
      and data_interesse = v_coleta.data_coleta
  ) into v_existe;

  if v_existe then
    return jsonb_build_object('ok', false, 'motivo', 'ja_na_lista');
  end if;

  insert into alx.interesses_entregador
    (nome, cpf, telefone, hub_id, data_interesse, turno, status, observacao)
  values (
    coalesce(nullif(trim(p_nome), ''), 'Entregador'),
    v_cpf,
    nullif(trim(p_telefone), ''),
    v_coleta.hub_id,
    v_coleta.data_coleta,
    v_coleta.turno,
    'pendente',
    'Lista de espera via link do entregador (vaga esgotada)'
  );

  return jsonb_build_object('ok', true, 'motivo', 'na_lista');
end;
$$;

-- ============================================================
-- 8) EXECUTE PARA ANON (link publico do entregador)
-- ============================================================
grant execute on function alx.only_digits(text) to anon, authenticated, service_role;
grant execute on function alx.entregador_agenda(text, text, text) to anon, authenticated, service_role;
grant execute on function alx.entregador_agendar(text, uuid) to anon, authenticated, service_role;
grant execute on function alx.entregador_lista_espera(text, text, text, uuid) to anon, authenticated, service_role;

comment on table alx.grupos is
'Grupo de entregadores (nome + membros) usado para liberar agendas';
comment on table alx.coleta_grupos is
'Define para quais grupos uma coleta foi liberada (elegibilidade do entregador)';
comment on function alx.entregador_agenda(text, text, text) is
'Agenda publica do entregador: retorna apenas coletas liberadas para os grupos dele, sem expor quantidade de vagas';
