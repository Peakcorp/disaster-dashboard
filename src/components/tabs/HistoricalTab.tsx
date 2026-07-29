"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent, DisasterCategory } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { PredictiveCalendarHeatmap } from "@/components/historical/PredictiveCalendarHeatmap";
import { SeasonalDangerAlerts } from "@/components/historical/SeasonalDangerAlerts";
import { TrendLineChart } from "@/components/historical/TrendLineChart";
import { HistoricalEventCard } from "@/components/historical/HistoricalEventCard";

export function HistoricalTab() {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DisasterCategory | "all">("all");
  const [search, setSearch] = useState("");

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
        <span className="text-xs text-foreground-muted">
          {filtered.length} of {events.length} events
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((event) => (
          <HistoricalEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
