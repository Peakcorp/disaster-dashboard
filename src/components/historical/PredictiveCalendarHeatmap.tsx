"use client";

import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { buildPredictiveCalendar, MONTH_NAMES } from "@/lib/historical";

export function PredictiveCalendarHeatmap({ events }: { events: DisasterEvent[] }) {
  const { categories, cells, maxCount } = buildPredictiveCalendar(events);
  const currentMonth = new Date().getUTCMonth();

  if (categories.length === 0) {
    return <p className="text-sm text-foreground-muted">Not enough historical data yet.</p>;
  }

  const cellFor = (category: string, month: number) =>
    cells.find((c) => c.category === category && c.month === month);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-32 text-left font-normal text-foreground-muted">Category</th>
            {MONTH_NAMES.map((m, i) => (
              <th
                key={m}
                className={`w-9 font-normal ${i === currentMonth ? "text-live" : "text-foreground-muted"}`}
              >
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category}>
              <td className="whitespace-nowrap pr-2 text-foreground-muted">
                {CATEGORY_LABELS[category]}
              </td>
              {MONTH_NAMES.map((_, month) => {
                const cell = cellFor(category, month);
                const intensity = maxCount > 0 ? (cell?.count ?? 0) / maxCount : 0;
                return (
                  <td key={month} className="p-0">
                    <div
                      title={`${cell?.count ?? 0} event(s)`}
                      className={`h-6 w-9 rounded-sm ${month === currentMonth ? "ring-1 ring-live/60" : ""}`}
                      style={{
                        background:
                          intensity === 0
                            ? "rgba(255,255,255,0.04)"
                            : `rgba(255, 59, 59, ${0.15 + intensity * 0.65})`,
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
