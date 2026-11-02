-- ============================================================
-- 0018_alx_turnos.sql
-- Habilita 3 turnos por dia nas metas e coletas do ALX.
-- Cada turno tem o seu proprio horario e a sua propria meta.
-- Nao altera nada do CR (public.*).
-- ============================================================

-- 1) Coluna de turno (1, 2 ou 3)
alter table alx.metas_coletas add column if not exists turno smallint not null default 1;
alter table alx.coletas add column if not exists turno smallint not null default 1;

-- 2) Validacao do turno
do $$ begin
  alter table alx.metas_coletas add constraint chk_alx_metas_turno check (turno between 1 and 3);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table alx.coletas add constraint chk_alx_coletas_turno check (turno between 1 and 3);
exception when duplicate_object then null;
end $$;

-- 3) A unicidade passa a ser por turno
--    metas: um registro por HUB + dia da semana + turno
--    coletas: um registro por HUB + data + turno
drop index if exists alx.uq_alx_metas_hub_dia_semana;
create unique index if not exists uq_alx_metas_hub_dia_turno
  on alx.metas_coletas(hub_id, dia_semana, turno);

drop index if exists alx.uq_alx_coletas_hub_data;
create unique index if not exists uq_alx_coletas_hub_data_turno
  on alx.coletas(hub_id, data_coleta, turno);

-- 4) Geracao de coletas considerando o turno
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
        insert into alx.coletas (hub_id, data_coleta, horario, meta, turno)
        values (v_meta.hub_id, v_data, v_meta.horario, v_meta.meta, v_meta.turno)
        on conflict (hub_id, data_coleta, turno) do update
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
