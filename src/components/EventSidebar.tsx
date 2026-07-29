"use client";

import type { DisasterEvent } from "@/types/event";
import { sortBySeverity } from "@/lib/format";
import { EventCard } from "./EventCard";

export function EventSidebar({
  events,
  selectedId,
  onSelect,
}: {
  events: DisasterEvent[];
  selectedId: string | null;
  onSelect: (event: DisasterEvent) => void;
}) {
  const sorted = sortBySeverity(events);

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      <p className="px-1 text-xs uppercase tracking-wide text-foreground-muted">
        {sorted.length} active event{sorted.length === 1 ? "" : "s"}
      </p>
      {sorted.length === 0 && (
        <p className="px-1 text-sm text-foreground-muted">
          No events yet — waiting for the first refresh cycle.
        </p>
      )}
      {sorted.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          selected={event.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
