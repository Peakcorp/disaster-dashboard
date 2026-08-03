"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent, NewsArticle } from "@/types/event";
import type { ReferralPartner, StateRegulatoryInfo } from "@/types/company";
import { ClaimCategoryList } from "@/components/insurance/ClaimCategoryCard";
import { ReferralPartnersPanel } from "@/components/insurance/ReferralPartnersPanel";
import { StateRegulatoryPanel } from "@/components/insurance/StateRegulatoryPanel";
import { sortBySeverity } from "@/lib/format";

export function InsuranceClaimsTab({ events }: { events: DisasterEvent[] }) {
  const [partners, setPartners] = useState<ReferralPartner[]>([]);
  const [regulatoryInfo, setRegulatoryInfo] = useState<StateRegulatoryInfo[]>([]);
  const [newsByEventId, setNewsByEventId] = useState<Record<string, NewsArticle[]>>({});

  const activeEvents = useMemo(
    () => sortBySeverity(events.filter((e) => e.status !== "resolved")),
    [events]
  );

  const statesInScope = useMemo(
    () => Array.from(new Set(activeEvents.flatMap((e) => e.states_affected))),
    [activeEvents]
  );

  const eventIds = useMemo(() => activeEvents.map((e) => e.id), [activeEvents]);

  useEffect(() => {
    supabase
      .from("referral_partners")
      .select("*")
      .then(({ data, error }) => {
        if (error) console.error("Failed to load referral_partners", error);
        setPartners((data as ReferralPartner[]) ?? []);
      });
    supabase
      .from("state_regulatory_info")
      .select("*")
      .then(({ data, error }) => {
        if (error) console.error("Failed to load state_regulatory_info", error);
        setRegulatoryInfo((data as StateRegulatoryInfo[]) ?? []);
      });
  }, []);

  useEffect(() => {
    if (eventIds.length === 0) return;
    supabase
      .from("news_articles")
      .select("*")
      .in("event_id", eventIds)
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load news_articles", error);
        const byEvent: Record<string, NewsArticle[]> = {};
        for (const article of (data as NewsArticle[]) ?? []) {
          if (!article.event_id) continue;
          (byEvent[article.event_id] ??= []).push(article);
        }
        setNewsByEventId(byEvent);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIds.join(",")]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="glass-card rounded-lg p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
          Active Claim Pool Estimation — by Disaster Category
        </p>
        <ClaimCategoryList events={activeEvents} newsByEventId={newsByEventId} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            Referral Partner Database
          </p>
          <ReferralPartnersPanel partners={partners} statesInScope={statesInScope} />
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            State Regulatory Intelligence
          </p>
          <StateRegulatoryPanel info={regulatoryInfo} statesInScope={statesInScope} />
        </div>
      </div>

      <div className="glass-card rounded-lg p-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-foreground-muted">
          Non-Legal Services Opportunities
        </p>
        <p className="text-sm text-foreground-muted">
          For each active event: property damage inspections, damage estimation and documentation reports,
          photography/evidence documentation, public adjuster coordination, expert witness sourcing.
          Estimated property counts needing these services require the same property-surfacing data as
          Tab 4 (Interserv) — run <code className="text-live">fetch-places</code> to populate real counts
          per event.
        </p>
      </div>
    </div>
  );
}
