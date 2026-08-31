// Guards on the World Cup results block that the article's credibility rests on:
// the day grouping is Vietnam time (a match finishing at 23:30 VN must not land
// on the previous day), the winner column comes from leader_side and never from
// the frozen score, and a Supabase failure degrades to an empty block rather
// than throwing on a page Google crawls every five minutes.

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "../../supabase";
import { fetchWcResultsBlock, vnDayKey } from "../wc-results";

type Row = Record<string, unknown>;

/** Minimal stand-in for the PostgREST builder chain the module uses. */
function fakeSupabase(rows: Row[] | null, error: unknown = null): SupabaseClient {
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({ data: rows, error }),
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

const base = {
  category_id: "pro_singles_mens",
  round_name: "Quarterfinal",
  entry_a_name: "Nguyễn Khánh Nam",
  entry_b_name: "Brad Middleton",
  current_a: 11,
  current_b: 15,
  games_json: [{ a: 11, b: 15 }],
  leader_side: "B",
  status: "completed",
  is_vietnam: true,
  court_label: "1",
  scheduled_at: null,
};

describe("vnDayKey", () => {
  it("puts a late-evening Vietnam finish on that Vietnam day", () => {
    // 2026-08-31T16:30:00Z is 23:30 on Aug 31 in Vietnam, not Sep 1.
    expect(vnDayKey("2026-08-31T16:30:00Z")).toBe("2026-08-31");
  });

  it("rolls over at Vietnam midnight, not UTC midnight", () => {
    // 18:00Z is 01:00 the next day in Vietnam.
    expect(vnDayKey("2026-08-31T18:00:00Z")).toBe("2026-09-01");
  });

  it("returns empty for a missing or unparseable timestamp", () => {
    expect(vnDayKey(null)).toBe("");
    expect(vnDayKey("not a date")).toBe("");
  });
});

describe("fetchWcResultsBlock", () => {
  it("groups completed matches by Vietnam day, newest day first", async () => {
    const block = await fetchWcResultsBlock(
      fakeSupabase([
        { ...base, match_id: "m1", last_seen_at: "2026-08-30T12:00:00Z" },
        { ...base, match_id: "m2", last_seen_at: "2026-08-31T12:00:00Z" },
      ]),
      "vi",
    );
    expect(block.completedCount).toBe(2);
    expect(block.html.indexOf("31/8/2026")).toBeLessThan(block.html.indexOf("30/8/2026"));
    expect(block.dataUpdatedAt).toBe("2026-08-31T12:00:00Z");
  });

  it("names the winner from leader_side, not from the frozen score", async () => {
    // A is behind on the last observed game but leader_side says A: the source
    // is the authority, the frozen score is not.
    const block = await fetchWcResultsBlock(
      fakeSupabase([
        { ...base, match_id: "m1", leader_side: "A", last_seen_at: "2026-08-31T12:00:00Z" },
      ]),
      "en",
    );
    const lastCell = block.html.slice(block.html.lastIndexOf("<td>"));
    expect(lastCell).toContain("Nguyễn Khánh Nam");
  });

  it("separates in-progress matches from the day tables", async () => {
    const block = await fetchWcResultsBlock(
      fakeSupabase([
        { ...base, match_id: "m1", status: "in_progress", last_seen_at: "2026-08-31T12:00:00Z" },
      ]),
      "vi",
    );
    expect(block.liveCount).toBe(1);
    expect(block.completedCount).toBe(0);
    expect(block.html).toContain("Đang thi đấu");
  });

  it("never claims the score is official", async () => {
    const vi = await fetchWcResultsBlock(
      fakeSupabase([{ ...base, match_id: "m1", last_seen_at: "2026-08-31T12:00:00Z" }]),
      "vi",
    );
    expect(vi.html).toContain("ghi nhận");
    expect(vi.html).toContain("không phải kết quả chính thức");
    const en = await fetchWcResultsBlock(
      fakeSupabase([{ ...base, match_id: "m1", last_seen_at: "2026-08-31T12:00:00Z" }]),
      "en",
    );
    expect(en.html).toContain("not an official final");
  });

  it("degrades to an empty block on a query error or empty feed", async () => {
    const errored = await fetchWcResultsBlock(fakeSupabase(null, { message: "boom" }), "en");
    expect(errored).toEqual({ html: "", dataUpdatedAt: null, completedCount: 0, liveCount: 0 });
    const empty = await fetchWcResultsBlock(fakeSupabase([]), "en");
    expect(empty.html).toBe("");
  });

  it("escapes player names into the table", async () => {
    const block = await fetchWcResultsBlock(
      fakeSupabase([
        {
          ...base,
          match_id: "m1",
          entry_a_name: "<script>x</script>",
          last_seen_at: "2026-08-31T12:00:00Z",
        },
      ]),
      "en",
    );
    expect(block.html).not.toContain("<script>");
    expect(block.html).toContain("&lt;script&gt;");
  });
});
