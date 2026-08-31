// @vitest-environment jsdom
// The home-page livescore card: hides unless a match is live, shows the logo
// beside a "Livescore" header, renders up to two live matches with a score
// per side (Vietnamese players first and highlighted), and links to /live.

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
});
