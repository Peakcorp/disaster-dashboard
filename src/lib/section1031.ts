import type { DisasterEvent } from "@/types/event";

// IRC §7508A + Rev. Proc. 2018-58: the IRS automatically grants deadline
// relief to taxpayers in any federally-declared (FEMA major disaster)
// area — this systematically includes postponing 1031 like-kind exchange
// identification (45-day) and completion (180-day) deadlines. It applies
// to essentially every FEMA major disaster declaration, not selectively;
// the exact postponed date varies per declaration and is published by the
// IRS as it happens, so this identifies WHICH of our tracked events likely
// qualify and gives real links to verify current details — it does not
// assert a specific extended date, since that would require per-declaration
// research this project has no live feed for.
const FEMA_SOURCES = new Set(["fema", "fema_declarations_2025"]);

export function isFemaSourced(event: DisasterEvent): boolean {
  return FEMA_SOURCES.has(event.external_source);
}

export function femaDeclarationNumber(event: DisasterEvent): string | null {
  if (!isFemaSourced(event)) return null;
  return event.external_id.replace(/^fema-/, "");
}

export function femaDeclarationLink(event: DisasterEvent): string | null {
  const number = femaDeclarationNumber(event);
  return number ? `https://www.fema.gov/disaster/${number}` : null;
}

export const IRS_DISASTER_RELIEF_HUB = "https://www.irs.gov/newsroom/tax-relief-in-disaster-situations";

export function irsReliefSearchLink(event: DisasterEvent): string {
  const state = event.states_affected[0] ?? "";
  return `https://www.google.com/search?q=${encodeURIComponent(`IRS disaster tax relief ${state} ${event.name} 1031 exchange site:irs.gov`)}`;
}
