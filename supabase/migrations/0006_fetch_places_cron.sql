-- Schedules fetch-places on a daily cadence so Interserv/SupplyX contact
-- surfacing (Tab 3D/3E, Tab 4A/4E) keeps expanding through the event
-- backlog automatically instead of relying on manual invocation. See
-- 0002_pg_cron_schedule.sql for the base Vault setup — this reuses the
-- same 'edge_function_service_role_key' secret.
--
-- Daily (not every 6h like fetch-disasters) because each run does up to
-- 5 events x 8 place-type queries = 40 Google Places Text Search calls;
-- daily keeps this comfortably inside the $200/mo free credit the build
-- prompt calls out, while still advancing through the backlog every day
-- (see fetch-places/index.ts's already-processed skip logic).
--
-- Before running, add one more Vault secret (in addition to the ones from
-- 0002_pg_cron_schedule.sql / 0004_phase2_cron.sql):
--
--   select vault.create_secret('https://<project-ref>.functions.supabase.co/fetch-places', 'fetch_places_url');

select
  cron.schedule(
    'fetch-places-daily',
    '15 9 * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'fetch_places_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $$
  );
