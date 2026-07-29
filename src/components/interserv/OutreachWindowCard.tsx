"use client";

import { useState } from "react";
import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { outreachStatusFor, outreachTimingFor, OUTREACH_STATUS_LABEL, daysSince } from "@/lib/company";
import { formatUsd } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  too_early: "bg-white/5 text-foreground-muted",
  now: "bg-opportunity/20 text-opportunity",
  closing: "bg-warning/20 text-warning",
  too_late: "bg-white/5 text-foreground-muted",
};

export function OutreachWindowCard({ event }: { event: DisasterEvent }) {
  const [expanded, setExpanded] = useState(false);
  const status = outreachStatusFor(event);
  const timing = outreachTimingFor(event.category);
  const daysSinceStart = daysSince(event.start_date);

  return (
    <button onClick={() => setExpanded((e) => !e)} className="glass-card w-full rounded-md p-3 text-left text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-foreground">{event.name}</p>
          <p className="text-xs text-foreground-muted">
            {CATEGORY_LABELS[event.category]} · {daysSinceStart}d since start · Est. damage:{" "}
            {formatUsd(event.estimated_damage_usd)}
          </p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
          {OUTREACH_STATUS_LABEL[status]}
        </span>
      </div>
      <p className="mt-1 text-xs text-foreground-muted">
        Typical outreach window for this disaster type: {timing.minMonths}–{timing.maxMonths} months
        post-event{timing.isGeneric ? " (generic estimate — no build-prompt-specified window for this category)" : ""}.
      </p>

      {expanded && (
        <div className="mt-3 border-t border-white/10 pt-2 text-xs text-foreground-muted">
          <p className="mb-1 text-ai">AI briefing</p>
          <p>{event.ai_summary ?? "AI analysis not yet generated for this event."}</p>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <p>Confidence: {event.confidence_score}</p>
            <p>Federal support: {event.govt_support_level ?? "—"}</p>
            <p>Interserv score: {event.interserv_score ?? "—"}/100</p>
            <p>States: {event.states_affected.join(", ") || "—"}</p>
          </div>
        </div>
      )}
    </button>
  );
}
