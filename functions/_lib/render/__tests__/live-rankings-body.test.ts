import { describe, expect, it } from "vitest";
import { renderLivestreamList } from "../live-video";
import { renderRankings } from "../rankings";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

/**
 * THIN-01 (2026-08-24) — /live rendered 59 words for Googlebot and /rankings
 * 135 (EN) / 165 (VI). Both are hub routes linked from the global nav on every
 * page, and on a quiet day /live's entire body was the string "No live streams
 * right now. Check back soon." — a page reduced to its own empty state.
 *
 * These tests pin the standing copy (true whether or not anything is live),
 * the replay fallback, and the one-h1 rule from #635.
 */

const countH1 = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;

const bodyWords = (html: string) => {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const stripped = (body ? body[1] : html)
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ");
  return stripped.split(/\s+/).filter(Boolean).length;
};

// ── /live ──────────────────────────────────────────────────────────────────

function streamClient(rows: unknown[]): SupabaseClient {
  const chain = {
    select: () => chain,
    in: () => chain,
    order: () => chain,
    limit: async () => ({ data: rows, error: null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const LIVE = {
  id: "aaaa1111",
  title: "Chung kết đôi nam HCMC Open",
  status: "live",
  scheduled_start_at: "2026-08-24T09:00:00Z",
  ended_at: null,
};
const SCHEDULED = {
  id: "bbbb2222",
  title: "Bán kết đôi nữ Hà Nội Open",
  status: "scheduled",
  scheduled_start_at: "2026-08-26T09:00:00Z",
  ended_at: null,
};
const ENDED = {
  id: "cccc3333",
  title: "Tứ kết đôi nam Đà Nẵng Open",
  status: "ended",
  scheduled_start_at: "2026-08-10T09:00:00Z",
  ended_at: "2026-08-10T11:30:00Z",
};

const renderLiveHub = (rows: unknown[], lang: "vi" | "en" = "vi") =>
  renderLivestreamList(streamClient(rows), SITE, lang === "vi" ? "/vi/live" : "/live", lang).then(
    (r) => r.text(),
  );

describe("renderLivestreamList — standing content (THIN-01)", () => {
  it("never reduces the page to a bare empty state when nothing is live", async () => {
    const html = await renderLiveHub([ENDED]);

    expect(html).not.toContain("Hiện chưa có livestream. Quay lại sau.");
    // The replay is real, watchable content — surface it instead.
    expect(html).toContain("Xem lại");
    expect(html).toContain("Tứ kết đôi nam Đà Nẵng Open");
  });

  it("survives a completely empty stream table and still carries the standing copy", async () => {
    const html = await renderLiveHub([]);

    expect(html).toContain("Xem được gì ở đây");
    expect(html).toContain("Khác trên ThePickleHub");
    expect(html).not.toContain("<ul></ul>");
    expect(bodyWords(html)).toBeGreaterThan(150);
  });

  it("splits live, scheduled and ended into their own sections", async () => {
    const html = await renderLiveHub([LIVE, SCHEDULED, ENDED]);

    expect(html).toContain("Đang phát trực tiếp");
    expect(html).toContain("Sắp diễn ra");
    expect(html).toContain("Xem lại");
    // The old renderer printed the raw enum next to the title.
    expect(html).not.toContain("(scheduled)");
  });

  it("counts what is actually live in the opening sentence", async () => {
    expect(await renderLiveHub([LIVE, SCHEDULED])).toContain("Hiện có 1 trận đang phát trực tiếp");
    expect(await renderLiveHub([SCHEDULED])).toContain("1 trận đã lên lịch");
    expect(await renderLiveHub([ENDED])).toContain("Hiện chưa có trận nào đang phát");
  });

  it("names ThePickleHub once in the opening passage, per the GEO rule", async () => {
    // buildHtml emits a site-nav <header> first, so match the one that
    // actually carries the page heading.
    const lead = (await renderLiveHub([LIVE])).match(/<header><h1[\s\S]*?<\/header>/)![0];

    expect(lead).toContain("ThePickleHub");
    // The spaced variant dilutes the entity and is alternateName-only.
    expect(lead).not.toContain("The Pickle Hub");
  });

  it("renders exactly one h1, in both locales", async () => {
    for (const lang of ["vi", "en"] as const) {
      const html = await renderLiveHub([LIVE, ENDED], lang);
      expect(countH1(html)).toBe(1);
      expect(html).not.toMatch(/<h1[^>]*>[^<]*\| ThePickleHub<\/h1>/);
    }
  });

  it("keeps the bilingual hreflang triple", async () => {
    const html = await renderLiveHub([LIVE]);

    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="vi"');
    expect(html).toContain('hreflang="x-default"');
  });

  it("links replays to the localized path in the VI cluster", async () => {
    expect(await renderLiveHub([ENDED], "vi")).toContain(`${SITE}/vi/live/cccc3333`);
    expect(await renderLiveHub([ENDED], "en")).toContain(`${SITE}/live/cccc3333`);
  });
});

// ── /rankings ──────────────────────────────────────────────────────────────

function rpcClient(rows: unknown[]): SupabaseClient {
  return {
    rpc: async () => ({ data: rows, error: null }),
  } as unknown as SupabaseClient;
}

const PLAYERS = [
  { rank: 1, user_id: "u1", username: "hoa", display_name: "Chồng Thanh Hoà", avatar_url: null, city: null, dupr_rating: 5.63 },
  { rank: 2, user_id: "u2", username: "hung", display_name: "Đỗ Hùng", avatar_url: null, city: "Hà Nội", dupr_rating: 4.0 },
];

const renderRank = (rows: unknown[], lang: "vi" | "en" = "vi") =>
  renderRankings(rpcClient(rows), SITE, lang === "vi" ? "/vi/rankings" : "/rankings", lang).then(
    (r) => r.text(),
  );

describe("renderRankings — explainer content (THIN-01)", () => {
  it("answers where the ratings come from, who qualifies and how often it moves", async () => {
    const html = await renderRank(PLAYERS);

    expect(html).toContain("Số DUPR này đến từ đâu");
    expect(html).toContain("Làm sao để có tên trong bảng");
    expect(html).toContain("Đôi và đơn khác nhau thế nào");
    expect(html).toContain("Bao lâu cập nhật một lần");
  });

  it("carries the same four sections in English", async () => {
    const html = await renderRank(PLAYERS, "en");

    expect(html).toContain("Where these DUPR numbers come from");
    expect(html).toContain("How to appear on this leaderboard");
    expect(html).toContain("Doubles versus singles");
    expect(html).toContain("How often it updates");
  });

  it("more than doubles the crawlable body — the point of the change", async () => {
    // Production measured 135 words (EN) / 165 (VI) before this commit.
    // EN lands ~328 and VI higher; 300 is the floor worth defending.
    expect(bodyWords(await renderRank(PLAYERS))).toBeGreaterThan(300);
    expect(bodyWords(await renderRank(PLAYERS, "en"))).toBeGreaterThan(300);
  });

  it("states the row count in the opening sentence and names ThePickleHub", async () => {
    const html = await renderRank(PLAYERS);

    expect(html).toContain("xếp 2 VĐV");
    expect(html).toContain("ThePickleHub");
    expect(html).not.toContain("The Pickle Hub");
  });

  it("omits the count rather than saying 'ranks 0 players' on an empty leaderboard", async () => {
    const html = await renderRank([]);

    expect(html).not.toContain("xếp 0 VĐV");
    // The explainer does not depend on the table, so it still renders.
    expect(html).toContain("Số DUPR này đến từ đâu");
  });

  it("keeps one h1 and the hreflang triple", async () => {
    for (const lang of ["vi", "en"] as const) {
      const html = await renderRank(PLAYERS, lang);
      expect(countH1(html)).toBe(1);
      expect(html).toContain('hreflang="x-default"');
    }
  });

  it("still emits the ItemList and the player links it wraps", async () => {
    const html = await renderRank(PLAYERS);

    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain(`${SITE}/nguoi-choi/hoa`);
    expect(html).toContain("DUPR 5.630");
  });
});
