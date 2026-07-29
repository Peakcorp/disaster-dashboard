"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { DisasterEvent } from "@/types/event";
import type { EventContact, ContactCompanyType } from "@/types/company";
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

export function InterservTab({ events }: { events: DisasterEvent[] }) {
  const [contacts, setContacts] = useState<EventContact[]>([]);
  const [propertyType, setPropertyType] = useState<ContactCompanyType | "all">("all");

  const activeEvents = useMemo(
    () => events.filter((e) => e.status !== "resolved" && e.estimated_damage_usd != null && e.estimated_damage_usd >= 500_000),
    [events]
  );
  const eventIds = useMemo(() => activeEvents.map((e) => e.id), [activeEvents]);

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

  const sortedByOutreach = useMemo(() => {
    const rank = { now: 0, closing: 1, too_early: 2, too_late: 3 };
    return [...activeEvents].sort((a, b) => rank[outreachStatusFor(a)] - rank[outreachStatusFor(b)]);
  }, [activeEvents]);

  const churches = contacts.filter((c) => c.company_type === "church");
  const filteredContacts =
    propertyType === "all" ? contacts : contacts.filter((c) => c.company_type === propertyType);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-lg p-4 lg:col-span-2">
          <p className="mb-3 text-xs uppercase tracking-wide text-foreground-muted">
            Renovation Outreach Timing — sorted by urgency
          </p>
          {sortedByOutreach.length === 0 ? (
            <p className="text-sm text-foreground-muted">No qualifying events (≥$500K damage) right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedByOutreach.map((event) => (
                <OutreachWindowCard key={event.id} event={event} />
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
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-foreground-muted">
            Active Event Opportunities — surfaced properties
          </p>
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
