// @vitest-environment jsdom
// Panel behaviour that is easy to break: it must hide itself when there is no
// feed (so /live never shows an empty World Cup box out of season), and it must
// put Vietnam's group first (that is the whole point for a ~95% Vietnamese
// audience). The data comes through a mocked useWcOpenLive.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { WcOpenFeed } from "@/hooks/useWcOpenLive";

const mockFeed = vi.fn<() => { data: WcOpenFeed | undefined; isLoading: boolean; isError: boolean }>();
vi.mock("@/hooks/useWcOpenLive", () => ({ useWcOpenLive: () => mockFeed() }));

import { WorldCupOpenPanel } from "../WorldCupOpenPanel";

const team = (slug: string, group: string, en: string, vi: string, cc: string) => ({
  slug, group_letter: group, seed: null, name_vi: vi, name_en: en, country_code: cc,
});
const feed = (): WcOpenFeed => ({
  drawOnly: true,
  hasLive: false,
  groups: [
    { letter: "B", teams: [team("usa", "B", "USA", "Mỹ", "US")], matches: [] },
    { letter: "A", teams: [team("viet_nam", "A", "Viet Nam", "Việt Nam", "VN"), team("chile", "A", "Chile", "Chile", "CL")], matches: [] },
  ],
});

afterEach(() => { cleanup(); mockFeed.mockReset(); });

describe("WorldCupOpenPanel", () => {
  it("renders nothing when the feed is empty", () => {
    mockFeed.mockReturnValue({ data: { groups: [], hasLive: false, drawOnly: true }, isLoading: false, isError: false });
    const { container } = render(<WorldCupOpenPanel language="vi" />);
    expect(container.querySelector(".wcop")).toBeNull();
  });

  it("renders nothing on error", () => {
    mockFeed.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const { container } = render(<WorldCupOpenPanel language="vi" />);
    expect(container.querySelector(".wcop")).toBeNull();
  });

  it("puts Vietnam's group first even though it is group A after group B in the data", () => {
    mockFeed.mockReturnValue({ data: feed(), isLoading: false, isError: false });
    const { container } = render(<WorldCupOpenPanel language="vi" />);
    const letters = [...container.querySelectorAll(".wcop-group-letter")].map((n) => n.textContent);
    expect(letters[0]).toContain("A");
    expect(container.querySelector(".wcop-group--vn")).not.toBeNull();
  });

  it("shows the draw-only status before the team competition starts", () => {
    mockFeed.mockReturnValue({ data: feed(), isLoading: false, isError: false });
    render(<WorldCupOpenPanel language="vi" />);
    expect(screen.getByText(/khởi tranh 3\/9/)).toBeTruthy();
  });

  it("uses Vietnamese names in VI and English names in EN", () => {
    mockFeed.mockReturnValue({ data: feed(), isLoading: false, isError: false });
    const { container, rerender } = render(<WorldCupOpenPanel language="vi" />);
    const names = () => [...container.querySelectorAll(".wcop-team-name")].map((n) => n.textContent);
    expect(names()).toContain("Việt Nam");
    rerender(<WorldCupOpenPanel language="en" />);
    expect(names()).toContain("Viet Nam");
  });
});
