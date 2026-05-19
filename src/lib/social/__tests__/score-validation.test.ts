import { describe, it, expect } from "vitest";
import { validateScores } from "../score-validation";

describe("validateScores — best-of N series resolution (Codex bot fix)", () => {
  // ─── Single game (best-of-1) ─────────────────────────────────────────────
  it("1 game: 11-9 → team A wins (1-0 series)", () => {
    const r = validateScores([11], [9], "11_rally");
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.winner).toBe("a");
      expect(r.games_a).toBe(1);
      expect(r.games_b).toBe(0);
    }
  });

  it("1 game: 9-11 → team B wins (0-1 series)", () => {
    const r = validateScores([9], [11], "11_rally");
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.winner).toBe("b");
    }
  });

  // ─── Best-of-3 — required 2 wins ─────────────────────────────────────────
  it("3 games: 11-9, 9-11, 11-7 → team A wins series 2-1", () => {
    const r = validateScores([11, 9, 11], [9, 11, 7], "11_rally");
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.winner).toBe("a");
      expect(r.games_a).toBe(2);
      expect(r.games_b).toBe(1);
    }
  });

  it("3 games: 9-11, 11-7, 9-11 → team B wins series 1-2", () => {
    const r = validateScores([9, 11, 9], [11, 7, 11], "11_rally");
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.winner).toBe("b");
    }
  });

  it("3 games: 11-9, 11-9, X → team A wins series 2-0 with first 2 games", () => {
    const r = validateScores([11, 11], [9, 9], "11_rally");
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.winner).toBe("a");
      expect(r.games_a).toBe(2);
    }
  });

  // ─── Best-of-5 — required 3 wins ─────────────────────────────────────────
  it("5 games: 11-9, 9-11, 11-7, 9-11, 11-9 → team A wins series 3-2", () => {
    const r = validateScores([11, 9, 11, 9, 11], [9, 11, 7, 11, 9], "11_rally");
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.winner).toBe("a");
      expect(r.games_a).toBe(3);
      expect(r.games_b).toBe(2);
    }
  });

  it("5 games: 9-11, 11-9, 9-11, 11-9, 9-11 → team B wins series 2-3", () => {
    const r = validateScores([9, 11, 9, 11, 9], [11, 9, 11, 9, 11], "11_rally");
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.winner).toBe("b");
    }
  });

  // ─── THE BUG CASES — these were broken before the fix ───────────────────
  it("BUG FIX: 2 games tied 1-1 → invalid (no winner yet)", () => {
    const r = validateScores([11, 9], [9, 11], "11_rally");
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.reason).toMatch(/Chưa đội nào thắng đủ|Hòa game count/);
    }
  });

  it("BUG FIX: 4 games tied 2-2 → invalid (no winner yet)", () => {
    const r = validateScores([11, 9, 11, 9], [9, 11, 9, 11], "11_rally");
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.reason).toMatch(/Chưa đội nào thắng đủ|Hòa game count/);
    }
  });

  // ─── Empty / degenerate inputs ──────────────────────────────────────────
  it("0 games (empty arrays) → invalid", () => {
    const r = validateScores([], [], "11_rally");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/1-5 game/);
  });

  it("0-0 game score → invalid (game not finished)", () => {
    const r = validateScores([0], [0], "11_rally");
    expect(r.valid).toBe(false);
  });

  it("array length mismatch → invalid", () => {
    const r = validateScores([11, 11], [9], "11_rally");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/bằng nhau/);
  });

  it("6 games (over max) → invalid", () => {
    const r = validateScores(
      [11, 9, 11, 9, 11, 9],
      [9, 11, 9, 11, 9, 11],
      "11_rally",
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/1-5 game/);
  });

  // ─── Win-by-2 enforcement (rally) ───────────────────────────────────────
  it("11_rally: 11-10 in 1 game → invalid (must win by 2)", () => {
    const r = validateScores([11], [10], "11_rally");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/cách biệt 2 điểm/);
  });

  it("11_rally: 13-11 in 1 game → valid (deuce extension)", () => {
    const r = validateScores([13], [11], "11_rally");
    expect(r.valid).toBe(true);
  });

  // ─── 11_traditional skips win-by-2 ──────────────────────────────────────
  it("11_traditional: 11-10 in 1 game → valid (no win-by-2 required)", () => {
    const r = validateScores([11], [10], "11_traditional");
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.winner).toBe("a");
  });

  // ─── Other scoring formats (quick sanity) ────────────────────────────────
  it("15_rally: 15-13 → valid (target 15, win by 2)", () => {
    const r = validateScores([15], [13], "15_rally");
    expect(r.valid).toBe(true);
  });

  it("21_rally: 21-19 → valid (target 21, win by 2)", () => {
    const r = validateScores([21], [19], "21_rally");
    expect(r.valid).toBe(true);
  });

  // ─── Negative / non-integer ────────────────────────────────────────────
  it("negative score → invalid", () => {
    const r = validateScores([-1], [11], "11_rally");
    expect(r.valid).toBe(false);
  });

  it("non-integer score → invalid", () => {
    const r = validateScores([11.5], [9], "11_rally");
    expect(r.valid).toBe(false);
  });

  it("score > target+30 cap → invalid", () => {
    const r = validateScores([99], [9], "11_rally");
    expect(r.valid).toBe(false);
  });
});
