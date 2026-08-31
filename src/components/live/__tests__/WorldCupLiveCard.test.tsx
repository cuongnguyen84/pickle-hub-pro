// @vitest-environment jsdom
// The home-page strip: hides when the feed is empty, features a Vietnamese
// player's live match with its score when one is on court, links to /live in
// the right language, and falls back gracefully when nothing is live.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { WcProFeed, WcProMatchRow, WcProEventGroup } from "@/hooks/useWcProLive";

const proMock = vi.fn<() => { data: WcProFeed | undefined; isLoading: boolean; isError: boolean }>();
vi.mock("@/hooks/useWcProLive", async (orig) => ({ ...(await orig<typeof import("@/hooks/useWcProLive")>()), useWcProLive: () => proMock() }));

import { WorldCupLiveCard } from "../WorldCupLiveCard";

const match = (over: Partial<WcProMatchRow>): WcProMatchRow => ({
  match_id: "m1", category_id: "pro_singles_mens", division_name: null, round_name: "R32",
  round_num: 3, entry_a_name: "Nguyễn Văn Linh", entry_a_seed: 1, entry_b_name: "Kento Tamaki",
  entry_b_seed: 2, current_a: 11, current_b: 7, games_json: [], serving_side: "A",
  leader_side: "A", status: "in_progress", is_vietnam: true, venue_name: null,
  court_label: null, scheduled_at: null, ...over,
});
const feed = (events: WcProEventGroup[], liveCount = 0): WcProFeed => ({ events, liveCount });
const wrap = (lang: "vi" | "en") => render(<MemoryRouter><WorldCupLiveCard language={lang} /></MemoryRouter>);

afterEach(() => { cleanup(); proMock.mockReset(); });

describe("WorldCupLiveCard", () => {
  it("hides when there is nothing to show", () => {
    proMock.mockReturnValue({ data: { events: [], liveCount: 0 }, isLoading: false, isError: false });
    const { container } = wrap("vi");
    expect(container.querySelector(".wclc")).toBeNull();
  });

  it("features a Vietnamese live match with its score and links to /vi/live", () => {
    proMock.mockReturnValue({
      data: feed([{ event: "pro_singles_mens", live: [match({ current_a: 11, current_b: 7 })], vietnam: [] }], 3),
      isLoading: false, isError: false,
    });
    const { container } = wrap("vi");
    expect(screen.getByText("Nguyễn Văn Linh")).toBeTruthy();
    expect(screen.getByText("11-7")).toBeTruthy();
    expect(screen.getByText(/3 trận/)).toBeTruthy();
    expect(container.querySelector("a.wclc")?.getAttribute("href")).toBe("/vi/live");
    // Vietnamese side is highlighted, opponent is not
    const vn = [...container.querySelectorAll(".wclc-side--vn")].map((n) => n.textContent);
    expect(vn).toContain("Nguyễn Văn Linh");
    expect(vn).not.toContain("Kento Tamaki");
  });

  it("prefers a Vietnamese match even when another is live first", () => {
    proMock.mockReturnValue({
      data: feed([
        { event: "pro_singles_mens", live: [
          match({ match_id: "foreign", entry_a_name: "Patrick Kawka", entry_b_name: "Yuta Yoshida", is_vietnam: false }),
          match({ match_id: "vn", entry_a_name: "Lê Xuân Đức", entry_b_name: "Stanley Owusu", current_a: 5, current_b: 2 }),
        ], vietnam: [] },
      ], 2),
      isLoading: false, isError: false,
    });
    wrap("vi");
    expect(screen.getByText("Lê Xuân Đức")).toBeTruthy();
    expect(screen.queryByText("Patrick Kawka")).toBeNull();
  });

  it("links to /live in English", () => {
    proMock.mockReturnValue({ data: feed([{ event: "pro_singles_mens", live: [match({})], vietnam: [] }], 1), isLoading: false, isError: false });
    const { container } = wrap("en");
    expect(container.querySelector("a.wclc")?.getAttribute("href")).toBe("/live");
  });
});
