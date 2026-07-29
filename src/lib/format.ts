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
