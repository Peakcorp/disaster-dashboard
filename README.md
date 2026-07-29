# Disaster Intelligence Dashboard — Phase 3

Live + historical US disaster intelligence for SupplyX, Interserv LP, and
Insurance Claims. All 5 tabs from the build prompt are now built: Live Map,
Historical, SupplyX, Interserv, Insurance Claims.

## What's built so far

**Phase 1** — Tab 1: dark Leaflet/OpenStreetMap map, event sidebar, status
bar, `fetch-disasters` edge function (FEMA + NOAA/NWS), pg_cron 4x/day,
Supabase Realtime.

**Phase 2** — RSS confirmation layer (`fetch-news`), Claude Haiku AI layer
for live events (`analyze-events`) with full cost-control rules, historical
seed + enrichment (`seed-historical-events` / `enrich-historical-events`),
and Tab 2 (Historical Disaster Intelligence: predictive calendar, seasonal
alerts, frequency trend, searchable event list).

**Phase 3 (new):**
- Live events now get deterministic destroyed/consumed material tagging
  too (`fetch-disasters` calls the same static lookup `seed-historical-events`
  uses), not just historical ones
- `fetch-prices` edge function — FRED material price series into
  `price_index_history` (needs `FRED_API_KEY`)
- `fetch-places` edge function — Google Places surfacing of churches,
  hotels, contractors, restoration companies, property managers per active
  event into `event_contacts` (needs `GOOGLE_PLACES_API_KEY`)
- `analyze-events` now also estimates `insurance_claims_filed_est` per event
- **Tab 3 (SupplyX)**: pre-purchase alert heuristics, material demand
  forecasting (destroyed/consumed per active event), FRED price charts,
  church opportunity signal, target client intelligence
