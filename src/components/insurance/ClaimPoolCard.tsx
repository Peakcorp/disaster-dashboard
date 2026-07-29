"use client";

import { useState } from "react";
import type { DisasterEvent } from "@/types/event";
import { formatUsd, formatRelativeTime } from "@/lib/format";
import { CLAIM_TYPES_BY_CATEGORY, stateLawFavorability, estimateClaimValuePoolUsd } from "@/lib/company";

const FAVORABILITY_LABEL: Record<"high" | "medium", string> = {
  high: "Strong policyholder protection laws",
  medium: "Standard policyholder protections",
};

export function ClaimPoolCard({ event }: { event: DisasterEvent }) {
  const [expanded, setExpanded] = useState(false);
  const claimTypes = CLAIM_TYPES_BY_CATEGORY[event.category] ?? ["Structural damage"];
  const primaryState = event.states_affected[0];
  const favorability = primaryState ? stateLawFavorability(primaryState) : null;
  const valuePoolUsd = estimateClaimValuePoolUsd(event.insurance_claims_filed_est);

  return (
    <button onClick={() => setExpanded((e) => !e)} className="glass-card w-full rounded-md p-3 text-left text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-foreground">{event.name}</p>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-foreground-muted">
          {event.confidence_score} confidence
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-foreground-muted">Est. claims filed</p>
          <p className="text-foreground">{event.insurance_claims_filed_est ?? "Pending AI analysis"}</p>
        </div>
        <div>
          <p className="text-foreground-muted">Est. referral fee pool</p>
          <p className="text-foreground">
            {valuePoolUsd != null ? formatUsd(valuePoolUsd) : "—"}
            <span className="ml-1 text-foreground-muted">(rough estimate)</span>
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs text-foreground-muted">
        Claim types: <span className="text-foreground">{claimTypes.join(", ")}</span>
      </p>
      {favorability && (
        <p className="mt-1 text-xs text-foreground-muted">
          {primaryState}: {FAVORABILITY_LABEL[favorability]}
        </p>
      )}

      {expanded && (
        <div className="mt-3 border-t border-white/10 pt-2 text-xs text-foreground-muted">
          <p className="mb-1 text-ai">AI briefing</p>
          <p>{event.ai_summary ?? "AI analysis not yet generated for this event."}</p>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <p>FEMA region: {event.fema_region ?? "—"}</p>
            <p>Federal support: {event.govt_support_level ?? "—"}</p>
            <p>States affected: {event.states_affected.join(", ") || "—"}</p>
            <p>Last updated: {formatRelativeTime(event.last_fetched_at)}</p>
          </div>
        </div>
      )}
    </button>
  );
}
