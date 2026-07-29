"use client";

import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { formatRelativeTime, formatUsd } from "@/lib/format";

const STATUS_STYLES: Record<DisasterEvent["status"], string> = {
  critical: "bg-critical/20 text-critical border-critical/40",
  developing: "bg-warning/20 text-warning border-warning/40",
  monitoring: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  resolved: "bg-gray-500/20 text-gray-400 border-gray-500/40",
};

const CONFIDENCE_STYLES: Record<DisasterEvent["confidence_score"], string> = {
  HIGH: "text-opportunity",
  MEDIUM: "text-warning",
  LOW: "text-foreground-muted",
};

export function EventCard({
  event,
  selected,
  onSelect,
}: {
  event: DisasterEvent;
  selected: boolean;
  onSelect: (event: DisasterEvent) => void;
}) {
  return (
    <button
      onClick={() => onSelect(event)}
      className={`glass-card w-full rounded-lg p-3 text-left transition hover:border-live/50 ${
        selected ? "border-live/60 ring-1 ring-live/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{event.name}</p>
          <p className="text-xs text-foreground-muted">
            {CATEGORY_LABELS[event.category]} · {event.states_affected.join(", ") || "Unknown"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLES[event.status]}`}
        >
          {event.status}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
        <span>Damage: {formatUsd(event.estimated_damage_usd)}</span>
        <span className={CONFIDENCE_STYLES[event.confidence_score]}>
          {event.confidence_score} confidence
        </span>
        {event.is_updated_since_last_refresh && (
          <span className="animate-pulse rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning">
            UPDATED
          </span>
        )}
        <span className="ml-auto">{formatRelativeTime(event.last_fetched_at)}</span>
      </div>
    </button>
  );
}
