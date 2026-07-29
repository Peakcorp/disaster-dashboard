"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent, EventMaterial } from "@/types/event";
import type { EventContact, PriceIndexPoint } from "@/types/company";
import { MaterialDemandPanel } from "@/components/supplyx/MaterialDemandPanel";
import { ProcurementAlerts } from "@/components/supplyx/ProcurementAlerts";
import { PriceIntelligenceChart } from "@/components/supplyx/PriceIntelligenceChart";
import { ContactsList } from "@/components/company/ContactsList";

export function SupplyXTab({ events }: { events: DisasterEvent[] }) {
  const [materials, setMaterials] = useState<EventMaterial[]>([]);
  const [contacts, setContacts] = useState<EventContact[]>([]);
  const [prices, setPrices] = useState<PriceIndexPoint[]>([]);

  const activeEvents = events.filter((e) => e.status !== "resolved");
  const eventIds = activeEvents.map((e) => e.id);

  useEffect(() => {
    // When there are no active events, activeEvents is empty too, so any
    // stale materials/contacts in state simply won't be rendered against
    // anything — no need to synchronously clear state here.
    if (eventIds.length === 0) return;
    supabase
      .from("event_materials")
      .select("*")
      .in("event_id", eventIds)
      .then(({ data, error }) => {
        if (error) console.error("Failed to load event_materials", error);
        setMaterials((data as EventMaterial[]) ?? []);
      });
    supabase
      .from("event_contacts")
      .select("*")
      .in("event_id", eventIds)
      .in("target_company", ["supplyx", "all"])
      .then(({ data, error }) => {
        if (error) console.error("Failed to load event_contacts", error);
        setContacts((data as EventContact[]) ?? []);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIds.join(",")]);

  useEffect(() => {
    supabase
      .from("price_index_history")
      .select("*")
      .order("date", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load price_index_history", error);
        setPrices((data as PriceIndexPoint[]) ?? []);
      });
  }, []);

  const churches = contacts.filter((c) => c.company_type === "church");
  const targetClients = contacts.filter((c) =>
    ["contractor", "restoration_company", "property_management"].includes(c.company_type)
  );

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            Act Now — Pre-Purchase Alerts
          </p>
          <ProcurementAlerts events={activeEvents} materials={materials} />
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            Price Intelligence (FRED, 12-month)
          </p>
          <PriceIntelligenceChart points={prices} />
        </div>
      </div>

      <div className="glass-card rounded-lg p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
          Material Demand Forecasting — Destroyed vs. Consumed
        </p>
        {activeEvents.length === 0 ? (
          <p className="text-sm text-foreground-muted">No active events right now.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeEvents.map((event) => (
              <MaterialDemandPanel
                key={event.id}
                event={event}
                materials={materials.filter((m) => m.event_id === event.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            Church Opportunity Signal
          </p>
          <ContactsList
            contacts={churches}
            emptyMessage="No churches surfaced yet — run the fetch-places edge function (needs GOOGLE_PLACES_API_KEY)."
          />
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            Target Client Intelligence
          </p>
          <ContactsList
            contacts={targetClients}
            emptyMessage="No contractors/restoration/property management firms surfaced yet — run fetch-places."
          />
        </div>
      </div>
    </div>
  );
}
