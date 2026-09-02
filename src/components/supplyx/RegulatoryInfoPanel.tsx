"use client";

import { useMemo } from "react";
import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import {
  priceGougingInfoForState,
  priceGougingSearchLink,
  approvedMaterialsFor,
} from "@/lib/regulatoryReference";

export function RegulatoryInfoPanel({ events }: { events: DisasterEvent[] }) {
  const stateCategoryPairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: { state: string; category: DisasterEvent["category"] }[] = [];
    for (const event of events) {
      for (const state of event.states_affected) {
        const key = `${state}::${event.category}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ state, category: event.category });
      }
    }
    return pairs;
  }, [events]);

  const states = useMemo(
    () => Array.from(new Set(stateCategoryPairs.map((p) => p.state))).sort(),
    [stateCategoryPairs]
  );
  const approvedMaterialHits = stateCategoryPairs
    .map((p) => ({ ...p, info: approvedMaterialsFor(p.state, p.category) }))
    .filter((p) => p.info != null);

  if (states.length === 0) {
    return <p className="text-sm text-foreground-muted">No active events to reference yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div>
        <p className="mb-1.5 text-foreground-muted">
          Price gouging: most states automatically prohibit &quot;unconscionable&quot; or &quot;excessive&quot;
          price increases the moment a state/local emergency is declared. A few set an explicit statutory cap;
          most use a case-by-case standard enforced by that state&apos;s Attorney General. Not legal advice —
          verify current statute text and any active emergency declaration before adjusting pricing.
        </p>
        <ul className="flex flex-col gap-1.5">
          {states.map((state) => {
            const info = priceGougingInfoForState(state);
            return (
              <li key={state} className="rounded bg-white/5 p-2">
                <span className="text-foreground">{state}: </span>
                <span className="text-foreground-muted">{info.note}</span>{" "}
                <a
                  href={priceGougingSearchLink(state)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-live hover:underline"
                >
                  Verify current law
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="mb-1.5 text-foreground-muted">
          Approved/required materials by region — only states with a well-documented, stable mandated
          product-approval program are listed; everywhere else, check the local building department.
        </p>
        {approvedMaterialHits.length === 0 ? (
          <p className="text-foreground-muted">
            No mandated product-approval program on file for the states/categories currently active.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {approvedMaterialHits.map(({ state, category, info }) => (
              <li key={`${state}-${category}`} className="rounded bg-white/5 p-2">
                <p className="text-foreground">
                  {state} — {CATEGORY_LABELS[category]}: {info!.program}
                </p>
                <p className="mt-0.5 text-foreground-muted">{info!.requirement}</p>
                <a
                  href={info!.sourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-live hover:underline"
                >
                  Official source
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
