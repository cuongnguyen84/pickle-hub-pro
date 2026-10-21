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
  /**
   * Organising body, used verbatim as schema.org `organizer` in the
   * SportsEvent JSON-LD on /tournaments. Set it ONLY when one of our own
   * fact-checked posts names the organiser — an absent `organizer` is valid
   * schema.org, a wrong one is a false entity claim. Do NOT default this to
   * "PPA Tour Asia": that is the sanctioning tour, not automatically the
   * organiser. Events deliberately left blank — the Heineken Pickleball World
   * Cup (Da Nang), the Hong Kong Slam (organised by F-Sports Promotions per
   * our own preview post), and the whole PPA Asia 125 series. The 125s are
   * third-party events the tour sanctions rather than runs: the organizers'
   * own pages credit PickleGO (PickleSlam) and MSPL Sports with Tomaz
   * Pickleball Club (Tomaz Cup). We have no post of our own naming those yet,
   * so the field stays absent rather than guessing "PPA Tour Asia" — which
   * would be exactly the false entity claim this rule exists to stop.
   */
  organizer?: string;
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
    organizer: "PPA Tour Asia",
    prizeEn: "up to $300,000",
    prizeVi: "tối đa 300.000 USD",
    blogEn: "/blog/vietnam-hosts-ppa-tour-asia-2026",
    blogVi: "/vi/blog/viet-nam-dang-cai-ppa-tour-asia-2026",
  },
  {
    id: "pickleslam-2026",
    nameEn: "PickleSlam 2026",
    nameVi: "PickleSlam 2026",
    placeEn: "Jurong, Singapore",
    placeVi: "Jurong, Singapore",
    startDate: "2026-04-11",
    endDate: "2026-04-18",
    tier: "PPA Asia 125",
    prizeEn: "$10,000",
    prizeVi: "10.000 USD",
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
    organizer: "PPA Tour Asia",
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
    organizer: "PPA Tour Asia",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
  },
  {
    id: "china-open-2026",
    nameEn: "Capital Securities Beijing Open",
    nameVi: "Capital Securities Beijing Open",
    placeEn: "Beijing, China",
    placeVi: "Bắc Kinh, Trung Quốc",
    startDate: "2026-06-17",
    endDate: "2026-06-21",
    tier: "PPA Asia 500",
    organizer: "PPA Tour Asia",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
    blogEn: "/blog/ppa-beijing-open-2026-recap",
    blogVi: "/vi/blog/ppa-beijing-open-2026-viet-nam-vo-dich",
  },
  {
    id: "tokyo-open-2026",
    nameEn: "Sansan Tokyo Open",
    nameVi: "Sansan Tokyo Open",
    placeEn: "Tokyo, Japan",
    placeVi: "Tokyo, Nhật Bản",
    startDate: "2026-07-01",
    endDate: "2026-07-04",
    tier: "PPA Asia 500",
    organizer: "PPA Tour Asia",
    prizeEn: "$50,000",
    prizeVi: "50.000 USD",
  },
  {
    id: "singapore-open-2026",
    nameEn: "Leapmotor Singapore Open",
    nameVi: "Leapmotor Singapore Open",
    placeEn: "Singapore",
    placeVi: "Singapore",
    startDate: "2026-07-23",
    endDate: "2026-07-26",
    tier: "PPA Asia 500",
    organizer: "PPA Tour Asia",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
    blogEn: "/blog/singapore-open-2026-recap",
    blogVi: "/vi/blog/singapore-open-2026-ket-qua",
  },
  {
    id: "hcmc-open-2026",
    nameEn: "MB Ho Chi Minh City Open",
    nameVi: "MB Ho Chi Minh City Open",
    placeEn: "Ho Chi Minh City, Vietnam",
    placeVi: "TP.HCM, Việt Nam",
    startDate: "2026-08-06",
    endDate: "2026-08-09",
    tier: "PPA Asia 500",
    organizer: "PPA Tour Asia",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
    blogEn: "/blog/hcmc-open-2026-recap",
    blogVi: "/vi/blog/hcmc-open-2026-ket-qua",
  },
  {
    id: "shenzhen-open-2026",
    // "China Open 2" was the placeholder name on the season announcement. The
    // official event name is the Skechers Shenzhen Open — confirmed 2026-08-18
    // from the PPA Tour Asia event page + pickleballtournaments.com listing,
    // and used as the entity throughout our own preview/recap post. See
    // docs/milestones.md CN-OPEN2-PREVIEW.
    nameEn: "Skechers Shenzhen Open",
    nameVi: "Skechers Shenzhen Open",
    placeEn: "Shenzhen, China",
    placeVi: "Thâm Quyến, Trung Quốc",
    startDate: "2026-08-20",
    endDate: "2026-08-23",
    tier: "PPA Asia 500",
    organizer: "PPA Tour Asia",
    prizeEn: "$70,000",
    prizeVi: "70.000 USD",
    blogEn: "/blog/shenzhen-open-2026-preview",
    blogVi: "/vi/blog/shenzhen-open-2026-lich-thi-dau-cach-xem",
  },
  {
    id: "tomaz-cup-2026",
    nameEn: "Tomaz Cup",
    nameVi: "Tomaz Cup",
    placeEn: "Kuala Lumpur, Malaysia",
    placeVi: "Kuala Lumpur, Malaysia",
    startDate: "2026-08-27",
    endDate: "2026-08-29",
    tier: "PPA Asia 125",
    prizeEn: "$15,000",
    prizeVi: "15.000 USD",
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
    // "Kuala Lumpur Cup" was the bare name carried over from the season
    // announcement. Leapmotor is the presenting partner and the official event
    // name is the Leapmotor Kuala Lumpur Cup — confirmed 2026-09-08 from the
    // PPA Tour Asia event page. Our own Singapore post already uses the
    // parallel entity "Leapmotor Singapore Open"; this row was the odd one out.
    // Same defect as the "China Open 2" placeholder fixed on 2026-08-28.
    nameEn: "Leapmotor Kuala Lumpur Cup",
    nameVi: "Leapmotor Kuala Lumpur Cup",
    placeEn: "Kuala Lumpur, Malaysia",
    placeVi: "Kuala Lumpur, Malaysia",
    startDate: "2026-09-09",
    endDate: "2026-09-13",
    tier: "PPA Asia 1000",
    organizer: "PPA Tour Asia",
    prizeEn: "up to $300,000",
    prizeVi: "tối đa 300.000 USD",
    blogEn: "/blog/kuala-lumpur-cup-2026-preview",
    blogVi: "/vi/blog/kuala-lumpur-cup-2026-lich-thi-dau-cach-xem",
  },
  {
    id: "shandong-challenger-2026",
    nameEn: "Shandong Challenger",
    nameVi: "Shandong Challenger",
    placeEn: "Shandong, China",
    placeVi: "Sơn Đông, Trung Quốc",
    startDate: "2026-10-04",
    endDate: "2026-10-07",
    tier: "PPA Asia 125",
    prizeEn: "$15,000",
    prizeVi: "15.000 USD",
  },
  {
    id: "hong-kong-slam-2026",
    nameEn: "Hang Seng Bank Hong Kong Slam",
    nameVi: "Hang Seng Bank Hong Kong Slam",
    placeEn: "Hong Kong",
    placeVi: "Hồng Kông",
    startDate: "2026-10-19",
    endDate: "2026-10-25",
    tier: "Slam",
    // No organizer: our own preview sources the Hong Kong Slam to F-Sports
    // Promotions (Hang Seng Bank is title sponsor). PPA Tour Asia sanctions
    // the stop but does not organise it — omit rather than guess.
    prizeEn: "up to $1,100,000",
    prizeVi: "tối đa 1.100.000 USD",
    blogEn: "/blog/hong-kong-slam-2026-preview",
    blogVi: "/vi/blog/hong-kong-slam-2026",
  },
  {
    id: "nanjing-125-2026",
    nameEn: "PPA Asia 125 CHN Nanjing",
    nameVi: "PPA Asia 125 CHN Nanjing",
    placeEn: "Nanjing, China",
    placeVi: "Nam Kinh, Trung Quốc",
    startDate: "2026-10-28",
    endDate: "2026-10-31",
    tier: "PPA Asia 125",
    // No prize money: the organizers' page carries the date and city but has
    // published no purse for this stop. Absent beats invented.
  },
];

export type ProCalendarStatus = "past" | "live" | "upcoming";

/**
 * Today's date in the Vietnam calendar (UTC+7), as `YYYY-MM-DD`.
 *
 * `startDate`/`endDate` above are VN-local calendar dates, so the "today"
 * they are compared against must be VN-local too. `new Date().toISOString()`
 * is UTC and runs a day behind between 00:00 and 07:00 ICT — which made the
 * calendar say "Sắp diễn ra" on the morning an event opened and "Đang diễn
 * ra" on the morning after it closed, for the ~95% Vietnamese audience and
 * for the SportsEvent JSON-LD (Cloudflare Pages Functions run in UTC).
 *
 * Fixed +7h offset on purpose: Vietnam has not observed DST since 1975, and
 * a plain arithmetic shift behaves identically in the browser, in Node and
 * in workerd — no dependency on the runtime shipping full-ICU tz data.
 */
export function vnTodayIso(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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
