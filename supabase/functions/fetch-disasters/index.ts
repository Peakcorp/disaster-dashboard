// Supabase Edge Function: fetch-disasters
//
// Pulls active/recent disaster data from two free, keyless government
// sources (FEMA OpenFEMA + NOAA/NWS Alerts), normalizes it into the `events`
// table schema, and upserts. Invoked every 6 hours by pg_cron
// (see supabase/migrations/0002_pg_cron_schedule.sql) and can also be
// triggered manually for testing:
//
//   supabase functions invoke fetch-disasters
//
// Phase 1 scope: no AI analysis, no RSS, no price data. Those land in later
// phases per the build prompt's own phasing. Damage-dollar estimates are not
// populated yet because FEMA's DisasterDeclarationsSummaries dataset doesn't
// carry them directly (they show up in PublicAssistanceFundedProjectsSummaries
// / SBA loan data, which is a Phase 2/3 add-on) — those rows will have
// estimated_damage_usd = null until that's wired up.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { MATERIALS_BY_DISASTER_TYPE } from "../_shared/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const NWS_USER_AGENT = "DisasterIntelligenceDashboard (contact: set-your-email@example.com)";

type DisasterCategory =
  | "hurricane"
  | "tornado"
  | "wildfire"
  | "flood"
  | "winter_storm"
  | "earthquake"
  | "landslide"
  | "hail"
  | "extreme_heat"
  | "man_made";

type EventStatus = "critical" | "developing" | "monitoring" | "resolved";

interface NormalizedEvent {
  name: string;
  category: DisasterCategory;
  sub_type: string | null;
  status: EventStatus;
  start_date: string;
  end_date: string | null;
  fema_region: string | null;
  states_affected: string[];
  counties: string[];
  lat: number | null;
  lng: number | null;
  estimated_damage_usd: number | null;
  govt_support_level: "full" | "partial" | "none" | null;
  confidence_score: "HIGH" | "MEDIUM" | "LOW";
  external_source: "fema" | "nws";
  external_id: string;
}

function mapFemaIncidentType(incidentType: string): DisasterCategory {
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

function mapNwsEventType(eventType: string): DisasterCategory | null {
  const t = eventType.toLowerCase();
  if (t.includes("hurricane") || t.includes("tropical storm")) return "hurricane";
  if (t.includes("tornado")) return "tornado";
  if (t.includes("fire")) return "wildfire";
  if (t.includes("flood")) return "flood";
  if (t.includes("winter") || t.includes("ice storm") || t.includes("blizzard") || t.includes("freez")) {
    return "winter_storm";
  }
  if (t.includes("earthquake")) return "earthquake";
  if (t.includes("hail")) return "hail";
  if (t.includes("heat")) return "extreme_heat";
  // Deliberately excludes generic/non-disaster alert types (e.g. Small Craft
  // Advisory, Air Quality) by returning null — caller skips those.
  return null;
}

function nwsSeverityToStatus(severity: string): EventStatus {
  const s = severity.toLowerCase();
  if (s === "extreme" || s === "severe") return "critical";
  if (s === "moderate") return "developing";
  return "monitoring";
}

// Deterministic destroyed/consumed material tagging (build prompt section
// 3A) for SupplyX's Tab 3 — same static lookup used by seed-historical-events,
// applied here for live events. Only inserts once per event (materials don't
// change unless the disaster category itself is ever corrected).
async function tagMaterialsForEvent(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  category: string
): Promise<void> {
  const { count } = await supabase
    .from("event_materials")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if (count) return;

  const mapping = MATERIALS_BY_DISASTER_TYPE[category];
  if (!mapping) return;

  const rows = [
    ...mapping.destroyed.map((material) => ({
      event_id: eventId,
      material_name: material,
      category: "destroyed" as const,
      proximity_band: null,
      disaster_type: category,
    })),
    ...mapping.consumed.map((material) => ({
      event_id: eventId,
      material_name: material,
      category: "consumed" as const,
      proximity_band: "5-10mi" as const,
      disaster_type: category,
      notes: "General post-recovery materials (long-tail demand, 3-12 months post-event)",
    })),
  ];
  await supabase.from("event_materials").insert(rows);
}

// SHA-256, not MD5 — Deno's Web Crypto implementation follows the W3C
// SubtleCrypto spec, which only supports SHA-1/256/384/512 (no MD5). Any
// deterministic hash works equally well for this change-detection purpose.
async function hashPayload(payload: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchFemaDeclarations(): Promise<NormalizedEvent[]> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const url =
    "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries" +
    `?$filter=declarationDate ge '${since.toISOString().slice(0, 10)}'` +
    "&$orderby=declarationDate desc&$top=200";

  const res = await fetch(url);
  if (!res.ok) {
    console.error("FEMA API error", res.status, await res.text());
    return [];
  }
  const json = await res.json();
  const rows: Array<Record<string, unknown>> = json.DisasterDeclarationsSummaries ?? [];

  // FEMA returns one row per state/county/program combo for the same
  // disaster number — group them into one event per disasterNumber.
  const byDisasterNumber = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const key = String(row.disasterNumber);
    if (!byDisasterNumber.has(key)) byDisasterNumber.set(key, []);
    byDisasterNumber.get(key)!.push(row);
  }

  const events: NormalizedEvent[] = [];
  for (const [disasterNumber, group] of byDisasterNumber) {
    const first = group[0];
    const states = Array.from(new Set(group.map((r) => String(r.state))));
    const counties = Array.from(
      new Set(group.map((r) => String(r.designatedArea)).filter((a) => a && a !== "undefined"))
    );
    const declarationDate = String(first.declarationDate).slice(0, 10);
    const daysSinceDeclaration =
      (Date.now() - new Date(declarationDate).getTime()) / (1000 * 60 * 60 * 24);

    events.push({
      name: `${first.declarationTitle ?? first.incidentType ?? "Disaster"} — ${states.join(", ")}`,
      category: mapFemaIncidentType(String(first.incidentType ?? "")),
      sub_type: String(first.incidentType ?? null),
      status: daysSinceDeclaration <= 30 ? "critical" : "developing",
      start_date: String(first.incidentBeginDate ?? declarationDate).slice(0, 10),
      end_date: first.incidentEndDate ? String(first.incidentEndDate).slice(0, 10) : null,
      fema_region: first.region != null ? String(first.region) : null,
      states_affected: states,
      counties,
      lat: null,
      lng: null,
      estimated_damage_usd: null,
      govt_support_level: first.ihProgramDeclared || first.paProgramDeclared ? "full" : "partial",
      confidence_score: "MEDIUM",
      external_source: "fema",
      external_id: disasterNumber,
    });
  }
  return events;
}

