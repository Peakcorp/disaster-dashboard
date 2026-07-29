// Supabase Edge Function: enrich-historical-events
//
// One-time (idempotent) AI batch enrichment for rows seeded by
// seed-historical-events: generates ai_summary, the three company opportunity
// scores, and price_behavior_notes. Only touches rows with is_historical_seed
// = true and ai_summary IS NULL, so re-running is always safe — already
// enriched rows are left alone (build prompt: "Run this enrichment once
// during setup... never re-run unless a record is edited").
//
// Deliberately does NOT touch `notable_recovery_companies` — naming real
// companies as having "operated in recovery" on a specific disaster is a
// hallucination risk we don't want presented as fact; that field is manual
// entry only via the Supabase Table Editor.
//
// Processes MAX_EVENTS_PER_CYCLE (25) per invocation, same cap as the live
// analyze-events function, for a predictable per-call token ceiling. Invoke
// repeatedly (e.g. `supabase functions invoke enrich-historical-events`)
// until the response shows 0 remaining.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  AI_MODEL,
  MAX_EVENTS_PER_CYCLE,
  MAX_RESPONSE_TOKENS,
  DAILY_TOKEN_BUDGET,
  estimateCostUsd,
  callClaudeJson,
} from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "3-5 sentence plain-English narrative: what happened, peak opportunity windows for each " +
        "company, and what signals preceded the event.",
    },
    price_behavior_notes: {
      type: "string",
      description: "1-2 sentences on how relevant material prices moved during/after this event.",
    },
    supplyx_score: { type: "integer", description: "0-100 SupplyX material-demand opportunity score" },
    interserv_score: { type: "integer", description: "0-100 Interserv renovation opportunity score" },
    insurance_claims_score: { type: "integer", description: "0-100 Insurance Claims lead opportunity score" },
  },
  required: [
    "summary",
    "price_behavior_notes",
    "supplyx_score",
    "interserv_score",
    "insurance_claims_score",
  ],
  additionalProperties: false,
};

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = new Date().toISOString().slice(0, 10);
  const { data: usageRows } = await supabase
    .from("ai_usage_log")
    .select("input_tokens, output_tokens")
    .eq("date", today);
  const tokensSpentToday = (usageRows ?? []).reduce(
    (sum, row) => sum + row.input_tokens + row.output_tokens,
    0
  );
  if (tokensSpentToday >= DAILY_TOKEN_BUDGET) {
    return new Response(
      JSON.stringify({ status: "paused", message: "Daily AI token budget reached — try again tomorrow." }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: candidates, error: fetchErr } = await supabase
    .from("events")
    .select("id, name, category, sub_type, states_affected, estimated_damage_usd, fatalities, start_date, end_date")
    .eq("is_historical_seed", true)
    .is("ai_summary", null)
    .order("estimated_damage_usd", { ascending: false })
    .limit(MAX_EVENTS_PER_CYCLE);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  const { count: remainingAfterThisBatch } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("is_historical_seed", true)
    .is("ai_summary", null);

  let enriched = 0;
  let failed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let firstError: string | null = null;

  for (const event of candidates ?? []) {
    const prompt = JSON.stringify({
      name: event.name,
      category: event.category,
      sub_type: event.sub_type,
      states: event.states_affected,
      estimated_damage_usd: event.estimated_damage_usd,
      fatalities: event.fatalities,
      start_date: event.start_date,
      end_date: event.end_date,
    });

    try {
      const { parsed, inputTokens, outputTokens } = await callClaudeJson(
        ANTHROPIC_API_KEY,
        "You are a business analyst building a historical record for three companies " +
          "(SupplyX: building materials; Interserv: commercial renovation; Insurance Claims: " +
          "legal lead gen). Summarize this historical disaster for them in plain English. " +
          "Event data:\n" + prompt,
        RESPONSE_SCHEMA,
        MAX_RESPONSE_TOKENS
      );

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      const { error: updateErr } = await supabase
        .from("events")
        .update({
          ai_summary: parsed.summary,
          ai_generated_at: new Date().toISOString(),
          price_behavior_notes: parsed.price_behavior_notes,
          supplyx_score: parsed.supplyx_score,
          interserv_score: parsed.interserv_score,
          insurance_claims_score: parsed.insurance_claims_score,
        })
        .eq("id", event.id);

      if (updateErr) throw updateErr;
      enriched++;
    } catch (err) {
      console.error(`Enrichment failed for event ${event.id}`, err);
      failed++;
      if (!firstError) {
        firstError = err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      }
    }
  }

  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    await supabase.from("ai_usage_log").insert({
      date: today,
      model: AI_MODEL,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      estimated_cost_usd: estimateCostUsd(totalInputTokens, totalOutputTokens),
      job_type: "historical_enrichment",
    });
  }

  const remaining = Math.max(0, (remainingAfterThisBatch ?? 0) - enriched);

  return new Response(
    JSON.stringify({
      enriched,
      failed,
      first_error: firstError,
      remaining_unenriched: remaining,
      note: remaining > 0 ? "Invoke this function again to continue enriching." : "All historical events enriched.",
      completed_at: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
