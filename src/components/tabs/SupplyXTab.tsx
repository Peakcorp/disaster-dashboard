"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent, DisasterCategory, EventMaterial } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import type { EventContact, ContactStatus } from "@/types/company";
import { MaterialDemandPanel } from "@/components/supplyx/MaterialDemandPanel";
import { MaterialsNeededList } from "@/components/supplyx/MaterialsNeededList";
import { MaterialPriceReference } from "@/components/supplyx/MaterialPriceReference";
import { ContactsList } from "@/components/company/ContactsList";

type DemandSort = "severity" | "recent" | "state_az";
const DEMAND_SORT_LABELS: Record<DemandSort, string> = {
  severity: "Severity",
  recent: "Most Recent Update",
  state_az: "State: A to Z",
};

const SEVERITY_RANK: Record<DisasterEvent["status"], number> = {
  critical: 3,
  developing: 2,
  monitoring: 1,
  resolved: 0,
};

const STATUS_FILTERS: { value: ContactStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "not_contacted", label: "Not Contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "engaged", label: "Engaged" },
  { value: "referred", label: "Referred" },
  { value: "closed", label: "Closed" },
];

export function SupplyXTab({ events }: { events: DisasterEvent[] }) {
  const [materials, setMaterials] = useState<EventMaterial[]>([]);
  const [contacts, setContacts] = useState<EventContact[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<DisasterCategory | "all">("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [demandSort, setDemandSort] = useState<DemandSort>("severity");
  const [contactStatusFilter, setContactStatusFilter] = useState<ContactStatus | "all">("all");

  const activeEvents = useMemo(() => events.filter((e) => e.status !== "resolved"), [events]);
  const eventIds = useMemo(() => activeEvents.map((e) => e.id), [activeEvents]);

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

  const availableCategories = useMemo(
    () => Array.from(new Set(activeEvents.map((e) => e.category))).sort(),
    [activeEvents]
  );
  const availableStates = useMemo(
    () => Array.from(new Set(activeEvents.flatMap((e) => e.states_affected))).sort(),
    [activeEvents]
  );

  const filteredEvents = useMemo(() => {
    return activeEvents.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (stateFilter !== "all" && !e.states_affected.includes(stateFilter)) return false;
      return true;
    });
  }, [activeEvents, categoryFilter, stateFilter]);

  const demandEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    switch (demandSort) {
      case "severity":
        return sorted.sort((a, b) => SEVERITY_RANK[b.status] - SEVERITY_RANK[a.status]);
      case "recent":
        return sorted.sort((a, b) => (b.last_fetched_at ?? "").localeCompare(a.last_fetched_at ?? ""));
      case "state_az":
        return sorted.sort((a, b) => (a.states_affected[0] ?? "").localeCompare(b.states_affected[0] ?? ""));
    }
  }, [filteredEvents, demandSort]);

  const churches = contacts.filter((c) => c.company_type === "church");
  const targetClients = contacts.filter((c) =>
    ["contractor", "restoration_company", "property_management"].includes(c.company_type)
  );
  const filterContacts = (list: EventContact[]) =>
    contactStatusFilter === "all" ? list : list.filter((c) => c.status === contactStatusFilter);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="glass-card flex flex-wrap gap-2 rounded-lg p-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as DisasterCategory | "all")}
          className="glass-card rounded-md px-2 py-1 text-xs text-foreground"
        >
          <option value="all">All categories</option>
          {availableCategories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="glass-card rounded-md px-2 py-1 text-xs text-foreground"
        >
          <option value="all">All states</option>
          {availableStates.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="self-center text-xs text-foreground-muted">
          Filters apply to materials, pricing, and demand forecasting below
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            Materials Needed — by Disaster Category
          </p>
          <MaterialsNeededList events={filteredEvents} materials={materials} />
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            US Price Reference — by Disaster Category
          </p>
          <MaterialPriceReference events={filteredEvents} materials={materials} />
        </div>
      </div>

      <div className="glass-card rounded-lg p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-foreground-muted">
            Material Demand Forecasting — Destroyed vs. Consumed
          </p>
          <select
            value={demandSort}
            onChange={(e) => setDemandSort(e.target.value as DemandSort)}
            className="glass-card rounded-md px-2 py-1 text-xs text-foreground"
          >
            {(Object.keys(DEMAND_SORT_LABELS) as DemandSort[]).map((option) => (
              <option key={option} value={option}>
                Sort: {DEMAND_SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
        {demandEvents.length === 0 ? (
          <p className="text-sm text-foreground-muted">No active events match this filter.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {demandEvents.map((event) => (
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
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-foreground-muted">Church Opportunity Signal</p>
            <select
              value={contactStatusFilter}
              onChange={(e) => setContactStatusFilter(e.target.value as ContactStatus | "all")}
              className="glass-card rounded-md px-2 py-1 text-xs text-foreground"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <ContactsList
            contacts={filterContacts(churches)}
            emptyMessage="No churches surfaced yet — run the fetch-places edge function (needs GOOGLE_PLACES_API_KEY)."
          />
        </div>
        <div className="glass-card rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-foreground-muted">Target Client Intelligence</p>
            <select
              value={contactStatusFilter}
              onChange={(e) => setContactStatusFilter(e.target.value as ContactStatus | "all")}
              className="glass-card rounded-md px-2 py-1 text-xs text-foreground"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <ContactsList
            contacts={filterContacts(targetClients)}
            emptyMessage="No contractors/restoration/property management firms surfaced yet — run fetch-places."
          />
        </div>
      </div>
    </div>
  );
}
