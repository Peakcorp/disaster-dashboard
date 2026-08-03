// Supabase Edge Function: seed-recent-disasters
//
// Backfills Tab 2 (Historical) for 2025 and 2026 YTD. NOAA discontinued the
// Billion-Dollar Weather and Climate Disasters dataset in May 2025 (staffing
// cuts), so seed-historical-events (which reads that CSV) has no way to ever
// cover 2025+ — there is no successor NOAA product. FEMA's OpenFEMA
// DisasterDeclarationsSummaries API is the closest free, comprehensive
// federal source for "significant disasters" in that window, so this pulls
// declarations from 2025-01-01 onward and seeds them the same way
// seed-historical-events seeds NOAA rows (is_historical_seed = true).
//
// FEMA declarations don't include a damage-cost figure the way NOAA's
// dataset does, so estimated_damage_usd is left null here and filled in
// later by enrich-historical-events, which now produces a clearly-flagged
// AI estimate for any historical row still missing one (confidence_score
// stays LOW for these rows to signal the cost figure is estimated, not
// official).
//
// Not on any cron schedule; invoke manually/occasionally:
//   curl -X POST <project-url>/functions/v1/seed-recent-disasters -H "Authorization: Bearer <anon-key>"

import { createClient } from "jsr:@supabase/supabase-js@2";
import { MATERIALS_BY_DISASTER_TYPE } from "../_shared/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function mapFemaIncidentType(incidentType: string): string {
  const t = incidentType.toLowerCase();
  if (t.includes("hurricane") || t.includes("tropical")) return "hurricane";
  if (t.includes("tornado")) return "tornado";
  if (t.includes("fire")) return "wildfire";
  if (t.includes("flood")) return "flood";
  if (t.includes("winter") || t.includes("snow") || t.includes("freez") || t.includes("ice")) {
    return "winter_storm";
  }
  if (t.includes("earthquake")) return "earthquake";
  if (t.includes("mud") || t.includes("landslide")) return "landslide";
  if (t.includes("drought") || t.includes("heat")) return "extreme_heat";
  if (
    t.includes("chemical") ||
    t.includes("terrorist") ||
    t.includes("human cause") ||
    t.includes("explosion") ||
    t.includes("dam")
  ) {
    return "man_made";
  }
  return "man_made";
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const url =
    "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries" +
    "?$filter=declarationDate ge '2025-01-01'" +
    "&$orderby=declarationDate desc&$top=1000";

  const res = await fetch(url);
  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: `FEMA API error: HTTP ${res.status}` }),
      { status: 502 }
    );
  }
  const json = await res.json();
  const rows: Array<Record<string, unknown>> = json.DisasterDeclarationsSummaries ?? [];

  // FEMA returns one row per state/county/program combo for the same
  // disaster number — group them into one event per disasterNumber, same
  // as the live fetch-disasters pipeline does.
  const byDisasterNumber = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const key = String(row.disasterNumber);
    if (!byDisasterNumber.has(key)) byDisasterNumber.set(key, []);
    byDisasterNumber.get(key)!.push(row);
  }

  let seeded = 0;
  let failed = 0;

  for (const [disasterNumber, group] of byDisasterNumber) {
    const first = group[0];
    const states = Array.from(new Set(group.map((r) => String(r.state))));
    const counties = Array.from(
      new Set(group.map((r) => String(r.designatedArea)).filter((a) => a && a !== "undefined"))
    );
    const declarationDate = String(first.declarationDate).slice(0, 10);
    const category = mapFemaIncidentType(String(first.incidentType ?? ""));
    // Heat/drought is out of scope — the three consumers (SupplyX materials,
    // Interserv renovation, Insurance Claims referrals) are all
    // property-damage-driven, which heat advisories don't map to.
    if (category === "extreme_heat") continue;
    const name = `${first.declarationTitle ?? first.incidentType ?? "Disaster"} — ${states.join(", ")}`;

    const eventRow = {
      name,
      category,
      sub_type: String(first.incidentType ?? null),
      status: "resolved" as const,
      start_date: String(first.incidentBeginDate ?? declarationDate).slice(0, 10),
      end_date: first.incidentEndDate ? String(first.incidentEndDate).slice(0, 10) : null,
      states_affected: states,
      counties,
      estimated_damage_usd: null,
      confidence_score: "LOW" as const,
      is_historical_seed: true,
      external_source: "fema_declarations_2025",
      external_id: `fema-${disasterNumber}`,
      last_fetched_at: new Date().toISOString(),
      source_data_hash: null,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from("events")
      .upsert(eventRow, { onConflict: "external_source,external_id" })
      .select("id")
      .single();

    if (upsertErr || !upserted) {
      console.error(`Failed to seed disaster ${disasterNumber}`, upsertErr);
      failed++;
      continue;
    }
    seeded++;

    const { count: existingMaterials } = await supabase
      .from("event_materials")
      .select("id", { count: "exact", head: true })
      .eq("event_id", upserted.id);

    if (!existingMaterials) {
      const mapping = MATERIALS_BY_DISASTER_TYPE[category];
      if (mapping) {
        const materialRows = [
          ...mapping.destroyed.map((material) => ({
            event_id: upserted.id,
            material_name: material,
            category: "destroyed" as const,
            proximity_band: null,
            disaster_type: category,
          })),
          ...mapping.consumed.map((material) => ({
            event_id: upserted.id,
            material_name: material,
            category: "consumed" as const,
            proximity_band: "5-10mi" as const,
            disaster_type: category,
            notes: "General post-recovery materials (long-tail demand, 3-12 months post-event)",
          })),
        ];
        await supabase.from("event_materials").insert(materialRows);
      }
    }
  }

  return new Response(
    JSON.stringify({
      disasters_found: byDisasterNumber.size,
      seeded,
      failed,
      completed_at: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
