// @vitest-environment jsdom
// The home-page World Cup card, two modes: "Livescore" (up to two live matches,
// a score per side, Vietnamese first and highlighted) when a match is live, and
// "Kết quả hôm nay" (today's finished Vietnamese matches with full scorelines)
// when nothing is live. Hidden only when there is neither. Always links to /live.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { WcProFeed, WcProMatchRow, WcProEventGroup } from "@/hooks/useWcProLive";

const proMock = vi.fn<() => { data: WcProFeed | undefined; isLoading: boolean; isError: boolean }>();
vi.mock("@/hooks/useWcProLive", async (orig) => ({ ...(await orig<typeof import("@/hooks/useWcProLive")>()), useWcProLive: () => proMock() }));

import { WorldCupLiveCard } from "../WorldCupLiveCard";

const match = (over: Partial<WcProMatchRow>): WcProMatchRow => ({
  match_id: "m1", category_id: "pro_singles_mens", division_name: null, round_name: "Round of 32",
  round_num: 3, entry_a_name: "Nguyễn Văn Linh", entry_a_seed: 1, entry_b_name: "Kento Tamaki",
  entry_b_seed: 2, current_a: 11, current_b: 7, games_json: [], serving_side: "A",
  leader_side: "A", status: "in_progress", is_vietnam: true, venue_name: null,
  court_label: null, scheduled_at: null, ...over,
});
const feed = (live: WcProMatchRow[], liveCount = live.length): WcProFeed => ({
  events: live.length ? [{ event: "pro_singles_mens", live, vietnam: [] } as WcProEventGroup] : [],
  liveCount,
});
const wrap = (lang: "vi" | "en") => render(<MemoryRouter><WorldCupLiveCard language={lang} /></MemoryRouter>);

afterEach(() => { cleanup(); proMock.mockReset(); });

describe("WorldCupLiveCard", () => {
  it("hides when nothing is live, even if there are scheduled events", () => {
    proMock.mockReturnValue({
      data: { events: [{ event: "pro_singles_mens", live: [], vietnam: [match({ status: "scheduled" })] }], liveCount: 0 },
      isLoading: false, isError: false,
    });
    const { container } = wrap("vi");
    expect(container.querySelector(".wclc")).toBeNull();
  });

  it("shows the logo, the Livescore header and the live count", () => {
    proMock.mockReturnValue({ data: feed([match({})], 4), isLoading: false, isError: false });
    const { container } = wrap("vi");
    expect(screen.getByText("Livescore")).toBeTruthy();
    expect(screen.getByText(/4 trận/)).toBeTruthy();
    const img = container.querySelector(".wclc-logo img");
    expect(img?.getAttribute("src")).toBe("/images/world-cup-2026-logo.jpg");
  });

  it("shows a score per side and highlights the Vietnamese name and the leader", () => {
    const { container } = (proMock.mockReturnValue({ data: feed([match({ current_a: 11, current_b: 7, leader_side: "A" })]), isLoading: false, isError: false }), wrap("vi"));
    expect(screen.getByText("Nguyễn Văn Linh")).toBeTruthy();
    expect(screen.getByText("11")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    const vn = [...container.querySelectorAll(".wclc-m-name--vn")].map((n) => n.textContent);
    expect(vn).toContain("Nguyễn Văn Linh");
    expect(vn).not.toContain("Kento Tamaki");
    expect(container.querySelectorAll(".wclc-m-row--win").length).toBe(1);
  });

  it("shows at most two matches, Vietnamese first", () => {
    proMock.mockReturnValue({
      data: feed([
        match({ match_id: "f1", entry_a_name: "Patrick Kawka", entry_b_name: "Yuta Yoshida", is_vietnam: false }),
        match({ match_id: "f2", entry_a_name: "Alex Newman", entry_b_name: "Sam Tan", is_vietnam: false }),
        match({ match_id: "vn", entry_a_name: "Lê Xuân Đức", entry_b_name: "Stanley Owusu" }),
      ], 3),
      isLoading: false, isError: false,
    });
    const { container } = wrap("vi");
    expect(container.querySelectorAll(".wclc-m").length).toBe(2);
    expect(screen.getByText("Lê Xuân Đức")).toBeTruthy(); // VN pulled into the top two
  });

  it("links to /live in the right language", () => {
    proMock.mockReturnValue({ data: feed([match({})]), isLoading: false, isError: false });
    const { container } = wrap("en");
    const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain("/live");
  });

  // ── Results mode: nothing live → today's finished Vietnamese matches ────────
  const todayIso = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10) + "T05:00:00+00:00";
  const resultsFeed = (vietnam: WcProMatchRow[]): WcProFeed => ({
    events: [{ event: "pro_singles_mens", live: [], vietnam } as WcProEventGroup],
    liveCount: 0,
  });

  it("falls back to today's results when nothing is live", () => {
    proMock.mockReturnValue({
      data: resultsFeed([
        match({ match_id: "r1", status: "completed", current_a: null, current_b: null, games_json: [{ a: 15, b: 17 }, { a: 15, b: 10 }, { a: 15, b: 9 }], leader_side: "A", scheduled_at: todayIso }),
      ]),
      isLoading: false, isError: false,
    });
    const { container } = wrap("vi");
    expect(container.querySelector(".wclc")).not.toBeNull();
    expect(screen.getByText(/Kết quả hôm nay/)).toBeTruthy();
    // full per-game scoreline, not a single game
    expect(screen.getByText("15-17, 15-10, 15-9")).toBeTruthy();
    expect(container.querySelector(".wclc-dot")).toBeNull(); // no live pulse in results mode
    // the winner (side A) is marked; colour never signals nationality here
    const winRow = container.querySelector(".wclc-r-row--win");
    expect(winRow?.textContent).toContain("Nguyễn Văn Linh");
    expect(container.querySelector(".wclc-r-tick")).not.toBeNull();
    expect(container.querySelector(".wclc-m-name--vn")).toBeNull();
  });

  it("does not count a result from another day as today", () => {
    proMock.mockReturnValue({
      data: resultsFeed([
        match({ match_id: "old", status: "completed", current_a: null, current_b: null, games_json: [{ a: 21, b: 10 }], leader_side: "A", scheduled_at: "2026-08-30T05:00:00+00:00" }),
      ]),
      isLoading: false, isError: false,
    });
    const { container } = wrap("vi");
    expect(container.querySelector(".wclc")).toBeNull();
  });

  it("prefers live over results when a match is live", () => {
    proMock.mockReturnValue({
      data: {
        events: [{
          event: "pro_singles_mens",
          live: [match({ match_id: "L", status: "in_progress" })],
          vietnam: [match({ match_id: "r", status: "completed", current_a: null, current_b: null, games_json: [{ a: 15, b: 9 }], scheduled_at: todayIso })],
        }],
        liveCount: 1,
      },
      isLoading: false, isError: false,
    });
    wrap("vi");
    expect(screen.getByText("Livescore")).toBeTruthy();
    expect(screen.queryByText(/Kết quả hôm nay/)).toBeNull();
  });
});
