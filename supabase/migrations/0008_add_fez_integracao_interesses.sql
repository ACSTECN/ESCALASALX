-- ============================================================
-- 0008_add_fez_integracao_interesses.sql
-- Adiciona informação sobre primeira integracao na lista de espera
-- Execute no SQL Editor do Supabase
-- ============================================================

alter table public.interesses_entregador
add column if not exists fez_integracao boolean;

comment on column public.interesses_entregador.fez_integracao is
'Indica se o entregador informou que ja fez a primeira integracao';
