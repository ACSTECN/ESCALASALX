-- Migração 0005: Adicionar coluna CPF na tabela condutores
-- Execute este script no SQL Editor do Supabase

alter table public.condutores
add column if not exists cpf text;

-- Índice para busca por CPF
create index if not exists idx_condutores_cpf on public.condutores(cpf);
