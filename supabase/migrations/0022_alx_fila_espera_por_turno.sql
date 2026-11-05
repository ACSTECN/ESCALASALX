-- A fila de espera do entregador passa a respeitar o turno escolhido.
-- Assim o mesmo CPF pode entrar em turnos diferentes no mesmo dia, sem misturar
-- solicitacoes nem esconder o turno de interesse na operacao.

drop index if exists alx.uq_alx_interesses_cpf_hub_data;

create unique index if not exists uq_alx_interesses_cpf_hub_data_turno
  on alx.interesses_entregador (cpf, hub_id, data_interesse, coalesce(turno, 0));

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
    select 1
    from alx.interesses_entregador
    where alx.only_digits(cpf) = v_cpf
      and hub_id = v_coleta.hub_id
      and data_interesse = v_coleta.data_coleta
      and coalesce(turno, 0) = coalesce(v_coleta.turno, 0)
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
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'ja_na_lista');
end;
$$;
