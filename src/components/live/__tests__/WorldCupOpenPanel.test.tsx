// @vitest-environment jsdom
// WorldCupOpenContent is presentational — it takes a WcOpenFeed and renders the
// groups. Vietnam's group must come first (the point for a ~95% Vietnamese
// audience), names follow the language, and the draw-only status shows before
// the team competition starts.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { WcOpenFeed } from "@/hooks/useWcOpenLive";
import { WorldCupOpenContent } from "../WorldCupOpenPanel";

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

afterEach(cleanup);

describe("WorldCupOpenContent", () => {
  it("puts Vietnam's group first even though group B precedes it in the data", () => {
    const { container } = render(<WorldCupOpenContent feed={feed()} language="vi" />);
    const letters = [...container.querySelectorAll(".wcop-group-letter")].map((n) => n.textContent);
    expect(letters[0]).toContain("A");
    expect(container.querySelector(".wcop-group--vn")).not.toBeNull();
  });

  it("shows the draw-only status before the team competition starts", () => {
    render(<WorldCupOpenContent feed={feed()} language="vi" />);
    expect(screen.getByText(/khởi tranh 3\/9/)).toBeTruthy();
  });

  it("uses Vietnamese names in VI and English names in EN", () => {
    const { container, rerender } = render(<WorldCupOpenContent feed={feed()} language="vi" />);
    const names = () => [...container.querySelectorAll(".wcop-team-name")].map((n) => n.textContent);
    expect(names()).toContain("Việt Nam");
    rerender(<WorldCupOpenContent feed={feed()} language="en" />);
    expect(names()).toContain("Viet Nam");
  });
});
