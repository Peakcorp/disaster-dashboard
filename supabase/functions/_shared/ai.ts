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
