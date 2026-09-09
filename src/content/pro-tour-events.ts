// ============================================================================
// Pro-tour event registry — the tournaments that get a results page at
// /live/pro/<slug> (+ /vi twin).
//
// Data for these pages is NOT here: it is the `matches` rows the pro-tour
// pipeline writes (pro_tour_watchlist → workers/pro-tour-scraper →
// pro-tour-ingest, source_provider = 'ppa_tour'). This file only says which
// tournament_name a slug maps to, and the facts the page needs before a single
// match has been played (dates, venue, tier) so it can render an honest
// "not started yet" state instead of an empty screen.
//
// Adding an event = one entry here + the bracket URLs on /admin/pro-tour.
// `namePattern` is a PostgREST ilike pattern so a small drift in how the source
// spells the tournament name (sponsor prefix, year) still matches.
// ============================================================================

export interface ProTourEventMeta {
  /** URL slug: /live/pro/<slug> */
  slug: string;
  /** Tournament name as the bracket site labels it (what pro-tour-ingest stores). */
  tournamentName: string;
  /** ilike pattern matched against matches.tournament_name. */
  namePattern: string;
  nameEn: string;
  nameVi: string;
  /** e.g. "PPA Asia 1000" */
  tier: string;
  tour: "PPA Tour Asia" | "PPA Tour";
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

export const PRO_TOUR_EVENTS: ProTourEventMeta[] = [
  {
    slug: "ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026",
    tournamentName: "PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026",
    namePattern: "%Leapmotor%Kuala Lumpur%2026%",
    nameEn: "PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026",
    nameVi: "PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026",
    tier: "PPA Asia 1000",
    tour: "PPA Tour Asia",
    sponsor: "Leapmotor",
    city: "Kuala Lumpur",
    country: "Malaysia",
    countryCode: "MY",
    venue: "The Hood, Jalan Ipoh",
    startDate: "2026-09-09",
    endDate: "2026-09-13",
    officialUrl: "https://www.ppatour-asia.com/tournament/2026/kuala-lumpur-cup/",
    bracketsUrl: "https://pickleballtournaments.com/tournaments/ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026/events",
    prizeMoney: "US$300,000",
    logoUrl: "/images/events/kl-cup-2026-badge.png",
    brandBg: "linear-gradient(135deg, #10283d 0%, #1c405f 55%, #16324a 100%)",
  },
  {
    slug: "ppa-asia-500-skechers-shenzhen-open-2026",
    tournamentName: "PPA Asia 500 Skechers Shenzhen Open 2026",
    namePattern: "%Shenzhen Open 2026%",
    nameEn: "PPA Asia 500 Skechers Shenzhen Open 2026",
    nameVi: "PPA Asia 500 Skechers Shenzhen Open 2026",
    tier: "PPA Asia 500",
    tour: "PPA Tour Asia",
    sponsor: "Skechers",
    city: "Shenzhen",
    country: "China",
    countryCode: "CN",
    startDate: "2026-08-19",
    endDate: "2026-08-23",
    officialUrl: "https://www.ppatour-asia.com/",
    bracketsUrl: "https://pickleballtournaments.com/tournaments/ppa-asia-500-skechers-shenzhen-open-2026/events",
  },
  {
    slug: "ppa-asia-500-mb-ho-chi-minh-city-open-2026",
    tournamentName: "PPA Asia 500 MB Ho Chi Minh City Open 2026",
    namePattern: "%Ho Chi Minh City Open 2026%",
    nameEn: "PPA Asia 500 MB Ho Chi Minh City Open 2026",
    nameVi: "PPA Asia 500 MB Ho Chi Minh City Open 2026",
    tier: "PPA Asia 500",
    tour: "PPA Tour Asia",
    sponsor: "MB",
    city: "Ho Chi Minh City",
    country: "Vietnam",
    countryCode: "VN",
    startDate: "2026-08-05",
    endDate: "2026-08-09",
    officialUrl: "https://www.ppatour-asia.com/",
    bracketsUrl: "https://pickleballtournaments.com/tournaments/ppa-asia-500-mb-ho-chi-minh-city-open-2026/events",
  },
  {
    slug: "ppa-asia-500-leapmotor-singapore-open-2026",
    tournamentName: "PPA Asia 500 Leapmotor Singapore Open 2026",
    namePattern: "%Leapmotor Singapore Open 2026%",
    nameEn: "PPA Asia 500 Leapmotor Singapore Open 2026",
    nameVi: "PPA Asia 500 Leapmotor Singapore Open 2026",
    tier: "PPA Asia 500",
    tour: "PPA Tour Asia",
    sponsor: "Leapmotor",
    city: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    startDate: "2026-07-22",
    endDate: "2026-07-26",
    officialUrl: "https://www.ppatour-asia.com/",
    bracketsUrl: "https://pickleballtournaments.com/tournaments/ppa-asia-500-singapore-open-2026/events",
  },
];

export function getProTourEvent(slug: string): ProTourEventMeta | undefined {
  return PRO_TOUR_EVENTS.find((e) => e.slug === slug);
}

export type ProTourEventPhase = "upcoming" | "live" | "finished";

const DAY_MS = 86_400_000;

/** Start of the first day / end of the last day, treated as UTC+8 (every
 * event in the registry so far is in the SGT/MYT/CST/ICT band; a few hours
 * of skew only moves the "live" pill, never the data). */
export function eventWindow(meta: ProTourEventMeta): { start: number; end: number } {
  const start = Date.parse(`${meta.startDate}T00:00:00+08:00`);
  const end = Date.parse(`${meta.endDate}T23:59:59+08:00`);
  return { start, end };
}

export function eventPhase(meta: ProTourEventMeta, now = Date.now()): ProTourEventPhase {
  const { start, end } = eventWindow(meta);
  if (now < start) return "upcoming";
  if (now > end) return "finished";
  return "live";
}

/** Events worth a card on /live right now: from a week before the first
 * match to two weeks after the final, so results stay one tap away while
 * people are still talking about them. */
export function proTourEventsOnLive(now = Date.now()): ProTourEventMeta[] {
  return PRO_TOUR_EVENTS.filter((e) => {
    const { start, end } = eventWindow(e);
    return now >= start - 7 * DAY_MS && now <= end + 14 * DAY_MS;
  }).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** "9–13/9/2026" (vi) or "September 9–13, 2026" (en). Same-month ranges
 * only need the day twice; cross-month ranges spell both. */
export function formatEventDates(meta: ProTourEventMeta, lang: "en" | "vi"): string {
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
