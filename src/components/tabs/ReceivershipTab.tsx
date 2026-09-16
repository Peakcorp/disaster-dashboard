"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { PropertyReceivership, ReceivershipStatus } from "@/types/company";
import { formatRelativeTime } from "@/lib/format";

const STATUS_LABELS: Record<ReceivershipStatus, string> = {
  reported: "Reported (auto-found, unverified)",
  confirmed: "Confirmed",
  resolved: "Resolved",
};

const STATUS_STYLES: Record<ReceivershipStatus, string> = {
  reported: "bg-warning/15 text-warning border-warning/30",
  confirmed: "bg-critical/15 text-critical border-critical/30",
  resolved: "bg-white/5 text-foreground-muted border-white/10",
};

export function ReceivershipTab() {
  const [entries, setEntries] = useState<PropertyReceivership[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedCount, setCheckedCount] = useState<number | null>(null);
  const [totalCandidates, setTotalCandidates] = useState<number | null>(null);

  function load() {
    supabase
      .from("property_receiverships")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load property_receiverships", error);
        setEntries((data as PropertyReceivership[]) ?? []);
        setLoading(false);
      });

    supabase
      .from("event_contacts")
      .select("id", { count: "exact", head: true })
      .in("company_type", ["hotel", "office", "mixed_use", "apartment"])
      .then(({ count }) => setTotalCandidates(count ?? 0));

    supabase
      .from("event_contacts")
      .select("id", { count: "exact", head: true })
      .in("company_type", ["hotel", "office", "mixed_use", "apartment"])
      .not("receivership_checked_at", "is", null)
      .then(({ count }) => setCheckedCount(count ?? 0));
  }

  useEffect(load, []);

  async function updateStatus(id: string, status: ReceivershipStatus) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, receivership_status: status } : e)));
    const { error } = await supabase.from("property_receiverships").update({ receivership_status: status }).eq("id", id);
    if (error) {
      console.error("Failed to update receivership status", error);
      load();
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="glass-card rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-ai">Receivership Tracker — Auto-Searched</p>
        <p className="mt-2 text-sm text-foreground-muted">
          This list is populated automatically: a daily job searches the web for receivership, foreclosure, and
          financial-distress news about the commercial properties (hotels, offices, apartments, mixed-use)
          Interserv has surfaced, and only records a property here when something real actually turns up. Most
          properties will find nothing — that&apos;s expected, not a gap, since receivership is genuinely rare.
          Status is &quot;Reported (auto-found, unverified)&quot; until someone confirms it against the source.
        </p>
        {totalCandidates != null && checkedCount != null && (
          <p className="mt-2 text-xs text-foreground-muted">
            {checkedCount.toLocaleString()} of {totalCandidates.toLocaleString()} candidate properties checked so
            far ({(totalCandidates - checkedCount).toLocaleString()} remaining in the queue).
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-foreground-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          No receivership cases found yet — either the search hasn&apos;t worked through the queue yet, or
          nothing has turned up so far.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="glass-card rounded-lg p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-foreground">{entry.property_name}</p>
                  <p className="text-xs text-foreground-muted">
                    {[entry.address, entry.state].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <select
                  value={entry.receivership_status}
                  onChange={(e) => updateStatus(entry.id, e.target.value as ReceivershipStatus)}
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase ${STATUS_STYLES[entry.receivership_status]}`}
                >
                  {(Object.keys(STATUS_LABELS) as ReceivershipStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              {entry.notes && <p className="mt-2 text-xs text-foreground-muted">{entry.notes}</p>}
              <div className="mt-2 flex items-center gap-3 text-xs">
                {entry.news_url && (
                  <a href={entry.news_url} target="_blank" rel="noopener noreferrer" className="text-live hover:underline">
                    Source →
                  </a>
                )}
                <span className="text-foreground-muted">Found {formatRelativeTime(entry.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
