import type { DisasterEvent, DisasterCategory } from "@/types/event";
import { compareRollingFiveYear, buildYearlyTrend } from "./historical";

// Seasonal risk forecasting: this is a statistical/climatological estimate
// derived entirely from this project's own 10-year historical archive — NOT
// a deterministic prediction of a specific storm/fire/flood at a specific
// place or date. No free data source can do that, and pretending otherwise
// would be dishonest. What IS defensible from 10 years of real event data:
// which disaster categories and states see disproportionately more activity
// in the same 3-month window in past years, and whether that activity has
// been trending up or down recently. That's what every number here means.

export interface StateFrequency {
  state: string;
  count: number;
}

export type RiskLevel = "elevated" | "moderate" | "baseline" | "low-data";

export interface SeasonalRiskForecast {
  category: DisasterCategory;
  windowLabel: string; // e.g. "Aug-Oct"
  totalEventsLast10Yr: number;
  eventsInWindowLast10Yr: number;
  windowSharePct: number; // 0-1, share of the category's 10yr events falling in this window
  yearsWithData: number;
  avgEventsPerWindow: number; // expected event count in an upcoming matching window
  trendDirection: "up" | "down" | "flat" | "unknown";
  trendRecentAvg: number | null;
  trendPriorAvg: number | null;
  topStates: StateFrequency[];
  riskLevel: RiskLevel;
  riskScore: number; // for sorting only, not shown directly
  sampleEvents: DisasterEvent[]; // the actual window events, for an audit trail
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MIN_EVENTS_FOR_CONFIDENCE = 8;
// A random 3-month slice of a year would "expect" 25% of events to land in
// it; this is the baseline a window's share is compared against to call it
// disproportionately concentrated rather than just noise.
const RANDOM_WINDOW_SHARE = 0.25;

function windowMonthsFrom(referenceDate: Date): number[] {
  const start = referenceDate.getUTCMonth();
  return [0, 1, 2].map((offset) => (start + offset) % 12);
}

export function computeSeasonalRiskForecasts(
  events: DisasterEvent[],
  referenceDate: Date = new Date()
): SeasonalRiskForecast[] {
  const cutoffYear = referenceDate.getUTCFullYear() - 10;
  const last10Yr = events.filter((e) => new Date(e.start_date).getUTCFullYear() >= cutoffYear);

  const windowMonths = windowMonthsFrom(referenceDate);
  const windowLabel = `${MONTH_NAMES[windowMonths[0]]}-${MONTH_NAMES[windowMonths[2]]}`;

  const byCategory = new Map<DisasterCategory, DisasterEvent[]>();
  for (const event of last10Yr) {
    const arr = byCategory.get(event.category) ?? [];
    arr.push(event);
    byCategory.set(event.category, arr);
  }

  const forecasts: SeasonalRiskForecast[] = [];

  for (const [category, categoryEvents] of byCategory) {
    const totalEventsLast10Yr = categoryEvents.length;
    const yearsWithData = new Set(categoryEvents.map((e) => new Date(e.start_date).getUTCFullYear())).size;

    const windowEvents = categoryEvents.filter((e) =>
      windowMonths.includes(new Date(e.start_date).getUTCMonth())
    );
    const eventsInWindowLast10Yr = windowEvents.length;
    const windowSharePct = totalEventsLast10Yr > 0 ? eventsInWindowLast10Yr / totalEventsLast10Yr : 0;
    const avgEventsPerWindow = eventsInWindowLast10Yr / Math.max(1, yearsWithData);

    const yearlyTrend = buildYearlyTrend(categoryEvents);
    const trend = compareRollingFiveYear(yearlyTrend);
    const trendDirection = trend?.direction ?? "unknown";

    // Counts every state an event lists, not just the first — many
    // historical entries name a whole region ("Midwest/Plains/Southeast
    // Tornadoes"), and undercounting to one state per event would bury
    // real multi-state footprints.
    const stateCounts = new Map<string, number>();
    for (const event of windowEvents) {
      for (const state of event.states_affected) {
        stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
      }
    }
    const topStates = Array.from(stateCounts.entries())
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    let riskLevel: RiskLevel;
    if (totalEventsLast10Yr < MIN_EVENTS_FOR_CONFIDENCE) {
      riskLevel = "low-data";
    } else if (windowSharePct >= RANDOM_WINDOW_SHARE * 1.6 && trendDirection !== "down") {
      riskLevel = "elevated";
    } else if (windowSharePct >= RANDOM_WINDOW_SHARE * 1.2) {
      riskLevel = "moderate";
    } else {
      riskLevel = "baseline";
    }

    const relativeConcentration = windowSharePct / RANDOM_WINDOW_SHARE;
    const trendMultiplier = trendDirection === "up" ? 1.15 : trendDirection === "down" ? 0.85 : 1.0;
    const riskScore =
      riskLevel === "low-data" ? -1 : avgEventsPerWindow * relativeConcentration * trendMultiplier;

    forecasts.push({
      category,
      windowLabel,
      totalEventsLast10Yr,
      eventsInWindowLast10Yr,
      windowSharePct,
      yearsWithData,
      avgEventsPerWindow,
      trendDirection,
      trendRecentAvg: trend?.recentAvg ?? null,
      trendPriorAvg: trend?.priorAvg ?? null,
      topStates,
      riskLevel,
      riskScore,
      sampleEvents: windowEvents,
    });
  }

  return forecasts.sort((a, b) => b.riskScore - a.riskScore);
}
