// Curated, manually-verified reference info — NOT legal advice, NOT a live
// feed. Getting exact statutory percentages wrong for all 50 states from
// memory would be worse than not showing a number at all, so this only
// asserts a specific cap where it's extremely well-documented public
// record; everywhere else it states the general rule and points to a real
// place to verify current details, matching how state_regulatory_info is
// handled elsewhere in this project.

export interface PriceGougingInfo {
  hasGeneralLaw: boolean;
  capPercent: number | null; // null = no fixed statutory percentage, standard is "unconscionable/excessive"
  note: string;
}

// Every US state has SOME form of price-gouging/anti-profiteering statute
// that activates on a declared state/local emergency — the specifics
// (fixed % cap vs. an "unconscionable price" standard, duration, covered
// goods) vary and change with legislation. Only a handful set an explicit,
// well-known percentage cap; the rest use a general "excessive/unconscionable"
// standard determined case-by-case by that state's AG.
const KNOWN_FIXED_CAPS: Record<string, number> = {
  CA: 10, // Penal Code §396
  AL: 25, // Ala. Code §8-31-4
  NJ: 10, // N.J.S.A. 56:8-107 ("excessive price increase" safe-harbor guidance)
};

export function priceGougingInfoForState(stateCode: string): PriceGougingInfo {
  const capPercent = KNOWN_FIXED_CAPS[stateCode] ?? null;
  return {
    hasGeneralLaw: true,
    capPercent,
    note:
      capPercent != null
        ? `${stateCode} sets an explicit statutory cap of roughly ${capPercent}% over the pre-emergency price during a declared emergency.`
        : `${stateCode} prohibits "unconscionable" or "excessive" pricing during a declared emergency without a fixed statutory percentage — enforcement is case-by-case by the state Attorney General.`,
  };
}

export function priceGougingSearchLink(stateCode: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${stateCode} attorney general price gouging law site:.gov`)}`;
}

export interface ApprovedMaterialInfo {
  program: string;
  requirement: string;
  sourceLink: string;
}

// Only states/categories with a well-documented, stable mandated
// product-approval program are listed — everywhere else, show a generic
// "check local building department" note rather than guessing.
export const APPROVED_MATERIALS_BY_STATE_CATEGORY: Partial<Record<string, Partial<Record<string, ApprovedMaterialInfo>>>> = {
  FL: {
    hurricane: {
      program: "Florida Building Code — High-Velocity Hurricane Zone (Miami-Dade & Broward)",
      requirement:
        "Roofing (shingles, tile, metal) and windows/doors in HVHZ counties must carry a Miami-Dade County NOA (Notice of Acceptance) or statewide Florida Product Approval (FL#) rated for wind-borne debris; impact-rated glazing must meet TAS 201/202/203.",
      sourceLink: "https://www.floridabuilding.org/pr/pr_default.aspx",
    },
  },
  CA: {
    wildfire: {
      program: "California Building Code Chapter 7A (Wildland-Urban Interface)",
      requirement:
        "New construction/re-roofing in a designated WUI Fire Hazard Severity Zone requires Class A fire-rated roofing, ignition-resistant siding/decking, and dual-pane tempered-glass windows.",
      sourceLink: "https://www.osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/wildland-urban-interface-wui-building-standards",
    },
  },
};

export function approvedMaterialsFor(stateCode: string, category: string): ApprovedMaterialInfo | null {
  return APPROVED_MATERIALS_BY_STATE_CATEGORY[stateCode]?.[category] ?? null;
}
