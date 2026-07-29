"use client";

import type { PriceIndexPoint } from "@/types/company";

export function PriceIntelligenceChart({ points }: { points: PriceIndexPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        No price data yet — run the <code className="text-live">fetch-prices</code> edge function (needs
        FRED_API_KEY) to populate this chart.
      </p>
    );
  }

  const byCategory = new Map<string, PriceIndexPoint[]>();
  for (const point of points) {
    const arr = byCategory.get(point.material_category) ?? [];
    arr.push(point);
    byCategory.set(point.material_category, arr);
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byCategory.entries()).map(([category, series]) => {
        const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
        const values = sorted.map((p) => p.index_value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const latest = values[values.length - 1];
        const first = values[0];
        const changePct = first ? ((latest - first) / first) * 100 : 0;

        return (
          <div key={category}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-foreground">{category}</span>
              <span className={changePct >= 0 ? "text-critical" : "text-opportunity"}>
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(1)}% (12mo)
              </span>
            </div>
            <div className="flex h-12 items-end gap-px">
              {sorted.map((point) => (
                <div
                  key={point.id}
                  title={`${point.date}: ${point.index_value}`}
                  className="flex-1 rounded-t-sm bg-live/50"
                  style={{ height: `${((point.index_value - min) / range) * 100}%` }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
