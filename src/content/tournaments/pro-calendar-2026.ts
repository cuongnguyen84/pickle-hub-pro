/**
 * Curated 2026 pro tournament calendar — Vietnam & Asia.
 *
 * Single source of truth for the /tournaments (+ /vi/tournaments) calendar
 * section, consumed by BOTH the React page (src/pages/Tournaments.tsx via
 * ProCalendar2026) and the SSR bot path (functions/_lib/render/tournaments.ts —
 * Pages Functions import from src/ directly, same pattern as blog-meta.ts).
 *
 * Facts sourced from our own fact-checked posts (blog
 * vietnam-pickleball-tournament-calendar-2026 + event previews/recaps) and the
 * official PPA Tour Asia season announcements those posts cite. Do NOT add an
 * event here without a public official source. Dates are local (VN) calendar
 * dates in ISO YYYY-MM-DD.
 *
 * blogEn/blogVi: absolute paths on thepicklehub.net linking each event to our
 * own preview/recap — the calendar doubles as the internal-link trunk of the
 * whole event cluster. Leave undefined when we have no post yet.
 */

export interface ProCalendarEvent {
  id: string;
  nameEn: string;
  nameVi: string;
  /** City + country, already localized. City omitted when not officially announced. */
  placeEn: string;
  placeVi: string;
  startDate: string; // ISO YYYY-MM-DD (first match day)
  endDate: string; // ISO YYYY-MM-DD (last match day)
  /** Short tier label, e.g. "PPA Asia 500", "PPA Asia 1000", "Slam", "World Cup". */
  tier: string;
  prizeEn?: string;
  prizeVi?: string;
  blogEn?: string;
  blogVi?: string;
}

