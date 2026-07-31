"use client";

import { useState } from "react";
import type { DisasterEvent, DisasterCategory, EventMaterial } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";

interface CategoryGroup {
  category: DisasterCategory;
  eventCount: number;
  states: string[];
  destroyed: string[];
  consumed: string[];
}

function buildGroups(events: DisasterEvent[], materials: EventMaterial[]): CategoryGroup[] {
  const groups = new Map<DisasterCategory, CategoryGroup>();

  for (const event of events) {
    const existing = groups.get(event.category);
    const group: CategoryGroup =
      existing ?? { category: event.category, eventCount: 0, states: [], destroyed: [], consumed: [] };
    group.eventCount += 1;
    group.states.push(...event.states_affected);
    groups.set(event.category, group);
  }

  for (const material of materials) {
    const group = groups.get(material.disaster_type);
    if (!group) continue;
    const bucket = material.category === "destroyed" ? group.destroyed : group.consumed;
    if (!bucket.includes(material.material_name)) bucket.push(material.material_name);
  }

  for (const group of groups.values()) {
    group.states = Array.from(new Set(group.states)).sort();
  }

  return Array.from(groups.values()).sort((a, b) => b.eventCount - a.eventCount);
}

export function MaterialsNeededList({
  events,
  materials,
}: {
  events: DisasterEvent[];
  materials: EventMaterial[];
}) {
  const [expanded, setExpanded] = useState<DisasterCategory | null>(null);
  const groups = buildGroups(events, materials);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        No active events right now — check back next refresh cycle.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => {
        const isOpen = expanded === group.category;
        const stateSummary =
          group.states.length > 4
            ? `${group.states.slice(0, 4).join(", ")} +${group.states.length - 4} more`
            : group.states.join(", ") || "Multi-state";

        return (
          <li key={group.category} className="glass-card rounded-md p-3 text-sm">
            <button
              onClick={() => setExpanded(isOpen ? null : group.category)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <div>
                <p className="text-foreground">{CATEGORY_LABELS[group.category]}</p>
                <p className="text-xs text-foreground-muted">
                  {group.eventCount} active event{group.eventCount === 1 ? "" : "s"} · {stateSummary}
                </p>
              </div>
              <span className="shrink-0 rounded bg-opportunity/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-opportunity">
                {group.destroyed.length + group.consumed.length} items {isOpen ? "▲" : "▼"}
              </span>
            </button>

            {isOpen && (
              <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2 text-xs">
                {group.destroyed.length > 0 && (
                  <div>
                    <p className="mb-1 text-critical">Destroyed — likely to sell immediately post-impact:</p>
                    <ul className="flex flex-wrap gap-1">
                      {group.destroyed.map((name) => (
                        <li key={name} className="rounded bg-critical/10 px-2 py-0.5 text-foreground">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {group.consumed.length > 0 && (
                  <div>
                    <p className="mb-1 text-ai">Consumed — post-recovery demand (3-12 months out):</p>
                    <ul className="flex flex-wrap gap-1">
                      {group.consumed.map((name) => (
                        <li key={name} className="rounded bg-ai/10 px-2 py-0.5 text-foreground">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {group.destroyed.length === 0 && group.consumed.length === 0 && (
                  <p className="text-foreground-muted">No material classification yet for this category.</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
