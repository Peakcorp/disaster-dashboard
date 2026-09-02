import type { EventMaterial } from "@/types/event";

// Materials with well-documented historical shortage precedent after major
// disasters — lumber/OSB after the 2017 hurricane season and the 2020-21
// pandemic-era shortage, roofing shingle backlogs after any major
// hail/hurricane season, impact windows' chronically long lead times,
// generators and tarps after any widespread power/roof-damage event, copper
// pipe after winter-storm freeze events (e.g. Texas Feb 2021). This is
// public record, not a guess, and is only one input into the score below —
// not a claim that any specific item WILL run short.
const HISTORICALLY_SHORTAGE_PRONE = new Set([
  "Framing lumber", "Wood framing (structural)", "Sheathing", "Drywall",
  "Drywall (burst-pipe damage)", "Roofing shingles", "Metal roofing panels",
  "Roofing", "Roof tiles", "Impact windows", "Copper pipe", "HVAC units",
  "HVAC condenser coils", "Water heaters", "Tarps",
]);

export interface ShortageRiskEntry {
  materialName: string;
  // How many currently-active events nationwide (any category, any state)
  // need this same material right now — real concentration of demand
  // computed from this project's own live data, not an estimate.
  concurrentDemandCount: number;
  historicallyShortageProne: boolean;
  riskScore: number;
}

// materials should be the FULL national active-event material set (not
// filtered by category/state) so demand concentration reflects reality —
// a shortage is a supply-chain phenomenon, not scoped to whatever the user
// happens to be filtering the UI to right now.
export function computeShortageRiskMap(materials: EventMaterial[]): Map<string, ShortageRiskEntry> {
  const eventIdsByMaterial = new Map<string, Set<string>>();
  for (const m of materials) {
    const set = eventIdsByMaterial.get(m.material_name) ?? new Set<string>();
    set.add(m.event_id);
    eventIdsByMaterial.set(m.material_name, set);
  }

  const result = new Map<string, ShortageRiskEntry>();
  for (const [materialName, eventIds] of eventIdsByMaterial) {
    const concurrentDemandCount = eventIds.size;
    const historicallyShortageProne = HISTORICALLY_SHORTAGE_PRONE.has(materialName);
    // Historically-prone items always rank above non-prone ones — a
    // multiplicative weighting let generic items shared across nearly every
    // disaster type (Cabinets, Flooring, Paint — in almost every category's
    // "consumed" list) dominate purely on raw count, drowning out the
    // actually-scarce, category-specific materials (lumber, roofing, impact
    // windows) this signal exists to surface. Concurrent demand only breaks
    // ties within each group.
    const riskScore = (historicallyShortageProne ? 1_000_000 : 0) + concurrentDemandCount;
    result.set(materialName, { materialName, concurrentDemandCount, historicallyShortageProne, riskScore });
  }
  return result;
}

export function topShortageRiskMaterials(
  materialNames: string[],
  riskMap: Map<string, ShortageRiskEntry>,
  topN = 4
): ShortageRiskEntry[] {
  return materialNames
    .map((name) => riskMap.get(name))
    .filter((e): e is ShortageRiskEntry => e != null)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, topN);
}
