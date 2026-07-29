"use client";

import { useState } from "react";
import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { formatUsd } from "@/lib/format";

export function HistoricalEventCard({ event }: { event: DisasterEvent }) {
  const [expanded, setExpanded] = useState(false);
  const year = new Date(event.start_date).getUTCFullYear();

  return (
    <div className="glass-card rounded-lg p-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <p className="text-sm font-medium text-foreground">
            {event.name} <span className="text-foreground-muted">({year})</span>
          </p>
          <p className="text-xs text-foreground-muted">
            {CATEGORY_LABELS[event.category]} · {event.states_affected.join(", ") || "Multi-state"}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs">
          <p className="text-foreground">{formatUsd(event.estimated_damage_usd)}</p>
          {event.fatalities != null && (
            <p className="text-foreground-muted">{event.fatalities} fatalities</p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 border-t border-white/10 pt-3 text-sm">
          <p className="text-foreground-muted">
            {event.ai_summary ?? "AI narrative not yet generated — run enrich-historical-events."}
          </p>

          {event.price_behavior_notes && (
            <p className="mt-2 text-xs text-foreground-muted">
              <span className="text-ai">Price behavior:</span> {event.price_behavior_notes}
            </p>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded bg-white/5 p-2">
              <p className="text-foreground-muted">SupplyX</p>
              <p className="text-opportunity">{event.supplyx_score ?? "—"}</p>
            </div>
            <div className="rounded bg-white/5 p-2">
              <p className="text-foreground-muted">Interserv</p>
              <p className="text-opportunity">{event.interserv_score ?? "—"}</p>
            </div>
            <div className="rounded bg-white/5 p-2">
              <p className="text-foreground-muted">Insurance</p>
              <p className="text-opportunity">{event.insurance_claims_score ?? "—"}</p>
            </div>
          </div>

          {event.notable_recovery_companies && (
            <p className="mt-2 text-xs text-foreground-muted">
              <span className="text-foreground">Notable recovery companies:</span>{" "}
              {event.notable_recovery_companies}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
