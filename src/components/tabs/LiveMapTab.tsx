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
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-foreground-muted">
            Loading live disaster data…
          </div>
        ) : (
          <DisasterMap events={events} onSelect={setSelected} />
        )}
        <EventDetailDrawer event={selected} onClose={() => setSelected(null)} />
      </div>

      <aside className="flex w-96 shrink-0 flex-col border-l border-white/10">
        <EventSidebar events={events} selectedId={selected?.id ?? null} onSelect={setSelected} />
      </aside>
    </div>
  );
}