- **Tab 4 (Interserv)**: renovation outreach-window timing (deterministic,
  per the build prompt's disaster-type timing table), property type filter,
  geographic/seasonal focus areas, church strategy module
- **Tab 5 (Insurance Claims)**: claim pool estimation, claim type
  classification, state law favorability, referral partner database
  (manual-entry), state regulatory intelligence (manual-entry)

Not built yet: the CEO Intelligence layer from the updated build prompt
(Snapshot Panel, Executive Action Panels, Triple Signal detection, dismissed-
opportunity learning, weekly digest email — Phase 4), auth, filters/search
polish (Phase 5).

## One-time setup

### 1–2. Supabase project + local env
Same as Phase 1 — see the bottom of this file if you're starting fresh.

### 3. Run the database migrations, in order
In the Supabase dashboard → **SQL Editor**:
1. `0001_events_table.sql`
2. `0002_pg_cron_schedule.sql` — read its comments first (Vault secrets)
3. `0003_phase2_intelligence.sql` — `news_articles`, `ai_usage_log`,
   `event_materials`, historical-tab columns on `events`
4. `0004_phase2_cron.sql` — read its comments first (two more Vault secrets)
5. `0005_phase3_company_tabs.sql` — `price_index_history`, `event_contacts`,
   `referral_partners`, `event_referrals`, `state_regulatory_info`

### 4. Set API keys
```bash
supabase secrets set ANTHROPIC_API_KEY=<key from console.anthropic.com>
supabase secrets set FRED_API_KEY=<key from fred.stlouisfed.org/docs/api/api_key.html>
supabase secrets set GOOGLE_PLACES_API_KEY=<key from Google Cloud Console — Places API (New)>
```
Anthropic (Haiku) is the only piece of this stack that isn't free — expect
$5–15/month at normal volume. FRED is free (registration only). Google
Places' free tier is $200/month credit, which the build prompt calls
sufficient for this use; `fetch-places` caps itself to the 5
highest-severity active events per invocation to keep that true.

### 5. Deploy the edge functions
```bash
supabase functions deploy fetch-disasters
supabase functions deploy fetch-news
supabase functions deploy analyze-events
supabase functions deploy seed-historical-events
supabase functions deploy enrich-historical-events
supabase functions deploy fetch-prices
supabase functions deploy fetch-places
```

### 6. Seed the historical database (Tab 2)
1. Get the current NOAA Billion-Dollar Disaster export link from
   [ncei.noaa.gov/access/billions](https://www.ncei.noaa.gov/access/billions/).
2. `supabase secrets set NOAA_BILLION_DOLLAR_CSV_URL=<that url>`
3. `supabase functions invoke seed-historical-events`
4. `supabase functions invoke enrich-historical-events` — re-invoke if
   `remaining_unenriched > 0` (25/call)

### 7. Populate price + property data (Tabs 3–4)
```bash
supabase functions invoke fetch-prices
supabase functions invoke fetch-places
```
Neither is on the 6-hour cron by default (prices don't move that often,
and Places calls cost real quota) — invoke manually or add your own
daily/weekly pg_cron entry once you've confirmed they work.

### 8. Populate referral partners + state regulatory info (Tab 5)
Both tables are intentionally empty by default — add rows via the Supabase
Table Editor:
- `referral_partners`: firm_name, states[], specialties[], contact_info,
  referral_permitted
- `state_regulatory_info`: state_code, referral_fee_permitted,
  statute_of_limitations_years, doi_contact — **verify current law with
  counsel before entering**; this isn't legal advice and statutes change
  (e.g. Florida's property-negligence SOL changed from 4 to 2 years in 2023)

### 9. Run the app locally / deploy
Same as Phase 1 — `npm install && npm run dev`, or push to GitHub for
Vercel auto-deploy. No new frontend env vars for Phase 3.

## Known Phase 3 limitations

- **FRED-only price data** — the build prompt names several BLS PPI series
  (gypsum, roofing, tile, HVAC) alongside two FRED series (lumber, copper).
  Only the two FRED series are wired up: guessing at specific BLS series IDs
  risked silently pulling the wrong commodity's price data with no error.
  Verify and add more series at fred.stlouisfed.org once confirmed.
- **`fetch-places` needs live event lat/lng or a state code** — FEMA-sourced
  events still have no coordinates (Phase 1 limitation), so Places search
  falls back to a state-level text query for those, which is less precise
  than a radius search around a real point.
- **Referral partners and state regulatory data are never AI-generated or
  pre-seeded with specifics** — same reasoning as `notable_recovery_companies`:
  naming real firms or asserting specific statute-of-limitations figures
  as fact carries real risk if wrong. Both are manual-entry only.
- **Claim pool / referral fee estimates are rough** — `insurance_claims_filed_est`
  comes from Claude's judgment given event category/damage/scale (explicitly
  framed as an estimate, per the build prompt's own "estimates, not
  guarantees" principle); the referral-fee-pool figure is that estimate ×
  a flat assumed average claim value, not a researched number.
- **Interserv's $500K display threshold is estimated-damage-based** — events
  without an estimated_damage_usd (all FEMA-sourced live events, per the
  Phase 1 limitation) won't appear in Tab 4's outreach list until that gap
  is closed.
- Everything from the Phase 1/2 known-limitations lists still applies.

## Next steps (Phase 4, per the updated build prompt)

1. CEO Snapshot Panel (Tab 1, pinned top) with Triple Signal detection
2. Executive Action Panels for each company tab
3. "What Comes Next" 7/30/90-day timeline projections
4. Dismissed-opportunity tracking and preference learning
5. Weekly Monday CEO digest email
6. Settings panel for per-company scoring preferences

---

<details>
<summary>Phase 1 setup (Supabase project + local env), if starting fresh</summary>

### Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New project (free tier).
2. Once created, go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret — never put it in frontend code or git)

### Configure local env
```bash
cp .env.local.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Push to GitHub + deploy on Vercel
1. Create a new GitHub repo, push this `app/` folder to it.
2. Go to [vercel.com](https://vercel.com) → New Project → import the repo.
3. Add the same two env vars in Vercel's project settings.
4. Deploy. Every push to `main` auto-deploys from then on.

</details>
