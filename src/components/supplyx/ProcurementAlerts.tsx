"use client";

import { useState } from "react";
import type { DisasterEvent, EventMaterial } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";

// Categories where pre-purchasing materials ahead of confirmed impact is
// historically worthwhile per the build prompt's material tables (roofing,
// framing, plumbing all see post-event demand spikes).
const STOCKPILE_WORTHY = new Set([
  "hurricane", "winter_storm", "wildfire", "tornado", "hail", "flood",
]);

interface Alert {
  event: DisasterEvent;
  recommendation: "PRE-PURCHASE" | "MONITOR";
  reasoning: string;
}

function buildAlert(event: DisasterEvent): Alert | null {
  if (event.status !== "developing" && event.status !== "monitoring") return null;
  if (!STOCKPILE_WORTHY.has(event.category)) return null;

  const isDeveloping = event.status === "developing";
  return {
    event,
    recommendation: isDeveloping ? "PRE-PURCHASE" : "MONITOR",
    reasoning: isDeveloping
      ? `${CATEGORY_LABELS[event.category]} events historically drive a material demand spike 2–8 weeks ` +
        `after peak impact — this event is still developing, so the pre-purchase window is open now.`
      : `Early signal only — below the action threshold for now. Revisit if this event is upgraded to ` +
        `"developing."`,
  };
}

export function ProcurementAlerts({
  events,
  materials,
}: {
  events: DisasterEvent[];
  materials: EventMaterial[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const alerts = events.map(buildAlert).filter((a): a is Alert => a !== null);

  if (alerts.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        No urgent pre-purchase actions right now — check back next refresh cycle.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {alerts.map(({ event, recommendation, reasoning }) => {
        const expanded = expandedId === event.id;
        const destroyed = materials.filter((m) => m.event_id === event.id && m.category === "destroyed");
        return (
          <li key={event.id} className="glass-card rounded-md p-3 text-sm">
            <button
              onClick={() => setExpandedId(expanded ? null : event.id)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-foreground">{event.name}</span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                  recommendation === "PRE-PURCHASE"
                    ? "bg-opportunity/20 text-opportunity"
                    : "bg-white/5 text-foreground-muted"
                }`}
              >
                {recommendation}
              </span>
            </button>
            <p className="mt-1 text-xs text-foreground-muted">{reasoning}</p>

            {expanded && (
              <div className="mt-2 border-t border-white/10 pt-2 text-xs text-foreground-muted">
                <p className="mb-1 text-critical">Materials likely to see demand:</p>
                {destroyed.length > 0 ? (
                  <ul className="flex flex-wrap gap-1">
                    {destroyed.map((m) => (
                      <li key={m.id} className="rounded bg-critical/10 px-2 py-0.5 text-foreground">
                        {m.material_name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No material classification yet for this event.</p>
                )}
                <p className="mt-2">SupplyX opportunity score: {event.supplyx_score ?? "pending AI analysis"}</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
