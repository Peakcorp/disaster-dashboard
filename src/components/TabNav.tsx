"use client";

import { TABS, type TabId } from "@/types/tabs";

export function TabNav({
  active,
  onSelect,
}: {
  active: TabId;
  onSelect: (id: TabId) => void;
}) {
  return (
    <nav className="glass-card flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition ${
            active === tab.id
              ? "bg-live/15 text-live"
              : "text-foreground-muted hover:bg-white/5 hover:text-foreground"
          }`}
        >
          {tab.shortLabel}
          {!tab.built && (
            <span className="ml-1.5 rounded bg-white/10 px-1 py-0.5 text-[9px] uppercase tracking-wide text-foreground-muted">
              Soon
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
