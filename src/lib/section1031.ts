import type { DisasterEvent } from "@/types/event";

// IRC §7508A + Rev. Proc. 2018-58: the IRS automatically grants deadline
// relief to taxpayers in any federally-declared disaster area — this
// systematically includes postponing 1031 like-kind exchange identification
// (45-day) and completion (180-day) deadlines. That's the general legal
// rule. But per direction, this tab now shows ONLY disasters where an
// actual IRS news release was found and read (via web search/fetch) that
// explicitly invokes Rev. Proc. 2018-58 relief — not every FEMA-tagged
// event in the dashboard, even though the general rule would technically
// cover most of them. Verified against irs.gov on 2026-09-02.
//
// Two ways an entry is matched to a row in our `events` table:
//  - matchFemaIds: the notice cites a FEMA "DR-XXXX" number that matches
//    our stored external_id directly (true for Major Disaster
//    declarations — storms, floods, hurricanes/typhoons).
//  - matchByStartDate: some IRS wildfire relief notices use the IRS's own
//    "SD-XXXX-DR" tracking number instead of citing a FEMA DR number
//    (this appears to be how the IRS labels relief tied to a FEMA Fire
//    Management Assistance declaration rather than a full Major Disaster
//    declaration) — those are matched by state + exact disaster start
//    date instead, which the notice states explicitly.
export interface VerifiedReliefNotice {
  id: string;
  state: string;
  disasterDescription: string;
  beganDate: string;
  postponedDeadline: string;
  noticeUrl: string;
  irsDisasterCode: string;
  matchFemaIds?: string[];
  matchByStartDate?: string;
}

export const VERIFIED_1031_RELIEF: VerifiedReliefNotice[] = [
  {
    id: "in-2026-storms",
    state: "IN",
    disasterDescription: "Severe storms, straight-line winds, tornadoes, and flooding",
    beganDate: "2026-08-11",
    postponedDeadline: "February 1, 2027",
    irsDisasterCode: "4933-DR",
    matchFemaIds: ["4933"],
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-impacted-by-severe-storms-straight-line-winds-tornadoes-and-flooding-in-indiana-various-deadlines-postponed-to-feb-1-2027",
  },
  {
    id: "wv-2026-storms",
    state: "WV",
    disasterDescription: "Severe storms, straight-line winds, tornadoes, flooding, landslides, and mudslides",
    beganDate: "2026-07-21",
    postponedDeadline: "February 1, 2027",
    irsDisasterCode: "4932-DR",
    matchFemaIds: ["4932"],
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-impacted-by-severe-storms-straight-line-winds-tornadoes-flooding-landslides-and-mudslides-in-west-virginia-various-deadlines-postponed-to-feb-1-2027",
  },
  {
    id: "ms-2026-arthur",
    state: "MS",
    disasterDescription: "Tropical Storm Arthur",
    beganDate: "2026-06-18",
    postponedDeadline: "February 1, 2027",
    irsDisasterCode: "4930-DR",
    matchFemaIds: ["4930"],
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-impacted-by-tropical-storm-arthur-in-mississippi-various-deadlines-postponed-to-feb-1-2027",
  },
  {
    id: "la-2026-arthur",
    state: "LA",
    disasterDescription: "Tropical Storm Arthur",
    beganDate: "2026-06-17",
    postponedDeadline: "November 2, 2026",
    irsDisasterCode: "4927-DR",
    matchFemaIds: ["4927"],
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-and-businesses-in-louisiana-affected-by-tropical-storm-arthur-that-began-on-june-17-2026",
  },
  {
    id: "wi-2026-storms",
    state: "WI",
    disasterDescription: "Severe storms, tornadoes, and flooding",
    beganDate: "2026-04-13",
    postponedDeadline: "November 2, 2026",
    irsDisasterCode: "4923-DR",
    matchFemaIds: ["4923"],
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-impacted-by-severe-storms-tornadoes-and-flooding-in-the-state-of-wisconsin-various-deadlines-postponed-to-nov-2-2026",
  },
  {
    id: "mi-2026-storms",
    state: "MI",
    disasterDescription: "Severe storms, tornadoes, and flooding",
    beganDate: "2026-04-10",
    postponedDeadline: "November 2, 2026",
    irsDisasterCode: "4925-DR",
    matchFemaIds: ["4925"],
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-impacted-by-severe-storms-tornadoes-and-flooding-in-the-state-of-michigan-various-deadlines-postponed-to-nov-2-2026",
  },
  {
    id: "ne-2026-march-wildfires",
    state: "NE",
    disasterDescription: "March wildfires (Sioux County)",
    beganDate: "2026-03-12",
    postponedDeadline: "February 1, 2027",
    irsDisasterCode: "SD-0010-DR",
    matchByStartDate: "2026-03-12",
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-impacted-by-march-wildfires-in-nebraska-various-deadlines-postponed-to-feb-1-2027",
  },
  {
    id: "ne-2026-june-wildfires",
    state: "NE",
    disasterDescription: "June wildfires (Sioux County)",
    beganDate: "2026-06-09",
    postponedDeadline: "February 1, 2027",
    irsDisasterCode: "SD-0014-DR",
    matchByStartDate: "2026-06-09",
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-impacted-by-june-wildfires-in-nebraska-various-deadlines-postponed-to-feb-1-2027",
  },
  {
    id: "mp-2026-bavi",
    state: "MP",
    disasterDescription: "Super Typhoon Bavi",
    beganDate: "2026-07-02",
    postponedDeadline: "February 1, 2027",
    irsDisasterCode: "4931-DR",
    matchFemaIds: ["4931"],
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-impacted-by-super-typhoon-bavi-in-the-northern-mariana-islands-various-deadlines-postponed-to-feb-1-2027",
  },
  {
    id: "mp-2026-sinlaku",
    state: "MP",
    disasterDescription: "Super Typhoon Sinlaku",
    beganDate: "2026-04-11",
    postponedDeadline: "November 2, 2026",
    irsDisasterCode: "4910-DR",
    matchFemaIds: ["4910"],
    noticeUrl:
      "https://www.irs.gov/newsroom/irs-announces-tax-relief-for-taxpayers-impacted-by-super-typhoon-sinlaku-in-the-commonwealth-of-the-northern-mariana-islands-various-deadlines-postponed-to-nov-2-2026",
  },
];

const FEMA_SOURCES = new Set(["fema", "fema_declarations_2025"]);

export function isFemaSourced(event: DisasterEvent): boolean {
  return FEMA_SOURCES.has(event.external_source);
}

export function femaDeclarationNumber(event: DisasterEvent): string | null {
  if (!isFemaSourced(event)) return null;
  return event.external_id.replace(/^fema-/, "");
}

export function matchedEventsForNotice(events: DisasterEvent[], notice: VerifiedReliefNotice): DisasterEvent[] {
  const matched = events.filter((event) => {
    if (!isFemaSourced(event)) return false;
    if (!event.states_affected.includes(notice.state)) return false;
    const drNumber = femaDeclarationNumber(event);
    if (notice.matchFemaIds && drNumber && notice.matchFemaIds.includes(drNumber)) return true;
    if (notice.matchByStartDate && event.start_date === notice.matchByStartDate) return true;
    return false;
  });

  // The DB has duplicate rows per disaster (same DR number under both
  // external_source "fema" and "fema_declarations_2025") — dedupe by name.
  const seen = new Set<string>();
  return matched.filter((e) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });
}

export const IRS_DISASTER_RELIEF_HUB = "https://www.irs.gov/newsroom/tax-relief-in-disaster-situations";
