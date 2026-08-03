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

  const { data: deleted, error } = await supabase
    .from("events")
    .delete()
    .eq("category", "extreme_heat")
    .select("id");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({ deleted: deleted?.length ?? 0, completed_at: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json" } }
  );
});
