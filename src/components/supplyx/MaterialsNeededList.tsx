"use client";

import { useMemo, useState } from "react";
import type { DisasterEvent, DisasterCategory, EventMaterial } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { computeShortageRiskMap, topShortageRiskMaterials } from "@/lib/shortageRisk";

type SortOption = "event_count" | "category_az" | "item_count";
const SORT_LABELS: Record<SortOption, string> = {
  event_count: "Most Active Events",
  item_count: "Most Materials Listed",
  category_az: "Category: A to Z",
};

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

  return Array.from(groups.values());
}

function sortGroups(groups: CategoryGroup[], sortBy: SortOption): CategoryGroup[] {
  const sorted = [...groups];
  switch (sortBy) {
    case "event_count":
      return sorted.sort((a, b) => b.eventCount - a.eventCount);
    case "item_count":
      return sorted.sort(
        (a, b) => b.destroyed.length + b.consumed.length - (a.destroyed.length + a.consumed.length)
      );
    case "category_az":
      return sorted.sort((a, b) => CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]));
  }
}

export function MaterialsNeededList({
  events,
  materials,
}: {
  events: DisasterEvent[];
  // The caller passes the full, unfiltered national active-event material
  // set here (not narrowed by whatever category/state the user filtered
  // the page to) — a shortage is a supply-chain phenomenon, so the risk
  // scoring below deliberately looks at all of it regardless of `events`.
  materials: EventMaterial[];
}) {
  const [expanded, setExpanded] = useState<DisasterCategory | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("event_count");
  const groups = useMemo(() => sortGroups(buildGroups(events, materials), sortBy), [events, materials, sortBy]);
  const shortageRiskMap = useMemo(() => computeShortageRiskMap(materials), [materials]);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        No active events right now — check back next refresh cycle.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortOption)}
        className="glass-card self-start rounded-md px-2 py-1 text-xs text-foreground"
      >
        {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
          <option key={option} value={option}>
            Sort: {SORT_LABELS[option]}
          </option>
        ))}
      </select>
      <ul className="flex flex-col gap-2">
      {groups.map((group) => {
        const isOpen = expanded === group.category;
        const stateSummary =
          group.states.length > 4
            ? `${group.states.slice(0, 4).join(", ")} +${group.states.length - 4} more`
            : group.states.join(", ") || "Multi-state";
        const allItems = [...group.destroyed, ...group.consumed];
        const shortageItems = topShortageRiskMaterials(allItems, shortageRiskMap, 4);
        const shortageNames = new Set(shortageItems.map((s) => s.materialName));

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
              <div className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-2 text-xs">
                {shortageItems.length > 0 && (
                  <div>
                    <p className="mb-1 text-warning">
                      ⚠ Shortage risk — high concurrent nationwide demand{" "}
                      {shortageItems.some((s) => s.historicallyShortageProne) && "+ historical shortage precedent"}:
                    </p>
                    <ul className="flex flex-wrap gap-1">
                      {shortageItems.map((s) => (
                        <li
                          key={s.materialName}
                          title={`Needed by ${s.concurrentDemandCount} active event(s) nationwide right now${s.historicallyShortageProne ? " — historically shortage-prone item" : ""}`}
                          className="rounded bg-warning/15 px-2 py-0.5 text-foreground"
                        >
                          {s.materialName}
                          {s.historicallyShortageProne && " ★"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="mb-1 text-foreground-muted">
                    General materials affected/likely affected (full list):
                  </p>
                  {group.destroyed.length > 0 && (
                    <div className="mb-1.5">
                      <p className="mb-1 text-critical">Destroyed — likely to sell immediately post-impact:</p>
                      <ul className="flex flex-wrap gap-1">
                        {group.destroyed.map((name) => (
                          <li
                            key={name}
                            className={`rounded px-2 py-0.5 text-foreground ${shortageNames.has(name) ? "bg-warning/10" : "bg-critical/10"}`}
                          >
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
                          <li
                            key={name}
                            className={`rounded px-2 py-0.5 text-foreground ${shortageNames.has(name) ? "bg-warning/10" : "bg-ai/10"}`}
                          >
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
              </div>
            )}
          </li>
        );
      })}
      </ul>
      <p className="text-[10px] text-foreground-muted">
        ★ Shortage risk combines how many active events nationwide need the same material right now with a
        curated list of materials with documented historical shortage precedent (lumber, drywall, roofing,
        impact windows, generators/tarps, copper pipe) — a signal to watch, not a guarantee.
      </p>
    </div>
  );
}
