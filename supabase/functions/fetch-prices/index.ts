// Supabase Edge Function: fetch-prices
//
// Pulls SupplyX material price indices from FRED (free, registration-only
// API — see build prompt Tier 3 data sources) into price_index_history for
// Tab 3C. Needs FRED_API_KEY:
//
//   supabase secrets set FRED_API_KEY=<key from fred.stlouisfed.org>
//
// Scope note: the build prompt names several material categories (gypsum,
// roofing/siding, plumbing fixtures, tile, HVAC) as BLS Producer Price Index
// series, but the exact current BLS series IDs for each aren't something to
// guess at — a wrong series ID silently returns someone else's price data
// with no error. This function ships with the two FRED series the build
// prompt names explicitly and that are verifiable directly on FRED's own
// site (fred.stlouisfed.org/series/<id>). Add more once verified there —
// see MATERIAL_SERIES below.
//
// Not on a cron schedule by default (material prices don't move 4x/day) —
// invoke manually or add a daily/weekly pg_cron entry once verified working:
//
//   supabase functions invoke fetch-prices

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FRED_API_KEY = Deno.env.get("FRED_API_KEY");

const MATERIAL_SERIES: Array<{ category: string; seriesId: string }> = [
  { category: "Framing lumber", seriesId: "WPU081" },
  { category: "Copper and brass mill shapes", seriesId: "WPU102502" },
];

Deno.serve(async () => {
  if (!FRED_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "FRED_API_KEY secret is not set. Register free at https://fred.stlouisfed.org/docs/api/api_key.html " +
          "then run: supabase secrets set FRED_API_KEY=<key>",
      }),
      { status: 400 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const startDate = oneYearAgo.toISOString().slice(0, 10);

  let seriesFetched = 0;
  let pointsUpserted = 0;
  let failed = 0;

  for (const { category, seriesId } of MATERIAL_SERIES) {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
      `&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`FRED API error for ${seriesId}`, res.status, await res.text());
        failed++;
        continue;
      }
      const json = await res.json();
      const observations: Array<{ date: string; value: string }> = json.observations ?? [];
      seriesFetched++;

      const rows = observations
        .filter((obs) => obs.value !== ".") // FRED uses "." for missing values
        .map((obs) => ({
          material_category: category,
          fred_series_id: seriesId,
          date: obs.date,
          index_value: Number(obs.value),
        }));

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("price_index_history")
          .upsert(rows, { onConflict: "fred_series_id,date" });
        if (upsertErr) {
          console.error(`Upsert failed for ${seriesId}`, upsertErr);
          failed++;
          continue;
        }
        pointsUpserted += rows.length;
      }
    } catch (err) {
      console.error(`Fetch failed for ${seriesId}`, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      series_fetched: seriesFetched,
      points_upserted: pointsUpserted,
      failed,
      completed_at: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
