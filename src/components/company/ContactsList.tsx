"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { EventContact, ContactCompanyType, ContactStatus } from "@/types/company";

const TYPE_LABELS: Record<ContactCompanyType, string> = {
  church: "Church",
  hotel: "Hotel / Resort",
  apartment: "Apartment Complex",
  office: "Office / Commercial",
  mixed_use: "Mixed-Use",
  contractor: "General Contractor",
  restoration_company: "Restoration Company",
  property_management: "Property Management",
};

const STATUS_OPTIONS: ContactStatus[] = ["not_contacted", "contacted", "engaged", "referred", "closed"];

const STATUS_STYLES: Record<ContactStatus, string> = {
  not_contacted: "bg-white/5 text-foreground-muted",
  contacted: "bg-warning/15 text-warning",
  engaged: "bg-live/15 text-live",
  referred: "bg-ai/15 text-ai",
  closed: "bg-opportunity/15 text-opportunity",
};

export function ContactsList({
  contacts,
  emptyMessage,
}: {
  contacts: EventContact[];
  emptyMessage: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ContactStatus>>({});
  const [errorId, setErrorId] = useState<string | null>(null);

  async function updateStatus(contact: EventContact, next: ContactStatus) {
    const current = statusOverrides[contact.id] ?? contact.status;
    setStatusOverrides((prev) => ({ ...prev, [contact.id]: next }));
    setErrorId(null);
    const { error } = await supabase.from("event_contacts").update({ status: next }).eq("id", contact.id);
    if (error) {
      console.error("Failed to update contact status", error);
      setStatusOverrides((prev) => ({ ...prev, [contact.id]: current })); // revert on failure
      setErrorId(contact.id);
    }
  }

  if (contacts.length === 0) {
    return <p className="text-sm text-foreground-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {contacts.map((contact) => {
        const status = statusOverrides[contact.id] ?? contact.status;
        const expanded = expandedId === contact.id;
        return (
          <li key={contact.id} className="glass-card rounded-md p-3 text-sm">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedId(expanded ? null : contact.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setExpandedId(expanded ? null : contact.id);
              }}
              className="flex w-full cursor-pointer items-start justify-between gap-2 text-left"
            >
              <div>
                <p className="text-foreground">{contact.name}</p>
                <p className="text-xs text-foreground-muted">{TYPE_LABELS[contact.company_type]}</p>
                {contact.address && <p className="mt-0.5 text-xs text-foreground-muted">{contact.address}</p>}
              </div>
              <select
                value={status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateStatus(contact, e.target.value as ContactStatus)}
                title="Referral status"
                className={`shrink-0 rounded border-none px-1.5 py-0.5 text-[10px] uppercase transition hover:brightness-125 ${STATUS_STYLES[status]}`}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-background text-foreground normal-case">
                    {option.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-muted">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} onClick={(e) => e.stopPropagation()} className="text-live hover:underline">
                  {contact.phone}
                </a>
              )}
              {contact.website && (
                <a
                  href={contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-live hover:underline"
                >
                  Website
                </a>
              )}
              {!contact.phone && !contact.website && <span>No phone/website on file</span>}
            </div>

            {errorId === contact.id && (
              <p className="mt-1 text-xs text-critical">
                Status update failed — the database may need the write-access migration applied.
              </p>
            )}

            {expanded && (
              <div className="mt-2 border-t border-white/10 pt-2 text-xs text-foreground-muted">
                <p>State: {contact.state ?? "—"}</p>
                <p>City: {contact.city ?? "—"}</p>
                {contact.lat != null && contact.lng != null && (
                  <p>
                    Coordinates: {contact.lat.toFixed(4)}, {contact.lng.toFixed(4)}
                  </p>
                )}
                {contact.notes && <p>Notes: {contact.notes}</p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