export const PRO_CALENDAR_2026: ProCalendarEvent[] = [
  {
    id: "mb-hanoi-cup-2026",
    nameEn: "MB Hanoi Cup",
    nameVi: "MB Hanoi Cup",
    placeEn: "Hanoi, Vietnam",
    placeVi: "Hà Nội, Việt Nam",
    startDate: "2026-04-01",
    endDate: "2026-04-05",
    tier: "PPA Asia 1000",
    prizeEn: "up to $300,000",
    prizeVi: "tối đa 300.000 USD",
    blogEn: "/blog/vietnam-hosts-ppa-tour-asia-2026",
    blogVi: "/vi/blog/viet-nam-dang-cai-ppa-tour-asia-2026",
  },
  {
    id: "panas-kuala-lumpur-open-2026",
    nameEn: "Panas Kuala Lumpur Open",
    nameVi: "Panas Kuala Lumpur Open",
    placeEn: "Kuala Lumpur, Malaysia",
    placeVi: "Kuala Lumpur, Malaysia",
    startDate: "2026-05-13",
    endDate: "2026-05-17",
    tier: "PPA Asia 500",
    prizeEn: "$50,000",
    prizeVi: "50.000 USD",
  },
  {
    id: "macao-open-2026",
    nameEn: "Macao Open",
    nameVi: "Macao Open",
    placeEn: "Macao",
    placeVi: "Macao",
    startDate: "2026-05-28",
    endDate: "2026-05-31",
    tier: "PPA Asia 500",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
  },
  {
    id: "china-open-2026",
    nameEn: "China Open (Beijing)",
    nameVi: "China Open (Bắc Kinh)",
    placeEn: "Beijing, China",
    placeVi: "Bắc Kinh, Trung Quốc",
    startDate: "2026-06-17",
    endDate: "2026-06-21",
    tier: "PPA Asia 500",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
    blogEn: "/blog/ppa-beijing-open-2026-recap",
    blogVi: "/vi/blog/ppa-beijing-open-2026-viet-nam-vo-dich",
  },
  {
    id: "tokyo-open-2026",
    nameEn: "Tokyo Open",
    nameVi: "Tokyo Open",
    placeEn: "Tokyo, Japan",
    placeVi: "Tokyo, Nhật Bản",
    startDate: "2026-07-01",
    endDate: "2026-07-04",
    tier: "PPA Asia 500",
    prizeEn: "$50,000",
    prizeVi: "50.000 USD",
  },
  {
    id: "singapore-open-2026",
    nameEn: "Singapore Open",
    nameVi: "Singapore Open",
    placeEn: "Singapore",
    placeVi: "Singapore",
    startDate: "2026-07-23",
    endDate: "2026-07-26",
    tier: "PPA Asia 500",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
    blogEn: "/blog/singapore-open-2026-recap",
    blogVi: "/vi/blog/singapore-open-2026-ket-qua",
  },
  {
    id: "hcmc-open-2026",
    nameEn: "Ho Chi Minh City Open",
    nameVi: "Ho Chi Minh City Open",
    placeEn: "Ho Chi Minh City, Vietnam",
    placeVi: "TP.HCM, Việt Nam",
    startDate: "2026-08-06",
    endDate: "2026-08-09",
    tier: "PPA Asia 500",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
    blogEn: "/blog/hcmc-open-2026-recap",
    blogVi: "/vi/blog/hcmc-open-2026-ket-qua",
  },
  {
    id: "china-open-2-2026",
    // City intentionally omitted — official announcements list dates/tier only
    // so far (see docs/milestones.md CN-OPEN2-PREVIEW). Add city + preview
    // links when the draw/venue is published on ppatourasia.
    nameEn: "China Open 2",
    nameVi: "China Open 2",
    placeEn: "China",
    placeVi: "Trung Quốc",
    startDate: "2026-08-20",
    endDate: "2026-08-23",
    tier: "PPA Asia 500",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
  },
  {
    id: "pickleball-world-cup-2026",
    nameEn: "Heineken Pickleball World Cup",
    nameVi: "Heineken Pickleball World Cup",
    placeEn: "Da Nang, Vietnam",
    placeVi: "Đà Nẵng, Việt Nam",
    startDate: "2026-08-30",
    endDate: "2026-09-06",
    tier: "World Cup",
    blogEn: "/blog/pickleball-world-cup-2026-da-nang-how-to-watch",
    blogVi: "/vi/blog/cam-nang-xem-pickleball-world-cup-2026-da-nang",
  },
  {
    id: "kuala-lumpur-cup-2026",
    nameEn: "Kuala Lumpur Cup",
    nameVi: "Kuala Lumpur Cup",
    placeEn: "Kuala Lumpur, Malaysia",
    placeVi: "Kuala Lumpur, Malaysia",
    startDate: "2026-09-09",
    endDate: "2026-09-13",
    tier: "PPA Asia 1000",
    prizeEn: "up to $300,000",
    prizeVi: "tối đa 300.000 USD",
  },
  {
    id: "hong-kong-slam-2026",
    nameEn: "Hong Kong Slam",
    nameVi: "Hong Kong Slam",
    placeEn: "Hong Kong",
    placeVi: "Hồng Kông",
    startDate: "2026-10-19",
    endDate: "2026-10-25",
    tier: "Slam",
    prizeEn: "up to $1,100,000",
    prizeVi: "tối đa 1.100.000 USD",
    blogEn: "/blog/hong-kong-slam-2026-preview",
    blogVi: "/vi/blog/hong-kong-slam-2026",
  },
];

export type ProCalendarStatus = "past" | "live" | "upcoming";

/** Status from calendar dates. `todayIso` injectable for SSR/tests. */
export function proCalendarStatus(
  ev: Pick<ProCalendarEvent, "startDate" | "endDate">,
  todayIso: string,
): ProCalendarStatus {
  if (todayIso > ev.endDate) return "past";
  if (todayIso < ev.startDate) return "upcoming";
  return "live";
}

/** "01–05/04" style compact VN date range (shared by React + SSR). */
export function proCalendarDateRange(ev: Pick<ProCalendarEvent, "startDate" | "endDate">): string {
  const [, sm, sd] = ev.startDate.split("-");
  const [, em, ed] = ev.endDate.split("-");
  return sm === em ? `${sd}–${ed}/${sm}` : `${sd}/${sm}–${ed}/${em}`;
}
