"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { PropertyReceivership, ReceivershipStatus } from "@/types/company";
import { formatRelativeTime } from "@/lib/format";

const STATUS_LABELS: Record<ReceivershipStatus, string> = {
  reported: "Reported (unverified)",
  confirmed: "Confirmed",
  resolved: "Resolved",
};

const STATUS_STYLES: Record<ReceivershipStatus, string> = {
  reported: "bg-warning/15 text-warning border-warning/30",
  confirmed: "bg-critical/15 text-critical border-critical/30",
  resolved: "bg-white/5 text-foreground-muted border-white/10",
};

const EMPTY_FORM = { property_name: "", address: "", state: "", news_url: "", notes: "" };

export function ReceivershipTab() {
  const [entries, setEntries] = useState<PropertyReceivership[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }

  useEffect(load, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.property_name.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.from("property_receiverships").insert({
      property_name: form.property_name.trim(),
      address: form.address.trim() || null,
      state: form.state.trim().toUpperCase() || null,
      news_url: form.news_url.trim() || null,
      notes: form.notes.trim() || null,
      receivership_status: "reported",
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(EMPTY_FORM);
    load();
  }

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
        <p className="text-xs uppercase tracking-wide text-ai">Receivership Tracker</p>
        <p className="mt-2 text-sm text-foreground-muted">
          There is no free API or reliable automated way to detect whether a specific commercial property has
          gone into receivership — court filings and receivership news are sparse and property-specific (a
          general search for disaster-linked receivership cases turned up nothing usable). This list is
          populated manually as the team finds real cases, same as the Referral Partner Database — add an entry
          below with a source link when you learn of one.
        </p>
      </div>

      <form onSubmit={submit} className="glass-card flex flex-col gap-2 rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-foreground-muted">Add a reported case</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            required
            placeholder="Property name *"
            value={form.property_name}
            onChange={(e) => setForm((f) => ({ ...f, property_name: e.target.value }))}
            className="glass-card rounded-md px-2 py-1.5 text-sm text-foreground placeholder:text-foreground-muted"
          />
          <input
            placeholder="State (e.g. FL)"
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            className="glass-card rounded-md px-2 py-1.5 text-sm text-foreground placeholder:text-foreground-muted"
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="glass-card rounded-md px-2 py-1.5 text-sm text-foreground placeholder:text-foreground-muted sm:col-span-2"
          />
          <input
            placeholder="News/source URL"
            value={form.news_url}
            onChange={(e) => setForm((f) => ({ ...f, news_url: e.target.value }))}
            className="glass-card rounded-md px-2 py-1.5 text-sm text-foreground placeholder:text-foreground-muted sm:col-span-2"
          />
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="glass-card rounded-md px-2 py-1.5 text-sm text-foreground placeholder:text-foreground-muted sm:col-span-2"
            rows={2}
          />
        </div>
        {error && <p className="text-xs text-critical">Failed to add entry: {error}</p>}
        <button
          type="submit"
          disabled={submitting || !form.property_name.trim()}
          className="glass-card self-start rounded-md px-3 py-1.5 text-sm text-live transition hover:brightness-125 disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add entry"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-foreground-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-foreground-muted">No receivership cases logged yet.</p>
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
                    <option key={s} value={s} className="bg-background text-foreground normal-case">
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
                <span className="text-foreground-muted">Added {formatRelativeTime(entry.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
