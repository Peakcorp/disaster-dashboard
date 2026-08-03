// Supabase Edge Function: cleanup-heat-events
//
// One-time cleanup: deletes every events row (live and historical-seed
// alike) with category = 'extreme_heat'. Heat/drought was removed from
// scope — the three consumers (SupplyX materials, Interserv renovation,
// Insurance Claims referrals) are all property-damage-driven, which heat
// advisories don't map to — and fetch-disasters/seed-historical-events/
// seed-recent-disasters no longer create new rows in this category, but
// existing rows needed an explicit one-time purge. event_materials and
// event_contacts cascade-delete automatically (on delete cascade FK).
//
// Not on any cron schedule; invoke once manually:
//   curl -X POST <project-url>/functions/v1/cleanup-heat-events -H "Authorization: Bearer <anon-key>"

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: heatDeleted, error: heatErr } = await supabase
    .from("events")
    .delete()
    .eq("category", "extreme_heat")
    .select("id");

  if (heatErr) {
    return new Response(JSON.stringify({ error: heatErr.message }), { status: 500 });
  }

  // Existing NWS-sourced "wildfire" rows are all Fire Weather Watch / Red
  // Flag Warning fire-risk forecasts (NWS never had a real fire-incident
  // product) — mapNwsEventType no longer classifies these as wildfire, but
  // rows whose content hasn't changed since ingestion never get
  // re-processed by fetch-disasters, so they need this one-time purge too.
  // Real (FEMA-sourced) wildfire declarations are untouched.
  const { data: fireForecastDeleted, error: fireErr } = await supabase
    .from("events")
    .delete()
    .eq("category", "wildfire")
    .eq("external_source", "nws")
    .select("id");

  if (fireErr) {
    return new Response(JSON.stringify({ error: fireErr.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      heat_deleted: heatDeleted?.length ?? 0,
      nws_fire_forecast_deleted: fireForecastDeleted?.length ?? 0,
      completed_at: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
