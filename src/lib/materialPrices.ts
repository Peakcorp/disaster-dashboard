// Approximate current (2026) US retail/wholesale market prices for the
// materials tracked in supabase/functions/_shared/constants.ts
// (MATERIALS_BY_DISASTER_TYPE). There is no free API that returns per-unit
// retail prices for named construction materials — FRED/BLS only publish
// producer price INDEXES (base-year=100 series), not dollar figures — so
// this is a manually curated reference table, not a live feed. It exists
// purely so the SupplyX team has a ballpark US price to compare against an
// overseas sourcing quote; always verify against a current supplier quote
// before using a figure here in an actual pricing decision.
export interface MaterialPriceRef {
  price: number;
  unit: string;
}

export const MATERIAL_PRICE_REFERENCE: Record<string, MaterialPriceRef> = {
  "Roofing shingles": { price: 130, unit: "per square (100 sq ft)" },
  "Roof tiles": { price: 450, unit: "per square (100 sq ft)" },
  "Metal roofing panels": { price: 350, unit: "per square (100 sq ft)" },
  "Roofing": { price: 130, unit: "per square (100 sq ft)" },
  "Hurricane straps": { price: 3.5, unit: "per strap" },
  "Reinforcement tape/cable": { price: 1.25, unit: "per linear ft" },
  "Impact windows": { price: 850, unit: "per window (avg size)" },
  "Windows": { price: 450, unit: "per window (avg size)" },
  "Glazing/windows": { price: 450, unit: "per window (avg size)" },
  "Skylights": { price: 600, unit: "per unit" },
  "Doors": { price: 350, unit: "per door" },
  "Siding": { price: 10, unit: "per sq ft (vinyl/fiber cement)" },
  "Gutters": { price: 8, unit: "per linear ft" },
  "Fascia": { price: 6, unit: "per linear ft" },
  "Wood framing (structural)": { price: 900, unit: "per 1,000 board ft" },
  "Framing lumber": { price: 900, unit: "per 1,000 board ft" },
  "Sheathing": { price: 45, unit: "per 4x8 sheet (OSB)" },
  "Drywall": { price: 15, unit: "per 4x8 sheet" },
  "Drywall (burst-pipe damage)": { price: 15, unit: "per 4x8 sheet" },
  "Insulation": { price: 1.3, unit: "per sq ft (batt)" },
  "Flooring (tile, hardwood, LVP)": { price: 4, unit: "per sq ft (LVP avg)" },
  "Flooring": { price: 4, unit: "per sq ft (LVP avg)" },
  "Subfloor": { price: 40, unit: "per 4x8 sheet" },
  "Baseboards": { price: 1.8, unit: "per linear ft" },
  "Moisture barriers": { price: 0.25, unit: "per sq ft" },
  "Water heaters": { price: 1200, unit: "per unit (50-gal)" },
  "HVAC units": { price: 6500, unit: "per unit (3-ton split system)" },
  "HVAC condenser coils": { price: 1200, unit: "per unit" },
  "Electrical panels": { price: 350, unit: "per panel (200A)" },
  "All interior finishes": { price: 8, unit: "per sq ft (blended avg)" },
  "Copper pipe": { price: 6.5, unit: "per linear ft (3/4in)" },
  "PEX tubing": { price: 0.9, unit: "per linear ft (3/4in)" },
  "Fittings": { price: 3, unit: "per fitting (avg)" },
  "Pipe insulation": { price: 1.5, unit: "per linear ft" },
  "Boilers": { price: 5500, unit: "per unit (residential)" },
  "Plumbing fixtures": { price: 250, unit: "per fixture (avg)" },
  "Structural reinforcement": { price: 12, unit: "per sq ft (rebar/bracing avg)" },
  "Foundation materials": { price: 150, unit: "per cubic yard (concrete)" },
  "Tile": { price: 5, unit: "per sq ft" },
  "Drainage materials": { price: 30, unit: "per linear ft (French drain avg)" },
  "Cabinets": { price: 200, unit: "per linear ft (stock cabinetry)" },
  "Countertops": { price: 55, unit: "per sq ft (laminate-to-quartz avg)" },
  "Fixtures": { price: 200, unit: "per fixture (avg)" },
  "Paint": { price: 45, unit: "per gallon" },
};

export function getMaterialPrice(materialName: string): MaterialPriceRef | null {
  return MATERIAL_PRICE_REFERENCE[materialName] ?? null;
}

export function formatMaterialPrice(ref: MaterialPriceRef | null): string {
  if (!ref) return "Price reference not available";
  return `$${ref.price.toLocaleString()} ${ref.unit}`;
}
