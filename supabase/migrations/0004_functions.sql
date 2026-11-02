-- ============================================================
-- 0004_functions.sql - Funções e Triggers
-- Execute após 0002_rls.sql
-- ============================================================

-- Trigger genérico para atualizar updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Aplicar trigger em todas as tabelas com updated_at
drop trigger if exists trg_usuarios_updated on public.usuarios;
create trigger trg_usuarios_updated before update on public.usuarios
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cidades_updated on public.cidades;
create trigger trg_cidades_updated before update on public.cidades
  for each row execute function public.set_updated_at();

drop trigger if exists trg_hubs_updated on public.hubs;
create trigger trg_hubs_updated before update on public.hubs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_condutores_updated on public.condutores;
create trigger trg_condutores_updated before update on public.condutores
  for each row execute function public.set_updated_at();

drop trigger if exists trg_coletas_updated on public.coletas;
create trigger trg_coletas_updated before update on public.coletas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_metas_updated on public.metas_coletas;
create trigger trg_metas_updated before update on public.metas_coletas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_agendamentos_updated on public.agendamentos;
create trigger trg_agendamentos_updated before update on public.agendamentos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_config_updated on public.configuracoes;
create trigger trg_config_updated before update on public.configuracoes
  for each row execute function public.set_updated_at();

-- ============================================================
-- Função: contar agendamentos ativos de uma coleta
-- (cancelados não contam)
-- ============================================================
create or replace function public.count_agendamentos_ativos(coleta uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.agendamentos
  where coleta_id = coleta
    and status <> 'cancelado';
$$;

-- ============================================================
-- Função: contar vagas disponíveis de uma coleta
-- ============================================================
create or replace function public.count_vagas_disponiveis(coleta uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(c.meta - public.count_agendamentos_ativos(coleta), 0)
  from public.coletas c where c.id = coleta;
$$;

-- ============================================================
-- Trigger: impedir que agendamento exceda a meta (concorrência)
-- Ao inserir/atualizar agendamento, verifica se ainda há vagas
-- ============================================================
create or replace function public.check_vaga_disponivel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta integer;
  v_ocupados integer;
begin
  -- Só verifica se o status não é cancelado
  if new.status = 'cancelado' then
    return new;
  end if;

  select meta into v_meta from public.coletas where id = new.coleta_id;

  -- Conta agendamentos ativos existentes (excluindo o atual se for update)
  select count(*) into v_ocupados
  from public.agendamentos
  where coleta_id = new.coleta_id
    and status <> 'cancelado'
    and (tg_op = 'INSERT' or id <> new.id);

  if v_ocupados >= v_meta then
    raise exception 'Meta de coletas atingida. Não há vagas disponíveis.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_vaga on public.agendamentos;
create trigger trg_check_vaga
  before insert or update of status on public.agendamentos
  for each row execute function public.check_vaga_disponivel();

-- ============================================================
-- Trigger: impedir conflito de horário para o mesmo condutor
-- (mesmo dia e horário próximo - intervalo de 60 min)
-- ============================================================
create or replace function public.check_conflito_horario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data date;
  v_horario time;
  v_intervalo interval := interval '60 minutes';
  v_conflito integer;
begin
  if new.status = 'cancelado' then
    return new;
  end if;

  select data_coleta, horario into v_data, v_horario
  from public.coletas where id = new.coleta_id;

  select count(*) into v_conflito
  from public.agendamentos a
  join public.coletas c on c.id = a.coleta_id
  where a.condutor_id = new.condutor_id
    and a.status <> 'cancelado'
    and (tg_op = 'INSERT' or a.id <> new.id)
    and c.data_coleta = v_data
    and c.horario between (v_horario - v_intervalo) and (v_horario + v_intervalo)
    and a.coleta_id <> new.coleta_id;

  if v_conflito > 0 then
    raise exception 'Condutor já possui agendamento conflitante neste horário.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_conflito on public.agendamentos;
create trigger trg_check_conflito
  before insert or update of condutor_id on public.agendamentos
  for each row execute function public.check_conflito_horario();

-- ============================================================
-- Trigger: registrar em histórico ao alterar agendamentos/coletas
-- ============================================================
create or replace function public.log_alteracao()
returns trigger
language plpgsql
security definer
set search_path = public
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

  -- Só loga mudanças relevantes (exclui updates de updated_at)
  if v_antes is not null and v_depois is not null then
    v_antes = v_antes - 'updated_at';
    v_depois = v_depois - 'updated_at';
    if v_antes = v_depois then
      return coalesce(new, old);
    end if;
  end if;

  insert into public.historico_alteracoes (entidade, entidade_id, acao, antes, depois, usuario_id)
  values (v_entidade, v_id, v_acao, v_antes, v_depois, auth.uid());

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_log_coletas on public.coletas;
create trigger trg_log_coletas
  after insert or update or delete on public.coletas
  for each row execute function public.log_alteracao();

drop trigger if exists trg_log_agendamentos on public.agendamentos;
create trigger trg_log_agendamentos
  after insert or update or delete on public.agendamentos
  for each row execute function public.log_alteracao();

drop trigger if exists trg_log_metas on public.metas_coletas;
create trigger trg_log_metas
  after insert or update or delete on public.metas_coletas
  for each row execute function public.log_alteracao();

-- ============================================================
-- Função: gerar coletas a partir de metas recorrentes para um intervalo
-- ============================================================
create or replace function public.gerar_coletas_recorrentes(
  p_hub_id uuid default null,
  p_data_inicio date default current_date,
  p_data_fim date default (current_date + interval '14 days')::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta record;
  v_data date;
  v_dia_semana integer;
  v_count integer := 0;
begin
  for v_meta in
    select * from public.metas_coletas
    where ativo = true
      and (p_hub_id is null or hub_id = p_hub_id)
  loop
    v_data := p_data_inicio;
    while v_data <= p_data_fim loop
      -- 0=domingo, 1=segunda ... 6=sábado (PostgreSQL: 0=domingo)
      v_dia_semana := extract(dow from v_data)::integer;
      if v_dia_semana = v_meta.dia_semana then
        insert into public.coletas (hub_id, data_coleta, horario, meta)
        values (v_meta.hub_id, v_data, v_meta.horario, v_meta.meta)
        on conflict do nothing;
        v_count := v_count + 1;
      end if;
      v_data := v_data + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;
