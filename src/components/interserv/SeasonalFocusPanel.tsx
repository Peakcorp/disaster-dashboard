"use client";

import { SEASONAL_FOCUS_AREAS } from "@/lib/company";

export function SeasonalFocusPanel() {
  return (
    <ul className="flex flex-col gap-2">
      {SEASONAL_FOCUS_AREAS.map((area) => (
        <li key={area.region} className="glass-card rounded-md p-3 text-sm">
          <p className="text-foreground">
            {area.region} <span className="text-foreground-muted">({area.window})</span>
          </p>
          <p className="text-xs text-foreground-muted">{area.note}</p>
        </li>
      ))}
    </ul>
  );
}
