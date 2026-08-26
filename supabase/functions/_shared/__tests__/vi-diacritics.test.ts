import { describe, expect, it } from "vitest";
import { missingViDiacritics } from "../vi-diacritics";

describe("missingViDiacritics", () => {
  it("flags the exact title that shipped without diacritics on prod 26/08", () => {
    expect(missingViDiacritics(
      "Major League Pickleball Cong Bo Chung Ket 2026 Tai Thanh Phố New York",
    )).toBe(true);
  });

  it("accepts a proper-noun-heavy but genuine Vietnamese title", () => {
    expect(missingViDiacritics(
      "Major League Pickleball công bố chung kết 2026 tại New York",
    )).toBe(false);
  });

  it("accepts normal Vietnamese prose", () => {
    expect(missingViDiacritics(
      "Giải đấu sẽ diễn ra tại Đà Nẵng với sự góp mặt của các tay vợt hàng đầu.",
    )).toBe(false);
  });

  it("treats empty text as missing", () => {
    expect(missingViDiacritics("   ")).toBe(true);
  });
});
