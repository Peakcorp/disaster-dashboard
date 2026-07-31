"use client";

import { useState } from "react";
import type { DisasterEvent, DisasterCategory, EventMaterial } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";
import { getMaterialPrice, formatMaterialPrice } from "@/lib/materialPrices";

interface CategoryMaterials {
  category: DisasterCategory;
  materials: string[];
}

function buildCategoryMaterials(events: DisasterEvent[], materials: EventMaterial[]): CategoryMaterials[] {
  const activeCategories = new Set(events.map((e) => e.category));
  const byCategory = new Map<DisasterCategory, string[]>();

  for (const material of materials) {
    if (!activeCategories.has(material.disaster_type)) continue;
    const list = byCategory.get(material.disaster_type) ?? [];
    if (!list.includes(material.material_name)) list.push(material.material_name);
    byCategory.set(material.disaster_type, list);
  }

  return Array.from(byCategory.entries())
    .map(([category, list]) => ({ category, materials: list.sort() }))
    .sort((a, b) => b.materials.length - a.materials.length);
}

export function MaterialPriceReference({
  events,
  materials,
}: {
  events: DisasterEvent[];
  materials: EventMaterial[];
}) {
  const [expanded, setExpanded] = useState<DisasterCategory | null>(null);
  const groups = buildCategoryMaterials(events, materials);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        No active events right now — check back next refresh cycle.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {groups.map((group) => {
          const isOpen = expanded === group.category;
          return (
            <li key={group.category} className="glass-card rounded-md p-3 text-sm">
              <button
                onClick={() => setExpanded(isOpen ? null : group.category)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <p className="text-foreground">{CATEGORY_LABELS[group.category]}</p>
                <span className="shrink-0 text-xs text-foreground-muted">
                  {group.materials.length} priced {isOpen ? "▲" : "▼"}
                </span>
              </button>

              {isOpen && (
                <ul className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2 text-xs">
                  {group.materials.map((name) => (
                    <li key={name} className="flex items-center justify-between gap-2">
                      <span className="text-foreground-muted">{name}</span>
                      <span className="shrink-0 text-foreground">{formatMaterialPrice(getMaterialPrice(name))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-foreground-muted">
        Approximate US market reference prices — not a live feed. Verify against a current supplier quote
        before use in an actual sourcing decision.
      </p>
    </div>
  );
}
