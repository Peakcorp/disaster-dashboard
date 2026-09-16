// Supabase Edge Function: chat-query
//
// Backs the "Ask the Dashboard" chat tab. Detects intent from the question
// (states, categories, and topic flags like "historical", "materials",
// "contacts", "claims", "receivership", "predictions", "1031", "price
// gouging"), retrieves the relevant slice of data from every table this
// dashboard actually uses across its tabs, and feeds it plus a condensed
// copy of the curated reference tables (materials pricing, verified 1031
// relief, price-gouging rules, approved-materials programs) to Claude
// Haiku. Same AI cost-control pattern as the rest of this project (Haiku,
// capped response tokens, daily token budget) — see _shared/ai.ts.
//
// This is retrieval-by-keyword/intent-flag, not a vector search — there's
// no vector index in this schema. Good enough for "what's happening in
// Florida", "what materials might be short right now", "any properties in
// receivership", etc. — not for fully open-ended semantic questions the
// keywords don't happen to match; the system prompt tells Claude to say so
// rather than guess when the retrieved data doesn't cover the question.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { AI_MODEL, DAILY_TOKEN_BUDGET, estimateCostUsd, callClaudeText } from "../_shared/ai.ts";
import { STATE_CODE_TO_NAME, MATERIALS_BY_DISASTER_TYPE } from "../_shared/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const MAX_RESPONSE_TOKENS = 700;
const MAX_MATCHED_EVENTS = 20;
const MAX_HISTORICAL_EVENTS = 15;
const MAX_CONTACTS = 15;

const CATEGORY_KEYWORDS: Record<string, string> = {
  hurricane: "hurricane", tropical: "hurricane",
  tornado: "tornado",
  wildfire: "wildfire", fire: "wildfire",
  flood: "flood",
  "winter storm": "winter_storm", freeze: "winter_storm", snow: "winter_storm", blizzard: "winter_storm",
  earthquake: "earthquake",
  landslide: "landslide", mudslide: "landslide",
  hail: "hail",
  "man-made": "man_made", "man made": "man_made", explosion: "man_made", chemical: "man_made",
};

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_CODE_TO_NAME).map(([code, name]) => [name.toLowerCase(), code])
);

function detectStates(question: string): string[] {
  const lower = question.toLowerCase();
  const found = new Set<string>();
  for (const [name, code] of Object.entries(NAME_TO_CODE)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(lower)) found.add(code);
  }
  for (const code of Object.keys(STATE_CODE_TO_NAME)) {
    if (new RegExp(`\\b${code}\\b`).test(question)) found.add(code);
  }
  return Array.from(found);
}

function detectCategories(question: string): string[] {
  const lower = question.toLowerCase();
  const found = new Set<string>();
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword)) found.add(category);
  }
  return Array.from(found);
}

function matchesAny(lower: string, terms: string[]): boolean {
  return terms.some((t) => lower.includes(t));
}

// Keep roughly in sync with src/lib/materialPrices.ts — this is a
// condensed Deno-side copy so the chat function doesn't need a second
// runtime to read the frontend's TS module. Not auto-synced; if the
// frontend table changes materially, update this too.
const MATERIAL_PRICE_SUMMARY = [
  "Roofing shingles ~$130/square", "Roof tiles ~$450/square", "Metal roofing panels ~$350/square",
  "Impact windows ~$850/window", "Windows ~$450/window", "Doors ~$350/door", "Siding ~$10/sq ft",
  "Framing lumber ~$900/1,000 board ft", "Sheathing (OSB) ~$45/4x8 sheet", "Drywall ~$15/4x8 sheet",
  "Insulation ~$1.30/sq ft", "Flooring (LVP avg) ~$4/sq ft", "Water heaters ~$1,200/unit",
  "HVAC units ~$6,500/unit (3-ton)", "Electrical panels ~$350/panel (200A)", "Copper pipe ~$6.50/linear ft",
  "PEX tubing ~$0.90/linear ft", "Cabinets ~$200/linear ft", "Countertops ~$55/sq ft", "Paint ~$45/gallon",
  "Tarps ~$35 per 20x30ft heavy-duty poly tarp",
].join("; ");

