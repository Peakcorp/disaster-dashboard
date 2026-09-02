-- property_receiverships: Tab 7 (Receivership). Whether a property
-- surfaced on Interserv (or any other property the team learns about) has
-- gone into receivership. There is no free API or reliable automated way
-- to detect this — court filings and receivership news are sparse and
-- property-specific, confirmed by an actual search turning up nothing
-- useful for a general query. Left EMPTY by design, populated manually via
-- the Supabase Table Editor as the team finds real cases — same reasoning
-- as referral_partners and state_regulatory_info.
create table if not exists property_receiverships (
  id uuid primary key default gen_random_uuid(),
  property_name text not null,
  address text,
  state text,
  event_contact_id uuid references event_contacts(id) on delete set null,
  related_event_id uuid references events(id) on delete set null,
  receivership_status text not null default 'reported' check (
    receivership_status in ('reported', 'confirmed', 'resolved')
  ),
  filed_date date,
  news_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_receiverships_state_idx on property_receiverships (state);

alter table property_receiverships enable row level security;
create policy "property_receiverships are publicly readable"
  on property_receiverships for select
  using (true);

create policy "property_receiverships are publicly writable"
  on property_receiverships for all
  using (true)
  with check (true);
