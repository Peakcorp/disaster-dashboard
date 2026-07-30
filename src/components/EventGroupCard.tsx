"use client";

import { useState } from "react";
import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import type { EventGroup } from "@/lib/format";
import { groupLatestEvent } from "@/lib/format";
import { EventCard } from "./EventCard";

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
  const latest = groupLatestEvent(group);
  const older = group.events.filter((e) => e.id !== latest.id);

  // Single-event groups: skip the extra collapse/expand chrome, just show
  // the card directly — grouping only earns its keep when there's more than
  // one issuance to hide.
  if (older.length === 0) {
    return <EventCard event={latest} selected={latest.id === selectedId} onSelect={onSelect} />;
  }

  return (
    <div className="flex flex-col gap-1">
      <EventCard event={latest} selected={latest.id === selectedId} onSelect={onSelect} />
      <button
        onClick={() => setExpanded((e) => !e)}
        className="glass-card w-full rounded-lg px-3 py-1.5 text-left text-xs text-foreground-muted transition hover:text-foreground"
      >
        {CATEGORY_LABELS[group.category]} — {group.primaryState} · {expanded ? "hide" : "show"} {older.length}{" "}
        earlier update{older.length === 1 ? "" : "s"} {expanded ? "▲" : "▼"}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 pl-2">
          {older.map((event) => (
            <EventCard key={event.id} event={event} selected={event.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
