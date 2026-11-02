-- ============================================================
-- 0013_gmail_cron.sql
-- Sincronização automática dos e-mails MAGALOG a cada 5 minutos.
--
-- PRÉ-REQUISITOS (rodar uma única vez no SQL Editor do Supabase):
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- ANTES DE RODAR: substitua COLE_AQUI_O_GMAIL_SYNC_SECRET pelo mesmo valor
-- definido no secret GMAIL_SYNC_SECRET da Edge Function.
-- ============================================================

do $$
declare
  v_secret text := 'COLE_AQUI_O_GMAIL_SYNC_SECRET';
  v_url text := 'https://dnkposvhajloqqtjtjny.supabase.co/functions/v1/gmail-sync';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron não habilitado. Habilite em Database > Extensions e rode este script novamente.';
    return;
  end if;

  if v_secret = 'COLE_AQUI_O_GMAIL_SYNC_SECRET' then
    raise notice 'Defina o GMAIL_SYNC_SECRET antes de agendar o cron.';
    return;
  end if;

  -- Remove agendamento anterior, se existir
  begin
    perform cron.unschedule('gmail-sync-magalog');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'gmail-sync-magalog',
    '*/5 * * * *',
    format(
      $sql$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', %L),
        body := '{}'::jsonb
      );
      $sql$,
      v_url, v_secret
    )
  );

  raise notice 'Cron gmail-sync-magalog agendado para cada 5 minutos.';
end $$;
