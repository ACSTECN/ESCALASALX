-- ============================================================
-- 0019_alx_grupos.sql
-- Grupos de entregadores + auto-agendamento pelo link publico.
--
-- Regra de negocio:
--  - O admin cria um grupo com HUB + dias da semana + turnos.
--  - Os entregadores sao vinculados ao grupo colando uma lista de CPFs.
--  - O entregador, no link /entregador, se identifica (nome + CPF + telefone)
--    e ve somente os dias/turnos elegiveis do(s) grupo(s) dele.
--  - Ele nunca ve a QUANTIDADE de vagas, apenas se esta DISPONIVEL.
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
create table if not exists alx.grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  hub_id uuid not null references alx.hubs(id) on delete cascade,
  dias smallint[] not null default '{}',
  turnos smallint[] not null default '{}',
  ativo boolean not null default true,
  observacao text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alx.grupo_condutores (
  grupo_id uuid not null references alx.grupos(id) on delete cascade,
  condutor_id uuid not null references alx.condutores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (grupo_id, condutor_id)
);

-- ============================================================
-- 3) LISTA DE ESPERA COM TURNO
-- ============================================================
alter table alx.interesses_entregador
  add column if not exists turno smallint;

-- ============================================================
-- 4) INDICES
-- ============================================================
create index if not exists idx_alx_grupos_hub on alx.grupos(hub_id);
create index if not exists idx_alx_grupo_condutores_condutor on alx.grupo_condutores(condutor_id);
create index if not exists idx_alx_condutores_cpf_digits on alx.condutores(alx.only_digits(cpf));

-- ============================================================
-- 5) GRANTS
-- ============================================================
grant select, insert, update, delete on alx.grupos to authenticated;
grant select, insert, update, delete on alx.grupo_condutores to authenticated;
grant all on alx.grupos, alx.grupo_condutores to service_role;

-- ============================================================
-- 6) TRIGGERS
-- ============================================================
drop trigger if exists trg_grupos_updated on alx.grupos;
create trigger trg_grupos_updated before update on alx.grupos
  for each row execute function alx.set_updated_at();

-- ============================================================
-- 7) RLS
-- ============================================================
alter table alx.grupos enable row level security;
alter table alx.grupo_condutores enable row level security;

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

-- ============================================================
-- 8) FUNCOES PUBLICAS DO ENTREGADOR (SECURITY DEFINER -> anon)
-- ============================================================

-- 8.1) Retorna a agenda visivel para o entregador (somente dias/turnos elegiveis).
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

  select coalesce(jsonb_agg(s order by s->>'data_coleta', (s->>'turno')::int), '[]'::jsonb)
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
    where c.data_coleta >= current_date
      and c.status <> 'cancelada'
      and exists (
        select 1
        from alx.grupo_condutores gc
        join alx.grupos g on g.id = gc.grupo_id
        where gc.condutor_id = v_cond.id
          and g.ativo = true
          and g.hub_id = c.hub_id
          and extract(dow from c.data_coleta)::smallint = any(g.dias)
          and c.turno = any(g.turnos)
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

-- 8.2) O entregador pega a vaga -> agendamento automatico.
--      Valida elegibilidade, duplicidade e vagas disponiveis.
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

  select exists (
    select 1
    from alx.grupo_condutores gc
    join alx.grupos g on g.id = gc.grupo_id
    where gc.condutor_id = v_cond.id
      and g.ativo = true
      and g.hub_id = v_coleta.hub_id
      and extract(dow from v_coleta.data_coleta)::smallint = any(g.dias)
      and v_coleta.turno = any(g.turnos)
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

-- 8.3) Sem vaga -> entra na lista de espera existente.
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
-- 9) EXECUTE PARA ANON (link publico do entregador)
-- ============================================================
grant execute on function alx.only_digits(text) to anon, authenticated, service_role;
grant execute on function alx.entregador_agenda(text, text, text) to anon, authenticated, service_role;
grant execute on function alx.entregador_agendar(text, uuid) to anon, authenticated, service_role;
grant execute on function alx.entregador_lista_espera(text, text, text, uuid) to anon, authenticated, service_role;

comment on table alx.grupos is
'Grupos de entregadores por HUB com dias e turnos elegiveis para auto-agendamento';
comment on function alx.entregador_agenda(text, text, text) is
'Agenda publica do entregador: retorna apenas dias/turnos elegiveis, sem expor quantidade de vagas';
