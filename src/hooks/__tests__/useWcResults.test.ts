// The grouping the results article depends on: Vietnam-time days (a match
// finishing at 23:30 in Da Nang belongs to that day, not the next), completed
// separated from in-progress, and dataUpdatedAt as the newest last_seen_at —
// which is what the page publishes as its dateModified.

import { describe, it, expect, vi, beforeEach } from "vitest";

const limit = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => ({ limit }) }) }),
  },
}));

import { fetchWcResults, vnDayKey } from "../useWcResults";

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
  scheduled_at: null,
  last_seen_at: "2026-08-31T12:00:00Z",
  ...over,
});

beforeEach(() => {
  limit.mockReset();
});

describe("vnDayKey", () => {
  it("keeps a late Vietnam evening on its own day", () => {
    expect(vnDayKey("2026-08-31T16:30:00Z")).toBe("2026-08-31");
  });

  it("rolls over at Vietnam midnight, not UTC midnight", () => {
    expect(vnDayKey("2026-08-31T18:00:00Z")).toBe("2026-09-01");
  });

  it("is empty for a missing or unparseable value", () => {
    expect(vnDayKey(null)).toBe("");
    expect(vnDayKey(undefined)).toBe("");
    expect(vnDayKey("whenever")).toBe("");
  });
});

describe("fetchWcResults", () => {
  it("groups completed matches by Vietnam day, newest first", async () => {
    limit.mockResolvedValue({
      data: [
        row({ match_id: "a", last_seen_at: "2026-08-30T12:00:00Z" }),
        row({ match_id: "b", last_seen_at: "2026-08-31T12:00:00Z" }),
      ],
      error: null,
    });
    const feed = (await fetchWcResults()) as {
      days: { day: string; matches: unknown[] }[];
      completedCount: number;
      dataUpdatedAt: string | null;
    };
    expect(feed.days.map((d) => d.day)).toEqual(["2026-08-31", "2026-08-30"]);
    expect(feed.completedCount).toBe(2);
    expect(feed.dataUpdatedAt).toBe("2026-08-31T12:00:00Z");
  });

  it("keeps in-progress matches out of the day buckets", async () => {
    limit.mockResolvedValue({
      data: [row({ match_id: "live", status: "in_progress" }), row({ match_id: "done" })],
      error: null,
    });
    const feed = (await fetchWcResults()) as {
      live: { match_id: string }[];
      days: { matches: { match_id: string }[] }[];
      completedCount: number;
      vietnamCount: number;
    };
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
