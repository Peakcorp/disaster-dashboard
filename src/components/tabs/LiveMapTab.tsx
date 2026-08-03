"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { DisasterEvent } from "@/types/event";
import { EventSidebar } from "@/components/EventSidebar";
import { EventDetailDrawer } from "@/components/EventDetailDrawer";

const DisasterMap = dynamic(
  () => import("@/components/DisasterMap").then((m) => m.DisasterMap),
  { ssr: false }
);

export function LiveMapTab({ events, loading }: { events: DisasterEvent[]; loading: boolean }) {
  const [selected, setSelected] = useState<DisasterEvent | null>(null);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      {/* Below md, the map gets a fixed share of the viewport (not flex-1)
          so the sidebar — the second flex-col child — still gets room to
          take the rest and scroll independently, matching the side-by-side
          behavior at md+ where the map is flex-1 in a row instead. */}
      <div className="relative h-[42vh] shrink-0 md:h-auto md:min-h-0 md:flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-foreground-muted">
            Loading live disaster data…
          </div>
        ) : (
          <DisasterMap events={events} onSelect={setSelected} />
        )}
        <EventDetailDrawer event={selected} onClose={() => setSelected(null)} />
      </div>

      <aside className="flex min-h-0 flex-1 flex-col border-t border-white/10 md:w-96 md:flex-none md:border-l md:border-t-0">
        <EventSidebar events={events} selectedId={selected?.id ?? null} onSelect={setSelected} />
      </aside>
    </div>
  );
}
