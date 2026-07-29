// Supabase Edge Function: analyze-events
//
// Claude Haiku AI layer for live events — generates ai_summary + the three
// company opportunity scores. Follows every rule in the build prompt's
// "AI COST CONTROL — MANDATORY RULES" section:
//
//   Rule 1 (cache everything)     — only analyzes events with no ai_summary
//                                    yet, or flagged is_updated_since_last_refresh
//                                    by fetch-disasters this cycle. Everything
//                                    else serves its cached ai_summary/scores.
//   Rule 2 (only changed events)  — same mechanism as above.
//   Rule 3 (cap 25/cycle)         — candidates are ranked by severity and
//                                    sliced to MAX_EVENTS_PER_CYCLE; the rest
//                                    are left for the next cycle (their
//                                    is_updated_since_last_refresh flag stays
//                                    true so they're picked up next time).
//   Rule 4 (prompt/response caps) — prompt passes only the fields the model
//                                    needs (~150 tokens); output_config.format
//                                    forces short structured JSON, response
//                                    capped at MAX_RESPONSE_TOKENS.
//   Rule 5 (Haiku only)           — AI_MODEL is claude-haiku-4-5, no Sonnet/Opus.
//   Rule 6 (daily token budget)   — checks ai_usage_log for today's cumulative
//                                    tokens before calling the API; pauses if
//                                    over DAILY_TOKEN_BUDGET.
//
// Scheduled a few minutes after fetch-disasters via pg_cron (see
// supabase/migrations/0004_phase2_cron.sql) so events already exist to analyze.
// Can also be invoked manually: `supabase functions invoke analyze-events`

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.32";
import {
  AI_MODEL,
  MAX_EVENTS_PER_CYCLE,
  MAX_RESPONSE_TOKENS,
  DAILY_TOKEN_BUDGET,
  estimateCostUsd,
} from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const STATUS_RANK: Record<string, number> = {
  critical: 3,
  developing: 2,
  monitoring: 1,
  resolved: 0,
};

interface EventRow {
  id: string;
  name: string;
  category: string;
  status: string;
  states_affected: string[];
  estimated_damage_usd: number | null;
  fema_region: string | null;
  govt_support_level: string | null;
  fatalities: number | null;
  confidence_score: string;
  start_date: string;
}

function severityRank(e: EventRow): number {
  const statusScore = (STATUS_RANK[e.status] ?? 0) * 1_000_000_000_000;
  const damageScore = e.estimated_damage_usd ?? 0;
  const recencyScore = new Date(e.start_date).getTime() / 1e15;
  return statusScore + damageScore + recencyScore;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "2-3 sentence plain-English briefing: what happened, current status, what's next.",
    },
    supplyx_score: { type: "integer", description: "0-100 SupplyX material-demand opportunity score" },
    interserv_score: { type: "integer", description: "0-100 Interserv renovation opportunity score" },
    insurance_claims_score: { type: "integer", description: "0-100 Insurance Claims lead opportunity score" },
    insurance_claims_filed_est: {
      type: "integer",
      description:
        "Rough order-of-magnitude estimate of property damage insurance claims likely filed for this " +
        "event, based on damage scale and category. This is an estimate, not a guarantee.",
    },
  },
  required: [
    "summary",
    "supplyx_score",
    "interserv_score",
    "insurance_claims_score",
    "insurance_claims_filed_est",
  ],
  additionalProperties: false,
};

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // Rule 6: daily token budget check.
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
      JSON.stringify({
        status: "paused",
        message: "AI analysis paused for today — resuming at midnight. All data is current; summaries may be up to 12 hours old.",
        tokens_spent_today: tokensSpentToday,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Rules 1/2: candidates are events never analyzed, or changed this cycle.
  const { data: candidates, error: fetchErr } = await supabase
    .from("events")
    .select(
      "id, name, category, status, states_affected, estimated_damage_usd, fema_region, govt_support_level, fatalities, confidence_score, start_date"
    )
    .or("ai_summary.is.null,is_updated_since_last_refresh.eq.true");

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  // Rule 3: cap at top 25 by severity; the rest wait for next cycle.
  const ranked = (candidates as EventRow[]).sort((a, b) => severityRank(b) - severityRank(a));
  const toAnalyze = ranked.slice(0, MAX_EVENTS_PER_CYCLE);
  const deferred = ranked.length - toAnalyze.length;

  let analyzed = 0;
  let failed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const event of toAnalyze) {
    // Rule 4: pass only the fields the model needs, nothing else.
    const prompt = JSON.stringify({
      name: event.name,
      category: event.category,
      status: event.status,
      states: event.states_affected,
      estimated_damage_usd: event.estimated_damage_usd,
      fema_region: event.fema_region,
      govt_support_level: event.govt_support_level,
      fatalities: event.fatalities,
      confidence: event.confidence_score,
    });

    try {
      const response = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: MAX_RESPONSE_TOKENS,
        output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
        messages: [
          {
            role: "user",
            content:
              "You are a business analyst briefing three companies (SupplyX: building materials; " +
              "Interserv: commercial renovation; Insurance Claims: legal lead gen) on this disaster " +
              "event. Write in plain English, no jargon. Event data:\n" +
              prompt,
          },
        ],
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("No text block in response");
      const parsed = JSON.parse(textBlock.text);

      const { error: updateErr } = await supabase
        .from("events")
        .update({
          ai_summary: parsed.summary,
          ai_generated_at: new Date().toISOString(),
          supplyx_score: parsed.supplyx_score,
          interserv_score: parsed.interserv_score,
          insurance_claims_score: parsed.insurance_claims_score,
          insurance_claims_filed_est: parsed.insurance_claims_filed_est,
        })
        .eq("id", event.id);

      if (updateErr) throw updateErr;
      analyzed++;
    } catch (err) {
      console.error(`Analysis failed for event ${event.id}`, err);
      failed++;
    }
  }

  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    await supabase.from("ai_usage_log").insert({
      date: today,
      model: AI_MODEL,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      estimated_cost_usd: estimateCostUsd(totalInputTokens, totalOutputTokens),
      job_type: "live_event_analysis",
    });
  }

  const summary = {
    status: "completed",
    candidates_found: ranked.length,
    analyzed,
    failed,
    deferred_to_next_cycle: deferred,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    completed_at: new Date().toISOString(),
  };

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json" },
  });
});
