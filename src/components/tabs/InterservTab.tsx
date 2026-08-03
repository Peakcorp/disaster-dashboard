"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent, DisasterCategory } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import type { EventContact, ContactCompanyType, ContactStatus } from "@/types/company";
import { OutreachWindowCard } from "@/components/interserv/OutreachWindowCard";
import { SeasonalFocusPanel } from "@/components/interserv/SeasonalFocusPanel";
import { ContactsList } from "@/components/company/ContactsList";
import { outreachStatusFor } from "@/lib/company";

const PROPERTY_TYPES: { value: ContactCompanyType | "all"; label: string }[] = [
  { value: "all", label: "All property types" },
  { value: "hotel", label: "Hotels & Resorts" },
  { value: "apartment", label: "Apartment Buildings" },
  { value: "church", label: "Churches & Religious Institutions" },
  { value: "office", label: "Office / Commercial" },
  { value: "mixed_use", label: "Mixed-Use" },
];

const STATUS_FILTERS: { value: ContactStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "not_contacted", label: "Not Contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "engaged", label: "Engaged" },
  { value: "referred", label: "Referred" },
  { value: "closed", label: "Closed" },
];

type OutreachSort = "urgency" | "score_desc" | "recent" | "state_az";
const OUTREACH_SORT_LABELS: Record<OutreachSort, string> = {
  urgency: "Outreach Urgency",
  score_desc: "Interserv Score",
  recent: "Most Recent Start",
  state_az: "State: A to Z",
};

type ContactSort = "name_az" | "status" | "state_az";
const CONTACT_SORT_LABELS: Record<ContactSort, string> = {
  name_az: "Name: A to Z",
  status: "Status",
  state_az: "State: A to Z",
};

export function InterservTab({ events }: { events: DisasterEvent[] }) {
  const [contacts, setContacts] = useState<EventContact[]>([]);
  const [propertyType, setPropertyType] = useState<ContactCompanyType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");
  const [contactSort, setContactSort] = useState<ContactSort>("name_az");
  const [categoryFilter, setCategoryFilter] = useState<DisasterCategory | "all">("all");
  const [outreachSort, setOutreachSort] = useState<OutreachSort>("urgency");

  // estimated_damage_usd is essentially never populated for live events —
  // neither the FEMA/NWS ingestion nor the AI analysis pass sets it — so
  // gating on a $500K damage figure alone left this permanently empty for
  // live data. interserv_score (AI-assigned per-event opportunity score,
  // 0-100) is what's actually populated and is a more direct fit anyway;
  // keep the damage threshold as an alternate qualifier for rows that do
  // have a real figure (historical/FEMA-enriched events).
  const qualifyingEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          e.status !== "resolved" &&
          ((e.estimated_damage_usd != null && e.estimated_damage_usd >= 500_000) ||
            (e.interserv_score != null && e.interserv_score >= 60))
      ),
    [events]
  );
  const eventIds = useMemo(() => qualifyingEvents.map((e) => e.id), [qualifyingEvents]);

  useEffect(() => {
    // No active qualifying events means nothing renders against contacts
    // anyway — no need to synchronously clear state here.
    if (eventIds.length === 0) return;
    supabase
      .from("event_contacts")
      .select("*")
      .in("event_id", eventIds)
      .in("target_company", ["interserv", "all"])
      .then(({ data, error }) => {
        if (error) console.error("Failed to load event_contacts", error);
        setContacts((data as EventContact[]) ?? []);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIds.join(",")]);

  const availableCategories = useMemo(
    () => Array.from(new Set(qualifyingEvents.map((e) => e.category))).sort(),
    [qualifyingEvents]
  );

  const outreachEvents = useMemo(() => {
    const filtered =
      categoryFilter === "all" ? qualifyingEvents : qualifyingEvents.filter((e) => e.category === categoryFilter);

    const sorted = [...filtered];
    switch (outreachSort) {
      case "urgency": {
        const rank = { now: 0, closing: 1, too_early: 2, too_late: 3 };
        return sorted.sort((a, b) => rank[outreachStatusFor(a)] - rank[outreachStatusFor(b)]);
      }
      case "score_desc":
        return sorted.sort((a, b) => (b.interserv_score ?? -1) - (a.interserv_score ?? -1));
      case "recent":
        return sorted.sort((a, b) => b.start_date.localeCompare(a.start_date));
      case "state_az":
        return sorted.sort((a, b) => (a.states_affected[0] ?? "").localeCompare(b.states_affected[0] ?? ""));
    }
  }, [qualifyingEvents, categoryFilter, outreachSort]);

  const churches = contacts.filter((c) => c.company_type === "church");

  const filteredContacts = useMemo(() => {
    let list = propertyType === "all" ? contacts : contacts.filter((c) => c.company_type === propertyType);
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    const sorted = [...list];
    switch (contactSort) {
      case "name_az":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "status":
        return sorted.sort((a, b) => a.status.localeCompare(b.status));
      case "state_az":
        return sorted.sort((a, b) => (a.state ?? "").localeCompare(b.state ?? ""));
    }
  }, [contacts, propertyType, statusFilter, contactSort]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-lg p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-foreground-muted">Renovation Outreach Timing</p>
            <div className="flex gap-2">
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
                value={outreachSort}
                onChange={(e) => setOutreachSort(e.target.value as OutreachSort)}
                className="glass-card rounded-md px-2 py-1 text-xs text-foreground"
              >
                {(Object.keys(OUTREACH_SORT_LABELS) as OutreachSort[]).map((option) => (
                  <option key={option} value={option}>
                    Sort: {OUTREACH_SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {outreachEvents.length === 0 ? (
            <p className="text-sm text-foreground-muted">No qualifying events right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {outreachEvents.map((event) => (
                <OutreachWindowCard
                  key={event.id}
                  event={event}
                  contacts={contacts.filter((c) => c.event_id === event.id)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            Geographic & Seasonal Focus
          </p>
          <SeasonalFocusPanel />
        </div>
      </div>

      <div className="glass-card rounded-lg p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-foreground-muted">
            Active Event Opportunities — surfaced properties
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as ContactCompanyType | "all")}
              className="glass-card rounded-md px-2 py-1 text-xs text-foreground"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ContactStatus | "all")}
              className="glass-card rounded-md px-2 py-1 text-xs text-foreground"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={contactSort}
              onChange={(e) => setContactSort(e.target.value as ContactSort)}
              className="glass-card rounded-md px-2 py-1 text-xs text-foreground"
            >
              {(Object.keys(CONTACT_SORT_LABELS) as ContactSort[]).map((option) => (
                <option key={option} value={option}>
                  Sort: {CONTACT_SORT_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ContactsList
          contacts={filteredContacts}
          emptyMessage="No properties surfaced yet — run the fetch-places edge function (needs GOOGLE_PLACES_API_KEY)."
        />
      </div>

      <div className="glass-card rounded-lg p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">Church Strategy Module</p>
        <p className="mb-2 text-xs text-foreground-muted">
          Recommended sequencing: SupplyX delivers materials first, Interserv follows with a renovation
          proposal once the relationship is established.
        </p>
        <ContactsList contacts={churches} emptyMessage="No churches surfaced yet." />
      </div>
    </div>
  );
}
