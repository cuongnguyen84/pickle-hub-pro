// @vitest-environment jsdom
// DS-03 contract tests for the Button variant bridge. These pin the D4
// mapping table (proposal §0):
//   .tl-btn base    → variant="outline"
//   .tl-btn.primary → variant="tl-primary"  (cream — NEVER `secondary`)
//   .tl-btn.green   → variant="default"     (optic-lime)
// and the A11Y-02 touch-target sizes.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "../button";

afterEach(cleanup);

describe("Button DS-03 variants", () => {
  it("tl-primary is the cream fill (--tl-fg background, --tl-bg ink)", () => {
    render(<Button variant="tl-primary">Đăng ký</Button>);
    const btn = screen.getByRole("button", { name: "Đăng ký" });
    expect(btn.className).toContain("bg-[var(--tl-fg)]");
    expect(btn.className).toContain("text-[var(--tl-bg)]");
    // The trap the panel caught: secondary is a DARK fill under the theme.
    expect(btn.className).not.toContain("bg-secondary");
  });

  it("default stays the lime fill (bg-primary) — .tl-btn.green maps here", () => {
    render(<Button>Xác nhận</Button>);
    expect(screen.getByRole("button").className).toContain("bg-primary");
  });

  it("outline keeps transparent + border — .tl-btn base maps here", () => {
    render(<Button variant="outline">Huỷ</Button>);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("border");
    expect(cls).toContain("bg-background");
  });
});

describe("Button DS-03 touch targets (A11Y-02)", () => {
  it("default size is 44px (h-11)", () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole("button").className).toContain("h-11");
  });

  it("icon size is 44×44 (h-11 w-11)", () => {
    render(
      <Button size="icon" aria-label="Đóng">
        ×
      </Button>,
    );
    const cls = screen.getByRole("button", { name: "Đóng" }).className;
    expect(cls).toContain("h-11");
    expect(cls).toContain("w-11");
  });

  it("lg is the 48px hot-path CTA (h-12)", () => {
    render(<Button size="lg">Đăng ký ngay</Button>);
    expect(screen.getByRole("button").className).toContain("h-12");
  });

  it("sm stays 36px for dense secondary actions (documented exception)", () => {
    render(<Button size="sm">Sửa</Button>);
    expect(screen.getByRole("button").className).toContain("h-9");
  });
});
