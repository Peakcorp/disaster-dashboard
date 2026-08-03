"use client";

import { useEffect, useState } from "react";
import type { DisasterEvent, NewsArticle } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { formatRelativeTime, formatUsd } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

export function EventDetailDrawer({
  event,
  onClose,
}: {
  event: DisasterEvent | null;
  onClose: () => void;
}) {
  const [news, setNews] = useState<NewsArticle[]>([]);

  useEffect(() => {
    if (!event) return;
    supabase
      .from("news_articles")
      .select("*")
      .eq("event_id", event.id)
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load news_articles", error);
        setNews((data as NewsArticle[]) ?? []);
      });
  }, [event]);

  if (!event) return null;

  return (
    // Fixed full-screen below md — the map's own container is only ~42vh
    // tall on mobile (see LiveMapTab), so an absolutely-positioned panel
    // confined to that box would be too cramped for the AI briefing/news
    // content. At md+ it reverts to the original inset panel over the map.
    <div
      className="fixed inset-0 z-[1000] overflow-y-auto p-5 shadow-2xl md:absolute md:inset-auto md:right-0 md:top-0 md:h-full md:w-full md:max-w-sm md:border-l md:border-white/10"
      style={{ background: "rgba(8, 12, 24, 0.97)", backdropFilter: "blur(12px)" }}
    >
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

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-wide text-foreground-muted">Related news</p>
        {news.length === 0 ? (
          <p className="mt-1 text-sm text-foreground-muted">No linked articles for this event yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {news.map((article) => (
              <li key={article.id}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-live hover:underline"
                >
                  {article.headline}
                </a>
                <p className="text-xs text-foreground-muted">
                  {article.source}
                  {article.published_at ? ` · ${formatRelativeTime(article.published_at)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
