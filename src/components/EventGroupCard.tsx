"use client";

import { useState } from "react";
import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import type { EventGroup } from "@/lib/format";
import { formatRelativeTime, groupLatestUpdate, groupHasUpdate, groupMaxStatus } from "@/lib/format";
import { EventCard } from "./EventCard";

const STATUS_STYLES: Record<DisasterEvent["status"], string> = {
  critical: "bg-critical/20 text-critical border-critical/40",
  developing: "bg-warning/20 text-warning border-warning/40",
  monitoring: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  resolved: "bg-gray-500/20 text-gray-400 border-gray-500/40",
};

export function EventGroupCard({
  group,
  selectedId,
  onSelect,
}: {
  group: EventGroup;
  selectedId: string | null;
  onSelect: (event: DisasterEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = groupMaxStatus(group);
  const latestUpdate = groupLatestUpdate(group);
  const hasUpdate = groupHasUpdate(group);
  const count = group.events.length;

  // Single-event groups: skip the extra collapse/expand chrome, just show
  // the card directly — grouping only earns its keep when there's more than
  // one issuance to hide.
  if (count === 1) {
    return <EventCard event={group.events[0]} selected={group.events[0].id === selectedId} onSelect={onSelect} />;
  }

  return (
    <div className="glass-card w-full rounded-lg">
      <button onClick={() => setExpanded((e) => !e)} className="w-full p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">
              {group.subType ?? CATEGORY_LABELS[group.category]}{" "}
              <span className="text-foreground-muted">— {group.primaryState}</span>
            </p>
            <p className="text-xs text-foreground-muted">
              {CATEGORY_LABELS[group.category]} · {count} active alerts {expanded ? "▲" : "▼"}
            </p>
          </div>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLES[status]}`}
          >
            {status}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-x-3 text-xs text-foreground-muted">
          {hasUpdate && (
            <span className="animate-pulse rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              UPDATED
            </span>
          )}
          <span className="ml-auto">Latest: {formatRelativeTime(latestUpdate)}</span>
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-white/10 p-2">
          {group.events.map((event) => (
            <EventCard key={event.id} event={event} selected={event.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
