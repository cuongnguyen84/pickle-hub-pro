// @vitest-environment jsdom
// The Pro board's fragile behaviours: hide when empty, show the live score line
// (finished games + current game), highlight the leading side, light up the
// Vietnamese entrant's name (and only that one), and label the event in the
// viewer's language. Data comes through a mocked useWcProLive.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { WcProFeed, WcProMatchRow } from "@/hooks/useWcProLive";

const mockFeed = vi.fn<() => { data: WcProFeed | undefined; isLoading: boolean; isError: boolean }>();
vi.mock("@/hooks/useWcProLive", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useWcProLive")>()),
  useWcProLive: () => mockFeed(),
}));

import { WorldCupProPanel } from "../WorldCupProPanel";

const match = (over: Partial<WcProMatchRow>): WcProMatchRow => ({
  match_id: "m1", category_id: "pro_singles_mens", division_name: null, round_name: "Round of 32",
  round_num: 3, entry_a_name: "Nguyễn Văn Linh", entry_a_seed: 50, entry_b_name: "Patrick Kawka",
  entry_b_seed: 97, current_a: 11, current_b: 7, games_json: [], serving_side: "A",
  leader_side: "A", status: "in_progress", is_vietnam: true, venue_name: "TIEN SON",
  court_label: "Sân 3", scheduled_at: null, ...over,
});

afterEach(() => { cleanup(); mockFeed.mockReset(); });

describe("WorldCupProPanel", () => {
  it("renders nothing when there are no events", () => {
    mockFeed.mockReturnValue({ data: { events: [], liveCount: 0 }, isLoading: false, isError: false });
    const { container } = render(<WorldCupProPanel language="vi" />);
    expect(container.querySelector(".wcpro")).toBeNull();
  });

  it("shows the live score line: finished games then the current game", () => {
    mockFeed.mockReturnValue({
      data: { liveCount: 1, events: [{ event: "pro_singles_mens", live: [match({ games_json: [{ a: 15, b: 12 }], current_a: 5, current_b: 8 })], vietnam: [] }] },
      isLoading: false, isError: false,
    });
    render(<WorldCupProPanel language="vi" />);
    expect(screen.getByText("15-12, 5-8")).toBeTruthy();
  });

  it("highlights the leading side and the Vietnamese name only", () => {
    mockFeed.mockReturnValue({
      data: { liveCount: 1, events: [{ event: "pro_singles_mens", live: [match({ leader_side: "A" })], vietnam: [] }] },
      isLoading: false, isError: false,
    });
    const { container } = render(<WorldCupProPanel language="vi" />);
    const vnNames = [...container.querySelectorAll(".wcpro-name--vn")].map((n) => n.textContent);
    expect(vnNames.join(" ")).toContain("Nguyễn Văn Linh");
    expect(vnNames.join(" ")).not.toContain("Kawka");
    // the leader row carries the win class
    const winRows = container.querySelectorAll(".wcpro-row--win");
    expect(winRows.length).toBe(1);
    expect(winRows[0].textContent).toContain("Nguyễn Văn Linh");
  });

  it("labels events per language and orders singles before doubles", () => {
    mockFeed.mockReturnValue({
      data: {
        liveCount: 0,
        events: [
          { event: "pro_mixed", live: [], vietnam: [match({ match_id: "x", category_id: "pro_mixed", status: "scheduled", leader_side: null })] },
          { event: "pro_singles_mens", live: [], vietnam: [match({ match_id: "y", status: "scheduled", leader_side: null })] },
        ],
      },
      isLoading: false, isError: false,
    });
    const { container, rerender } = render(<WorldCupProPanel language="vi" />);
    const titlesVi = [...container.querySelectorAll(".wcpro-event-title")].map((n) => n.textContent);
    expect(titlesVi[0]).toContain("Đơn nam");
    expect(titlesVi[1]).toContain("Đôi nam nữ");
    rerender(<WorldCupProPanel language="en" />);
    expect(within(container).getByText(/Men's Singles/)).toBeTruthy();
  });

  it("shows a completed match as a kept result with its score", () => {
    mockFeed.mockReturnValue({
      data: { liveCount: 0, events: [{ event: "pro_singles_womens", live: [], vietnam: [match({ category_id: "pro_singles_womens", status: "completed", games_json: [{ a: 21, b: 15 }], current_a: null, current_b: null, leader_side: "A" })] }] },
      isLoading: false, isError: false,
    });
    render(<WorldCupProPanel language="vi" />);
    expect(screen.getByText("Kết thúc")).toBeTruthy();
    expect(screen.getByText("21-15")).toBeTruthy();
  });
});
