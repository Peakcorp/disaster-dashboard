"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent } from "@/types/event";
import { computeSeasonalRiskForecasts } from "@/lib/predictions";
import { SeasonalRiskCard } from "@/components/predictions/SeasonalRiskCard";

export function PredictionsTab() {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from("events")
      .select("*")
      .eq("is_historical_seed", true)
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

  const referenceDate = useMemo(() => new Date(), []);
  const forecasts = useMemo(
    () => computeSeasonalRiskForecasts(events, referenceDate),
    [events, referenceDate]
  );

  const windowLabel = forecasts[0]?.windowLabel ?? "";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-foreground-muted">
        Loading 10-year historical archive…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-medium text-foreground">No historical data seeded yet</p>
        <p className="max-w-md text-sm text-foreground-muted">
          This tab needs the historical archive (Tab 2) populated first — run{" "}
          <code className="text-live">seed-historical-events</code> and{" "}
          <code className="text-live">seed-recent-disasters</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="glass-card rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-ai">
          Seasonal Risk Forecast — {windowLabel} ({referenceDate.getUTCFullYear()})
        </p>
        <p className="mt-2 text-sm text-foreground-muted">
          This is a statistical estimate built from this project&apos;s own 10-year historical archive — it
          identifies which disaster categories and states have disproportionately more activity in this same
          3-month window in past years, and whether that activity has been trending up or down recently. It is
          {" "}
          <span className="text-foreground">not</span>
          {" "}
          a prediction of a specific storm, fire, or flood at a specific place or date — no free data source can
          do that. Treat it as a &quot;what to prepare for&quot; planning signal, not a forecast to act on alone.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {forecasts.map((forecast) => (
          <SeasonalRiskCard key={forecast.category} forecast={forecast} />
        ))}
      </div>
    </div>
  );
}
