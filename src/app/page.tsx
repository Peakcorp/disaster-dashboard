"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent } from "@/types/event";
import { TABS, type TabId } from "@/types/tabs";
import { StatusBar } from "@/components/StatusBar";
import { TabNav } from "@/components/TabNav";
import { LiveMapTab } from "@/components/tabs/LiveMapTab";
import { HistoricalTab } from "@/components/tabs/HistoricalTab";
import { SupplyXTab } from "@/components/tabs/SupplyXTab";
import { InterservTab } from "@/components/tabs/InterservTab";
import { InsuranceClaimsTab } from "@/components/tabs/InsuranceClaimsTab";
import { PredictionsTab } from "@/components/tabs/PredictionsTab";
import { ComingSoonTab } from "@/components/tabs/ComingSoonTab";

export default function DashboardPage() {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("live-map");

  useEffect(() => {
    let isMounted = true;

    // Tab 1 (live map) shows only the live-tracked feed, not historical
    // seed rows from Tab 2 — those are fetched separately by HistoricalTab.
    supabase
      .from("events")
      .select("*")
      .eq("is_historical_seed", false)
      .order("start_date", { ascending: false })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) console.error("Failed to load events", error);
        setEvents((data as DisasterEvent[]) ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          const row = (payload.new ?? payload.old) as DisasterEvent | undefined;
          if (row?.is_historical_seed) return; // historical rows never appear on Tab 1

          setEvents((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as DisasterEvent, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((e) =>
                e.id === (payload.new as DisasterEvent).id ? (payload.new as DisasterEvent) : e
              );
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((e) => e.id !== (payload.old as DisasterEvent).id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const activeTabDef = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <StatusBar events={events} />
      <TabNav active={activeTab} onSelect={setActiveTab} />

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === "live-map" ? (
          <LiveMapTab events={events} loading={loading} />
        ) : activeTab === "historical" ? (
          <HistoricalTab />
        ) : activeTab === "supplyx" ? (
          <SupplyXTab events={events} />
        ) : activeTab === "interserv" ? (
          <InterservTab events={events} />
        ) : activeTab === "insurance" ? (
          <InsuranceClaimsTab events={events} />
        ) : activeTab === "predictions" ? (
          <PredictionsTab />
        ) : (
          <div className="flex flex-1 p-6">
            <ComingSoonTab tab={activeTabDef} />
          </div>
        )}
      </div>
    </div>
  );
}
