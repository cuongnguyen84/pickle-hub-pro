// @ts-nocheck — vitest types available at test runtime only
import { describe, it, expect } from "vitest";
import { maskName } from "../maskName";

describe("maskName", () => {
  it("masks a 3-word Vietnamese name to first + initial", () => {
    expect(maskName("Nguyễn Văn An")).toBe("Nguyễn VA.");
  });

  it("masks a 2-word English name to first + initial", () => {
    expect(maskName("Test User")).toBe("Test U.");
  });

  it("masks a name with a numeric suffix word", () => {
    expect(maskName("Test User 1")).toBe("Test U1.");
  });

  it("keeps a single word unchanged", () => {
    expect(maskName("Cường")).toBe("Cường");
  });

  it("keeps a 2-char single word unchanged (no asterisk)", () => {
    expect(maskName("Lý")).toBe("Lý");
  });

  it("falls back to 'Khách' for empty string", () => {
    expect(maskName("")).toBe("Khách");
  });

  it("falls back to 'Khách' for whitespace-only", () => {
    expect(maskName("   ")).toBe("Khách");
  });

  it("falls back to 'Khách' for null", () => {
    expect(maskName(null)).toBe("Khách");
  });

  it("collapses multiple internal spaces correctly", () => {
    expect(maskName("Nguyễn   Văn   An")).toBe("Nguyễn VA.");
  });

  it("uppercases initials regardless of input casing", () => {
    expect(maskName("test user")).toBe("test U.");
  });
});