const HISTORICALLY_SHORTAGE_PRONE = [
  "Framing lumber", "Wood framing (structural)", "Sheathing", "Drywall", "Roofing shingles",
  "Metal roofing panels", "Roofing", "Roof tiles", "Impact windows", "Copper pipe", "HVAC units",
  "Water heaters", "Tarps",
].join(", ");

// Keep in sync with src/lib/section1031.ts.
const VERIFIED_1031_RELIEF_SUMMARY = [
  "IN — severe storms/tornadoes/flooding (FEMA DR-4933, began 2026-08-11), 1031 deadlines postponed to Feb 1, 2027",
  "WV — severe storms/tornadoes/flooding/landslides (DR-4932, began 2026-07-21), postponed to Feb 1, 2027",
  "MS — Tropical Storm Arthur (DR-4930, began 2026-06-18), postponed to Feb 1, 2027",
  "LA — Tropical Storm Arthur (DR-4927, began 2026-06-17), postponed to Nov 2, 2026",
  "WI — severe storms/tornadoes/flooding (DR-4923, began 2026-04-13), postponed to Nov 2, 2026",
  "MI — severe storms/tornadoes/flooding (DR-4925, began 2026-04-10), postponed to Nov 2, 2026",
  "NE — March wildfires, Sioux County (IRS code SD-0010-DR, began 2026-03-12), postponed to Feb 1, 2027",
  "NE — June wildfires, Sioux County (IRS code SD-0014-DR, began 2026-06-09), postponed to Feb 1, 2027",
  "MP (N. Mariana Islands) — Super Typhoon Bavi (DR-4931, began 2026-07-02), postponed to Feb 1, 2027",
  "MP (N. Mariana Islands) — Super Typhoon Sinlaku (DR-4910, began 2026-04-11), postponed to Nov 2, 2026",
].join("\n");

// Keep in sync with src/lib/regulatoryReference.ts.
const PRICE_GOUGING_SUMMARY =
  "Every US state has some price-gouging/anti-profiteering law that activates on a declared state/local " +
  "emergency. Explicit statutory caps are only confirmed for: CA ~10% (Penal Code §396), AL ~25% (Ala. Code " +
  "§8-31-4), NJ ~10% (N.J.S.A. 56:8-107 safe-harbor guidance). Every other state uses a general " +
  "'unconscionable/excessive price' standard enforced case-by-case by that state's Attorney General, not a " +
  "fixed percentage.";

