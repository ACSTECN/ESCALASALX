-- ============================================================
-- 0017_alx_condutores_codigo.sql
-- Adiciona o campo ID (codigo) do condutor no schema do ALX.
-- Nao altera nada do CR (public.*).
-- ============================================================

alter table alx.condutores
  add column if not exists codigo text;

create index if not exists idx_alx_condutores_codigo on alx.condutores(codigo);
