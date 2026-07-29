"use client";

import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { computeSeasonalAlerts } from "@/lib/historical";

export function SeasonalDangerAlerts({ events }: { events: DisasterEvent[] }) {
  const alerts = computeSeasonalAlerts(events);

  if (alerts.length === 0) {
    return <p className="text-sm text-foreground-muted">Not enough historical data yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {alerts.slice(0, 5).map((alert) => (
        <li key={alert.category} className="glass-card rounded-md p-3 text-sm">
          <span className="text-warning">{CATEGORY_LABELS[alert.category]}</span> season peaks{" "}
          <span className="text-foreground">{alert.peakMonths}</span>. Based on {alert.totalEvents}-event
          history, {(alert.peakShare * 100).toFixed(0)}% of these events occur in this window.
        </li>
      ))}
    </ul>
  );
}
