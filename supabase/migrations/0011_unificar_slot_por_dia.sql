-- ============================================================
-- 0011_unificar_slot_por_dia.sql
-- Garante um slot por HUB por dia e uma meta por HUB/dia da semana
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Remove metas duplicadas por HUB + dia da semana, mantendo a mais recente
with metas_ranked as (
  select
    id,
    row_number() over (
      partition by hub_id, dia_semana
      order by updated_at desc, created_at desc, id desc
    ) as rn
  from public.metas_coletas
)
delete from public.metas_coletas m
using metas_ranked r
where m.id = r.id
  and r.rn > 1;

-- Consolida coletas duplicadas no mesmo HUB e dia, preservando agendamentos
do $$
declare
  v_grupo record;
  v_keep uuid;
  v_dup record;
begin
  for v_grupo in
    select hub_id, data_coleta
    from public.coletas
    group by hub_id, data_coleta
    having count(*) > 1
  loop
    select id into v_keep
    from public.coletas
    where hub_id = v_grupo.hub_id
      and data_coleta = v_grupo.data_coleta
    order by created_at asc, id asc
    limit 1;

    for v_dup in
      select id
      from public.coletas
      where hub_id = v_grupo.hub_id
        and data_coleta = v_grupo.data_coleta
        and id <> v_keep
    loop
      update public.agendamentos a
      set coleta_id = v_keep
      where a.coleta_id = v_dup.id
        and not exists (
          select 1
          from public.agendamentos ax
          where ax.coleta_id = v_keep
            and ax.condutor_id = a.condutor_id
        );

      delete from public.agendamentos
      where coleta_id = v_dup.id;

      delete from public.coletas
      where id = v_dup.id;
    end loop;
  end loop;
end $$;

create unique index if not exists uq_metas_hub_dia_semana
  on public.metas_coletas(hub_id, dia_semana);

create unique index if not exists uq_coletas_hub_data
  on public.coletas(hub_id, data_coleta);

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
      v_dia_semana := extract(dow from v_data)::integer;
      if v_dia_semana = v_meta.dia_semana then
        insert into public.coletas (hub_id, data_coleta, horario, meta)
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
