// Shared AI cost-control constants (build prompt: "AI COST CONTROL — MANDATORY RULES").

export const AI_MODEL = "claude-haiku-4-5";

// Rule 3 — cap at 25 events analyzed per refresh cycle.
export const MAX_EVENTS_PER_CYCLE = 25;

// Rule 4 — prompt/response token ceilings.
export const MAX_RESPONSE_TOKENS = 400;

// Rule 6 — daily token budget before pausing automated AI calls for the day.
export const DAILY_TOKEN_BUDGET = 500_000;

// Haiku 4.5 pricing: $1 / $5 per 1M input/output tokens.
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 5;
}

// Raw fetch to the Anthropic API rather than the npm SDK — the SDK (via
// Deno's npm compatibility layer) was failing every request with a generic
// "Connection error" and no further detail. Plain `fetch` is the same
// pattern already used reliably elsewhere in these edge functions (FEMA,
// NOAA, RSS, FRED, Google Places), so this removes the SDK as a variable.
export async function callClaudeJson(
  apiKey: string,
  userPrompt: string,
  schema: Record<string, unknown>,
  maxTokens: number
): Promise<{ parsed: Record<string, unknown>; inputTokens: number; outputTokens: number }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const textBlock = (json.content ?? []).find((b: { type: string }) => b.type === "text");
  if (!textBlock) throw new Error("No text block in Claude response");

  return {
    parsed: JSON.parse(textBlock.text),
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
  };
}