const APPROVED_MATERIALS_SUMMARY =
  "FL High-Velocity Hurricane Zone (Miami-Dade & Broward): roofing and windows/doors need a Miami-Dade " +
  "County NOA or Florida Product Approval rated for wind-borne debris; impact glazing must meet TAS " +
  "201/202/203. CA Wildland-Urban Interface (Building Code Chapter 7A): new construction/re-roofing in a " +
  "designated Fire Hazard Severity Zone needs Class A fire-rated roofing, ignition-resistant siding/decking, " +
  "dual-pane tempered-glass windows. No other state/category has a confirmed mandated program on file.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let question: string;
  try {
    const body = await req.json();
    question = String(body.question ?? "").trim();
  } catch {
    return json({ error: "Invalid JSON body — expected { question: string }" }, 400);
  }
  if (!question) return json({ error: "question is required" }, 400);
  if (question.length > 500) return json({ error: "question too long (max 500 chars)" }, 400);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = new Date().toISOString().slice(0, 10);
  const { data: usageRows } = await supabase.from("ai_usage_log").select("input_tokens, output_tokens").eq("date", today);
  const tokensSpentToday = (usageRows ?? []).reduce((sum, row) => sum + row.input_tokens + row.output_tokens, 0);
  if (tokensSpentToday >= DAILY_TOKEN_BUDGET) {
    return json({ answer: "Daily AI token budget reached for today — try again tomorrow.", data_used: false });
  }

  const lower = question.toLowerCase();
  const states = detectStates(question);
  const categories = detectCategories(question);

  const wantsHistorical = matchesAny(lower, ["histor", "past", "trend", "10 year", "10-year", "since 1980", "archive"]);
  const wantsMaterials = matchesAny(lower, ["material", "price", "shortage", "tarp", "lumber", "shingle", "drywall", "supplyx", "gouging", "approved material", "building code"]);
  const wantsContacts = matchesAny(lower, ["propert", "contact", "church", "hotel", "apartment", "office building", "outreach", "interserv", "loopnet"]);
  const wantsClaims = matchesAny(lower, ["claim", "insurance", "referral", "policyholder", "adjuster"]);
  const wantsReceivership = matchesAny(lower, ["receiver", "foreclos", "distress"]);
  const wantsPredictions = matchesAny(lower, ["predict", "forecast", "risk", "season", "next 3 month", "upcoming", "outlook"]);
  const wants1031 = matchesAny(lower, ["1031", "exchange", "like-kind", "like kind"]);

  // --- Always: live event aggregate + keyword-matched live events ---
  let liveQuery = supabase
    .from("events")
    .select(
      "name, category, sub_type, status, states_affected, estimated_damage_usd, insurance_claims_filed_est, start_date, external_source, external_id"
    )
    .neq("status", "resolved")
    .eq("is_historical_seed", false)
    .order("start_date", { ascending: false })
    .limit(MAX_MATCHED_EVENTS);
  if (states.length > 0) liveQuery = liveQuery.overlaps("states_affected", states);
  if (categories.length > 0) liveQuery = liveQuery.in("category", categories);
  const { data: matchedEvents, error: matchErr } = await liveQuery;
  if (matchErr) return json({ error: matchErr.message }, 500);

  const { count: totalActiveCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .neq("status", "resolved")
    .eq("is_historical_seed", false);

  const { data: categoryCountsRaw } = await supabase
    .from("events")
    .select("category")
    .neq("status", "resolved")
    .eq("is_historical_seed", false)
    .range(0, 4999);
  const categoryCounts: Record<string, number> = {};
  for (const row of categoryCountsRaw ?? []) categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;

  const dataContext: Record<string, unknown> = {
    total_active_events_nationwide: totalActiveCount ?? 0,
    active_event_count_by_category: categoryCounts,
    matched_live_events: (matchedEvents ?? []).map((e) => ({
      name: e.name,
      category: e.category,
      sub_type: e.sub_type,
      status: e.status,
      states_affected: e.states_affected,
      estimated_damage_usd: e.estimated_damage_usd,
      insurance_claims_filed_est: e.insurance_claims_filed_est,
      start_date: e.start_date,
      fema_dr_number: e.external_source?.includes("fema") ? String(e.external_id).replace(/^fema-/, "") : null,
    })),
  };
  const matchedIds = (matchedEvents ?? []).map((e) => e as unknown as { name: string });

  // --- Historical archive (10-year seed data) ---
  if (wantsHistorical || (matchedEvents ?? []).length === 0) {
    let histQuery = supabase
      .from("events")
      .select("name, category, states_affected, estimated_damage_usd, fatalities, start_date")
      .eq("is_historical_seed", true)
      .order("estimated_damage_usd", { ascending: false, nullsFirst: false })
      .limit(MAX_HISTORICAL_EVENTS);
    if (states.length > 0) histQuery = histQuery.overlaps("states_affected", states);
    if (categories.length > 0) histQuery = histQuery.in("category", categories);
    const { data: historicalEvents } = await histQuery;
    dataContext.historical_top_events = historicalEvents ?? [];
  }

  // --- Materials / pricing / shortage ---
  if (wantsMaterials) {
    dataContext.materials_by_disaster_category = MATERIALS_BY_DISASTER_TYPE;
    dataContext.us_price_reference = MATERIAL_PRICE_SUMMARY;
    dataContext.historically_shortage_prone_materials = HISTORICALLY_SHORTAGE_PRONE;
  }

  // --- Interserv contacts / properties ---
  if (wantsContacts) {
    let contactQuery = supabase
      .from("event_contacts")
      .select("name, company_type, address, state, status, phone, website")
      .order("id", { ascending: false })
      .limit(MAX_CONTACTS);
    if (states.length > 0) contactQuery = contactQuery.in("state", states);
    const { data: contacts } = await contactQuery;
    dataContext.surfaced_properties = contacts ?? [];
  }

  // --- Insurance claims aggregates ---
  if (wantsClaims) {
    const claimsByCategory: Record<string, { events: number; total_claims_est: number; total_damage_usd: number }> = {};
    for (const e of matchedEvents ?? []) {
      const bucket = claimsByCategory[e.category] ?? { events: 0, total_claims_est: 0, total_damage_usd: 0 };
      bucket.events++;
      bucket.total_claims_est += e.insurance_claims_filed_est ?? 0;
      bucket.total_damage_usd += e.estimated_damage_usd ?? 0;
      claimsByCategory[e.category] = bucket;
    }
    dataContext.insurance_claims_by_category_for_matched_events = claimsByCategory;
  }

  // --- Receivership ---
  if (wantsReceivership) {
    const { data: receiverships } = await supabase
      .from("property_receiverships")
      .select("property_name, state, receivership_status, notes, news_url")
      .order("created_at", { ascending: false })
      .limit(20);
    dataContext.receivership_cases_found = receiverships ?? [];
  }

  // --- 1031 Exchange ---
  if (wants1031) {
    dataContext.verified_irs_1031_relief_notices = VERIFIED_1031_RELIEF_SUMMARY;
  }

  // --- Price gouging / approved materials (cheap, include whenever materials or regulatory intent) ---
  if (wantsMaterials) {
    dataContext.price_gouging_law_summary = PRICE_GOUGING_SUMMARY;
    dataContext.approved_materials_by_region_summary = APPROVED_MATERIALS_SUMMARY;
  }

  // --- Seasonal risk / predictions (lightweight inline version) ---
  if (wantsPredictions) {
    const cutoffYear = new Date().getFullYear() - 10;
    const { data: last10yr } = await supabase
      .from("events")
      .select("category, states_affected, start_date")
      .eq("is_historical_seed", true)
      .gte("start_date", `${cutoffYear}-01-01`)
      .range(0, 4999);
    const referenceMonth = new Date().getMonth();
    const windowMonths = [0, 1, 2].map((o) => (referenceMonth + o) % 12);
    const byCategory: Record<string, { total: number; inWindow: number }> = {};
    for (const e of last10yr ?? []) {
      const bucket = byCategory[e.category] ?? { total: 0, inWindow: 0 };
      bucket.total++;
      if (windowMonths.includes(new Date(e.start_date).getUTCMonth())) bucket.inWindow++;
      byCategory[e.category] = bucket;
    }
    dataContext.seasonal_risk_next_3_months = {
      note: "Share of each category's last-10-year events falling in the same 3-month window as today — a statistical concentration signal, not a deterministic forecast.",
      by_category: byCategory,
    };
  }

  const systemPrompt =
    "You are the data assistant embedded in a disaster intelligence dashboard used by three business units: " +
    "SupplyX (building materials), Interserv (commercial renovation), and Insurance Claims (legal referrals). " +
    "The dashboard also has Historical (10-year archive), Predictions (seasonal risk), a 1031 Exchange relief " +
    "tracker, and a Receivership tracker. You are given a JSON snapshot of data retrieved from the dashboard's " +
    "own database and curated reference tables, selected based on what the question seems to be about — it may " +
    "be incomplete if the question didn't match any of the topic detectors. Answer using this data when it's " +
    "relevant and say so explicitly (e.g. 'Per the dashboard's live data...' or 'Per the curated price-gouging " +
    "reference...'). For anything the data doesn't cover (general knowledge, definitions, topics with no active " +
    "matches), answer from your own knowledge but say clearly that it's general knowledge, not from the " +
    "dashboard. If you don't know something confidently, say so rather than guessing — this dashboard is used " +
    "for real business decisions, and the price-gouging/approved-materials/1031 reference data is curated, not " +
    "legal advice. Be concise: 2-6 sentences unless the question needs a list.";

  const userPrompt = `DASHBOARD DATA SNAPSHOT:\n${JSON.stringify(dataContext)}\n\nQUESTION: ${question}`;

  try {
    const { text, inputTokens, outputTokens } = await callClaudeText(ANTHROPIC_API_KEY, systemPrompt, userPrompt, MAX_RESPONSE_TOKENS);

    await supabase.from("ai_usage_log").insert({
      date: today,
      model: AI_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimateCostUsd(inputTokens, outputTokens),
      job_type: "chat_query",
    });

    return json({
      answer: text,
      data_used: (matchedEvents ?? []).length > 0 || Object.keys(dataContext).length > 2,
      matched_event_count: matchedIds.length,
    });
  } catch (err) {
    console.error("chat-query failed", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
