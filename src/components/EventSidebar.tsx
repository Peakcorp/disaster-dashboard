"use client";

import { useMemo, useState } from "react";
import type { DisasterEvent, DisasterCategory } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import {
  groupEvents,
  sortGroupsBySeverity,
  groupLatestUpdate,
  type EventGroup,
} from "@/lib/format";
import { EventGroupCard } from "./EventGroupCard";

type SortOption = "severity" | "recent" | "state_az" | "category_az";

const SORT_LABELS: Record<SortOption, string> = {
  severity: "Severity",
  recent: "Most Recent Update",
  state_az: "State: A to Z",
  category_az: "Category: A to Z",
};

function sortGroups(groups: EventGroup[], sortBy: SortOption): EventGroup[] {
  switch (sortBy) {
    case "severity":
      return sortGroupsBySeverity(groups);
    case "recent":
      return [...groups].sort((a, b) => (groupLatestUpdate(b) ?? "").localeCompare(groupLatestUpdate(a) ?? ""));
    case "state_az":
      return [...groups].sort((a, b) => a.primaryState.localeCompare(b.primaryState));
    case "category_az":
      return [...groups].sort((a, b) => CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]));
  }
}

export function EventSidebar({
  events,
  selectedId,
  onSelect,
}: {
  events: DisasterEvent[];
  selectedId: string | null;
  onSelect: (event: DisasterEvent) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<DisasterCategory | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("severity");

  const allGroups = useMemo(() => groupEvents(events), [events]);
  const availableCategories = useMemo(
    () => Array.from(new Set(allGroups.map((g) => g.category))).sort(),
    [allGroups]
  );

  // Category sections keep "all Floods together, all Wildfires together"
  // instead of interleaving every category in one long list — sections are
  // ordered by how many active events they contain (most active first).
  const sections = useMemo(() => {
    const visible =
      categoryFilter === "all" ? allGroups : allGroups.filter((g) => g.category === categoryFilter);

    const byCategory = new Map<DisasterCategory, EventGroup[]>();
    for (const group of visible) {
      const arr = byCategory.get(group.category) ?? [];
      arr.push(group);
      byCategory.set(group.category, arr);
    }

    return Array.from(byCategory.entries())
      .map(([category, groups]) => ({
        category,
        groups: sortGroups(groups, sortBy),
        eventCount: groups.reduce((sum, g) => sum + g.events.length, 0),
      }))
      .sort((a, b) => b.eventCount - a.eventCount);
  }, [allGroups, categoryFilter, sortBy]);

  const visibleGroupCount = sections.reduce((sum, s) => sum + s.groups.length, 0);
  const visibleEventCount = sections.reduce((sum, s) => sum + s.eventCount, 0);

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      <div className="flex flex-wrap gap-2 px-1">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as DisasterCategory | "all")}
          className="glass-card min-w-0 flex-1 rounded-md px-2 py-1 text-xs text-foreground"
        >
          <option value="all">All categories</option>
          {availableCategories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="glass-card min-w-0 flex-1 rounded-md px-2 py-1 text-xs text-foreground"
        >
          {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
            <option key={option} value={option}>
              Sort: {SORT_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <p className="px-1 text-xs uppercase tracking-wide text-foreground-muted">
        {visibleEventCount} active event{visibleEventCount === 1 ? "" : "s"}
        {visibleGroupCount !== visibleEventCount ? ` · grouped into ${visibleGroupCount}` : ""}
      </p>

      {sections.length === 0 && (
        <p className="px-1 text-sm text-foreground-muted">
          {events.length === 0 ? "No events yet — waiting for the first refresh cycle." : "No events match this filter."}
        </p>
      )}

      {sections.map((section) => (
        <div key={section.category} className="flex flex-col gap-2">
          {categoryFilter === "all" && (
            <p className="mt-1 px-1 text-xs font-medium uppercase tracking-wide text-foreground first:mt-0">
              {CATEGORY_LABELS[section.category]} · {section.eventCount}
            </p>
          )}
          {section.groups.map((group) => (
            <EventGroupCard key={group.key} group={group} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </div>
  );
}
