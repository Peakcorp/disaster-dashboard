import type { DisasterCategory, DisasterEvent } from "@/types/event";

// --- Interserv: renovation outreach timing (build prompt section 4C) ---
// Only the four categories the build prompt explicitly gives a timing
// window for use that window; everything else falls back to a generic
// range, clearly labeled as such rather than asserting false precision.
const OUTREACH_TIMING_MONTHS: Partial<Record<DisasterCategory, [number, number]>> = {
  flood: [4, 9],
  hurricane: [5, 10],
  wildfire: [8, 18],
  winter_storm: [1, 3],
};
const GENERIC_OUTREACH_TIMING_MONTHS: [number, number] = [3, 9];

export function outreachTimingFor(category: DisasterCategory): {
  minMonths: number;
  maxMonths: number;
  isGeneric: boolean;
} {
  const range = OUTREACH_TIMING_MONTHS[category];
  const [minMonths, maxMonths] = range ?? GENERIC_OUTREACH_TIMING_MONTHS;
  return { minMonths, maxMonths, isGeneric: !range };
}

export function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export type OutreachStatus = "too_early" | "now" | "closing" | "too_late";

export function outreachStatusFor(event: DisasterEvent): OutreachStatus {
  const { minMonths, maxMonths } = outreachTimingFor(event.category);
  const daysSinceStart = (Date.now() - new Date(event.start_date).getTime()) / (1000 * 60 * 60 * 24);
  const openDays = minMonths * 30;
  const closeDays = maxMonths * 30;

  if (daysSinceStart < openDays) return "too_early";
  if (daysSinceStart <= closeDays * 0.9) return "now";
  if (daysSinceStart <= closeDays) return "closing";
  return "too_late";
}

export const OUTREACH_STATUS_LABEL: Record<OutreachStatus, string> = {
  too_early: "🕐 Too early",
  now: "✅ Outreach NOW",
  closing: "⚠️ Window closing",
  too_late: "⏹ Window closed",
};

// --- Interserv: geographic & seasonal focus areas (build prompt 4D) ---
export const SEASONAL_FOCUS_AREAS = [
  { region: "Northeast", window: "Oct–Mar", note: "Winter storm freeze damage — interior plumbing, drywall, hospitality properties" },
  { region: "Gulf Coast / Southeast", window: "Jun–Nov", note: "Hurricane season — full hotel/resort renovation cycles" },
  { region: "West Coast", window: "Jul–Oct", note: "Wildfire displacement — church and apartment rehab" },
  { region: "Midwest", window: "Mar–Jun", note: "Tornado season — churches, multifamily" },
];

// --- Insurance Claims: claim type classification (build prompt 5B) ---
export const CLAIM_TYPES_BY_CATEGORY: Partial<Record<DisasterCategory, string[]>> = {
  hurricane: ["Structural damage", "Business interruption", "Wind vs. flood disputes", "Code upgrade claims"],
  flood: ["Structural damage", "Business interruption", "Code upgrade claims"],
  winter_storm: ["Freeze / pipe burst", "Structural damage"],
  wildfire: ["Structural damage", "Wildfire smoke damage", "Business interruption"],
  earthquake: ["Earthquake (negligence / code violations)", "Structural damage"],
  tornado: ["Structural damage", "Business interruption", "Code upgrade claims"],
  hail: ["Structural damage"],
  landslide: ["Structural damage", "Code upgrade claims"],
  extreme_heat: ["Business interruption"],
  man_made: ["Structural damage", "Business interruption"],
};

// --- Insurance Claims: state law favorability (build prompt 5C) ---
// Only the states the build prompt itself names as having "strong
// policyholder protection laws" / "active bad-faith insurance statutes" are
// flagged high — everything else defaults to medium rather than asserting
// an unfavorable rating we have no basis for.
const HIGH_FAVORABILITY_STATES = new Set(["FL", "LA", "TX"]);

export function stateLawFavorability(stateCode: string): "high" | "medium" {
  return HIGH_FAVORABILITY_STATES.has(stateCode) ? "high" : "medium";
}

// Rough, clearly-labeled estimate only — the build prompt itself frames
// these as "estimates, not guarantees" (CEO principle 4).
const ASSUMED_AVG_CLAIM_VALUE_USD = 75_000;

export function estimateClaimValuePoolUsd(claimsFiledEst: number | null): number | null {
  if (claimsFiledEst == null) return null;
  return claimsFiledEst * ASSUMED_AVG_CLAIM_VALUE_USD;
}
