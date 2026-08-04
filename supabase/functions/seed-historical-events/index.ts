// Supabase Edge Function: seed-historical-events
//
// One-time (or occasional re-run) backfill of Tab 2 (Historical Disaster
// Intelligence) from NOAA's Billion-Dollar Weather and Climate Disasters
// dataset — the free, authoritative source the build prompt names for
// historical damage figures. Not on any cron schedule; invoke manually:
//
//   supabase functions invoke seed-historical-events
//
// IMPORTANT — NOAA_BILLION_DOLLAR_CSV_URL must be set as a function secret.
// NOAA's export link is served from a JS-driven dashboard
// (ncei.noaa.gov/access/billions/) rather than a stable static file, so
// there's no single URL that's safe to hardcode here without it going stale
// or 404ing after the next annual data refresh. Get the current CSV/export
// link from that page's download button and set it:
//
//   supabase secrets set NOAA_BILLION_DOLLAR_CSV_URL=https://...
//
// Known limitation: this dataset only covers events at/above $1B in damage
// (CPI-adjusted) since 1980 — narrower than the build prompt's stated
// "$100M+ since 2005" target, because there is no free, equivalent dataset
// covering that wider $100M-$999M band with per-event damage figures. This
// is flagged in the README rather than papered over.

import { createClient } from "jsr:@supabase/supabase-js@2";
import Papa from "npm:papaparse@5";
import { MATERIALS_BY_DISASTER_TYPE, STATE_CODE_TO_NAME } from "../_shared/constants.ts";

// NOAA's Billion-Dollar Disasters CSV has no state/region column at all —
// just Name, Disaster, Begin Date, End Date, and cost/death figures. The
// only geographic signal is free text baked into the event name (e.g.
// "Arizona Flooding (October 1983)", "Gulf States Storms and Flooding
// (December 1982-January 1983)", "Midwest/Plains/Southeast Tornadoes").
// Extracting states from that text is the only way this dataset can support
// a region-level view (Tab 6's Predictions), so this matches full state
// names directly, plus a synonym map for the common multi-state region
// names NOAA uses instead of listing states out.
const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_CODE_TO_NAME).map(([code, name]) => [name.toLowerCase(), code])
);

