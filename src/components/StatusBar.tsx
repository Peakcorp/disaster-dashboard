"use client";

import { useEffect, useState } from "react";
import type { DisasterEvent } from "@/types/event";
import { formatRelativeTime } from "@/lib/format";

const REFRESH_INTERVAL_HOURS = 6;

function nextRefreshCountdown(lastRefresh: string | null): string {
  if (!lastRefresh) return "--:--";
  const last = new Date(lastRefresh).getTime();
  const next = last + REFRESH_INTERVAL_HOURS * 60 * 60 * 1000;
  const remainingMs = next - Date.now();
  if (remainingMs <= 0) return "due now";
  const h = Math.floor(remainingMs / (1000 * 60 * 60));
  const m = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function StatusBar({ events }: { events: DisasterEvent[] }) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const lastRefresh = events.reduce<string | null>((latest, e) => {
    if (!e.last_fetched_at) return latest;
    if (!latest || e.last_fetched_at > latest) return e.last_fetched_at;
    return latest;
  }, null);

  const activeCount = events.filter((e) => e.status !== "resolved").length;
  const updatedCount = events.filter((e) => e.is_updated_since_last_refresh).length;

  return (
    <div className="glass-card sticky top-0 z-50 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 text-xs text-foreground-muted">
      <span>
        Last refresh:{" "}
        <span className="text-foreground">{formatRelativeTime(lastRefresh)}</span>
      </span>
      <span>
        Next refresh in:{" "}
        <span className="font-mono text-live">{nextRefreshCountdown(lastRefresh)}</span>
      </span>
      <span>
        Active events: <span className="text-foreground">{activeCount}</span>
      </span>
      <span>
        Updated this cycle: <span className="text-warning">{updatedCount}</span>
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
        AI analysis: <span className="text-foreground-muted">Not yet enabled (Phase 2)</span>
      </span>
    </div>
  );
}
