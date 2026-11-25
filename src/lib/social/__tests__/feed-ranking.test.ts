import { describe, expect, it } from "vitest";
import {
  BLOG_TYPE_BONUS,
  FEED_RESULT_WIDE_WINDOW_MS,
  FEED_STANDARD_WINDOW_MS,
  FEED_WIDE_RESULT_CAP,
  dedupeFeedItems,
  feedRecencyMs,
  feedResultHref,
  feedResultLabels,
  hideQuickTableMatchCopies,
  interleaveFeedResults,
  isMatchResult,
  computeEffectiveSeenIds,
  partitionFeedBySeen,
  selectFeedResults,
  sortFeedByRecency,
} from "../feed-ranking";

interface Row {
  id: string;
  kind: "blog" | "result" | "match";
  at: number;
  winning_team?: "a" | "b" | null;
}

const isResult = (row: Row) =>
  isMatchResult({
    type: row.kind,
    winning_team: row.winning_team ?? (row.kind === "result" ? "a" : null),
  });

const DAY = 24 * 60 * 60 * 1000;

describe("feed result labels and links", () => {
  it("names quick-table, tournament, and team-match finals in both languages", () => {
    expect(feedResultLabels({ source: "quick_table", roundName: "Final", language: "vi" })).toEqual({
      kind: "GIẢI CHIA BẢNG",
      round: "CHUNG KẾT",
      division: null,
    });
    expect(feedResultLabels({ source: "doubles_elim", roundName: "F", language: "en" })).toEqual({
      kind: "TOURNAMENT",
      round: "FINAL",
      division: null,
    });
    expect(
      feedResultLabels({ source: "team_match", roundName: "Final", division: "1", language: "vi" }).division,
    ).toBe("NHÁNH 2");
    expect(
      feedResultLabels({ source: "team_match", roundName: "Final", division: "0", language: "en" }).division,
    ).toBeNull();
  });

  it("links each result at the page that already shows it", () => {
    expect(feedResultHref("quick_table", "abc")).toBe("/tools/quick-tables/abc");
    expect(feedResultHref("doubles_elim", "de1")).toBe("/tools/doubles-elimination/de1");
    expect(feedResultHref("team_match", "tm1")).toBe("/tools/team-match/tm1");
    expect(feedResultHref("ppa_tour", "match-slug")).toBe("/tran-dau/match-slug");
    expect(feedResultHref("quick_table", "ignored", "/tools/quick-tables/from-url")).toBe(
      "/tools/quick-tables/from-url",
    );
  });

  it("keeps the blog type bonus below a finished-match bonus", () => {
    expect(BLOG_TYPE_BONUS).toBe(0.25);
  });
});

describe("selectFeedResults", () => {
  const now = Date.parse("2026-11-22T00:00:00Z");

  function run(rows: Row[]) {
    return selectFeedResults(rows, {
      isResult,
      rankedAtMs: (row) => row.at,
      nowMs: now,
    }).map((row) => row.id);
  }

  it("drops posts older than 14 days and keeps a fresh result", () => {
    const ids = run([
      { id: "blog-old", kind: "blog", at: now - 20 * DAY },
      { id: "blog-new", kind: "blog", at: now - 1 * DAY },
      { id: "final-new", kind: "result", at: now - 2 * DAY },
      { id: "final-old", kind: "result", at: now - 40 * DAY },
    ]);
    expect(ids).toEqual(["blog-new", "final-new"]);
  });

  it("widens to the newest 90-day results when the 14-day window has none", () => {
    const old = Array.from({ length: FEED_WIDE_RESULT_CAP + 3 }, (_, i) => ({
      id: `r${i}`,
      kind: "result" as const,
      at: now - (20 + i) * DAY,
    }));
    const ids = run([
      { id: "blog", kind: "blog", at: now - DAY },
      ...old,
      { id: "ancient", kind: "result", at: now - FEED_RESULT_WIDE_WINDOW_MS - DAY },
    ]);
    expect(ids[0]).toBe("blog");
    expect(ids.slice(1)).toEqual(old.slice(0, FEED_WIDE_RESULT_CAP).map((row) => row.id));
    expect(ids).not.toContain("ancient");
  });

  it("treats a completed match with a winner as a result", () => {
    const ids = run([
      { id: "open", kind: "match", at: now - 20 * DAY, winning_team: null },
      { id: "done", kind: "match", at: now - 3 * DAY, winning_team: "b" },
    ]);
    expect(ids).toEqual(["done"]);
  });

  it("uses the standard window constant of 14 days", () => {
    expect(FEED_STANDARD_WINDOW_MS).toBe(14 * DAY);
  });
});