const REGION_SYNONYMS: Record<string, string[]> = {
  "gulf states": ["TX", "LA", "MS", "AL", "FL"],
  "gulf coast": ["TX", "LA", "MS", "AL", "FL"],
  midwest: ["OH", "IN", "IL", "MI", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"],
  northeast: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA"],
  "new england": ["ME", "NH", "VT", "MA", "RI", "CT"],
  southeast: ["VA", "NC", "SC", "GA", "FL", "AL", "MS", "TN", "KY"],
  southwest: ["AZ", "NM", "TX", "NV"],
  "pacific northwest": ["WA", "OR", "ID"],
  plains: ["ND", "SD", "NE", "KS", "OK", "TX"],
  "northern plains": ["ND", "SD", "MT", "WY"],
  "west coast": ["CA", "OR", "WA"],
  western: ["CA", "OR", "WA", "NV", "AZ", "ID", "MT", "WY", "UT", "CO", "NM"],
  southern: ["TX", "LA", "MS", "AL", "GA", "FL", "SC", "NC", "TN", "AR"],
  rockies: ["CO", "WY", "MT", "ID", "UT"],
  "rocky mountain": ["CO", "WY", "MT", "ID", "UT"],
};

function extractStatesFromName(name: string): string[] {
  const lower = name.toLowerCase();
  const found = new Set<string>();

  for (const [stateName, code] of Object.entries(NAME_TO_CODE)) {
    // Word-boundary match so "Georgia" doesn't match inside an unrelated
    // word, and so short names aren't over-eager — still fine for full
    // state names like "ohio" or "texas".
    const pattern = new RegExp(`\\b${stateName}\\b`, "i");
    if (pattern.test(lower)) found.add(code);
  }

  for (const [term, codes] of Object.entries(REGION_SYNONYMS)) {
    if (lower.includes(term)) {
      for (const code of codes) found.add(code);
    }
  }

  return Array.from(found);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOAA_BILLION_DOLLAR_CSV_URL = Deno.env.get("NOAA_BILLION_DOLLAR_CSV_URL");

function findColumn(headers: string[], ...terms: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const term of terms) {
    const idx = lower.findIndex((h) => h.includes(term));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function mapDisasterText(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("tropical") || t.includes("hurricane")) return "hurricane";
  if (t.includes("wildfire") || t.includes("fire")) return "wildfire";
  if (t.includes("flood")) return "flood";
  if (t.includes("winter") || t.includes("freeze") || t.includes("ice storm")) return "winter_storm";
  if (t.includes("drought") || t.includes("heat")) return "extreme_heat";
  if (t.includes("earthquake")) return "earthquake";
  if (t.includes("tornado")) return "tornado";
  if (t.includes("severe storm") || t.includes("hail")) return "hail";
  return "man_made";
}

// NOAA's cost columns are reported in millions of dollars (e.g. "2749.4"
// means $2,749.4M), not raw dollars.
function parseMoneyInMillions(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const value = Number(cleaned);
  return Number.isFinite(value) ? value * 1_000_000 : null;
}

// NOAA's date columns are YYYYMMDD with no separators (e.g. "19800410"),
// which the plain Date constructor does not parse correctly. Fall back to
// generic parsing for any other format this CSV might use in the future.
function parseNoaaDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{8}$/.test(trimmed)) {
    const iso = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}T00:00:00Z`;
    const date = new Date(iso);
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(trimmed);
  return isNaN(date.getTime()) ? null : date;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

Deno.serve(async () => {
  if (!NOAA_BILLION_DOLLAR_CSV_URL) {
    return new Response(
      JSON.stringify({
        error:
          "NOAA_BILLION_DOLLAR_CSV_URL secret is not set. Get the current export link from " +
          "https://www.ncei.noaa.gov/access/billions/ and run: supabase secrets set NOAA_BILLION_DOLLAR_CSV_URL=<url>",
      }),
      { status: 400 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const csvRes = await fetch(NOAA_BILLION_DOLLAR_CSV_URL);
  if (!csvRes.ok) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch NOAA CSV: HTTP ${csvRes.status}` }),
      { status: 502 }
    );
  }
  const csvText = await csvRes.text();

  // NOAA's export has a couple of title/note lines before the real header
  // row (e.g. "Weather and Climate Billion-Dollar Disasters..." and "Cost
  // values are in millions of dollars"). Skip down to the line that starts
  // with "Name," — the actual column header — before parsing.
  const lines = csvText.split(/\r?\n/);
  const headerLineIndex = lines.findIndex((line) => /^name,/i.test(line.trim()));
  const dataStartingCsv = headerLineIndex > 0 ? lines.slice(headerLineIndex).join("\n") : csvText;

  const parsed = Papa.parse<Record<string, string>>(dataStartingCsv, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    console.error("CSV parse errors (first 5):", parsed.errors.slice(0, 5));
  }

  const headers = parsed.meta.fields ?? [];
  const nameCol = findColumn(headers, "name", "event");
  const typeCol = findColumn(headers, "disaster", "type", "category");
  const beginCol = findColumn(headers, "begin", "start");
  const endCol = findColumn(headers, "end");
  const costCol = findColumn(headers, "cpi-adjusted", "cpi adjusted", "cost", "damage");
  const deathsCol = findColumn(headers, "death", "fatal");

  if (!nameCol || !typeCol || !beginCol) {
    return new Response(
      JSON.stringify({
        error: "Could not identify required columns (name/type/begin date) in the NOAA CSV.",
        headers_found: headers,
      }),
      { status: 422 }
    );
  }

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  let withStatesExtracted = 0;

  for (const [index, row] of parsed.data.entries()) {
    const name = row[nameCol]?.trim();
    const beginDateRaw = row[beginCol]?.trim();
    if (!name || !beginDateRaw) {
      skipped++;
      continue;
    }

    const beginDate = parseNoaaDate(beginDateRaw);
    if (!beginDate) {
      skipped++;
      continue;
    }
    const endDate = endCol ? parseNoaaDate(row[endCol]) : null;

    const category = mapDisasterText(row[typeCol] ?? "");
    // Heat/drought is out of scope — the three consumers (SupplyX materials,
    // Interserv renovation, Insurance Claims referrals) are all
    // property-damage-driven, which heat advisories don't map to.
    if (category === "extreme_heat") {
      skipped++;
      continue;
    }
    const externalId = `${slugify(name)}-${beginDate.getUTCFullYear()}-${index}`;
    const statesAffected = extractStatesFromName(name);
    if (statesAffected.length > 0) withStatesExtracted++;

    const eventRow = {
      name,
      category,
      sub_type: row[typeCol] ?? null,
      status: "resolved" as const,
      start_date: beginDate.toISOString().slice(0, 10),
      end_date: endDate ? endDate.toISOString().slice(0, 10) : null,
      states_affected: statesAffected,
      counties: [] as string[],
      estimated_damage_usd: costCol ? parseMoneyInMillions(row[costCol]) : null,
      fatalities: deathsCol ? Number(row[deathsCol]) || null : null,
      confidence_score: "MEDIUM" as const,
      is_historical_seed: true,
      external_source: "noaa_billion_dollar",
      external_id: externalId,
      last_fetched_at: new Date().toISOString(),
      source_data_hash: null,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from("events")
      .upsert(eventRow, { onConflict: "external_source,external_id" })
      .select("id")
      .single();

    if (upsertErr || !upserted) {
      console.error(`Failed to seed "${name}"`, upsertErr);
      failed++;
      continue;
    }
    inserted++;

    // Deterministic material tagging from the static disaster-type mapping —
    // not AI-generated (see file header). Skip if already tagged (re-run safety).
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

  const summary = {
    rows_in_csv: parsed.data.length,
    seeded: inserted,
    skipped_missing_fields: skipped,
    with_states_extracted_from_name: withStatesExtracted,
    failed,
    completed_at: new Date().toISOString(),
  };

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json" },
  });
});
