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
    <div className="relative flex flex-1">
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-foreground-muted">
            Loading live disaster data…
          </div>
        ) : (
          <DisasterMap events={events} onSelect={setSelected} />
        )}
        <EventDetailDrawer event={selected} onClose={() => setSelected(null)} />
      </div>

      <aside className="w-96 shrink-0 border-l border-white/10">
        <EventSidebar events={events} selectedId={selected?.id ?? null} onSelect={setSelected} />
      </aside>
    </div>
  );
}
