"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import {
  isFemaSourced,
  femaDeclarationNumber,
  femaDeclarationLink,
  irsReliefSearchLink,
  IRS_DISASTER_RELIEF_HUB,
} from "@/lib/section1031";
import { fetchAllPages } from "@/lib/supabaseFetch";
import { formatRelativeTime } from "@/lib/format";

export function Section1031Tab() {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchAllPages<DisasterEvent>((from, to) =>
      supabase.from("events").select("*").neq("status", "resolved").order("id", { ascending: true }).range(from, to)
    ).then((live) => {
      fetchAllPages<DisasterEvent>((from, to) =>
        supabase
          .from("events")
          .select("*")
          .eq("is_historical_seed", true)
          .in("external_source", ["fema", "fema_declarations_2025"])
          .order("start_date", { ascending: false })
          .range(from, to)
      ).then((historical) => {
        if (!isMounted) return;
        setEvents([...live, ...historical]);
        setLoading(false);
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const femaEvents = useMemo(
    () =>
      events
        .filter(isFemaSourced)
        .sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [events]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-foreground-muted">
        Loading FEMA-declared disasters…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="glass-card rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-ai">1031 Exchange — Federal Disaster Relief</p>
        <p className="mt-2 text-sm text-foreground-muted">
          Under IRC §7508A and Rev. Proc. 2018-58, the IRS automatically grants tax deadline relief to
          taxpayers in any federally-declared (FEMA major disaster) area — this systematically includes
          postponing 1031 like-kind exchange identification (45-day) and completion (180-day) deadlines. This
          applies to essentially every FEMA declaration, not selectively (the 2018 Camp Fire, the 2025
          Southern California wildfires, and numerous hurricane declarations have all triggered it). The{" "}
          <span className="text-foreground">exact postponed date is set per declaration</span> and published by
          the IRS as it happens — this tab identifies which of the disasters in this dashboard are FEMA-declared
          (and therefore likely qualify) and links directly to where the current, authoritative date is
          published. It is not legal or tax advice; verify with the IRS notice for the specific declaration
          before relying on a deadline.
        </p>
        <a
          href={IRS_DISASTER_RELIEF_HUB}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-live hover:underline"
        >
          IRS Disaster Tax Relief Hub (current announcements) →
        </a>
      </div>

      {femaEvents.length === 0 ? (
        <p className="text-sm text-foreground-muted">No FEMA-declared disasters tracked yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {femaEvents.map((event) => {
            const drNumber = femaDeclarationNumber(event);
            return (
              <li key={event.id} className="glass-card rounded-lg p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-foreground">{event.name}</p>
                    <p className="text-xs text-foreground-muted">
                      {CATEGORY_LABELS[event.category]} · {event.states_affected.join(", ") || "—"}
                      {drNumber && ` · FEMA DR-${drNumber}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded border border-opportunity/40 bg-opportunity/15 px-2 py-0.5 text-[10px] font-medium uppercase text-opportunity">
                    Likely Qualifies
                  </span>
                </div>
                <p className="mt-2 text-xs text-foreground-muted">
                  Declared {new Date(event.start_date).toISOString().slice(0, 10)} · Last updated{" "}
                  {formatRelativeTime(event.last_fetched_at)}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {femaDeclarationLink(event) && (
                    <a
                      href={femaDeclarationLink(event)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-live hover:underline"
                    >
                      FEMA declaration page →
                    </a>
                  )}
                  <a
                    href={irsReliefSearchLink(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-live hover:underline"
                  >
                    Search for this declaration&apos;s IRS relief notice →
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
