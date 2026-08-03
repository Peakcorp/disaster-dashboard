// Supabase Edge Function: fetch-places
//
// Surfaces churches, hotels, contractors, and other property/business types
// near active events via the Google Places API (New) — Tab 3D/3E (SupplyX
// church + target-client signals) and Tab 4A/4E (Interserv property
// opportunities + church strategy). Needs GOOGLE_PLACES_API_KEY:
//
//   supabase secrets set GOOGLE_PLACES_API_KEY=<key>
//
// The build prompt notes Google Places' free tier ($200/mo credit) is
// "sufficient for this use" — this function caps itself to the top N
// highest-severity active events per invocation (not every event, every
// type, every cycle) to keep that true. Not on the 6-hour cron by default;
// invoke manually or add a daily pg_cron entry once verified working:
//
//   supabase functions invoke fetch-places

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");

const MAX_EVENTS_PER_CYCLE = 5;
const RESULTS_PER_QUERY = 5;

const STATE_CODE_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming", DC: "District of Columbia", PR: "Puerto Rico",
};

const COMPANY_TYPE_QUERIES: Record<string, { query: string; target: string }> = {
  church: { query: "churches", target: "all" },
  hotel: { query: "hotels and resorts", target: "interserv" },
  apartment: { query: "apartment complexes", target: "interserv" },
  office: { query: "commercial office buildings", target: "interserv" },
  mixed_use: { query: "mixed-use commercial properties", target: "interserv" },
  contractor: { query: "general contractors", target: "supplyx" },
  restoration_company: { query: "restoration companies", target: "supplyx" },
  property_management: { query: "property management companies", target: "supplyx" },
};

interface PlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
}

async function searchPlaces(textQuery: string, locationBias?: { lat: number; lng: number }) {
  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: RESULTS_PER_QUERY,
  };
  if (locationBias) {
    body.locationBias = {
      circle: { center: { latitude: locationBias.lat, longitude: locationBias.lng }, radius: 50_000 },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Google Places API error", res.status, text);
    return { places: [] as PlaceResult[], error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
  }
  const json = await res.json();
  return { places: (json.places ?? []) as PlaceResult[], error: null as string | null };
}

Deno.serve(async () => {
  if (!GOOGLE_PLACES_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "GOOGLE_PLACES_API_KEY secret is not set. Get a key at " +
          "https://console.cloud.google.com/google/maps-apis (Places API, New) then run: " +
          "supabase secrets set GOOGLE_PLACES_API_KEY=<key>",
      }),
      { status: 400 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Without this, every invocation re-picked the same top-N-by-damage
  // events (there's no other ordering signal to advance past them),
  // so re-running never reached new events. Excluding events that
  // already have at least one contact row lets each invocation make
  // real progress through the backlog.
  // The project's PostgREST "max rows" setting caps every request at 1000
  // regardless of a client-side .limit() — event_contacts blows past that
  // after a handful of runs (up to 40 rows per event), which was silently
  // truncating this lookup and making the exclusion below miss
  // already-processed events, causing the same 5 to be reprocessed forever.
  // Page through with .range() to actually get everything.
  const alreadyProcessed = new Set<string>();
  for (let page = 0; ; page++) {
    const { data: pageRows } = await supabase
      .from("event_contacts")
      .select("event_id")
      .range(page * 1000, page * 1000 + 999);
    for (const row of pageRows ?? []) alreadyProcessed.add(row.event_id as string);
    if (!pageRows || pageRows.length < 1000) break;
  }

  // estimated_damage_usd is null for most live (NWS-sourced) events, so
  // without a tiebreaker Postgres has no defined order among those ties —
  // successive calls could return them in a different order, making the
  // "top 200" window shift under us and defeating the alreadyProcessed
  // exclusion (an event could drop out of the window before ever being
  // reached, while a stale one keeps reappearing). Sorting by id as a
  // secondary key makes the window stable across invocations.
  const { data: candidateEvents, error: fetchErr } = await supabase
    .from("events")
    .select("id, category, status, states_affected, lat, lng, estimated_damage_usd")
    .neq("status", "resolved")
    .eq("is_historical_seed", false)
    .order("estimated_damage_usd", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(500);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  const events = (candidateEvents ?? [])
    .filter((e) => !alreadyProcessed.has(e.id))
    .slice(0, MAX_EVENTS_PER_CYCLE);

  let eventsProcessed = 0;
  let contactsUpserted = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (const event of events ?? []) {
    const stateName = event.states_affected?.[0]
      ? STATE_CODE_TO_NAME[event.states_affected[0]] ?? event.states_affected[0]
      : null;
    if (!stateName && event.lat == null) continue; // nothing to search near

    eventsProcessed++;

    for (const [companyType, { query, target }] of Object.entries(COMPANY_TYPE_QUERIES)) {
      const textQuery = stateName ? `${query} in ${stateName}` : query;
      const locationBias = event.lat != null && event.lng != null ? { lat: event.lat, lng: event.lng } : undefined;

      try {
        const { places, error: searchError } = await searchPlaces(textQuery, locationBias);
        if (searchError) {
          failed++;
          if (!firstError) firstError = searchError;
          continue;
        }
        const rows = places
          .filter((p) => p.id && p.displayName?.text)
          .map((p) => ({
            event_id: event.id,
            company_type: companyType,
            name: p.displayName!.text,
            address: p.formattedAddress ?? null,
            state: event.states_affected?.[0] ?? null,
            lat: p.location?.latitude ?? null,
            lng: p.location?.longitude ?? null,
            google_place_id: p.id,
            target_company: target,
          }));

        if (rows.length > 0) {
          const { error: upsertErr } = await supabase
            .from("event_contacts")
            .upsert(rows, { onConflict: "event_id,google_place_id" });
          if (upsertErr) {
            console.error(`Upsert failed for event ${event.id} / ${companyType}`, upsertErr);
            failed++;
            if (!firstError) firstError = upsertErr.message;
            continue;
          }
          contactsUpserted += rows.length;
        }
      } catch (err) {
        console.error(`Places search failed for event ${event.id} / ${companyType}`, err);
        failed++;
        if (!firstError) firstError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const remainingBacklog = candidateEvents
    ? candidateEvents.filter((e) => !alreadyProcessed.has(e.id)).length - eventsProcessed
    : 0;

  return new Response(
    JSON.stringify({
      events_processed: eventsProcessed,
      contacts_upserted: contactsUpserted,
      remaining_backlog: Math.max(0, remainingBacklog),
      failed,
      first_error: firstError,
      completed_at: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
