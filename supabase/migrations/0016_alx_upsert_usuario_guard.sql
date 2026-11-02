-- ============================================================
-- 0016_alx_upsert_usuario_guard.sql
-- Endurece a funcao de upsert de usuario do ALX para permitir
-- autocriacao somente do proprio perfil e sempre como operador.
-- ============================================================

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

grant execute on function alx.upsert_usuario(uuid, text, text, alx.perfil_usuario, uuid, boolean)
to authenticated, service_role;
