import { describe, expect, it } from "vitest";
import { renderPpaAsiaHub } from "../ppa-hub";

const SITE = "https://www.thepicklehub.net";

const EVENT_ROW = {
  slug: "ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026",
  name_pattern: "kuala lumpur cup",
  name_en: "Leapmotor Kuala Lumpur Cup 2026",
  name_vi: "Cúp Kuala Lumpur Leapmotor 2026",
  tier: "PPA Asia 1000",
  tour: "PPA Tour Asia",
  sponsor: "Leapmotor",
  city: "Kuala Lumpur",
  country: "Malaysia",
  country_code: "MY",
  venue: "The Hood, Jalan Ipoh",
  start_date: "2026-09-09",
  end_date: "2026-09-13",
  official_url: "",
  brackets_url: "",
  prize_money: "US$300,000",
  logo_url: null,
  brand_bg: null,
};

const VI_ROWS = [
  {
    slug: "ket-qua-hong-kong-slam-2026",
    title: "Kết quả Hong Kong Slam 2026",
    published_at: "2026-10-19T02:00:00+00:00",
    alternate_en_slug: "hong-kong-slam-2026-results",
  },
  {
    slug: "lich-thi-dau-hong-kong-slam-2026",
    title: "Lịch thi đấu Hong Kong Slam 2026",
    published_at: "2026-09-30T02:00:00+00:00",
    alternate_en_slug: "hong-kong-slam-2026-schedule",
  },
];

const TOURNAMENT_ROWS = [
  {
    slug: "d-joy-vietnam-masters-2026",
    name: "D-Joy Vietnam Masters 2026",
    start_date: "2026-11-24",
    end_date: "2026-11-29",
  },
];

function stubSupabase(failTable?: string) {
  const rowsByTable: Record<string, unknown[]> = {
    pro_tour_events: [EVENT_ROW],
    vi_blog_posts: VI_ROWS,
    tournaments: TOURNAMENT_ROWS,
  };
  const chain = (table: string) => {
    const chainObj: Record<string, unknown> = {
      select: () => chainObj,
      eq: () => chainObj,
      contains: () => chainObj,
      like: () => chainObj,
      order: () => chainObj,
      limit: () => chainObj,
      then: (resolve: (v: unknown) => void) => {
        if (failTable === table) {
          resolve({ data: null, error: { message: "boom" } });
        } else {
          resolve({ data: rowsByTable[table] ?? [], error: null });
        }
        return Promise.resolve();
      },
    };
    return chainObj;
  };
  return { from: (table: string) => chain(table) } as never;
}

describe("renderPpaAsiaHub", () => {
  it("renders the English hub with events, coverage and Vietnam tournaments", async () => {
    const res = await renderPpaAsiaHub(stubSupabase(), SITE, "en");
    const html = await res.text();
    expect(html).toContain("<h1>PPA Tour Asia results, schedule and coverage</h1>");
    expect(html).toContain("Leapmotor Kuala Lumpur Cup 2026");
    expect(html).toContain("/live/pro/ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026");
    expect(html).toContain("Hong Kong Slam 2026 Results");
    expect(html).toContain("/blog/hong-kong-slam-2026-results");
    expect(html).toContain("D-Joy Vietnam Masters 2026");
    expect(html).toContain("/tournament/d-joy-vietnam-masters-2026");
    expect(html).toContain("/rankings/ppa-tour");
    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain('rel="alternate" hreflang="vi"');
  });

  it("renders the Vietnamese hub from vi_blog_posts", async () => {
    const res = await renderPpaAsiaHub(stubSupabase(), SITE, "vi");
    const html = await res.text();
    expect(html).toContain("<h1>PPA Tour Asia: kết quả, lịch thi đấu và tin tức</h1>");
    expect(html).toContain("Cúp Kuala Lumpur Leapmotor 2026");
    expect(html).toContain("/vi/live/pro/ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026");
    expect(html).toContain("/vi/blog/ket-qua-hong-kong-slam-2026");
    expect(html).toContain("Kết quả");
    expect(html).toContain("D-Joy Vietnam Masters 2026");
  });

  it("still renders when a query fails", async () => {
    const res = await renderPpaAsiaHub(stubSupabase("vi_blog_posts"), SITE, "vi");
    const html = await res.text();
    expect(html).toContain("<h1>PPA Tour Asia: kết quả, lịch thi đấu và tin tức</h1>");
    // Fallback to the EN metadata posts with Vietnamese titles.
    expect(html).toContain("/blog/hong-kong-slam-2026-results");
  });
});