async function fetchNwsAlerts(): Promise<NormalizedEvent[]> {
  const res = await fetch("https://api.weather.gov/alerts/active?status=actual&message_type=alert", {
    headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
  });
  if (!res.ok) {
    console.error("NWS API error", res.status, await res.text());
    return [];
  }
  const json = await res.json();
  const features: Array<Record<string, any>> = json.features ?? [];

  const events: NormalizedEvent[] = [];
  for (const feature of features) {
    const props = feature.properties;
    const category = mapNwsEventType(String(props.event ?? ""));
    if (!category) continue;

    let lat: number | null = null;
    let lng: number | null = null;
    const geometry = feature.geometry;
    if (geometry?.type === "Polygon" && Array.isArray(geometry.coordinates?.[0])) {
      const ring: Array<[number, number]> = geometry.coordinates[0];
      const avgLng = ring.reduce((sum, c) => sum + c[0], 0) / ring.length;
      const avgLat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length;
      lat = avgLat;
      lng = avgLng;
    }

    const states = Array.from(
      new Set(String(props.areaDesc ?? "").split(";").map((s) => s.trim()).filter(Boolean))
    );

    events.push({
      name: String(props.headline ?? props.event ?? "NWS Alert"),
      category,
      sub_type: String(props.event ?? null),
      status: nwsSeverityToStatus(String(props.severity ?? "Unknown")),
      start_date: String(props.onset ?? props.sent ?? new Date().toISOString()).slice(0, 10),
      end_date: props.ends ? String(props.ends).slice(0, 10) : null,
      fema_region: null,
      states_affected: states,
      counties: [],
      lat,
      lng,
      estimated_damage_usd: null,
      govt_support_level: null,
      confidence_score: "MEDIUM",
      external_source: "nws",
      external_id: String(props.id ?? feature.id),
    });
  }
  return events;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Clear last cycle's "UPDATED" badges before computing this cycle's.
  await supabase
    .from("events")
    .update({ is_updated_since_last_refresh: false })
    .eq("is_updated_since_last_refresh", true);

  const [femaEvents, nwsEvents] = await Promise.all([
    fetchFemaDeclarations().catch((err) => {
      console.error("FEMA fetch failed", err);
      return [] as NormalizedEvent[];
    }),
    fetchNwsAlerts().catch((err) => {
      console.error("NWS fetch failed", err);
      return [] as NormalizedEvent[];
    }),
  ]);

  const allEvents = [...femaEvents, ...nwsEvents];
  let changed = 0;
  let unchanged = 0;
  let failed = 0;

  for (const event of allEvents) {
    const hash = await hashPayload(event);

    const { data: existing, error: fetchErr } = await supabase
      .from("events")
      .select("id, source_data_hash")
      .eq("external_source", event.external_source)
      .eq("external_id", event.external_id)
      .maybeSingle();

    if (fetchErr) {
      console.error("Lookup failed", event.external_source, event.external_id, fetchErr);
      failed++;
      continue;
    }

    if (existing && existing.source_data_hash === hash) {
      unchanged++;
      continue;
    }

    const { data: upserted, error: upsertErr } = await supabase
      .from("events")
      .upsert(
        {
          ...event,
          source_data_hash: hash,
          last_fetched_at: new Date().toISOString(),
          is_updated_since_last_refresh: Boolean(existing),
        },
        { onConflict: "external_source,external_id" }
      )
      .select("id")
      .single();

    if (upsertErr || !upserted) {
      console.error("Upsert failed", event.external_source, event.external_id, upsertErr);
      failed++;
      continue;
    }
    changed++;

    await tagMaterialsForEvent(supabase, upserted.id, event.category).catch((err) =>
      console.error(`Material tagging failed for event ${upserted.id}`, err)
    );
  }

  const summary = {
    fetched: allEvents.length,
    changed,
    unchanged,
    failed,
    completed_at: new Date().toISOString(),
  };

  // Status bar data (last refresh time, events updated this cycle) is
  // derived directly from `events.last_fetched_at` /
  // `is_updated_since_last_refresh` on the frontend — no separate
  // refresh_log table needed until Phase 2 adds AI token tracking.

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json" },
  });
});
