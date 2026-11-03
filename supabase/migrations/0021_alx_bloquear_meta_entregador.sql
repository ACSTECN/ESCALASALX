-- Impede que o autoagendamento do entregador ultrapasse a meta da coleta
-- mesmo quando houver tentativas simultaneas no mesmo turno.

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
  select *
  into v_cond
  from alx.condutores
  where alx.only_digits(cpf) = v_cpf
  limit 1;

  if v_cond.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_cadastrado');
  end if;

  -- Serializa as tentativas no mesmo turno para nao passar da meta.
  select *
  into v_coleta
  from alx.coletas
  where id = p_coleta_id
  for update;

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
    select 1
    from alx.agendamentos a
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
