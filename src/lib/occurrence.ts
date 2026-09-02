import type { DisasterEvent } from "@/types/event";

// NWS issues distinct alert products for "conditions favorable, hasn't
// happened yet" (Watch) vs "happening now or about to" (Warning/Advisory).
// sub_type carries that exact NWS product name (e.g. "Flood Watch" vs
// "Flash Flood Warning") for live NWS-sourced events. FEMA declarations and
// the historical/seed archive are always confirmed, already-occurred
// disasters (FEMA doesn't declare for a storm that hasn't hit yet), so they
// default to "occurring" regardless of text.
export type OccurrenceStatus = "occurring" | "watch";

const WATCH_PATTERN = /\bwatch\b/i;
const CONFIRMED_PATTERN = /\b(warning|advisory|emergency|statement)\b/i;

export function occurrenceStatusFor(event: DisasterEvent): OccurrenceStatus {
  const text = event.sub_type ?? event.name;
  if (WATCH_PATTERN.test(text) && !CONFIRMED_PATTERN.test(text)) return "watch";
  return "occurring";
}

export const OCCURRENCE_LABEL: Record<OccurrenceStatus, string> = {
  occurring: "Occurring",
  watch: "Watch — Not Yet Occurred",
};

export const OCCURRENCE_STYLES: Record<OccurrenceStatus, string> = {
  occurring: "bg-critical/15 text-critical border-critical/30",
  watch: "bg-warning/15 text-warning border-warning/30",
};
