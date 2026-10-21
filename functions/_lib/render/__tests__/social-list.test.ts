import { describe, expect, it } from "vitest";
import { renderSocialList } from "../social-list";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

const EVENTS = [
  {
    slug: "giao-luu-thu-7",
    title_vi: "Giao lưu thứ 7",
    title_en: "Saturday social",
    start_at: "2026-09-05T01:00:00Z",
    end_at: "2026-09-05T04:00:00Z",
    location_text: "Sân Thành Đồng, Hà Nội",
    price_vnd: 80000,
    max_players: 16,
    court_count: 2,
    club: { slug: "thanh-dong", name: "Thành Đồng Pickleball" },
  },
  {
    slug: "xe-ve-toi-thu-3",
    title_vi: "Xé vé tối thứ 3",
    title_en: "Tuesday night open play",
    start_at: "2026-09-08T11:00:00Z",
    end_at: "2026-09-08T14:00:00Z",
    location_text: "Tân Phú, TP.HCM",
    price_vnd: 0,
    max_players: 12,
    court_count: 1,
    club: null,
  },
];

/** Minimal Supabase stub — only the chain renderSocialList actually walks. */
function stubClient(rows: typeof EVENTS | null): SupabaseClient {
  const result = Promise.resolve(
    rows ? { data: rows, error: null } : { data: null, error: new Error("query failed") },
  );
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => result,
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

async function render(lang: "en" | "vi", rows: typeof EVENTS | null = EVENTS) {
  return await (await renderSocialList(stubClient(rows), SITE, lang)).text();
}

describe("renderSocialList — bilingual pair", () => {
  it("self-references the EN canonical on /social", async () => {
    expect(await render("en")).toContain(`<link rel="canonical" href="${SITE}/social"/>`);
  });

  it("self-references the VI canonical on /vi/social instead of collapsing to /social", async () => {
    const html = await render("vi");
    // The regression this guards: /vi/social used to canonicalise to /social,
    // so Google built the Vietnamese page and immediately discarded it.
    expect(html).toContain(`<link rel="canonical" href="${SITE}/vi/social"/>`);
    expect(html).not.toContain(`<link rel="canonical" href="${SITE}/social"/>`);
  });

  it("emits hreflang pointing at two DISTINCT urls in both locales", async () => {
    for (const lang of ["en", "vi"] as const) {
      const html = await render(lang);
      expect(html).toContain(`hreflang="en" href="${SITE}/social"`);
      expect(html).toContain(`hreflang="vi" href="${SITE}/vi/social"`);
      expect(html).toContain(`hreflang="x-default" href="${SITE}/social"`);
    }
  });

  it("declares the matching html lang for each locale", async () => {
    expect(await render("en")).toContain('<html lang="en"');
    expect(await render("vi")).toContain('<html lang="vi"');
  });

  it("links each locale to its counterpart so the pair is crawlable", async () => {
    expect(await render("en")).toContain(`href="${SITE}/vi/social" hreflang="vi"`);
    expect(await render("vi")).toContain(`href="${SITE}/social" hreflang="en"`);
  });

  it("renders exactly one h1, not the decorated auto-header", async () => {
    for (const lang of ["en", "vi"] as const) {
      const html = await render(lang);
      expect(html.match(/<h1[ >]/g) ?? []).toHaveLength(1);
      expect(html).not.toContain("<h1>Sự kiện pickleball cộng đồng | ThePickleHub</h1>");
      expect(html).not.toContain("<h1>Pickleball Community Events | ThePickleHub</h1>");
    }
  });

  it("front-loads real counts in the lead and names ThePickleHub once", async () => {
    const en = await render("en");
    // 2 events, 1 of them club-hosted — both derived from the rows rendered.
    expect(en).toContain("ThePickleHub has 2 upcoming pickleball community events");
    expect(en).toContain("1 of them is hosted by a club");
    const vi = await render("vi");
    expect(vi).toContain("ThePickleHub đang mở đăng ký 2 sự kiện");
    expect(vi).toContain("1 sự kiện do câu lạc bộ đứng ra tổ chức");
  });

  it("keeps the pair valid when there are no upcoming events", async () => {
    const html = await render("vi", []);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/vi/social"/>`);
    expect(html).toContain(`hreflang="vi" href="${SITE}/vi/social"`);
    expect(html).toContain("Hiện chưa có sự kiện công khai nào sắp diễn ra");
    expect(html.match(/<h1[ >]/g) ?? []).toHaveLength(1);
  });

  it("still renders a valid pair when the query fails outright", async () => {
    const html = await render("en", null);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/social"/>`);
    expect(html).toContain(`hreflang="vi" href="${SITE}/vi/social"`);
    expect(html).toContain("No public events are upcoming right now");
  });
});
