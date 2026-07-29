"use client";

import type { ReferralPartner } from "@/types/company";

export function ReferralPartnersPanel({
  partners,
  statesInScope,
}: {
  partners: ReferralPartner[];
  statesInScope: string[];
}) {
  const relevant =
    statesInScope.length === 0
      ? partners
      : partners.filter((p) => p.states.some((s) => statesInScope.includes(s)));

  if (relevant.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        No referral partners on file for the current active states. This database is manual-entry only
        (Supabase Table Editor → <code className="text-live">referral_partners</code>) — deliberately not
        AI-generated, since naming specific real law firms as facts carries real risk if wrong.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {relevant.slice(0, 5).map((partner) => (
        <li key={partner.id} className="glass-card rounded-md p-3 text-sm">
          <p className="text-foreground">{partner.firm_name}</p>
          <p className="text-xs text-foreground-muted">
            {partner.states.join(", ")}
            {partner.specialties.length > 0 ? ` · ${partner.specialties.join(", ")}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
