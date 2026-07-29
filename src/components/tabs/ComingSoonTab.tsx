import type { TabDef } from "@/types/tabs";

const PHASE_NOTE: Record<string, string> = {
  historical: "Lands in Phase 2, seeded from FEMA declarations + NOAA's Billion-Dollar Disaster dataset.",
  supplyx: "Lands in Phase 3: material demand forecasting, procurement alerts, FRED/BLS price charts.",
  interserv: "Lands in Phase 3: commercial/institutional renovation opportunity scoring and outreach timing.",
  insurance: "Lands in Phase 3: legal lead scoring, referral partner database, state regulatory intelligence.",
};

export function ComingSoonTab({ tab }: { tab: TabDef }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-lg font-medium text-foreground">{tab.label}</p>
      <p className="max-w-md text-sm text-foreground-muted">
        {PHASE_NOTE[tab.id] ?? "Not built yet."}
      </p>
    </div>
  );
}
