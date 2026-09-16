-- Schedules search-receivership daily so it steadily works through the
-- backlog of surfaced properties (see 0002_pg_cron_schedule.sql for the
-- base Vault setup this reuses).
--
-- Before running, add one more Vault secret (in addition to the ones from
-- 0002_pg_cron_schedule.sql / 0004_phase2_cron.sql / 0006):
--
--   select vault.create_secret('https://<project-ref>.functions.supabase.co/search-receivership', 'search_receivership_url');

select
  cron.schedule(
    'search-receivership-daily',
    '30 9 * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'search_receivership_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $$
  );
