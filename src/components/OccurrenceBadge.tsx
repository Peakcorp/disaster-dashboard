import type { DisasterEvent } from "@/types/event";
import { occurrenceStatusFor, OCCURRENCE_LABEL, OCCURRENCE_STYLES } from "@/lib/occurrence";

export function OccurrenceBadge({ event }: { event: DisasterEvent }) {
  const status = occurrenceStatusFor(event);
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${OCCURRENCE_STYLES[status]}`}
    >
      {OCCURRENCE_LABEL[status]}
    </span>
  );
}
