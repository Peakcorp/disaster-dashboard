"use client";

import type { DisasterEvent } from "@/types/event";
import { buildYearlyTrend, compareRollingFiveYear } from "@/lib/historical";

export function TrendLineChart({ events }: { events: DisasterEvent[] }) {
  const trend = buildYearlyTrend(events);
  const comparison = compareRollingFiveYear(trend);
  const maxCount = Math.max(1, ...trend.map((t) => t.count));

  if (trend.length === 0) {
    return <p className="text-sm text-foreground-muted">Not enough historical data yet.</p>;
  }

  return (
    <div>
      <div className="flex h-24 items-end gap-0.5">
        {trend.map((t) => (
          <div
            key={t.year}
            title={`${t.year}: ${t.count} event(s)`}
            className="flex-1 rounded-t-sm bg-live/50"
            style={{ height: `${(t.count / maxCount) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-foreground-muted">
        <span>{trend[0].year}</span>
        <span>{trend[trend.length - 1].year}</span>
      </div>
      {comparison && (
        <p className="mt-3 text-sm text-foreground-muted">
          5-year average is{" "}
          <span
            className={
              comparison.direction === "up"
                ? "text-critical"
                : comparison.direction === "down"
                  ? "text-opportunity"
                  : "text-foreground"
            }
          >
            {comparison.direction === "up" ? "increasing" : comparison.direction === "down" ? "decreasing" : "flat"}
          </span>{" "}
          ({comparison.recentAvg.toFixed(1)}/yr recent vs. {comparison.priorAvg.toFixed(1)}/yr prior).
        </p>
      )}
    </div>
  );
}
