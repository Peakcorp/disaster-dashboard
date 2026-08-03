"use client";

import { useState } from "react";
import type { DisasterEvent, DisasterCategory } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { formatUsd } from "@/lib/format";
import { CLAIM_TYPES_BY_CATEGORY, estimateClaimValuePoolUsd } from "@/lib/company";
import { ClaimPoolCard } from "./ClaimPoolCard";

interface CategoryGroup {
  category: DisasterCategory;
  events: DisasterEvent[];
  states: string[];
  totalClaimsFiledEst: number;
  eventsWithClaimsEst: number;
  totalRealDamageUsd: number;
  eventsWithRealDamage: number;
}

function buildGroups(events: DisasterEvent[]): CategoryGroup[] {
  const groups = new Map<DisasterCategory, CategoryGroup>();

  for (const event of events) {
    const group: CategoryGroup =
      groups.get(event.category) ??
      {
        category: event.category,
        events: [],
        states: [],
        totalClaimsFiledEst: 0,
        eventsWithClaimsEst: 0,
        totalRealDamageUsd: 0,
        eventsWithRealDamage: 0,
      };
    group.events.push(event);
    group.states.push(...event.states_affected);
    if (event.insurance_claims_filed_est != null) {
      group.totalClaimsFiledEst += event.insurance_claims_filed_est;
      group.eventsWithClaimsEst += 1;
    }
    if (event.estimated_damage_usd != null) {
      group.totalRealDamageUsd += event.estimated_damage_usd;
      group.eventsWithRealDamage += 1;
    }
    groups.set(event.category, group);
  }

  for (const group of groups.values()) {
    group.states = Array.from(new Set(group.states)).sort();
  }

  return Array.from(groups.values()).sort((a, b) => b.events.length - a.events.length);
}

export function ClaimCategoryList({ events }: { events: DisasterEvent[] }) {
  const [expanded, setExpanded] = useState<DisasterCategory | null>(null);
  const groups = buildGroups(events);

  if (groups.length === 0) {
    return <p className="text-sm text-foreground-muted">No active events right now.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => {
        const isOpen = expanded === group.category;
        const claimTypes = CLAIM_TYPES_BY_CATEGORY[group.category] ?? ["Structural damage"];
        const estimatedClaimValue = estimateClaimValuePoolUsd(
          group.eventsWithClaimsEst > 0 ? group.totalClaimsFiledEst : null
        );
        const stateSummary =
          group.states.length > 4
            ? `${group.states.slice(0, 4).join(", ")} +${group.states.length - 4} more`
            : group.states.join(", ") || "Multi-state";

        return (
          <li key={group.category} className="glass-card rounded-md p-3 text-sm">
            <button
              onClick={() => setExpanded(isOpen ? null : group.category)}
              className="flex w-full items-start justify-between gap-2 text-left"
            >
              <div>
                <p className="text-foreground">{CATEGORY_LABELS[group.category]}</p>
                <p className="text-xs text-foreground-muted">
                  {group.events.length} active event{group.events.length === 1 ? "" : "s"} · {stateSummary}
                </p>
              </div>
              <span className="shrink-0 text-xs text-foreground-muted">{isOpen ? "▲ hide" : "▼ details"}</span>
            </button>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-foreground-muted">Est. claims filed</p>
                <p className="text-foreground">
                  {group.eventsWithClaimsEst > 0 ? group.totalClaimsFiledEst.toLocaleString() : "Pending AI analysis"}
                  {group.eventsWithClaimsEst > 0 && group.eventsWithClaimsEst < group.events.length && (
                    <span className="ml-1 text-foreground-muted">
                      ({group.eventsWithClaimsEst}/{group.events.length} events analyzed)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-foreground-muted">Est. damage to be claimed</p>
                <p className="text-foreground">
                  {group.eventsWithRealDamage > 0
                    ? formatUsd(group.totalRealDamageUsd)
                    : estimatedClaimValue != null
                      ? `${formatUsd(estimatedClaimValue)} (est.)`
                      : "—"}
                </p>
              </div>
            </div>

            <p className="mt-2 text-xs text-foreground-muted">
              Claim types: <span className="text-foreground">{claimTypes.join(", ")}</span>
            </p>

            {isOpen && (
              <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-2">
                {group.events.map((event) => (
                  <ClaimPoolCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
