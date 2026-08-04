"use client";

import { useState } from "react";
import { CATEGORY_LABELS } from "@/types/event";
import type { SeasonalRiskForecast } from "@/lib/predictions";

const RISK_LABEL: Record<SeasonalRiskForecast["riskLevel"], string> = {
  elevated: "Elevated Risk",
  moderate: "Moderate Risk",
  baseline: "Baseline",
  "low-data": "Limited Data",
};

const RISK_STYLES: Record<SeasonalRiskForecast["riskLevel"], string> = {
  elevated: "bg-critical/20 text-critical border-critical/40",
  moderate: "bg-warning/20 text-warning border-warning/40",
  baseline: "bg-white/5 text-foreground-muted border-white/10",
  "low-data": "bg-white/5 text-foreground-muted border-white/10",
};

const TREND_LABEL: Record<SeasonalRiskForecast["trendDirection"], string> = {
  up: "increasing",
  down: "decreasing",
  flat: "flat",
  unknown: "not enough years of data",
};

export function SeasonalRiskCard({ forecast }: { forecast: SeasonalRiskForecast }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card rounded-lg p-4">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-start justify-between gap-2 text-left">
        <div>
          <p className="text-sm font-medium text-foreground">{CATEGORY_LABELS[forecast.category]}</p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {forecast.riskLevel === "low-data" ? (
              <>Only {forecast.totalEventsLast10Yr} events in the last 10 years — too few to forecast reliably.</>
            ) : (
              <>
                ~{forecast.avgEventsPerWindow.toFixed(1)} events/year historically occur in a {forecast.windowLabel}{" "}
                window · {(forecast.windowSharePct * 100).toFixed(0)}% of all {CATEGORY_LABELS[forecast.category].toLowerCase()}{" "}
                events in the last 10 years fell in this window
              </>
            )}
          </p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${RISK_STYLES[forecast.riskLevel]}`}>
          {RISK_LABEL[forecast.riskLevel]}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-foreground-muted">Historical window events</p>
              <p className="text-foreground">
                {forecast.eventsInWindowLast10Yr} of {forecast.totalEventsLast10Yr} ({forecast.yearsWithData} years with data)
              </p>
            </div>
            <div>
              <p className="text-foreground-muted">5-year trend</p>
              <p className="text-foreground">
                {TREND_LABEL[forecast.trendDirection]}
                {forecast.trendRecentAvg != null && forecast.trendPriorAvg != null && (
                  <span className="text-foreground-muted">
                    {" "}
                    ({forecast.trendRecentAvg.toFixed(1)}/yr recent vs {forecast.trendPriorAvg.toFixed(1)}/yr prior)
                  </span>
                )}
              </p>
            </div>
          </div>

          {forecast.topStates.length > 0 && (
            <div>
              <p className="mb-1 text-foreground-muted">Most historically active states in this window</p>
              <ul className="flex flex-wrap gap-1">
                {forecast.topStates.map((s) => (
                  <li key={s.state} className="rounded bg-white/5 px-2 py-0.5 text-foreground">
                    {s.state} ({s.count})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {forecast.sampleEvents.length > 0 && (
            <div>
              <p className="mb-1 text-foreground-muted">
                Underlying events this estimate is based on ({forecast.sampleEvents.length})
              </p>
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
                {forecast.sampleEvents
                  .slice()
                  .sort((a, b) => b.start_date.localeCompare(a.start_date))
                  .map((event) => (
                    <li key={event.id} className="text-foreground-muted">
                      <span className="text-foreground">{event.name}</span> —{" "}
                      {new Date(event.start_date).getUTCFullYear()} · {event.states_affected.join(", ") || "—"}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
