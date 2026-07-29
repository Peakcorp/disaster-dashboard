"use client";

import type { DisasterEvent } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { formatRelativeTime, formatUsd } from "@/lib/format";

export function EventDetailDrawer({
  event,
  onClose,
}: {
  event: DisasterEvent | null;
  onClose: () => void;
}) {
  if (!event) return null;

  return (
    <div className="glass-card absolute right-0 top-0 z-[1000] h-full w-full max-w-sm overflow-y-auto p-5 shadow-2xl">
      <button
        onClick={onClose}
        className="mb-4 text-xs text-foreground-muted hover:text-foreground"
      >
        Close ✕
      </button>

      <h2 className="text-lg font-semibold text-foreground">{event.name}</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        {CATEGORY_LABELS[event.category]} · {event.sub_type ?? "—"}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-foreground-muted">Status</dt>
          <dd className="capitalize text-foreground">{event.status}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Confidence</dt>
          <dd className="text-foreground">{event.confidence_score}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Estimated damage</dt>
          <dd className="text-foreground">{formatUsd(event.estimated_damage_usd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">FEMA region</dt>
          <dd className="text-foreground">{event.fema_region ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">States affected</dt>
          <dd className="text-foreground">{event.states_affected.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Counties</dt>
          <dd className="text-foreground">{event.counties.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Federal support</dt>
          <dd className="capitalize text-foreground">{event.govt_support_level ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Last updated</dt>
          <dd className="text-foreground">{formatRelativeTime(event.last_fetched_at)}</dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-wide text-ai">AI briefing</p>
        <p className="mt-1 text-sm text-foreground-muted">
          {event.ai_summary ?? "AI narrative generation lands in Phase 2 — not yet enabled."}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="glass-card rounded p-2">
          <p className="text-foreground-muted">SupplyX</p>
          <p className="text-opportunity">{event.supplyx_score ?? "—"}</p>
        </div>
        <div className="glass-card rounded p-2">
          <p className="text-foreground-muted">Interserv</p>
          <p className="text-opportunity">{event.interserv_score ?? "—"}</p>
        </div>
        <div className="glass-card rounded p-2">
          <p className="text-foreground-muted">Insurance</p>
          <p className="text-opportunity">{event.insurance_claims_score ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
