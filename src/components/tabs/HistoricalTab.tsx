"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent, DisasterCategory } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { PredictiveCalendarHeatmap } from "@/components/historical/PredictiveCalendarHeatmap";
import { SeasonalDangerAlerts } from "@/components/historical/SeasonalDangerAlerts";
import { TrendLineChart } from "@/components/historical/TrendLineChart";
import { HistoricalEventCard } from "@/components/historical/HistoricalEventCard";

type SortOption =
  | "damage_desc"
  | "damage_asc"
  | "year_desc"
  | "year_asc"
  | "fatalities_desc"
  | "name_asc";

const SORT_LABELS: Record<SortOption, string> = {
  damage_desc: "Damage: High to Low",
  damage_asc: "Damage: Low to High",
  year_desc: "Year: Newest First",
  year_asc: "Year: Oldest First",
  fatalities_desc: "Fatalities: Highest First",
  name_asc: "Name: A to Z",
};

function sortEvents(events: DisasterEvent[], sortBy: SortOption): DisasterEvent[] {
  const sorted = [...events];
  switch (sortBy) {
    case "damage_desc":
      return sorted.sort((a, b) => (b.estimated_damage_usd ?? -1) - (a.estimated_damage_usd ?? -1));
    case "damage_asc":
      return sorted.sort(
        (a, b) =>
          (a.estimated_damage_usd ?? Number.POSITIVE_INFINITY) -
          (b.estimated_damage_usd ?? Number.POSITIVE_INFINITY)
      );
    case "year_desc":
      return sorted.sort((a, b) => b.start_date.localeCompare(a.start_date));
    case "year_asc":
      return sorted.sort((a, b) => a.start_date.localeCompare(b.start_date));
    case "fatalities_desc":
      return sorted.sort((a, b) => (b.fatalities ?? -1) - (a.fatalities ?? -1));
    case "name_asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function HistoricalTab() {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DisasterCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("damage_desc");

  useEffect(() => {
    let isMounted = true;
    supabase
      .from("events")
      .select("*")
      .eq("is_historical_seed", true)
      .order("estimated_damage_usd", { ascending: false })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) console.error("Failed to load historical events", error);
        setEvents((data as DisasterEvent[]) ?? []);
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (!query) return true;
      return (
        e.name.toLowerCase().includes(query) ||
        e.states_affected.some((s) => s.toLowerCase().includes(query))
      );
    });
  }, [events, category, search]);

  const categories = useMemo(
    () => Array.from(new Set(events.map((e) => e.category))).sort(),
    [events]
  );

  const sorted = useMemo(() => sortEvents(filtered, sortBy), [filtered, sortBy]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-foreground-muted">
        Loading historical disaster database…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-medium text-foreground">No historical events seeded yet</p>
        <p className="max-w-md text-sm text-foreground-muted">
          Run the <code className="text-live">seed-historical-events</code>{" "}
          edge function to backfill this tab from NOAA&apos;s Billion-Dollar Disaster dataset, then{" "}
          <code className="text-live">enrich-historical-events</code> for AI narratives and scores.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-lg p-4 lg:col-span-2">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            Predictive Calendar — event frequency by month
          </p>
          <PredictiveCalendarHeatmap events={events} />
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">Seasonal Danger Windows</p>
          <SeasonalDangerAlerts events={events} />
        </div>
      </div>

      <div className="glass-card rounded-lg p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
          Frequency Trend — events per year
        </p>
        <TrendLineChart events={events} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DisasterCategory | "all")}
          className="glass-card rounded-md px-2 py-1.5 text-sm text-foreground"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or state…"
          className="glass-card min-w-[220px] flex-1 rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-muted"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="glass-card rounded-md px-2 py-1.5 text-sm text-foreground"
        >
          {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
            <option key={option} value={option}>
              Sort: {SORT_LABELS[option]}
            </option>
          ))}
        </select>
        <span className="text-xs text-foreground-muted">
          {filtered.length} of {events.length} events
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((event) => (
          <HistoricalEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
