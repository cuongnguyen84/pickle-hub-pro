// ============================================================================
// Pro-tour event model — type + pure helpers for the tournaments that get a
// results page at /live/pro/<slug> (+ /vi twin).
//
// Since 2026-09-09 the registry DATA lives in the `pro_tour_events` table
// (managed in /admin/pro-tour → tab Sự kiện) so Cuong can add an event
// without a deploy; this module keeps the shared type, the row mapper and
// the date/phase helpers. Match data is still the `matches` rows the
// pro-tour pipeline writes (pro_tour_watchlist → workers/pro-tour-scraper →
// pro-tour-ingest, source_provider = 'ppa_tour').
// ============================================================================

export interface ProTourEventMeta {
  /** URL slug: /live/pro/<slug> */
  slug: string;
  /** ilike pattern matched against matches.tournament_name. */
  namePattern: string;
  nameEn: string;
  nameVi: string;
  /** e.g. "PPA Asia 1000" */
  tier: string;
  tour: string;
  sponsor?: string;
  city: string;
  country: string;
  countryCode: string;
  venue?: string;
  /** ISO dates in local time of the venue (inclusive). */
  startDate: string;
  endDate: string;
  /** Official tournament page (credit link). */
  officialUrl: string;
  /** Public draws/results page at the bracket site. */
  bracketsUrl: string;
  prizeMoney?: string;
  /** Event badge/logo (local asset, lazy-loaded on the card). */
  logoUrl?: string;
  /** Brand card background (CSS gradient or color) + implies light text. */
  brandBg?: string;
}

/** Row shape of public.pro_tour_events (snake_case, per generated types). */
export interface ProTourEventRow {
  slug: string;
  name_pattern: string;
  name_en: string;
  name_vi: string;
  tier: string;
  tour: string;
  sponsor: string | null;
  city: string;
  country: string;
  country_code: string;
  venue: string | null;
  start_date: string;
  end_date: string;
  official_url: string;
  brackets_url: string;
  prize_money: string | null;
  logo_url: string | null;
  brand_bg: string | null;
}

export function metaFromRow(r: ProTourEventRow): ProTourEventMeta {
  return {
    slug: r.slug,
    namePattern: r.name_pattern,
    nameEn: r.name_en,
    nameVi: r.name_vi,
    tier: r.tier,
    tour: r.tour,
    sponsor: r.sponsor ?? undefined,
    city: r.city,
    country: r.country,
    countryCode: r.country_code,
    venue: r.venue ?? undefined,
    startDate: r.start_date,
    endDate: r.end_date,
    officialUrl: r.official_url,
    bracketsUrl: r.brackets_url,
    prizeMoney: r.prize_money ?? undefined,
    logoUrl: r.logo_url ?? undefined,
    brandBg: r.brand_bg ?? undefined,
  };
}

export type ProTourEventPhase = "upcoming" | "live" | "finished";

const DAY_MS = 86_400_000;

/** Start of the first day / end of the last day, treated as UTC+8 (every
 * event so far is in the SGT/MYT/CST/ICT band; a few hours of skew only
 * moves the "live" pill, never the data). */
export function eventWindow(meta: Pick<ProTourEventMeta, "startDate" | "endDate">): {
  start: number;
  end: number;
} {
  const start = Date.parse(`${meta.startDate}T00:00:00+08:00`);
  const end = Date.parse(`${meta.endDate}T23:59:59+08:00`);
  return { start, end };
}

export function eventPhase(
  meta: Pick<ProTourEventMeta, "startDate" | "endDate">,
  now = Date.now(),
): ProTourEventPhase {
  const { start, end } = eventWindow(meta);
  if (now < start) return "upcoming";
  if (now > end) return "finished";
  return "live";
}

/** Events worth a card on / and /live right now: from a week before the
 * first match to two weeks after the final, so results stay one tap away
 * while people are still talking about them. */
export function eventsOnLive(
  events: ProTourEventMeta[],
  now = Date.now(),
): ProTourEventMeta[] {
  return events
    .filter((e) => {
      const { start, end } = eventWindow(e);
      return now >= start - 7 * DAY_MS && now <= end + 14 * DAY_MS;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** "9–13/9/2026" (vi) or "September 9–13, 2026" (en). Same-month ranges
 * only need the day twice; cross-month ranges spell both. */
export function formatEventDates(
  meta: Pick<ProTourEventMeta, "startDate" | "endDate">,
  lang: "en" | "vi",
): string {
  const [sy, sm, sd] = meta.startDate.split("-").map(Number);
  const [ey, em, ed] = meta.endDate.split("-").map(Number);
  if (lang === "vi") {
    if (sm === em && sy === ey) return `${sd}–${ed}/${sm}/${sy}`;
    return `${sd}/${sm}${sy !== ey ? `/${sy}` : ""} – ${ed}/${em}/${ey}`;
  }
  const monthName = (m: number) =>
    new Date(Date.UTC(2000, m - 1, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  if (sm === em && sy === ey) return `${monthName(sm)} ${sd}–${ed}, ${sy}`;
  return `${monthName(sm)} ${sd}${sy !== ey ? `, ${sy}` : ""} – ${monthName(em)} ${ed}, ${ey}`;
}
