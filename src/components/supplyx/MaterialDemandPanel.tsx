"use client";

import type { DisasterEvent, EventMaterial } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";

export function MaterialDemandPanel({
  event,
  materials,
}: {
  event: DisasterEvent;
  materials: EventMaterial[];
}) {
  const destroyed = materials.filter((m) => m.category === "destroyed");
  const consumed = materials.filter((m) => m.category === "consumed");

  return (
    <div className="glass-card rounded-lg p-3">
      <p className="text-sm font-medium text-foreground">{event.name}</p>
      <p className="mb-2 text-xs text-foreground-muted">{CATEGORY_LABELS[event.category]}</p>

      {destroyed.length === 0 && consumed.length === 0 ? (
        <p className="text-xs text-foreground-muted">No material classification yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-critical">🔴 Destroyed</p>
            <ul className="flex flex-wrap gap-1">
              {destroyed.map((m) => (
                <li key={m.id} className="rounded bg-critical/10 px-2 py-0.5 text-xs text-foreground">
                  {m.material_name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-warning">🟡 Consumed</p>
            <ul className="flex flex-wrap gap-1">
              {consumed.map((m) => (
                <li key={m.id} className="rounded bg-warning/10 px-2 py-0.5 text-xs text-foreground">
                  {m.material_name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
