// QA-07: MLP match result, default + total-score mode.
// Swift mirror: apple/Tests/TeamMatchResultTests.swift — keep case-for-case
// identical. Rule changes happen in computeTeamMatchResult and its Swift
// twin, never in components.

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

  it("default mode: games majority beats higher cumulative total", () => {
    // B outscores A overall but loses 1-2 on games → A wins by default rule.
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
    expect(r.totalPointsB).toBe(19);
    expect(r.winnerId).toBe(A);
  });

  it("total-score mode: higher cumulative total wins, regardless of games won", () => {
    // Same scores as above — with total_score_mode on, B's 19-14 wins the
    // match even though A won more games (Cuong's rule 2026-07-16).
    const r = computeTeamMatchResult(
      [
        { a: 7, b: 6 },
        { a: 0, b: 7 },
        { a: 7, b: 6 },
      ],
      A,
      B,
      true,
    );
    expect(r.totalPointsB).toBe(19);
    expect(r.winnerId).toBe(B);
  });

  it("total-score mode: no winner while any game is undecided", () => {
    // A leads 7-5 after game 1, but games 2-4 are unplayed (0-0) — the
    // match must NOT complete early on a points lead.
    const r = computeTeamMatchResult(
      [
        { a: 7, b: 5 },
        { a: 0, b: 0 },
        { a: 0, b: 0 },
        { a: 0, b: 0 },
      ],
      A,
      B,
      true,
    );
    expect(r.winnerId).toBeNull();
  });

  it("total-score mode: equal totals leave no winner", () => {
    // 14-14 after all games decided → dreambreaker/organizer resolves.
    const r = computeTeamMatchResult(
      [
        { a: 7, b: 5 },
        { a: 5, b: 7 },
        { a: 2, b: 7 },
        { a: 7, b: 2 },
      ],
      A,
      B,
      true,
    );
    expect(r.totalPointsA).toBe(21);
    expect(r.totalPointsB).toBe(21);
    expect(r.winnerId).toBeNull();
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
