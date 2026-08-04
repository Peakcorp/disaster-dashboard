export type TabId = "live-map" | "historical" | "supplyx" | "interserv" | "insurance" | "predictions";

export interface TabDef {
  id: TabId;
  label: string;
  shortLabel: string;
  built: boolean;
}

export const TABS: TabDef[] = [
  { id: "live-map", label: "Live Disaster Map & Tracker", shortLabel: "Live Map", built: true },
  { id: "historical", label: "Historical Disaster Intelligence", shortLabel: "Historical", built: true },
  { id: "supplyx", label: "SupplyX Intelligence", shortLabel: "SupplyX", built: true },
  { id: "interserv", label: "Interserv LP Intelligence", shortLabel: "Interserv", built: true },
  { id: "insurance", label: "Insurance Claims Intelligence", shortLabel: "Insurance Claims", built: true },
  { id: "predictions", label: "Seasonal Risk Predictions", shortLabel: "Predictions", built: true },
];
