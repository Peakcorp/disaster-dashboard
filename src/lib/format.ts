import type { DisasterEvent } from "@/types/event";

export function formatUsd(value: number | null): string {
  if (value == null) return "Unknown";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "unknown";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_RANK: Record<DisasterEvent["status"], number> = {
  critical: 3,
  developing: 2,
  monitoring: 1,
  resolved: 0,
};

// Placeholder composite severity ranking until Phase 2 AI scoring lands.
// Ranks by status tier first, then damage estimate, then recency.
export function severityRank(event: DisasterEvent): number {
  const statusScore = STATUS_RANK[event.status] * 1_000_000_000_000;
  const damageScore = event.estimated_damage_usd ?? 0;
  const recencyScore = new Date(event.start_date).getTime() / 1e15;
  return statusScore + damageScore + recencyScore;
}

export function sortBySeverity(events: DisasterEvent[]): DisasterEvent[] {
  return [...events].sort((a, b) => severityRank(b) - severityRank(a));
}

// --- Grouping: NWS issues many overlapping alerts for the same underlying
// situation — a single heat wave produces separate "Extreme Heat Watch" and
// "Excessive Heat Warning" products, each re-issued per county/zone. Users
// think of these as one matter ("the heat situation in Montana"), not one
// row per product text, so the group key deliberately drops sub_type and
// groups by category + primary state only.
export interface EventGroup {
  key: string;
  category: DisasterEvent["category"];
  subType: string | null;
  primaryState: string;
  events: DisasterEvent[];
}

export function groupEvents(events: DisasterEvent[]): EventGroup[] {
  const groups = new Map<string, EventGroup>();
  for (const event of events) {
    const primaryState = event.states_affected[0] ?? "Multi-state";
    const key = `${event.category}::${primaryState}`;
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(key, { key, category: event.category, subType: event.sub_type, primaryState, events: [event] });
    }
  }
  return Array.from(groups.values());
}

export function groupSeverityRank(group: EventGroup): number {
  return Math.max(...group.events.map(severityRank));
}

export function groupLatestUpdate(group: EventGroup): string | null {
  return groupLatestEvent(group).last_fetched_at;
}

export function groupLatestEvent(group: EventGroup): DisasterEvent {
  return group.events.reduce((latest, e) => {
    if (!e.last_fetched_at) return latest;
    if (!latest.last_fetched_at || e.last_fetched_at > latest.last_fetched_at) return e;
    return latest;
  }, group.events[0]);
}

export function groupHasUpdate(group: EventGroup): boolean {
  return group.events.some((e) => e.is_updated_since_last_refresh);
}

const GROUP_STATUS_RANK = STATUS_RANK;

export function groupMaxStatus(group: EventGroup): DisasterEvent["status"] {
  return group.events.reduce(
    (max, e) => (GROUP_STATUS_RANK[e.status] > GROUP_STATUS_RANK[max] ? e.status : max),
    group.events[0].status
  );
}

export function sortGroupsBySeverity(groups: EventGroup[]): EventGroup[] {
  return [...groups].sort((a, b) => groupSeverityRank(b) - groupSeverityRank(a));
}
