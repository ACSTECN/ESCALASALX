-- ============================================================
-- 0009_add_fez_integracao_condutores.sql
-- Adiciona informacao de integracao nos condutores
-- Execute no SQL Editor do Supabase
-- ============================================================

alter table public.condutores
add column if not exists fez_integracao boolean not null default false;

comment on column public.condutores.fez_integracao is
'Indica se o condutor ja realizou integracao';
