"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent } from "@/types/event";
import {
  VERIFIED_1031_RELIEF,
  matchedEventsForNotice,
  IRS_DISASTER_RELIEF_HUB,
} from "@/lib/section1031";
import { fetchAllPages } from "@/lib/supabaseFetch";

export function Section1031Tab() {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchAllPages<DisasterEvent>((from, to) =>
      supabase.from("events").select("*").order("id", { ascending: true }).range(from, to)
    ).then((data) => {
      if (!isMounted) return;
      setEvents(data);
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const noticesWithMatches = useMemo(
    () =>
      VERIFIED_1031_RELIEF.map((notice) => ({
        notice,
        matchedEvents: matchedEventsForNotice(events, notice),
      })).sort((a, b) => b.notice.beganDate.localeCompare(a.notice.beganDate)),
    [events]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-foreground-muted">
        Loading verified IRS relief notices…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="glass-card rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-ai">1031 Exchange — Verified IRS Relief Only</p>
        <p className="mt-2 text-sm text-foreground-muted">
          This list shows only disasters where an actual IRS news release was individually confirmed (read
          directly from irs.gov, last checked 2026-09-02) to invoke Rev. Proc. 2018-58 relief — the provision
          under which 1031 like-kind exchange identification/completion deadlines get postponed for taxpayers
          in the disaster area, up to the same date as other postponed tax deadlines. Many other FEMA-declared
          disasters in this dashboard likely qualify too under the same general federal rule, but are
          intentionally left off this list until individually verified against a real IRS notice — this is not
          legal or tax advice, and coverage (which counties, which taxpayers) is exactly as stated in each
          linked notice, not broader.
        </p>
        <a
          href={IRS_DISASTER_RELIEF_HUB}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-live hover:underline"
        >
          IRS Disaster Tax Relief Hub (check for newer notices) →
        </a>
      </div>

      <ul className="flex flex-col gap-2">
        {noticesWithMatches.map(({ notice, matchedEvents }) => (
          <li key={notice.id} className="glass-card rounded-lg p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-foreground">
                  {notice.state} — {notice.disasterDescription}
                </p>
                <p className="text-xs text-foreground-muted">
                  Began {notice.beganDate} · IRS disaster code {notice.irsDisasterCode}
                </p>
              </div>
              <span className="shrink-0 rounded border border-opportunity/40 bg-opportunity/15 px-2 py-0.5 text-[10px] font-medium uppercase text-opportunity">
                Verified
              </span>
            </div>
            <p className="mt-2 text-xs text-foreground-muted">
              1031 exchange deadlines postponed to{" "}
              <span className="text-foreground">{notice.postponedDeadline}</span> for taxpayers in the covered
              area.
            </p>
            {matchedEvents.length > 0 && (
              <p className="mt-1 text-xs text-foreground-muted">
                Matches in this dashboard:{" "}
                <span className="text-foreground">{matchedEvents.map((e) => e.name).join(", ")}</span>
              </p>
            )}
            <a
              href={notice.noticeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-live hover:underline"
            >
              Read the IRS notice →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
