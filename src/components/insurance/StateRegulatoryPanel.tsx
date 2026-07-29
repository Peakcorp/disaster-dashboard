"use client";

import type { StateRegulatoryInfo } from "@/types/company";

export function StateRegulatoryPanel({
  info,
  statesInScope,
}: {
  info: StateRegulatoryInfo[];
  statesInScope: string[];
}) {
  const byState = new Map(info.map((i) => [i.state_code, i]));

  if (statesInScope.length === 0) {
    return <p className="text-sm text-foreground-muted">No active states to check right now.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-foreground-muted">
        Not legal advice — general reference only. Statutes change; verify current law with counsel before
        acting.
      </p>
      {statesInScope.map((state) => {
        const row = byState.get(state);
        return (
          <div key={state} className="glass-card rounded-md p-3 text-sm">
            <p className="text-foreground">{state}</p>
            {row ? (
              <>
                <p className="text-xs text-foreground-muted">
                  Referral fee permitted: {row.referral_fee_permitted ?? "unknown"}
                  {row.referral_fee_note ? ` — ${row.referral_fee_note}` : ""}
                </p>
                <p className="text-xs text-foreground-muted">
                  Statute of limitations:{" "}
                  {row.statute_of_limitations_years != null
                    ? `${row.statute_of_limitations_years} years`
                    : "not entered"}
                  {row.statute_of_limitations_note ? ` — ${row.statute_of_limitations_note}` : ""}
                </p>
                {row.doi_contact && (
                  <p className="text-xs text-foreground-muted">DOI contact: {row.doi_contact}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-foreground-muted">
                Not entered yet — add via Table Editor →{" "}
                <code className="text-live">state_regulatory_info</code>.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
