// @vitest-environment jsdom
// The results table embedded in the World Cup results article. The hook is
// mocked; what matters here is that the three states are distinguishable
// (results / nothing yet / could not ask), that the winner comes from
// leader_side rather than the frozen score, and that the page never calls a
// recorded score official.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { WcProMatchRow } from "@/hooks/useWcProLive";
import type { WcResultsFeed } from "@/hooks/useWcResults";

const resultsMock = vi.fn<() => { data: WcResultsFeed | undefined; isLoading: boolean; isError: boolean }>();
vi.mock("@/hooks/useWcResults", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useWcResults")>()),
  useWcResults: () => resultsMock(),
}));

import { WorldCupResultsBoard } from "../WorldCupResultsBoard";

const match = (over: Partial<WcProMatchRow> = {}): WcProMatchRow => ({
  match_id: "m1",
  category_id: "pro_singles_mens",
  division_name: null,
  round_name: "Quarterfinal",
  round_num: 4,
  entry_a_name: "Nguyễn Khánh Nam",
  entry_a_seed: 1,
  entry_b_name: "Brad Middleton",
  entry_b_seed: 8,
  current_a: 11,
  current_b: 15,
  games_json: [{ a: 11, b: 15 }],
  serving_side: null,
  leader_side: "B",
  status: "completed",
  is_vietnam: true,
  venue_name: null,
  court_label: "1",
  scheduled_at: null,
  ...over,
});

const feed = (over: Partial<WcResultsFeed> = {}): WcResultsFeed => ({
  live: [],
  days: [{ day: "2026-08-31", matches: [match()] }],
  completedCount: 1,
  vietnamCount: 1,
  dataUpdatedAt: "2026-08-31T12:00:00Z",
  ...over,
});

const ok = (data: WcResultsFeed) => ({ data, isLoading: false, isError: false });

afterEach(() => {
  cleanup();
  resultsMock.mockReset();
});

describe("WorldCupResultsBoard", () => {
  it("renders a day heading and the match, in Vietnamese", () => {
    resultsMock.mockReturnValue(ok(feed()));
    render(<WorldCupResultsBoard language="vi" />);
    expect(screen.getByText("Ngày 31/8/2026")).toBeTruthy();
    expect(screen.getByText(/Nguyễn Khánh Nam/)).toBeTruthy();
    expect(screen.getByText("11-15")).toBeTruthy();
  });

  it("names the winner from leader_side, not from the frozen score", () => {
    // A trails 11-15 on the last observed game but leader_side says A won.
    resultsMock.mockReturnValue(
      ok(feed({ days: [{ day: "2026-08-31", matches: [match({ leader_side: "A" })] }] })),
    );
    render(<WorldCupResultsBoard language="en" />);
    const cells = screen.getAllByRole("cell");
    expect(cells[cells.length - 1].textContent).toBe("Nguyễn Khánh Nam");
  });

  it("separates matches on court now from the finished days", () => {
    resultsMock.mockReturnValue(
      ok(feed({ live: [match({ match_id: "live1", status: "in_progress" })] })),
    );
    render(<WorldCupResultsBoard language="vi" />);
    expect(screen.getByText("Đang thi đấu")).toBeTruthy();
    expect(screen.getByText("Ngày 31/8/2026")).toBeTruthy();
  });

  it("never presents a recorded score as an official final", () => {
    resultsMock.mockReturnValue(ok(feed()));
    const { container } = render(<WorldCupResultsBoard language="vi" />);
    expect(container.textContent).toContain("Tỉ số ghi nhận");
    expect(container.textContent).toContain("không phải kết quả chính thức");
  });

  it("distinguishes an outage from an empty draw", () => {
    resultsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const { container: errored } = render(<WorldCupResultsBoard language="vi" />);
    expect(errored.textContent).toContain("Không tải được");
    cleanup();

    resultsMock.mockReturnValue(
      ok(feed({ live: [], days: [], completedCount: 0, vietnamCount: 0, dataUpdatedAt: null })),
    );
    const { container: empty } = render(<WorldCupResultsBoard language="vi" />);
    expect(empty.textContent).toContain("Chưa có trận Pro nào");
    expect(empty.textContent).not.toContain("Không tải được");
  });

  it("shows a loading line rather than an empty table", () => {
    resultsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<WorldCupResultsBoard language="en" />);
    expect(screen.getByText("Loading results…")).toBeTruthy();
  });
});
