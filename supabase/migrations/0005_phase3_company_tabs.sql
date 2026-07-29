-- Phase 3: Tab 3 (SupplyX), Tab 4 (Interserv LP), Tab 5 (Insurance Claims).

-- price_index_history: FRED/BLS material price series (Tab 3C). Populated by
-- fetch-prices, which needs FRED_API_KEY — empty until that secret is set.
create table if not exists price_index_history (
  id uuid primary key default gen_random_uuid(),
  material_category text not null,
  fred_series_id text not null,
  date date not null,
  index_value numeric not null,
  related_event_id uuid references events(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (fred_series_id, date)
);

create index if not exists price_index_history_series_date_idx
  on price_index_history (fred_series_id, date desc);

alter table price_index_history enable row level security;
create policy "price_index_history is publicly readable"
  on price_index_history for select
  using (true);

-- event_contacts: churches, hotels, contractors, etc. surfaced per event via
-- Google Places (Tab 3D/3E, Tab 4A/4E). Populated by fetch-places, which
-- needs GOOGLE_PLACES_API_KEY — empty until that secret is set.
create table if not exists event_contacts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  company_type text not null check (
    company_type in (
      'church', 'hotel', 'apartment', 'office', 'mixed_use',
      'contractor', 'restoration_company', 'property_management'
    )
  ),
  name text not null,
  address text,
  state text,
  city text,
  county text,
  lat double precision,
  lng double precision,
  google_place_id text,
  target_company text not null default 'all' check (
    target_company in ('supplyx', 'interserv', 'insurance_claims', 'all')
  ),
  status text not null default 'not_contacted' check (
    status in ('not_contacted', 'contacted', 'engaged', 'referred', 'closed')
  ),
  notes text,
  created_at timestamptz not null default now(),
  unique (event_id, google_place_id)
);

create index if not exists event_contacts_event_id_idx on event_contacts (event_id);
create index if not exists event_contacts_company_type_idx on event_contacts (company_type);

alter table event_contacts enable row level security;
create policy "event_contacts are publicly readable"
  on event_contacts for select
  using (true);

-- referral_partners: law firm database for Insurance Claims (Tab 5D).
-- Deliberately empty by default and populated manually via the Supabase
-- Table Editor — same reasoning as `events.notable_recovery_companies`:
-- naming specific real firms is not something to generate automatically.
create table if not exists referral_partners (
  id uuid primary key default gen_random_uuid(),
  firm_name text not null,
  states text[] not null default '{}',
  specialties text[] not null default '{}',
  contact_info text,
  referral_permitted boolean,
  notes text,
  created_at timestamptz not null default now()
);

alter table referral_partners enable row level security;
create policy "referral_partners are publicly readable"
  on referral_partners for select
  using (true);

-- event_referrals: per-event referral pipeline status against a firm in
-- referral_partners (Tab 5D "Referral Pipeline Status").
create table if not exists event_referrals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  referral_partner_id uuid not null references referral_partners(id) on delete cascade,
  status text not null default 'not_contacted' check (
    status in ('not_contacted', 'contacted', 'engaged', 'referred', 'closed')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, referral_partner_id)
);

alter table event_referrals enable row level security;
create policy "event_referrals are publicly readable"
  on event_referrals for select
  using (true);

-- state_regulatory_info: attorney referral-fee rules, statute of limitations,
-- state insurance department contact (Tab 5F). Left EMPTY by design — statute
-- of limitations figures change with legislation (e.g. Florida's property
-- negligence SOL changed from 4 to 2 years in 2023) and getting this wrong
-- has real consequences for a business relying on it. Populate manually via
-- the Table Editor and verify against current law; this is not legal advice.
create table if not exists state_regulatory_info (
  state_code text primary key,
  referral_fee_permitted text check (referral_fee_permitted in ('yes', 'no', 'restricted')),
  referral_fee_note text,
  statute_of_limitations_years numeric,
  statute_of_limitations_note text,
  doi_contact text,
  updated_at timestamptz not null default now()
);

alter table state_regulatory_info enable row level security;
create policy "state_regulatory_info is publicly readable"
  on state_regulatory_info for select
  using (true);
