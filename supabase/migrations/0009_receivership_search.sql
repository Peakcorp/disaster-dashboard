-- Tracks which surfaced properties (Interserv's event_contacts) have
-- already been checked by search-receivership, so the daily batch job
-- advances through the backlog instead of re-querying the same ones —
-- same reasoning as fetch-places' already-processed exclusion.
alter table event_contacts
  add column if not exists receivership_checked_at timestamptz;

create index if not exists event_contacts_receivership_checked_idx
  on event_contacts (receivership_checked_at);

-- property_receiverships is now populated only by the automated
-- search-receivership edge function (service-role key), not by users
-- through the app — replace the public "for all" write policy from
-- migration 0008 with read-only public access.
drop policy if exists "property_receiverships are publicly writable" on property_receiverships;
