-- Schedules fetch-news and analyze-events alongside fetch-disasters (see
-- 0002_pg_cron_schedule.sql for the base schedule + the Vault setup
-- instructions — read those comments first).
--
-- Offsets: fetch-disasters runs at :00, fetch-news at :03 (needs events to
-- already exist to link articles to), analyze-events at :06 (needs both
-- fetch-disasters' events and fetch-news' confidence upgrades to have
-- landed). Same UTC/EST caveat as 0002 applies.
--
-- Before running, add two more Vault secrets (in addition to the two from
-- 0002_pg_cron_schedule.sql):
--
--   select vault.create_secret('https://<project-ref>.functions.supabase.co/fetch-news', 'fetch_news_url');
--   select vault.create_secret('https://<project-ref>.functions.supabase.co/analyze-events', 'analyze_events_url');
--
-- (They reuse the same 'edge_function_service_role_key' secret from 0002.)

select
  cron.schedule(
    'fetch-news-6h',
    '3 5,11,17,23 * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'fetch_news_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $$
  );

select
  cron.schedule(
    'analyze-events-6h',
    '6 5,11,17,23 * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'analyze_events_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $$
  );
