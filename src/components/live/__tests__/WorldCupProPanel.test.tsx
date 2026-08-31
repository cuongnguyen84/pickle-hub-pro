// @vitest-environment jsdom
// WorldCupProContent is presentational — it takes a WcProFeed and renders a
// sub-tab per event, the selected event's matches below. Guards: the score line
// (finished games + current), the leading side and the Vietnamese name lighting
// up (only the VN side), event labels per language, and sub-tab switching.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { WcProFeed, WcProMatchRow, WcProEventGroup } from "@/hooks/useWcProLive";
import { WorldCupProContent } from "../WorldCupProPanel";

const match = (over: Partial<WcProMatchRow>): WcProMatchRow => ({
  match_id: "m1", category_id: "pro_singles_mens", division_name: null, round_name: "Round of 32",
  round_num: 3, entry_a_name: "Nguyễn Văn Linh", entry_a_seed: 50, entry_b_name: "Patrick Kawka",
  entry_b_seed: 97, current_a: 11, current_b: 7, games_json: [], serving_side: "A",
  leader_side: "A", status: "in_progress", is_vietnam: true, venue_name: "TIEN SON",
  court_label: "Sân 3", scheduled_at: null, ...over,
});
const evt = (over: Partial<WcProEventGroup> & { event: WcProEventGroup["event"] }): WcProEventGroup => ({
  live: [], vietnam: [], ...over,
});
const feed = (events: WcProEventGroup[], liveCount = 0): WcProFeed => ({ events, liveCount });

afterEach(cleanup);

describe("WorldCupProContent", () => {
  it("shows the live score line: finished games then the current game", () => {
    render(<WorldCupProContent feed={feed([evt({ event: "pro_singles_mens", live: [match({ games_json: [{ a: 15, b: 12 }], current_a: 5, current_b: 8 })] })], 1)} language="vi" />);
    expect(screen.getByText("15-12, 5-8")).toBeTruthy();
  });

  it("highlights the leading side and only the Vietnamese name", () => {
    const { container } = render(<WorldCupProContent feed={feed([evt({ event: "pro_singles_mens", live: [match({ leader_side: "A" })] })], 1)} language="vi" />);
    const vnNames = [...container.querySelectorAll(".wcpro-name--vn")].map((n) => n.textContent);
    expect(vnNames.join(" ")).toContain("Nguyễn Văn Linh");
    expect(vnNames.join(" ")).not.toContain("Kawka");
    const winRows = container.querySelectorAll(".wcpro-row--win");
    expect(winRows.length).toBe(1);
    expect(winRows[0].textContent).toContain("Nguyễn Văn Linh");
  });

  it("renders a sub-tab per event, singles before doubles, and switches on click", () => {
    const { container } = render(
      <WorldCupProContent
        feed={feed([
          evt({ event: "pro_mixed", vietnam: [match({ match_id: "x", category_id: "pro_mixed", status: "scheduled", entry_a_name: "Trần A", leader_side: null })] }),
          evt({ event: "pro_singles_mens", vietnam: [match({ match_id: "y", status: "scheduled", leader_side: null })] }),
        ])}
        language="vi"
      />,
    );
    const tabs = [...container.querySelectorAll(".wcpro-subtab")].map((n) => n.textContent);
    expect(tabs[0]).toContain("Đơn nam");
    expect(tabs[1]).toContain("Đôi nam nữ");
    // default tab is the first event; its match is shown
    expect(screen.getByText(/Nguyễn Văn Linh/)).toBeTruthy();
    // switch to mixed → its match shows
    fireEvent.click(screen.getByRole("tab", { name: /Đôi nam nữ/ }));
    expect(screen.getByText(/Trần A/)).toBeTruthy();
  });

  it("labels events in English too", () => {
    const { container } = render(<WorldCupProContent feed={feed([evt({ event: "pro_singles_womens", live: [match({ category_id: "pro_singles_womens" })] })], 1)} language="en" />);
    expect(within(container).getByRole("tab", { name: /Women's Singles/ })).toBeTruthy();
  });

  it("shows a completed match as a kept result with its score", () => {
    render(<WorldCupProContent feed={feed([evt({ event: "pro_singles_womens", vietnam: [match({ category_id: "pro_singles_womens", status: "completed", games_json: [{ a: 21, b: 15 }], current_a: null, current_b: null, leader_side: "A" })] })])} language="vi" />);
    expect(screen.getByText("Kết thúc")).toBeTruthy();
    expect(screen.getByText("21-15")).toBeTruthy();
  });

  it("shows the last-observed score of a completed match that has no finished games", () => {
    // The source drops a match the moment it ends, so a single-game knockout may
    // freeze with only a current game (empty games_json). It must not render blank.
    render(<WorldCupProContent feed={feed([evt({ event: "pro_singles_mens", vietnam: [match({ status: "completed", games_json: [], current_a: 7, current_b: 10, leader_side: "B" })] })])} language="vi" />);
    expect(screen.getByText("7-10")).toBeTruthy();
  });

  it("keeps the last-observed decider on a completed bo3", () => {
    render(<WorldCupProContent feed={feed([evt({ event: "pro_singles_mens", vietnam: [match({ status: "completed", games_json: [{ a: 14, b: 16 }, { a: 16, b: 14 }], current_a: 13, current_b: 5, leader_side: "A" })] })])} language="vi" />);
    expect(screen.getByText("14-16, 16-14, 13-5")).toBeTruthy();
  });

  it("does not double-print the last game when the current game duplicates it", () => {
    render(<WorldCupProContent feed={feed([evt({ event: "pro_singles_mens", vietnam: [match({ status: "completed", games_json: [{ a: 15, b: 8 }], current_a: 15, current_b: 8, leader_side: "A" })] })])} language="vi" />);
    expect(screen.getByText("15-8")).toBeTruthy();
  });
});
