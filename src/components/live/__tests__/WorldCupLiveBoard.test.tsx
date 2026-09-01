// @vitest-environment jsdom
// The board's level-1 tabs (Cá nhân Pro / Đội tuyển) and self-hide. Both data
// hooks are mocked; the content components are covered by their own tests.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { WcProFeed } from "@/hooks/useWcProLive";
import type { WcOpenFeed } from "@/hooks/useWcOpenLive";

const proMock = vi.fn<() => { data: WcProFeed | undefined; isLoading: boolean; isError: boolean }>();
const teamMock = vi.fn<() => { data: WcOpenFeed | undefined; isLoading: boolean; isError: boolean }>();
vi.mock("@/hooks/useWcProLive", async (orig) => ({ ...(await orig<typeof import("@/hooks/useWcProLive")>()), useWcProLive: () => proMock() }));
vi.mock("@/hooks/useWcOpenLive", async (orig) => ({ ...(await orig<typeof import("@/hooks/useWcOpenLive")>()), useWcOpenLive: () => teamMock() }));

import { WorldCupLiveBoard } from "../WorldCupLiveBoard";

const proFeed = (): WcProFeed => ({
  liveCount: 2,
  events: [{ event: "pro_singles_mens", live: [{ match_id: "m", category_id: "pro_singles_mens", division_name: null, round_name: "R32", round_num: 3, entry_a_name: "Nguyễn Văn Linh", entry_a_seed: 1, entry_b_name: "Kento Tamaki", entry_b_seed: 2, current_a: 5, current_b: 3, games_json: [], serving_side: "A", leader_side: "A", status: "in_progress", is_vietnam: true, venue_name: null, court_label: null, scheduled_at: null }], completed: [], vietnam: [] }],
});
const teamFeed = (): WcOpenFeed => ({
  drawOnly: true, hasLive: false,
  groups: [{ letter: "A", teams: [{ slug: "viet_nam", group_letter: "A", seed: null, name_vi: "Việt Nam", name_en: "Viet Nam", country_code: "VN" }], matches: [] }],
});
const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false });

afterEach(() => { cleanup(); proMock.mockReset(); teamMock.mockReset(); });

describe("WorldCupLiveBoard", () => {
  it("hides entirely when both feeds are empty", () => {
    proMock.mockReturnValue(ok({ events: [], liveCount: 0 }));
    teamMock.mockReturnValue(ok({ groups: [], hasLive: false, drawOnly: true }));
    const { container } = render(<WorldCupLiveBoard language="vi" />);
    expect(container.querySelector(".wcb")).toBeNull();
  });

  it("shows both tabs, defaults to Pro, and carries the live count", () => {
    proMock.mockReturnValue(ok(proFeed()));
    teamMock.mockReturnValue(ok(teamFeed()));
    render(<WorldCupLiveBoard language="vi" />);
    expect(screen.getByRole("tab", { name: /Cá nhân Pro/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /Cá nhân Pro/ }).textContent).toContain("2");
    // Pro content is showing (its VN player)
    expect(screen.getByText(/Nguyễn Văn Linh/)).toBeTruthy();
  });

  it("switches to the team tab on click", () => {
    proMock.mockReturnValue(ok(proFeed()));
    teamMock.mockReturnValue(ok(teamFeed()));
    render(<WorldCupLiveBoard language="vi" />);
    fireEvent.click(screen.getByRole("tab", { name: /Đội tuyển/ }));
    expect(screen.getByRole("tab", { name: /Đội tuyển/ }).getAttribute("aria-selected")).toBe("true");
    // team content: the group table
    expect(screen.getByText(/Bảng A/)).toBeTruthy();
  });

  it("falls back to the team tab when Pro has no data", () => {
    proMock.mockReturnValue(ok({ events: [], liveCount: 0 }));
    teamMock.mockReturnValue(ok(teamFeed()));
    render(<WorldCupLiveBoard language="vi" />);
    expect(screen.getByRole("tab", { name: /Đội tuyển/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/Bảng A/)).toBeTruthy();
  });
});
