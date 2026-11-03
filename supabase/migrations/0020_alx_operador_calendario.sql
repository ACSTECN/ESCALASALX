-- Libera visualizacao e movimentacao do calendario para operador sem depender
-- de vinculo manual em usuario_hubs.

create or replace function alx.user_can_access_hub(hub uuid)
returns boolean
language sql
stable
security definer
set search_path = alx, public
as $$
  select coalesce(
    alx.get_user_perfil() in ('admin', 'supervisor', 'operador', 'visualizador'),
    false
  )
  or hub = any(alx.get_user_hub_ids());
$$;

drop policy if exists "coletas_select" on alx.coletas;
create policy "coletas_select" on alx.coletas
  for select using (
    alx.get_user_perfil() in ('admin', 'supervisor', 'operador', 'visualizador')
    and alx.user_can_access_hub(hub_id)
  );

drop policy if exists "coletas_write" on alx.coletas;
create policy "coletas_write" on alx.coletas
  for all using (
    alx.get_user_perfil() in ('admin', 'supervisor', 'operador')
    and alx.user_can_access_hub(hub_id)
  )
  with check (
    alx.get_user_perfil() in ('admin', 'supervisor', 'operador')
    and alx.user_can_access_hub(hub_id)
  );
