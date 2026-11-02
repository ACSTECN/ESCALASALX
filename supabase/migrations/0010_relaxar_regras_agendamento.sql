-- ============================================================
-- 0010_relaxar_regras_agendamento.sql
-- Permite agendar acima da meta e sem bloqueio de conflito horario
-- Execute no SQL Editor do Supabase
-- ============================================================

drop trigger if exists trg_check_vaga on public.agendamentos;
drop trigger if exists trg_check_conflito on public.agendamentos;

comment on table public.agendamentos is
'Agendamentos de condutores por coleta; bloqueio por meta e conflito horario foi removido';
