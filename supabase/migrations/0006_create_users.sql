-- Criação de usuários via SQL
-- Execute no Supabase SQL Editor

-- 1. Isabel
insert into auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  'isabel@gmail.com',
  crypt('Cr@2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"nome":"Isabel"}',
  now(),
  now()
)
on conflict (email) do nothing;

insert into public.usuarios (id, nome, email, perfil)
select id, 'Isabel', 'isabel@gmail.com', 'operador'
from auth.users where email = 'isabel@gmail.com'
on conflict (id) do nothing;

-- 2. Thiago
insert into auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  'thiago@gmail.com',
  crypt('Cr@2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"nome":"Thiago"}',
  now(),
  now()
)
on conflict (email) do nothing;

insert into public.usuarios (id, nome, email, perfil)
select id, 'Thiago', 'thiago@gmail.com', 'operador'
from auth.users where email = 'thiago@gmail.com'
on conflict (id) do nothing;
