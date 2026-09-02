// Supabase Edge Function: backfill-tarps
//
// One-time backfill: adds "Tarps" as a consumed material to every existing
// event (live + historical) whose category now includes it in
// MATERIALS_BY_DISASTER_TYPE. Needed because tagMaterialsForEvent()
// skips any event that already has at least one event_materials row —
// so adding Tarps to the shared constant alone doesn't reach the ~1,700
// events already tagged before this change.
//
// Not on any cron schedule; invoke once manually:
//   curl -X POST <project-url>/functions/v1/backfill-tarps -H "Authorization: Bearer <anon-key>"

import { createClient } from "jsr:@supabase/supabase-js@2";
import { MATERIALS_BY_DISASTER_TYPE } from "../_shared/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TARP_CATEGORIES = Object.entries(MATERIALS_BY_DISASTER_TYPE)
  .filter(([, mapping]) => mapping.consumed.includes("Tarps"))
  .map(([category]) => category);

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const eligibleEvents: { id: string; category: string }[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("events")
      .select("id, category")
      .in("category", TARP_CATEGORIES)
      .order("id", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    if (!data || data.length === 0) break;
    eligibleEvents.push(...(data as { id: string; category: string }[]));
    if (data.length < 1000) break;
  }

  const alreadyHasTarps = new Set<string>();
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("event_materials")
      .select("event_id")
      .eq("material_name", "Tarps")
      .range(page * 1000, page * 1000 + 999);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    if (!data || data.length === 0) break;
    for (const row of data) alreadyHasTarps.add(row.event_id as string);
    if (data.length < 1000) break;
  }

  const missing = eligibleEvents.filter((e) => !alreadyHasTarps.has(e.id));

  let inserted = 0;
  const BATCH = 500;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const rows = batch.map(({ id: event_id, category }) => ({
      event_id,
      material_name: "Tarps",
      category: "consumed" as const,
      proximity_band: "5-10mi" as const,
      disaster_type: category,
      notes: "General post-recovery materials (long-tail demand, 3-12 months post-event)",
    }));
    const { error } = await supabase.from("event_materials").insert(rows);
    if (error) {
      console.error("Batch insert failed", error);
      continue;
    }
    inserted += rows.length;
  }

  return new Response(
    JSON.stringify({
      eligible_events: eligibleEvents.length,
      already_had_tarps: alreadyHasTarps.size,
      inserted,
      completed_at: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
