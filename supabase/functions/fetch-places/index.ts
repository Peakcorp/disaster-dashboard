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
      circle: { center: { latitude: locationBias.lat, longitude: locationBias.lng }, radius: 80_000 },
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
    console.error("Google Places API error", res.status, await res.text());
    return [];
  }
  const json = await res.json();
  return (json.places ?? []) as PlaceResult[];
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

  const { data: events, error: fetchErr } = await supabase
    .from("events")
    .select("id, category, status, states_affected, lat, lng, estimated_damage_usd")
    .neq("status", "resolved")
    .eq("is_historical_seed", false)
    .order("estimated_damage_usd", { ascending: false, nullsFirst: false })
    .limit(MAX_EVENTS_PER_CYCLE);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  let eventsProcessed = 0;
  let contactsUpserted = 0;
  let failed = 0;

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
        const places = await searchPlaces(textQuery, locationBias);
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
            continue;
          }
          contactsUpserted += rows.length;
        }
      } catch (err) {
        console.error(`Places search failed for event ${event.id} / ${companyType}`, err);
        failed++;
      }
    }
  }

  return new Response(
    JSON.stringify({
      events_processed: eventsProcessed,
      contacts_upserted: contactsUpserted,
      failed,
      completed_at: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
