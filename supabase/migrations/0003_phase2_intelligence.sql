-- Phase 2: RSS ingestion, AI layer, and Historical Disaster Intelligence (Tab 2).
--
-- Design note: the build prompt's own schema section describes `events` as
-- "All active and historical disaster events" — one table, not two — with
-- auto-archival (resolved > 90 days) moving a row from the Live Map to the
-- Historical tab. This migration extends `events` with the extra fields
-- Tab 2 needs rather than duplicating the whole event model in a parallel
-- table. `is_historical_seed` distinguishes rows backfilled once from the
-- NOAA Billion-Dollar Disaster dataset from rows that arrived via the live
-- FEMA/NOAA refresh cycle.

alter table events
  add column if not exists is_historical_seed boolean not null default false,
  add column if not exists insurance_claims_filed_est integer,
  add column if not exists rebuilding_timeline_months integer,
  add column if not exists price_behavior_notes text,
  -- Deliberately NOT AI-generated (see enrich-historical-events) — naming
  -- specific real companies as having "operated in recovery" on an event is
  -- a hallucination risk we don't want to present as fact. Manual entry via
  -- the Supabase Table Editor only, left null otherwise.
  add column if not exists notable_recovery_companies text;

create index if not exists events_is_historical_seed_idx on events (is_historical_seed);

-- event_materials: destroyed/consumed material tagging per event. Populated
-- deterministically from the static disaster-type -> materials mapping in
-- the build prompt (section 3A), not by AI — it's a fixed lookup table, so
-- there's no reason to pay for or risk an AI guess at it.
create table if not exists event_materials (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  material_name text not null,
  category text not null check (category in ('destroyed', 'consumed')),
  proximity_band text check (proximity_band in ('0-1mi', '1-5mi', '5-10mi')),
  disaster_type disaster_category not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists event_materials_event_id_idx on event_materials (event_id);

alter table event_materials enable row level security;
create policy "event_materials are publicly readable"
  on event_materials for select
  using (true);

-- news_articles: filtered RSS articles, best-effort linked to an event.
-- event_id is nullable — disaster-relevant articles that don't clearly
-- match an active event are still stored (useful context), they just don't
-- contribute to any event's confidence score.
create table if not exists news_articles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete set null,
  source text not null,
  headline text not null,
  url text not null unique,
  published_at timestamptz,
  confidence_contribution text,
  created_at timestamptz not null default now()
);

create index if not exists news_articles_event_id_idx on news_articles (event_id);
create index if not exists news_articles_published_at_idx on news_articles (published_at desc);

alter table news_articles enable row level security;
create policy "news_articles are publicly readable"
  on news_articles for select
  using (true);

-- ai_usage_log: daily token tracking for the Rule 6 budget-alert cost control.
create table if not exists ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  estimated_cost_usd numeric not null,
  job_type text not null,
  event_id uuid references events(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_date_idx on ai_usage_log (date);

alter table ai_usage_log enable row level security;
create policy "ai_usage_log is publicly readable"
  on ai_usage_log for select
  using (true);
