-- Schedules fetch-disasters to run 4x/day via pg_cron + pg_net.
--
-- IMPORTANT — do this manually in the Supabase SQL editor, NOT by
-- committing your service role key into this file / git:
--
--   1. Store your project's function URL + service role key as Vault secrets:
--
--      select vault.create_secret('https://<project-ref>.functions.supabase.co/fetch-disasters', 'edge_function_url');
--      select vault.create_secret('<your-service-role-key>', 'edge_function_service_role_key');
--
--   2. Then run this file's cron.schedule statement below (it reads the
--      secrets from Vault at call time, so nothing sensitive ends up in
--      migration history).
--
-- pg_cron on Supabase runs in UTC. Times below (05:00, 11:00, 17:00, 23:00
-- UTC) correspond to 00:00 / 06:00 / 12:00 / 18:00 US Eastern *Standard*
-- Time (winter). During Eastern *Daylight* Time (mid-March to early
-- November), these run one hour earlier in local terms (23:00, 05:00,
-- 11:00, 17:00 ET). To correct for DST, re-run the cron.schedule call below
-- with '0 4,10,16,22 * * *' for EDT months, or automate the swap with a
-- second cron job that runs cron.alter_job twice a year.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select
  cron.schedule(
    'fetch-disasters-6h',
    '0 5,11,17,23 * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $$
  );

-- To trigger an out-of-cycle emergency refresh (e.g. from a database
-- trigger on a new FEMA Major Disaster Declaration), call the same
-- net.http_post pattern directly rather than going through cron.
