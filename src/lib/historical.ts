import type { DisasterEvent, DisasterCategory } from "@/types/event";
import { CATEGORY_LABELS } from "@/types/event";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface CalendarCell {
  category: DisasterCategory;
  month: number; // 0-11
  count: number;
}

// Predictive calendar: frequency of each disaster category by calendar month,
// across all historical events. Used to answer "which months are highest-risk
// for which disaster type."
export function buildPredictiveCalendar(events: DisasterEvent[]): {
  categories: DisasterCategory[];
  cells: CalendarCell[];
  maxCount: number;
} {
  const counts = new Map<string, number>();
  const categoriesSeen = new Set<DisasterCategory>();

  for (const event of events) {
    const month = new Date(event.start_date).getUTCMonth();
    const key = `${event.category}-${month}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    categoriesSeen.add(event.category);
  }

  const categories = Array.from(categoriesSeen).sort((a, b) =>
    CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b])
  );

  const cells: CalendarCell[] = [];
  let maxCount = 0;
  for (const category of categories) {
    for (let month = 0; month < 12; month++) {
      const count = counts.get(`${category}-${month}`) ?? 0;
      cells.push({ category, month, count });
      if (count > maxCount) maxCount = count;
    }
  }

  return { categories, cells, maxCount };
}

export { MONTH_NAMES };

export interface SeasonalAlert {
  category: DisasterCategory;
  peakMonths: string;
  peakShare: number; // 0-1, share of all events in that category occurring in the peak window
  totalEvents: number;
}

// "Hurricane season peaks in Gulf Coast: August-October. Based on N-year
// history, X% of events occur in this window." — auto-generated from
// whichever 3-consecutive-month window captures the most events per category.
export function computeSeasonalAlerts(events: DisasterEvent[]): SeasonalAlert[] {
  const byCategory = new Map<DisasterCategory, number[]>();
  for (const event of events) {
    const month = new Date(event.start_date).getUTCMonth();
    const arr = byCategory.get(event.category) ?? new Array(12).fill(0);
    arr[month]++;
    byCategory.set(event.category, arr);
  }

  const alerts: SeasonalAlert[] = [];
  for (const [category, monthCounts] of byCategory) {
    const total = monthCounts.reduce((a, b) => a + b, 0);
    if (total < 4) continue; // not enough data to claim a seasonal pattern

    let bestStart = 0;
    let bestSum = -1;
    for (let start = 0; start < 12; start++) {
      const sum = [0, 1, 2].reduce((acc, offset) => acc + monthCounts[(start + offset) % 12], 0);
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = start;
      }
    }

    const peakShare = bestSum / total;
    if (peakShare < 0.5) continue; // no meaningful concentration

    const monthLabels = [0, 1, 2].map((offset) => MONTH_NAMES[(bestStart + offset) % 12]);
    alerts.push({
      category,
      peakMonths: `${monthLabels[0]}-${monthLabels[2]}`,
      peakShare,
      totalEvents: total,
    });
  }

  return alerts.sort((a, b) => b.peakShare - a.peakShare);
}

export interface YearlyTrend {
  year: number;
  count: number;
}

export function buildYearlyTrend(events: DisasterEvent[]): YearlyTrend[] {
  const counts = new Map<number, number>();
  for (const event of events) {
    const year = new Date(event.start_date).getUTCFullYear();
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
}

// 5-year rolling average (most recent 5 full years) vs. the prior 5-year
// average — "is frequency increasing or decreasing?"
export function compareRollingFiveYear(trend: YearlyTrend[]): {
  recentAvg: number;
  priorAvg: number;
  direction: "up" | "down" | "flat";
} | null {
  if (trend.length < 6) return null;
  const years = trend.slice(-10);
  if (years.length < 10) return null;

  const prior = years.slice(0, 5);
  const recent = years.slice(5, 10);
  const priorAvg = prior.reduce((sum, y) => sum + y.count, 0) / 5;
  const recentAvg = recent.reduce((sum, y) => sum + y.count, 0) / 5;

  const direction = recentAvg > priorAvg * 1.1 ? "up" : recentAvg < priorAvg * 0.9 ? "down" : "flat";
  return { recentAvg, priorAvg, direction };
}
