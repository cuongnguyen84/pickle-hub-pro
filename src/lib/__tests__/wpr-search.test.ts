import { describe, expect, it } from "vitest";
import { filterWpr, WPR_SEARCH_INDEX } from "../wpr-search";

describe("filterWpr", () => {
  // Pre-mortem P0: Telex input with diacritics MUST match ASCII source names.
  // Hien Truong (#28 men at the 2026-08-27 snapshot, countryCode vn) lives
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
    expect(boards.has("women")).toBe(true); // Alix Truong #14 women
  });

  it("matches mid-string and is case-insensitive", () => {
    expect(filterWpr("JOHNS").map((r) => r.name)).toContain("Ben Johns");
  });

  it("folds đ/Đ", () => {
    expect(filterWpr("Le Xuan Duc").map((r) => r.name)).toContain("Lê Xuân Đức");
  });

  it("returns [] for empty query", () => {
    expect(filterWpr("   ")).toEqual([]);
  });

  it("index has no duplicate board#rank rows", () => {
    const keys = WPR_SEARCH_INDEX.map((r) => `${r.board}#${r.rank}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
