// Supabase Edge Function: fetch-news
//
// Pulls the approved Tier 2 RSS feeds (free, no API keys), keyword-filters
// for disaster relevance, and best-effort links each article to an active
// `events` row. A linked article upgrades that event's confidence_score
// from MEDIUM (gov't source only) to HIGH (gov't + news confirmation) —
// see the Data Confidence Scoring section of the build prompt.
//
// Scheduled alongside fetch-disasters via pg_cron (see
// supabase/migrations/0004_phase2_cron.sql). Can also be invoked manually:
//
//   supabase functions invoke fetch-news

import { createClient } from "jsr:@supabase/supabase-js@2";
import Parser from "npm:rss-parser@3";
import {
  matchesDisasterKeyword,
  STATE_CODE_TO_NAME,
  CATEGORY_MATCH_TERMS,
} from "../_shared/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Tier 2 feeds from the build prompt. Some of these (Reuters in particular)
// have historically been flaky/discontinued RSS endpoints — each feed is
// fetched independently and a failure just skips that one feed rather than
// aborting the whole run.
const FEEDS: Array<{ source: string; url: string }> = [
  { source: "AP News", url: "https://feeds.apnews.com/rss/apf-topnews" },
  { source: "AP News Weather", url: "https://feeds.apnews.com/rss/weather" },
  { source: "Reuters", url: "https://feeds.reuters.com/reuters/topNews" },
  { source: "NPR News", url: "https://feeds.npr.org/1001/rss.xml" },
  { source: "USA Today", url: "https://rssfeeds.usatoday.com/usatoday-NewsTopStories" },
  { source: "ABC News", url: "https://feeds.abcnews.com/abcnews/topstories" },
  { source: "CBS News", url: "https://www.cbsnews.com/latest/rss/main" },
  { source: "NBC News", url: "https://feeds.nbcnews.com/nbcnews/public/news" },
  { source: "CNN", url: "https://rss.cnn.com/rss/cnn_topstories.rss" },
  { source: "Fox News", url: "https://feeds.foxnews.com/foxnews/national" },
  { source: "Weather.com", url: "https://feed.weather.com/weather/rss/regional" },
  { source: "AccuWeather", url: "https://rss.accuweather.com/accuweather/news/rss" },
  { source: "Insurance Journal", url: "https://www.insurancejournal.com/feeds/latest.rss" },
  { source: "Construction Dive", url: "https://www.constructiondive.com/feeds/news" },
  { source: "ENR", url: "https://www.enr.com/rss/news" },
  { source: "InciWeb", url: "https://inciweb.nwcg.gov/feeds/rss/incidents" },
];

interface CandidateEvent {
  id: string;
  category: string;
  states_affected: string[];
  confidence_score: string;
}

function findMatchingEvent(
  headline: string,
  events: CandidateEvent[]
): CandidateEvent | null {
  const lower = headline.toLowerCase();
  const categoryTerms = CATEGORY_MATCH_TERMS;

  for (const event of events) {
    const stateNames = event.states_affected
      .map((code) => STATE_CODE_TO_NAME[code] ?? code)
      .map((s) => s.toLowerCase());
    const stateMatch = stateNames.some((name) => lower.includes(name));
    if (!stateMatch) continue;

    const terms = categoryTerms[event.category] ?? [event.category];
    const categoryMatch = terms.some((term) => lower.includes(term));
    if (categoryMatch) return event;
  }
  return null;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const parser = new Parser({ timeout: 10_000 });

  const { data: candidateEvents, error: eventsErr } = await supabase
    .from("events")
    .select("id, category, states_affected, confidence_score")
    .neq("status", "resolved");

  if (eventsErr) {
    return new Response(JSON.stringify({ error: eventsErr.message }), { status: 500 });
  }

  let fetched = 0;
  let matched = 0;
  let stored = 0;
  let feedFailures = 0;
  const eventsToUpgrade = new Set<string>();

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items ?? []) {
        const headline = item.title ?? "";
        const snippet = item.contentSnippet ?? "";
        if (!matchesDisasterKeyword(`${headline} ${snippet}`)) continue;
        if (!item.link) continue;

        fetched++;
        const matchedEvent = findMatchingEvent(headline, candidateEvents ?? []);
        if (matchedEvent) {
          matched++;
          eventsToUpgrade.add(matchedEvent.id);
        }

        const { error: insertErr } = await supabase.from("news_articles").upsert(
          {
            event_id: matchedEvent?.id ?? null,
            source: feed.source,
            headline,
            url: item.link,
            published_at: item.isoDate ?? item.pubDate ?? null,
            confidence_contribution: matchedEvent
              ? "Tier 2 headline match on event state + category"
              : null,
          },
          { onConflict: "url", ignoreDuplicates: true }
        );
        if (!insertErr) stored++;
      }
    } catch (err) {
      feedFailures++;
      console.error(`Feed failed: ${feed.source}`, err);
    }
  }

  if (eventsToUpgrade.size > 0) {
    await supabase
      .from("events")
      .update({ confidence_score: "HIGH" })
      .in("id", Array.from(eventsToUpgrade))
      .eq("confidence_score", "MEDIUM");
  }

  const summary = {
    feeds_polled: FEEDS.length,
    feed_failures: feedFailures,
    articles_matching_keywords: fetched,
    articles_matched_to_event: matched,
    articles_stored: stored,
    events_upgraded_to_high_confidence: eventsToUpgrade.size,
    completed_at: new Date().toISOString(),
  };

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json" },
  });
});
