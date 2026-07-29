-- Phase 1 MVP: events table only.
-- Later phases add event_materials, price_index_history, news_articles,
-- referral_partners, event_contacts, ai_usage_log, refresh_log.

create extension if not exists "pgcrypto";

create type disaster_category as enum (
  'hurricane',
  'tornado',
  'wildfire',
  'flood',
  'winter_storm',
  'earthquake',
  'landslide',
  'hail',
  'extreme_heat',
  'man_made'
);

create type event_status as enum (
  'critical',
  'developing',
  'monitoring',
  'resolved'
);

create type confidence_score as enum ('HIGH', 'MEDIUM', 'LOW');

create type govt_support_level as enum ('full', 'partial', 'none');

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category disaster_category not null,
  sub_type text,
  status event_status not null default 'monitoring',
  start_date date not null,
  end_date date,
  fema_region text,
  states_affected text[] not null default '{}',
  counties text[] not null default '{}',
  lat double precision,
  lng double precision,
  estimated_damage_usd numeric,
  insured_loss_usd numeric,
  federal_aid_usd numeric,
  govt_support_level govt_support_level,
  fatalities integer,
  confidence_score confidence_score not null default 'LOW',
  source_data_hash text,
  last_fetched_at timestamptz,
  supplyx_score smallint check (supplyx_score between 0 and 100),
  interserv_score smallint check (interserv_score between 0 and 100),
  insurance_claims_score smallint check (insurance_claims_score between 0 and 100),
  ai_summary text,
  ai_generated_at timestamptz,
  is_updated_since_last_refresh boolean not null default false,

  -- Dedup key: one row per external source event, e.g. FEMA disaster number
  -- or NWS alert id. Upserts from the edge function key off this.
  external_source text not null,
  external_id text not null,

  created_at timestamptz not null default now(),

  unique (external_source, external_id)
);

create index if not exists events_status_idx on events (status);
create index if not exists events_category_idx on events (category);
create index if not exists events_start_date_idx on events (start_date desc);
create index if not exists events_estimated_damage_idx on events (estimated_damage_usd desc);

alter table events enable row level security;

-- Public read access (dashboard is shared via URL). Writes only via the
-- service role key from the edge function, never from the browser.
create policy "events are publicly readable"
  on events for select
  using (true);

alter publication supabase_realtime add table events;
