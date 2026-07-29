export type DisasterCategory =
  | "hurricane"
  | "tornado"
  | "wildfire"
  | "flood"
  | "winter_storm"
  | "earthquake"
  | "landslide"
  | "hail"
  | "extreme_heat"
  | "man_made";

export type EventStatus = "critical" | "developing" | "monitoring" | "resolved";

export type ConfidenceScore = "HIGH" | "MEDIUM" | "LOW";

export type GovtSupportLevel = "full" | "partial" | "none" | null;

export interface DisasterEvent {
  id: string;
  name: string;
  category: DisasterCategory;
  sub_type: string | null;
  status: EventStatus;
  start_date: string;
  end_date: string | null;
  fema_region: string | null;
  states_affected: string[];
  counties: string[];
  lat: number | null;
  lng: number | null;
  estimated_damage_usd: number | null;
  insured_loss_usd: number | null;
  federal_aid_usd: number | null;
  govt_support_level: GovtSupportLevel;
  fatalities: number | null;
  confidence_score: ConfidenceScore;
  source_data_hash: string | null;
  last_fetched_at: string | null;
  supplyx_score: number | null;
  interserv_score: number | null;
  insurance_claims_score: number | null;
  ai_summary: string | null;
  ai_generated_at: string | null;
  is_updated_since_last_refresh: boolean;
  is_historical_seed: boolean;
  insurance_claims_filed_est: number | null;
  rebuilding_timeline_months: number | null;
  price_behavior_notes: string | null;
  notable_recovery_companies: string | null;
  created_at: string;
}

export type MaterialCategory = "destroyed" | "consumed";

export interface EventMaterial {
  id: string;
  event_id: string;
  material_name: string;
  category: MaterialCategory;
  proximity_band: "0-1mi" | "1-5mi" | "5-10mi" | null;
  disaster_type: DisasterCategory;
  notes: string | null;
}

export interface NewsArticle {
  id: string;
  event_id: string | null;
  source: string;
  headline: string;
  url: string;
  published_at: string | null;
  confidence_contribution: string | null;
}

export const CATEGORY_LABELS: Record<DisasterCategory, string> = {
  hurricane: "Hurricane / Tropical Storm",
  tornado: "Tornado",
  wildfire: "Wildfire",
  flood: "Flood / Flash Flood",
  winter_storm: "Winter Storm / Freeze",
  earthquake: "Earthquake",
  landslide: "Landslide",
  hail: "Hail Storm",
  extreme_heat: "Extreme Heat",
  man_made: "Man-Made Disaster",
};

export const STATUS_COLOR: Record<EventStatus, string> = {
  critical: "var(--color-critical)",
  developing: "var(--color-warning)",
  monitoring: "#eab308",
  resolved: "#6b7280",
};
