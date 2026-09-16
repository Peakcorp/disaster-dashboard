// Supabase Edge Function: search-receivership
//
// Automatically searches the web for receivership/foreclosure/distress
// news about properties Interserv has surfaced (event_contacts), and
// records only the ones where something real turns up — most properties
// will find nothing, which is expected and correct (receivership is rare).
// Needs GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID (a free Programmable Search
// Engine at https://programmablesearchengine.google.com/ configured to
// search the entire web, plus Custom Search API enabled in Google Cloud
// Console — same project as GOOGLE_PLACES_API_KEY works, or a separate key):
//
//   supabase secrets set GOOGLE_CSE_API_KEY=<key>
//   supabase secrets set GOOGLE_CSE_ID=<cx>
//
// Scoped to hotel/office/mixed_use/apartment contacts — larger commercial
// assets are what receivership actually applies to; churches/contractors/
// restoration companies/property managers are excluded. Capped at
// MAX_PER_CYCLE per run (well under the Custom Search API's 100 free
// queries/day) and skips contacts already checked, so repeated invocations
// (daily cron) advance through the backlog instead of re-querying the same
// ones. Not on the 6-hour cron; scheduled separately (see migration
// 0009_receivership_search.sql comment) or invoke manually:
//
//   curl -X POST <project-url>/functions/v1/search-receivership -H "Authorization: Bearer <anon-key>"

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CSE_API_KEY = Deno.env.get("GOOGLE_CSE_API_KEY");
const GOOGLE_CSE_ID = Deno.env.get("GOOGLE_CSE_ID");

const MAX_PER_CYCLE = 15;
const RECEIVERSHIP_TERMS = '(receivership OR foreclosure OR "distressed property" OR "loan default" OR "special servicing")';

interface CandidateContact {
  id: string;
  event_id: string;
  name: string;
  address: string | null;
  state: string | null;
  city: string | null;
  company_type: string;
}

interface CseItem {
  title?: string;
  link?: string;
  snippet?: string;
}

async function searchProperty(contact: CandidateContact): Promise<CseItem[]> {
  const location = [contact.city, contact.state].filter(Boolean).join(", ");
  const query = `"${contact.name}" ${location} ${RECEIVERSHIP_TERMS}`;
  const url =
    "https://www.googleapis.com/customsearch/v1" +
    `?key=${GOOGLE_CSE_API_KEY}&cx=${GOOGLE_CSE_ID}&num=3&q=${encodeURIComponent(query)}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Google Custom Search API error", res.status, await res.text());
    return [];
  }
  const json = await res.json();
  return (json.items ?? []) as CseItem[];
}

// Light sanity check on top of Google's own query matching — the property
// name is a quoted phrase in the query, but this guards against a result
// that only matched on the location/keywords with the name coincidentally
// appearing unrelated elsewhere on the page.
function looksRelevant(item: CseItem, propertyName: string): boolean {
  const significantWord = propertyName
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(the|and|of|at|inc|llc|corp)$/i.test(w))[0];
  if (!significantWord) return true;
  const haystack = `${item.title ?? ""} ${item.snippet ?? ""}`.toLowerCase();
  return haystack.includes(significantWord.toLowerCase());
}

Deno.serve(async () => {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    return new Response(
      JSON.stringify({
        error:
          "GOOGLE_CSE_API_KEY and/or GOOGLE_CSE_ID secrets are not set. Create a free Programmable Search " +
          "Engine at https://programmablesearchengine.google.com/ (set it to search the entire web) for the " +
          "GOOGLE_CSE_ID (cx), enable Custom Search API in Google Cloud Console for GOOGLE_CSE_API_KEY, then run: " +
          "supabase secrets set GOOGLE_CSE_API_KEY=<key> && supabase secrets set GOOGLE_CSE_ID=<cx>",
      }),
      { status: 400 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: candidates, error: fetchErr } = await supabase
    .from("event_contacts")
    .select("id, event_id, name, address, state, city, company_type")
    .in("company_type", ["hotel", "office", "mixed_use", "apartment"])
    .is("receivership_checked_at", null)
    .order("id", { ascending: true })
    .limit(MAX_PER_CYCLE);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  let checked = 0;
  let found = 0;
  let failed = 0;

  for (const contact of (candidates ?? []) as CandidateContact[]) {
    checked++;
    try {
      const items = await searchProperty(contact);
      const relevant = items.filter((item) => looksRelevant(item, contact.name));

      if (relevant.length > 0) {
        const top = relevant[0];
        const { error: insertErr } = await supabase.from("property_receiverships").insert({
          property_name: contact.name,
          address: contact.address,
          state: contact.state,
          event_contact_id: contact.id,
          related_event_id: contact.event_id,
          receivership_status: "reported",
          news_url: top.link ?? null,
          notes: `Auto-found via web search: "${top.title ?? ""}" — ${top.snippet ?? ""}`.trim(),
        });
        if (insertErr) {
          console.error(`Failed to insert receivership finding for ${contact.name}`, insertErr);
          failed++;
        } else {
          found++;
        }
      }

      await supabase.from("event_contacts").update({ receivership_checked_at: new Date().toISOString() }).eq("id", contact.id);
    } catch (err) {
      console.error(`Search failed for contact ${contact.id} (${contact.name})`, err);
      failed++;
    }
  }

  const { count: remainingBacklog } = await supabase
    .from("event_contacts")
    .select("id", { count: "exact", head: true })
    .in("company_type", ["hotel", "office", "mixed_use", "apartment"])
    .is("receivership_checked_at", null);

  return new Response(
    JSON.stringify({
      checked,
      found,
      failed,
      remaining_backlog: remainingBacklog ?? 0,
      completed_at: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
