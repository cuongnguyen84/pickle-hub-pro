// @vitest-environment jsdom
// A11Y-02 contract tests for non-Button controls. Visual size stays ≤20px
// (layout balance) — the 44px touch target comes from an after-inset
// pseudo-element on the control itself. These pin that contract so the
// hit-area classes are not accidentally reverted.
//   Checkbox / RadioGroupItem: 20px visual (h-5 w-5) + after:-inset-3 → 44px
//   Switch: 24×44 visual + after:-inset-y-[10px] → 44px hit height

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Checkbox } from "../checkbox";
import { RadioGroup, RadioGroupItem } from "../radio-group";
import { Switch } from "../switch";

afterEach(cleanup);

describe("A11Y-02 touch targets — non-button primitives", () => {
  it("Checkbox: 20px visual + after-inset pseudo hit area", () => {
    render(<Checkbox aria-label="Đồng ý" />);
    const cls = screen.getByRole("checkbox", { name: "Đồng ý" }).className;
    expect(cls).toContain("h-5");
    expect(cls).toContain("w-5");
    expect(cls).toContain("relative");
    expect(cls).toContain("after:absolute");
    expect(cls).toContain("after:-inset-3");
  });

  it("RadioGroupItem: 20px visual + after-inset pseudo hit area", () => {
    render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" aria-label="Chọn A" />
      </RadioGroup>,
    );
    const cls = screen.getByRole("radio", { name: "Chọn A" }).className;
    expect(cls).toContain("h-5");
    expect(cls).toContain("w-5");
    expect(cls).toContain("relative");
    expect(cls).toContain("after:absolute");
    expect(cls).toContain("after:-inset-3");
  });

  it("Switch: keeps 24×44 visual, vertical after-inset extends hit height to 44px", () => {
    render(<Switch aria-label="Bật thông báo" />);
    const cls = screen.getByRole("switch", { name: "Bật thông báo" }).className;
    expect(cls).toContain("h-6");
    expect(cls).toContain("w-11");
    expect(cls).toContain("relative");
    expect(cls).toContain("after:absolute");
    expect(cls).toContain("after:-inset-y-[10px]");
  });
});
