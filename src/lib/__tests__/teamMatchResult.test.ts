// QA-07 characterization: MLP total-score match result.
// These tests PIN current behavior on both platforms (Swift mirror:
// apple/Tests/TeamMatchResultTests.swift). If a case here surprises you,
// that is the point — change the rule deliberately, in computeTeamMatchResult
// and its Swift twin, not by scattering fixes in components.

import { describe, it, expect } from "vitest";
import { computeTeamMatchResult } from "../teamMatchResult";

const A = "team-a";
const B = "team-b";

describe("computeTeamMatchResult", () => {
  it("total points are the SUM of game scores, not a fixed 28", () => {
    // 4 games each played to 7 (MLP total-score mode)
    const r = computeTeamMatchResult(
      [
        { a: 7, b: 5 },
        { a: 7, b: 6 },
        { a: 5, b: 7 },
        { a: 7, b: 3 },
      ],
      A,
      B,
    );
    expect(r.totalPointsA).toBe(26);
    expect(r.totalPointsB).toBe(21);
    expect(r.totalPointsA + r.totalPointsB).not.toBe(28);
  });

  it("winner is decided by games-won majority", () => {
    const r = computeTeamMatchResult(
      [
        { a: 7, b: 5 },
        { a: 7, b: 6 },
        { a: 5, b: 7 },
        { a: 7, b: 3 },
      ],
      A,
      B,
    );
    expect(r.gamesWonA).toBe(3);
    expect(r.gamesWonB).toBe(1);
    expect(r.winnerId).toBe(A);
  });

  it("CHARACTERIZATION: games majority beats higher cumulative total, even in total-score mode", () => {
    // B racks up huge totals in one game but loses 1-2 on games.
    // Current rule on web AND Swift: A wins. Cumulative points never
    // decide the match winner; they only break ties in standings.
    const r = computeTeamMatchResult(
      [
        { a: 7, b: 6 },
        { a: 0, b: 7 },
        { a: 7, b: 6 },
      ],
      A,
      B,
    );
    expect(r.totalPointsA).toBe(14);
    expect(r.totalPointsB).toBe(19); // B outscored A overall…
    expect(r.winnerId).toBe(A); // …but A wins on games 2-1
  });

  it("no winner while the games majority is unreached", () => {
    // 1-1 after two of four games (remaining games still 0-0 → ties)
    const r = computeTeamMatchResult(
      [
        { a: 7, b: 5 },
        { a: 4, b: 7 },
        { a: 0, b: 0 },
        { a: 0, b: 0 },
      ],
      A,
      B,
    );
    expect(r.gamesWonA).toBe(1);
    expect(r.gamesWonB).toBe(1);
    expect(r.winnerId).toBeNull();
  });

  it("a tied game counts for neither side", () => {
    const r = computeTeamMatchResult(
      [
        { a: 6, b: 6 },
        { a: 7, b: 2 },
      ],
      A,
      B,
    );
    expect(r.gamesWonA).toBe(1);
    expect(r.gamesWonB).toBe(0);
    // 1 of 2 games meets ceil(2/2)=1 → A already has the majority
    expect(r.winnerId).toBe(A);
  });

  it("a majority winner with a missing team id yields no winner", () => {
    const r = computeTeamMatchResult([{ a: 7, b: 0 }], null, B);
    expect(r.winnerId).toBeNull();
  });

  it("no games yields zeros and no winner", () => {
    const r = computeTeamMatchResult([], A, B);
    expect(r).toEqual({
      gamesWonA: 0,
      gamesWonB: 0,
      totalPointsA: 0,
      totalPointsB: 0,
      winnerId: null,
    });
  });
});
