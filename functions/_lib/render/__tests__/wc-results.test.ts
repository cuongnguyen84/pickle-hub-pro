// Guards on the World Cup results block that the article's credibility rests on:
// the day grouping is Vietnam time (a match finishing at 23:30 VN must not land
// on the previous day), the winner column comes from leader_side and never from
// the frozen score, and a Supabase failure degrades to an empty block rather
// than throwing on a page Google crawls every five minutes.

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "../../supabase";
import {
  fetchWcResultsBlock,
  matchDayKey,
  selectDaysForDisplay,
  vnDayFromUtc,
  vnStamp,
} from "../wc-results";

type Row = Record<string, unknown>;

/** Minimal stand-in for the PostgREST builder chain the module uses. */
function fakeSupabase(rows: Row[] | null, error: unknown = null): SupabaseClient {
  // The module pages with .range(); one short page ends the loop.
  let served = false;
  const builder = {
    select: () => builder,
    order: () => builder,
    range: () => {
      const payload = served ? { data: [], error } : { data: rows, error };
      served = true;
      return Promise.resolve(payload);
    },
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
  scheduled_at: "2026-08-31T09:00:00+00:00",
};

describe("vnDayFromUtc", () => {
  it("puts a late-evening Vietnam finish on that Vietnam day", () => {
    // 2026-08-31T16:30:00Z is 23:30 on Aug 31 in Vietnam, not Sep 1.
    expect(vnDayFromUtc("2026-08-31T16:30:00Z")).toBe("2026-08-31");
  });

  it("rolls over at Vietnam midnight, not UTC midnight", () => {
    // 18:00Z is 01:00 the next day in Vietnam.
    expect(vnDayFromUtc("2026-08-31T18:00:00Z")).toBe("2026-09-01");
  });

  it("returns empty for a missing or unparseable timestamp", () => {
    expect(vnDayFromUtc(null)).toBe("");
    expect(vnDayFromUtc("not a date")).toBe("");
  });
});

describe("fetchWcResultsBlock", () => {
  it("groups completed matches by Vietnam day, newest day first", async () => {
    const block = await fetchWcResultsBlock(
      fakeSupabase([
        { ...base, match_id: "m1", scheduled_at: "2026-08-30T09:00:00+00:00", last_seen_at: "2026-08-30T12:00:00Z" },
        { ...base, match_id: "m2", scheduled_at: "2026-08-31T09:00:00+00:00", last_seen_at: "2026-08-31T12:00:00Z" },
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

  it("states the table's scope instead of implying it holds everything", async () => {
    const vi = await fetchWcResultsBlock(
      fakeSupabase([{ ...base, match_id: "m1", last_seen_at: "2026-08-31T12:00:00Z" }]),
      "vi",
    );
    expect(vi.html).toContain("mọi trận Pro đã kết thúc");
    const en = await fetchWcResultsBlock(
      fakeSupabase([{ ...base, match_id: "m1", last_seen_at: "2026-08-31T12:00:00Z" }]),
      "en",
    );
    expect(en.html).toContain("every completed match across the five Pro individual draws");
  });

  it("generates the dateline from the feed rather than the prose", async () => {
    const block = await fetchWcResultsBlock(
      fakeSupabase([{ ...base, match_id: "m1", last_seen_at: "2026-08-31T10:42:00Z" }]),
      "vi",
    );
    // 10:42 UTC is 17:42 in Vietnam.
    expect(block.html).toContain("17:42 · 31/8/2026");
    expect(block.html).toContain("Cập nhật lần cuối");
  });

  it("names the bracket's winner as the winner, not a hedge", async () => {
    const vi = await fetchWcResultsBlock(
      fakeSupabase([{ ...base, match_id: "m1", last_seen_at: "2026-08-31T12:00:00Z" }]),
      "vi",
    );
    expect(vi.html).toContain("Thắng");
    expect(vi.html).toContain("trang nhánh đấu chính thức");
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

  it("takes the playing day from scheduled_at, which is already Vietnam time", () => {
    // 20:00 on Aug 31 in Da Nang. A +7 shift would file it under September 1.
    expect(matchDayKey({ scheduled_at: "2026-08-31T20:00:00+00:00", last_seen_at: null })).toBe(
      "2026-08-31",
    );
    expect(matchDayKey({ scheduled_at: null, last_seen_at: "2026-08-31T18:00:00Z" })).toBe(
      "2026-09-01",
    );
  });

  it("spends the display budget newest-first and never drops a Vietnamese match", () => {
    // Three days of five matches each, one Vietnamese per day. A budget of 10
    // pays for the two newest days in full; the third may keep only its VN row.
    const rows = ["2026-09-02", "2026-09-01", "2026-08-31"].flatMap((day, di) =>
      Array.from({ length: 5 }, (_, i) => ({
        ...base,
        match_id: `d${di}m${i}`,
        is_vietnam: i === 0,
        scheduled_at: `${day}T09:00:00+00:00`,
      })),
    );
    const { days, trimmed } = selectDaysForDisplay(rows, 10);
    expect(days.map((d) => [d.day, d.matches.length])).toEqual([
      ["2026-09-02", 5],
      ["2026-09-01", 5],
      ["2026-08-31", 1],
    ]);
    expect(trimmed).toBe(true);
    // The survivor of the trimmed day is the Vietnamese one, not just the first.
    expect(days[2].matches[0].is_vietnam).toBe(true);
  });

  it("does not report trimming when everything fits", () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ ...base, match_id: `m${i}` }));
    const { days, trimmed } = selectDaysForDisplay(rows, 10);
    expect(trimmed).toBe(false);
    expect(days[0].matches).toHaveLength(3);
  });

  it("formats the Vietnam stamp, and nothing for a missing one", () => {
    expect(vnStamp("2026-08-31T10:42:00Z")).toBe("17:42 · 31/8/2026");
    expect(vnStamp(null)).toBe("");
    expect(vnStamp("nope")).toBe("");
  });
});
