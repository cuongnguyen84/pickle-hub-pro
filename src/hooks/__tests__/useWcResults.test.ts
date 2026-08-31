// The grouping the results article depends on. The trap worth a test: two
// different clocks. scheduled_at is the organizers' Vietnam wall-clock stored
// verbatim, so shifting it by +7 would file every evening match under tomorrow;
// last_seen_at is a real UTC instant and does need the shift. Getting this
// wrong splits a single day of play across two headings on the page.

import { describe, it, expect, vi, beforeEach } from "vitest";

const limit = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => ({ limit }) }) }),
  },
}));

import { fetchWcResults, matchDayKey, vnDayFromUtc } from "../useWcResults";

const row = (over: Record<string, unknown> = {}) => ({
  match_id: "m1",
  category_id: "pro_singles_mens",
  division_name: null,
  round_name: "Quarterfinal",
  round_num: 4,
  entry_a_name: "Nguyễn Khánh Nam",
  entry_a_seed: null,
  entry_b_name: "Brad Middleton",
  entry_b_seed: null,
  current_a: 11,
  current_b: 15,
  games_json: [],
  serving_side: null,
  leader_side: "B",
  status: "completed",
  is_vietnam: true,
  venue_name: null,
  court_label: null,
  scheduled_at: "2026-08-31T20:00:00+00:00",
  last_seen_at: "2026-08-31T12:00:00Z",
  ...over,
});

beforeEach(() => {
  limit.mockReset();
});

describe("vnDayFromUtc", () => {
  it("keeps a late Vietnam evening on its own day", () => {
    expect(vnDayFromUtc("2026-08-31T16:30:00Z")).toBe("2026-08-31");
  });

  it("rolls over at Vietnam midnight, not UTC midnight", () => {
    expect(vnDayFromUtc("2026-08-31T18:00:00Z")).toBe("2026-09-01");
  });

  it("is empty for a missing or unparseable value", () => {
    expect(vnDayFromUtc(null)).toBe("");
    expect(vnDayFromUtc(undefined)).toBe("");
    expect(vnDayFromUtc("whenever")).toBe("");
  });
});

describe("matchDayKey", () => {
  it("takes scheduled_at's date verbatim — it is already Vietnam wall-clock", () => {
    // 20:00 on Aug 31 in Da Nang. Adding +7 would file it under September 1.
    expect(
      matchDayKey({ scheduled_at: "2026-08-31T20:00:00+00:00", last_seen_at: null }),
    ).toBe("2026-08-31");
  });

  it("falls back to last_seen_at, shifted, when the match has no scheduled time", () => {
    expect(matchDayKey({ scheduled_at: null, last_seen_at: "2026-08-31T18:00:00Z" })).toBe(
      "2026-09-01",
    );
  });

  it("ignores an unparseable scheduled_at rather than bucketing on garbage", () => {
    expect(matchDayKey({ scheduled_at: "soon", last_seen_at: "2026-08-31T02:00:00Z" })).toBe(
      "2026-08-31",
    );
  });
});

describe("fetchWcResults", () => {
  it("groups completed matches by playing day, newest day first", async () => {
    limit.mockResolvedValue({
      data: [
        row({ match_id: "a", scheduled_at: "2026-08-30T09:00:00+00:00" }),
        row({ match_id: "b", scheduled_at: "2026-08-31T09:00:00+00:00" }),
      ],
      error: null,
    });
    const feed = await fetchWcResults();
    expect(feed.days.map((d) => d.day)).toEqual(["2026-08-31", "2026-08-30"]);
    expect(feed.completedCount).toBe(2);
    expect(feed.dataUpdatedAt).toBe("2026-08-31T12:00:00Z");
  });

  it("keeps in-progress matches out of the day buckets", async () => {
    limit.mockResolvedValue({
      data: [row({ match_id: "live", status: "in_progress" }), row({ match_id: "done" })],
      error: null,
    });
    const feed = await fetchWcResults();
    expect(feed.live.map((m) => m.match_id)).toEqual(["live"]);
    expect(feed.days[0].matches.map((m) => m.match_id)).toEqual(["done"]);
    expect(feed.completedCount).toBe(1);
    expect(feed.vietnamCount).toBe(1);
  });

  it("throws on a query error so the UI can say it could not ask", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchWcResults()).rejects.toBeTruthy();
  });
});
