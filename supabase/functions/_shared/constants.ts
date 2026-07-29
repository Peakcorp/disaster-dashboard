// Shared across edge functions. Deno-only module (uses no Node/browser APIs).

export const DISASTER_KEYWORDS = [
  "hurricane",
  "tropical storm",
  "tornado",
  "wildfire",
  "fire",
  "flood",
  "earthquake",
  "storm",
  "blizzard",
  "freeze",
  "ice storm",
  "disaster",
  "damage",
  "emergency",
  "FEMA",
  "evacuation",
  "landslide",
  "drought",
  "hail",
  "derecho",
];

export function matchesDisasterKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return DISASTER_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

// FEMA's API reports states as 2-letter postal codes; RSS headlines use full
// names, so matching an article to an event needs this lookup.
export const STATE_CODE_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming", DC: "District of Columbia", PR: "Puerto Rico",
};

// Static destroyed/consumed material mapping from the build prompt (section
// 3A) — deterministic, not AI-generated. "consumed" here uses the broadest
// (5-10mi) tier, since historical archive rows don't have a real impact
// radius to band by; see seed-historical-events for how it's applied.
export const MATERIALS_BY_DISASTER_TYPE: Record<
  string,
  { destroyed: string[]; consumed: string[] }
> = {
  hurricane: {
    destroyed: [
      "Roofing shingles", "Roof tiles", "Hurricane straps", "Reinforcement tape/cable",
      "Impact windows", "Doors", "Siding", "Gutters", "Fascia", "Wood framing (structural)",
    ],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
  flood: {
    destroyed: [
      "Drywall", "Insulation", "Flooring (tile, hardwood, LVP)", "Cabinets", "Baseboards",
      "Subfloor", "Moisture barriers", "Water heaters", "HVAC units", "Electrical panels",
    ],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
  wildfire: {
    destroyed: [
      "Framing lumber", "Sheathing", "Roofing", "Windows", "Doors", "All interior finishes",
    ],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
  winter_storm: {
    destroyed: [
      "Copper pipe", "PEX tubing", "Fittings", "Pipe insulation", "Drywall (burst-pipe damage)",
      "Water heaters", "Boilers", "Plumbing fixtures",
    ],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
  earthquake: {
    destroyed: ["Structural reinforcement", "Drywall", "Tile", "Glazing/windows", "Foundation materials"],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
  hail: {
    destroyed: ["Roofing shingles", "Metal roofing panels", "HVAC condenser coils", "Skylights", "Gutters"],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
  tornado: {
    destroyed: ["Roofing", "Framing lumber", "Windows", "Doors", "Siding", "Structural reinforcement"],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
  landslide: {
    destroyed: ["Foundation materials", "Structural reinforcement", "Drainage materials"],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
  extreme_heat: {
    destroyed: ["HVAC units", "Electrical panels"],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
  man_made: {
    destroyed: ["Structural reinforcement", "Drywall", "Electrical panels", "HVAC units"],
    consumed: ["Cabinets", "Countertops", "Fixtures", "Flooring", "Paint"],
  },
};

export const CATEGORY_MATCH_TERMS: Record<string, string[]> = {
  hurricane: ["hurricane", "tropical storm"],
  tornado: ["tornado"],
  wildfire: ["wildfire", "fire"],
  flood: ["flood"],
  winter_storm: ["winter storm", "blizzard", "ice storm", "freeze"],
  earthquake: ["earthquake"],
  landslide: ["landslide", "mudslide"],
  hail: ["hail"],
  extreme_heat: ["heat wave", "drought"],
  man_made: ["explosion", "chemical spill", "dam"],
};
