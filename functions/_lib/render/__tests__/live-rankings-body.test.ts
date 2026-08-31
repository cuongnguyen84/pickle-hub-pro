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

/**
 * Drop <script> elements by index scan rather than by regex.
 *
 * A tag-matching regex here is a losing game: `/<script[\s\S]*?<\/script>/g`
 * misses `<SCRIPT>`, adding `i` then misses `</script >`, and CodeQL's
 * js/bad-tag-filter keeps finding the next variant. This walks the string
 * instead, so casing and whitespace inside the closing tag are irrelevant.
 *
 * It is not a sanitizer — nothing here is security-sensitive. But a script
 * block that survives the strip gets counted as prose, and since these tests
 * assert /live and /rankings are no longer thin, the JSON-LD payload would
 * inflate every count below.
 */
const stripScriptElements = (html: string): string => {
  const lower = html.toLowerCase();
  const parts: string[] = [];
  let cursor = 0;
  for (;;) {
    const open = lower.indexOf("<script", cursor);
    if (open === -1) {
      parts.push(html.slice(cursor));
      return parts.join(" ");
    }
    parts.push(html.slice(cursor, open));
    const close = lower.indexOf("</script", open);
    if (close === -1) return parts.join(" "); // unterminated: drop the rest
    const gt = html.indexOf(">", close);
    if (gt === -1) return parts.join(" ");
    cursor = gt + 1;
  }
};

const bodyWords = (html: string) => {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const stripped = stripScriptElements(body ? body[1] : html).replace(/<[^>]+>/g, " ");
  return stripped.split(/\s+/).filter(Boolean).length;
};

// ── /live ──────────────────────────────────────────────────────────────────

type StreamRow = { status?: string };
type OrderCall = { column: string; opts?: { ascending?: boolean; nullsFirst?: boolean } };
type QueryLog = { status: string; order: OrderCall[]; limit: number };

/**
 * The renderer asks for one status per query (see the comment in live-video.ts),
 * so the mock filters `rows` by whatever `.eq("status", …)` asked for. Passing a
 * mixed array still works exactly as it did when there was a single `.in()`.
 *
 * `log` records the query shape so a test can assert the *windowing* — which is
 * where the bug lived — and not only the rendered HTML.
 */
function streamClient(rows: unknown[], log: QueryLog[] = []): SupabaseClient {
  const from = () => {
    const q: QueryLog = { status: "", order: [], limit: 0 };
    const chain = {
      select: () => chain,
      in: () => chain,
      eq: (col: string, val: string) => {
        if (col === "status") q.status = val;
        return chain;
      },
      order: (column: string, opts?: OrderCall["opts"]) => {
        q.order.push({ column, opts });
        return chain;
      },
      limit: async (n: number) => {
        q.limit = n;
        log.push(q);
        const filtered = q.status
          ? (rows as StreamRow[]).filter((r) => r.status === q.status)
          : rows;
        // Honour the limit. PostgREST does, and a mock that returns everything
        // is exactly why a shared 40-row window across three statuses looked
        // correct in CI for a day.
        return { data: filtered.slice(0, n), error: null };
      },
    };
    return chain;
  };
  return { from } as unknown as SupabaseClient;
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

  // Reversed 2026-08-25. The VI hub used to link /vi/live/:id, which
  // _middleware.ts rule 1d now 301s to /live/:id — so the "localized" link was
  // a redirect hop to the page we actually index. Both locales link the
  // canonical URL; the stream page itself renders Vietnamese-first regardless.
  it("links replays to the single canonical /live/:id from both clusters", async () => {
    expect(await renderLiveHub([ENDED], "vi")).toContain(`${SITE}/live/cccc3333`);
    expect(await renderLiveHub([ENDED], "vi")).not.toContain(`${SITE}/vi/live/cccc3333`);
    expect(await renderLiveHub([ENDED], "en")).toContain(`${SITE}/live/cccc3333`);
  });
});

/**
 * 2026-08-25 site audit.
 *
 * THIN-01 widened the query to `.in(["live","scheduled","ended"]).limit(40)`
 * ordered by created_at. That gives the three statuses one shared 40-row budget,
 * and `ended` is the only bucket that grows without bound — 29 rows already sat
 * in it. Once 40 rows are newer than a scheduled stream, the stream stops
 * appearing on /live with nothing to show it was dropped, and the rows most at
 * risk are the ones announced furthest ahead: a tournament broadcast created
 * weeks before it airs.
 *
 * These tests pin the windowing itself. The HTML assertions above cannot see it
 * — the mock returns everything it is given, which is precisely why a shared
 * window looked fine in CI.
 */
describe("renderLivestreamList — one query window per status", () => {
  const shape = async (rows: unknown[]) => {
    const log: QueryLog[] = [];
    await renderLivestreamList(streamClient(rows, log), SITE, "/live", "en");
    return log;
  };

  it("gives live, scheduled and ended their own limit", async () => {
    const log = await shape([LIVE, SCHEDULED, ENDED]);

    // Only the three livestream windows are under test here; the World Cup
    // livescore block adds its own wc_pro_matches query, which is not one of them.
    const streamStatuses = log.map((q) => q.status).filter((s) => ["live", "scheduled", "ended"].includes(s ?? ""));
    expect(streamStatuses.sort()).toEqual(["ended", "live", "scheduled"]);
    // No status may share a budget with another — that is the whole bug.
    for (const q of log) expect(q.limit).toBeGreaterThan(0);
    expect(new Set(streamStatuses).size).toBe(3);
  });

  it("orders upcoming by air time, not by when the row was created", async () => {
    const log = await shape([SCHEDULED]);
    const scheduled = log.find((q) => q.status === "scheduled")!;

    expect(scheduled.order[0].column).toBe("scheduled_start_at");
    expect(scheduled.order[0].opts?.ascending).toBe(true);
  });

  it("still shows a scheduled stream when ended rows outnumber the old window", async () => {
    // 60 replays — more than the old shared .limit(40) — plus one stream
    // scheduled long ago. Under the old query the scheduled row was past the
    // cut and the section vanished.
    const manyEnded = Array.from({ length: 60 }, (_, i) => ({
      ...ENDED,
      id: `ended${i}`,
      title: `Replay ${i}`,
    }));
    const html = await renderLiveHub([...manyEnded, SCHEDULED], "vi");

    expect(html).toContain("Sắp diễn ra");
    expect(html).toContain("Bán kết đôi nữ Hà Nội Open");
    expect(html).toContain("1 trận đã lên lịch");
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
