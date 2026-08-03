-- event_contacts and event_referrals only had a SELECT policy — the
-- existing "click the status badge to advance" UI in ContactsList.tsx has
-- always silently failed (RLS blocks the UPDATE, the client optimistically
-- updates local state then reverts on failure with no error surfaced).
-- This project has no auth layer, so allow public updates the same way
-- reads are already public.
create policy "event_contacts status is publicly updatable"
  on event_contacts for update
  using (true)
  with check (true);

create policy "event_referrals status is publicly updatable"
  on event_referrals for update
  using (true)
  with check (true);

-- Google Places (New) Text Search can return a phone number and website for
-- a place if requested in the field mask — fetch-places didn't request
-- them originally. Add columns to store them once it does.
alter table event_contacts
  add column if not exists phone text,
  add column if not exists website text;
