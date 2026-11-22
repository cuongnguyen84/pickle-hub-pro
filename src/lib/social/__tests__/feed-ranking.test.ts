import { describe, expect, it } from "vitest";
import {
  BLOG_TYPE_BONUS,
  FEED_RESULT_WIDE_WINDOW_MS,
  FEED_STANDARD_WINDOW_MS,
  FEED_WIDE_RESULT_CAP,
  dedupeFeedItems,
  feedResultHref,
  feedResultLabels,
  interleaveFeedResults,
  isMatchResult,
  selectFeedResults,
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