describe("interleaveFeedResults", () => {
  const blog = (id: string): Row => ({ id, kind: "blog", at: 0 });
  const result = (id: string): Row => ({ id, kind: "result", at: 0 });

  it("leaves a blog page unchanged when there is no result", () => {
    const rows = [blog("b1"), blog("b2"), blog("b3")];
    expect(interleaveFeedResults(rows, isResult).map((row) => row.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("puts a result in every block of three when blogs would fill page 1", () => {
    const rows = [
      ...Array.from({ length: 9 }, (_, i) => blog(`b${i}`)),
      result("r0"),
      result("r1"),
      result("r2"),
    ];
    expect(interleaveFeedResults(rows, isResult, { windowSize: 9, every: 3 }).map((row) => row.id)).toEqual([
      "b0",
      "b1",
      "r0",
      "b3",
      "b4",
      "r1",
      "b6",
      "b7",
      "r2",
      "b8",
      "b5",
      "b2",
    ]);
  });

  it("does not move a result that already sits in its block", () => {
    const rows = [result("r0"), blog("b0"), blog("b1"), blog("b2"), blog("b3"), result("r1")];
    expect(interleaveFeedResults(rows, isResult, { windowSize: 6, every: 3 }).map((row) => row.id)).toEqual([
      "r0",
      "b0",
      "b1",
      "b2",
      "b3",
      "r1",
    ]);
  });

  it("keeps a leading run of results ahead of blogs", () => {
    const rows = [result("r0"), result("r1"), result("r2"), blog("b0"), blog("b1"), blog("b2")];
    expect(interleaveFeedResults(rows, isResult, { windowSize: 6, every: 3 }).map((row) => row.id)).toEqual([
      "r0",
      "r1",
      "r2",
      "b0",
      "b1",
      "b2",
    ]);
  });

  it("still places one result per three on a 20-item page", () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => blog(`b${i}`)),
      ...Array.from({ length: 4 }, (_, i) => result(`r${i}`)),
    ];
    const page = interleaveFeedResults(rows, isResult).slice(0, 20);
    for (let block = 0; block < 6; block += 1) {
      const slice = page.slice(block * 3, block * 3 + 3);
      if (block < 4) expect(slice.some(isResult)).toBe(true);
    }
    expect(page.filter(isResult)).toHaveLength(4);
  });
});

describe("dedupeFeedItems", () => {
  it("keeps the first copy when the timeline and the result overlay share an id", () => {
    const rows = dedupeFeedItems(
      [
        [{ id: "m1", from: "timeline" }],
        [{ id: "m1", from: "overlay" }, { id: "qt1", from: "overlay" }],
      ],
      (row) => row.id,
    );
    expect(rows).toEqual([
      { id: "m1", from: "timeline" },
      { id: "qt1", from: "overlay" },
    ]);
  });
});

describe("hideQuickTableMatchCopies", () => {
  const finalCard = {
    type: "result" as const,
    source_provider: "quick_table",
    tournament_name: "Sunday Cup",
    slug: "share-abc",
  };
  const semi = {
    type: "match" as const,
    slug: "qt-abcdef12-11111111",
    tournament_name: "Sunday Cup",
    source_provider: "community",
  };

  it("hides qt-* copies of the table whose final card is on the page", () => {
    const otherTable = {
      type: "match" as const,
      slug: "qt-99999999-22222222",
      tournament_name: "Monday Cup",
    };
    const sameNamePro = {
      type: "match" as const,
      slug: "ppa-open-final",
      tournament_name: "Sunday Cup",
      source_provider: "ppa_tour",
    };
    const kept = hideQuickTableMatchCopies([finalCard, semi, otherTable, sameNamePro]);
    expect(kept.map((row) => row.slug)).toEqual(["share-abc", "qt-99999999-22222222", "ppa-open-final"]);
  });

  it("keeps qt-* rows when that table has no final card", () => {
    expect(hideQuickTableMatchCopies([semi]).map((row) => row.slug)).toEqual([semi.slug]);
  });

  it("matches the SSR row shape and ignores surrounding whitespace in the table name", () => {
    const kept = hideQuickTableMatchCopies([
      {
        item_type: "result",
        source_provider: "quick_table",
        tournament_name: "Sunday Cup",
        slug: "share-abc",
      },
      {
        item_type: "match",
        slug: "QT-abcdef12-11111111",
        tournament_name: "  sunday cup ",
      },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.slug).toBe("share-abc");
  });

  it("does not hide a copy it cannot tie to a table", () => {
    const kept = hideQuickTableMatchCopies([
      { type: "result", source_provider: "quick_table", tournament_name: " ", slug: "share-abc" },
      { type: "match", slug: "qt-abcdef12-11111111", tournament_name: "" },
    ]);
    expect(kept).toHaveLength(2);
  });
});

describe("feed recency ordering", () => {
  interface RecencyRow {
    type: string;
    kind?: string;
    ranked_at?: string | null;
    published_at?: string | null;
    cursor_id: string;
  }
  // 2026-11-24 11:05 in Ho Chi Minh City - when Cuong checked his feed.
  const NOW = Date.parse("2026-11-24T04:05:00Z");

  it("ranks a later played match above an earlier one when ranked_at is played_at", () => {
    // The RPC sets ranked_at to played_at. A backfill must not jump the
    // queue by carrying a newer insert timestamp in some other field.
    const rows: RecencyRow[] = [
      {
        type: "match",
        ranked_at: "2026-11-18T12:00:00Z",
        published_at: "2026-11-18T12:00:00Z",
        cursor_id: "match:nations-cup",
      },
      {
        type: "match",
        ranked_at: "2026-11-23T18:00:00Z",
        published_at: "2026-11-23T18:00:00Z",
        cursor_id: "match:ppa",
      },
    ];
    expect(sortFeedByRecency(rows, NOW).map((r) => r.cursor_id)).toEqual([
      "match:ppa",
      "match:nations-cup",
    ]);
  });

  it("puts this morning's news above yesterday's pro results and blogs", () => {
    const rows: RecencyRow[] = [
      { type: "result", ranked_at: "2026-11-23T13:00:00Z", cursor_id: "result:daytona-final" },
      { type: "blog", ranked_at: "2026-11-23T02:00:00Z", published_at: "2026-11-23T02:00:00Z", cursor_id: "blog:vi" },
      { type: "news", published_at: "2026-11-24T01:30:00Z", cursor_id: "news:manila-showcase" },
      { type: "match", ranked_at: "2026-11-24T00:30:00Z", cursor_id: "match:community" },
    ];
    expect(sortFeedByRecency(rows, NOW).map((r) => r.cursor_id)).toEqual([
      "news:manila-showcase",
      "match:community",
      "result:daytona-final",
      "blog:vi",
    ]);
  });

  it("sorts a live happening as happening now, ahead of older items", () => {
    const rows: RecencyRow[] = [
      { type: "news", published_at: "2026-11-24T03:00:00Z", cursor_id: "news:a" },
      { type: "happening", kind: "live", published_at: "2026-11-24T01:00:00Z", cursor_id: "live:1" },
    ];
    expect(sortFeedByRecency(rows, NOW)[0].cursor_id).toBe("live:1");
  });

  it("prefers ranked_at over published_at and clamps future timestamps to now", () => {
    const row: RecencyRow = {
      type: "match",
      ranked_at: "2026-11-24T02:00:00Z",
      published_at: "2026-11-20T02:00:00Z",
      cursor_id: "match:x",
    };
    expect(feedRecencyMs(row, NOW)).toBe(Date.parse("2026-11-24T02:00:00Z"));
    expect(
      feedRecencyMs({ type: "happening", kind: "event", published_at: "2026-12-01T00:00:00Z", cursor_id: "event:f" }, NOW),
    ).toBe(NOW);
  });

  it("sinks items with no parseable timestamp and breaks ties by cursor_id DESC", () => {
    const rows: RecencyRow[] = [
      { type: "news", published_at: "not-a-date", cursor_id: "news:broken" },
      { type: "news", published_at: "2026-11-24T01:00:00Z", cursor_id: "news:a" },
      { type: "news", published_at: "2026-11-24T01:00:00Z", cursor_id: "news:b" },
    ];
    expect(sortFeedByRecency(rows, NOW).map((r) => r.cursor_id)).toEqual([
      "news:b",
      "news:a",
      "news:broken",
    ]);
  });

  it("does not mutate the input array", () => {
    const rows: RecencyRow[] = [
      { type: "news", published_at: "2026-11-24T01:00:00Z", cursor_id: "news:a" },
      { type: "news", published_at: "2026-11-24T02:00:00Z", cursor_id: "news:b" },
    ];
    sortFeedByRecency(rows, NOW);
    expect(rows.map((r) => r.cursor_id)).toEqual(["news:a", "news:b"]);
  });
});

describe("partitionFeedBySeen", () => {
  const keyOf = (row: { cursor_id: string }) => row.cursor_id;
  const rows = [
    { cursor_id: "embed:reel" },
    { cursor_id: "news:a" },
    { cursor_id: "news:b" },
    { cursor_id: "match:c" },
  ];

  it("moves seen items below every unseen item, preserving order in each group", () => {
    const out = partitionFeedBySeen(rows, new Set(["embed:reel", "news:b"]), keyOf);
    expect(out.map((r) => r.cursor_id)).toEqual([
      "news:a",
      "match:c",
      "embed:reel",
      "news:b",
    ]);
  });

  it("removes nothing - seen items stay reachable by scrolling", () => {
    const out = partitionFeedBySeen(rows, new Set(rows.map((r) => r.cursor_id)), keyOf);
    expect(out.map((r) => r.cursor_id)).toEqual(rows.map((r) => r.cursor_id));
  });

  it("is a no-op copy when nothing has been seen", () => {
    const out = partitionFeedBySeen(rows, new Set<string>(), keyOf);
    expect(out.map((r) => r.cursor_id)).toEqual(rows.map((r) => r.cursor_id));
    expect(out).not.toBe(rows);
  });
});

describe("computeEffectiveSeenIds", () => {
  it("revives a seen item whose engagement grew since the mark", () => {
    const entries = new Map([
      ["match:a", { t: 100, e: 3 }],
      ["match:b", { t: 100, e: 5 }],
    ]);
    const current = new Map([
      ["match:a", 4],
      ["match:b", 5],
    ]);
    const seen = computeEffectiveSeenIds(entries, current);
    expect(seen.has("match:a")).toBe(false);
    expect(seen.has("match:b")).toBe(true);
  });

  it("keeps seen when the baseline or the current signal is missing", () => {
    const entries = new Map([
      ["news:x", { t: 100 }],
      ["match:y", { t: 100, e: 2 }],
    ]);
    const seen = computeEffectiveSeenIds(entries, new Map());
    expect(seen.has("news:x")).toBe(true);
    expect(seen.has("match:y")).toBe(true);
  });

  it("keeps seen when engagement shrank or is unchanged", () => {
    const entries = new Map([["match:a", { t: 100, e: 9 }]]);
    expect(
      computeEffectiveSeenIds(entries, new Map([["match:a", 9]])).has("match:a"),
    ).toBe(true);
    expect(
      computeEffectiveSeenIds(entries, new Map([["match:a", 1]])).has("match:a"),
    ).toBe(true);
  });
});
