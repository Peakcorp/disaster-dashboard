"use client";

import type { DisasterEvent } from "@/types/event";
import { groupEvents, sortGroupsBySeverity } from "@/lib/format";
import { EventGroupCard } from "./EventGroupCard";

export function EventSidebar({
  events,
  selectedId,
  onSelect,
}: {
  events: DisasterEvent[];
  selectedId: string | null;
  onSelect: (event: DisasterEvent) => void;
}) {
  const groups = sortGroupsBySeverity(groupEvents(events));

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      <p className="px-1 text-xs uppercase tracking-wide text-foreground-muted">
        {events.length} active event{events.length === 1 ? "" : "s"}
        {groups.length !== events.length ? ` · grouped into ${groups.length}` : ""}
      </p>
      {groups.length === 0 && (
        <p className="px-1 text-sm text-foreground-muted">
          No events yet — waiting for the first refresh cycle.
        </p>
      )}
      {groups.map((group) => (
        <EventGroupCard key={group.key} group={group} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}
