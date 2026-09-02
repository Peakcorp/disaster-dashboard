// Supabase Edge Function: chat-query
//
// Backs the "Ask the Dashboard" chat tab. Retrieves relevant live data
// from this project's own database based on simple keyword matching
// against the question (state names/codes, disaster categories), feeds it
// to Claude Haiku alongside the question, and returns a plain-text answer.
// Same AI cost-control pattern as the rest of this project (Haiku, capped
// response tokens, daily token budget) — see _shared/ai.ts.
//
// This is retrieval-by-keyword, not a vector search — there's no vector
// index in this schema. Good enough for "what's happening in Florida" or
// "how many active wildfires are there", not for open-ended semantic
// questions the keywords don't happen to match; the system prompt tells
// Claude to say so rather than guess when the retrieved data doesn't cover
// the question.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { AI_MODEL, DAILY_TOKEN_BUDGET, estimateCostUsd, callClaudeText } from "../_shared/ai.ts";
import { STATE_CODE_TO_NAME } from "../_shared/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const MAX_RESPONSE_TOKENS = 500;
const MAX_MATCHED_EVENTS = 20;

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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }

  let question: string;
  try {
    const body = await req.json();
    question = String(body.question ?? "").trim();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body — expected { question: string }" }), { status: 400 });
  }
  if (!question) {
    return new Response(JSON.stringify({ error: "question is required" }), { status: 400 });
  }
  if (question.length > 500) {
    return new Response(JSON.stringify({ error: "question too long (max 500 chars)" }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = new Date().toISOString().slice(0, 10);
  const { data: usageRows } = await supabase.from("ai_usage_log").select("input_tokens, output_tokens").eq("date", today);
  const tokensSpentToday = (usageRows ?? []).reduce((sum, row) => sum + row.input_tokens + row.output_tokens, 0);
  if (tokensSpentToday >= DAILY_TOKEN_BUDGET) {
    return new Response(
      JSON.stringify({ answer: "Daily AI token budget reached for today — try again tomorrow.", data_used: false }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const states = detectStates(question);
  const categories = detectCategories(question);

  let query = supabase
    .from("events")
    .select(
      "name, category, sub_type, status, states_affected, estimated_damage_usd, insurance_claims_filed_est, start_date, is_historical_seed, external_source"
    )
    .neq("status", "resolved")
    .eq("is_historical_seed", false)
    .order("start_date", { ascending: false })
    .limit(MAX_MATCHED_EVENTS);

  if (states.length > 0) query = query.overlaps("states_affected", states);
  if (categories.length > 0) query = query.in("category", categories);

  const { data: matchedEvents, error: matchErr } = await query;
  if (matchErr) {
    return new Response(JSON.stringify({ error: matchErr.message }), { status: 500 });
  }

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
  for (const row of categoryCountsRaw ?? []) {
    categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
  }

  const dataContext = {
    total_active_events_nationwide: totalActiveCount ?? 0,
    active_event_count_by_category: categoryCounts,
    matched_events: (matchedEvents ?? []).map((e) => ({
      name: e.name,
      category: e.category,
      sub_type: e.sub_type,
      status: e.status,
      states_affected: e.states_affected,
      estimated_damage_usd: e.estimated_damage_usd,
      insurance_claims_filed_est: e.insurance_claims_filed_est,
      start_date: e.start_date,
    })),
    note:
      matchedEvents && matchedEvents.length === MAX_MATCHED_EVENTS
        ? `Showing the ${MAX_MATCHED_EVENTS} most recent matching events — more may exist.`
        : undefined,
  };

  const systemPrompt =
    "You are the data assistant embedded in a disaster intelligence dashboard used by three business " +
    "units: SupplyX (building materials), Interserv (commercial renovation), and Insurance Claims " +
    "(legal referrals). You are given a JSON snapshot of LIVE data retrieved from the dashboard's own " +
    "database, matched to the user's question by keyword (state names, disaster categories) — it may be " +
    "incomplete or empty if the question didn't match anything. Answer using this data when it's relevant " +
    "and say so explicitly (e.g. 'Per the dashboard's live data...'). For questions the data doesn't cover " +
    "(general knowledge, definitions, questions about categories/states with no active events), answer from " +
    "your own knowledge but say clearly that it's general knowledge, not from the dashboard's live feed. " +
    "If you don't know something confidently, say so rather than guessing — this dashboard is used for real " +
    "business decisions. Be concise: 2-5 sentences unless the question needs a list.";

  const userPrompt = `DASHBOARD DATA SNAPSHOT:\n${JSON.stringify(dataContext)}\n\nQUESTION: ${question}`;

  try {
    const { text, inputTokens, outputTokens } = await callClaudeText(
      ANTHROPIC_API_KEY,
      systemPrompt,
      userPrompt,
      MAX_RESPONSE_TOKENS
    );

    await supabase.from("ai_usage_log").insert({
      date: today,
      model: AI_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimateCostUsd(inputTokens, outputTokens),
      job_type: "chat_query",
    });

    return new Response(
      JSON.stringify({
        answer: text,
        data_used: (matchedEvents ?? []).length > 0,
        matched_event_count: (matchedEvents ?? []).length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("chat-query failed", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500 }
    );
  }
});
