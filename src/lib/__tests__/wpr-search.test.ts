import { describe, expect, it } from "vitest";
import { filterWpr, WPR_SEARCH_INDEX } from "../wpr-search";

describe("filterWpr", () => {
  // Pre-mortem P0: Telex input with diacritics MUST match ASCII source names.
  // Hien Truong (#30 men at the 2026-09-24 snapshot, countryCode vn) lives
  // only in the highlights list —
  // this test also pins the union scope (not just the top-25 boards).
  it('finds Hien Truong for "Trương" (diacritics + union scope)', () => {
    const names = filterWpr("Trương").map((r) => r.name);
    expect(names).toContain("Hien Truong");
  });

  it("matches across both boards regardless of selection", () => {
    const results = filterWpr("truong");
    const boards = new Set(results.map((r) => r.board));
    expect(boards.has("men")).toBe(true);
    expect(boards.has("women")).toBe(true); // Alix Truong #12 women
  });

  it("matches mid-string and is case-insensitive", () => {
    expect(filterWpr("JOHNS").map((r) => r.name)).toContain("Ben Johns");
  });

  // Source respelled "Lê Xuân Đức" as ASCII "LE Xuan Duc" on 2026-09-24, so the
  // đ/Đ fixture moved to the next source name that still carries Đ.
  it("folds đ/Đ", () => {
    expect(filterWpr("Tien Dat Le").map((r) => r.name)).toContain("Tiến Đạt Lê");
  });

  it("returns [] for empty query", () => {
    expect(filterWpr("   ")).toEqual([]);
  });

  it("index has no duplicate board#rank rows", () => {
    const keys = WPR_SEARCH_INDEX.map((r) => `${r.board}#${r.rank}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
