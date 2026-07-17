// ARCH-04 pre-work: characterization of the doubles-elimination result rule
// as it behaves today, BEFORE the shared-scoring-core extraction. These
// tests pin current behavior — including quirks — they do not bless it.
// Swift mirror: apple/Tests/DoublesElimResultTests.swift (shared-rule cases
// case-for-case identical; sparse/padding quirks are web-only).

import { describe, it, expect } from "vitest";
import {
  computeDoublesElimResult,
  bracketAdvanceTarget,
  type DoublesElimGame,
} from "../doublesElimResult";

const A = "team-a";
const B = "team-b";

const g = (game: number, a: number, b: number): DoublesElimGame => ({
  game,
  score_a: a,
  score_b: b,
  winner: a > b ? "a" : "b",
});

describe("computeDoublesElimResult", () => {
  it("BO3: two game wins complete the match", () => {
    const r = computeDoublesElimResult([g(1, 11, 7), g(2, 11, 9)], 3, A, B);
    expect(r).toEqual({
      gamesWonA: 2,
      gamesWonB: 0,
      complete: true,
      winnerId: A,
      loserId: B,
    });
  });

  it("BO3: 1-1 is incomplete — no winner, no loser", () => {
    const r = computeDoublesElimResult([g(1, 11, 7), g(2, 9, 11)], 3, A, B);
    expect(r.complete).toBe(false);
    expect(r.winnerId).toBeNull();
    expect(r.loserId).toBeNull();
  });

  it("BO1: a single decided game completes the match (ceil(1/2)=1)", () => {
    const r = computeDoublesElimResult([g(1, 7, 11)], 1, A, B);
    expect(r.complete).toBe(true);
    expect(r.winnerId).toBe(B);
    expect(r.loserId).toBe(A);
  });

  it("BO5: completes at 3 wins even with games left unplayed", () => {
    const r = computeDoublesElimResult(
      [g(1, 11, 3), g(2, 11, 5), g(3, 11, 9)],
      5,
      A,
      B,
    );
    expect(r.complete).toBe(true);
    expect(r.winnerId).toBe(A);
  });

  it("BO5: 2-2 is incomplete", () => {
    const r = computeDoublesElimResult(
      [g(1, 11, 3), g(2, 3, 11), g(3, 11, 5), g(4, 5, 11)],
      5,
      A,
      B,
    );
    expect(r.complete).toBe(false);
    expect(r.winnerId).toBeNull();
  });

  it("sparse games (bracket inline edit by index): holes count for neither side", () => {
    // Editing game 2 first leaves index 0 undefined.
    const games: (DoublesElimGame | undefined)[] = [];
    games[1] = g(2, 11, 8);
    const r = computeDoublesElimResult(games, 3, A, B);
    expect(r.gamesWonA).toBe(1);
    expect(r.gamesWonB).toBe(0);
    expect(r.complete).toBe(false);
  });

  it("DELTA: a materialized null game entry (bracket hole after a DB JSON round-trip) is skipped, where the old scoring-page copy crashed", () => {
    const r = computeDoublesElimResult([null, g(2, 11, 8), g(3, 11, 5)], 3, A, B);
    expect(r.gamesWonA).toBe(2);
    expect(r.gamesWonB).toBe(0);
    expect(r.complete).toBe(true);
    expect(r.winnerId).toBe(A);
  });

  it("QUIRK: a 0-0 placeholder game (scoring-page padding) counts as a win for A", () => {
    // DoublesEliminationScoring.tsx pads skipped game slots with
    // { score_a: 0, score_b: 0, winner: 'a' } — saving game 2 without game 1
    // silently credits A with a game. Pinned, not blessed.
    const padded: DoublesElimGame[] = [
      { game: 1, score_a: 0, score_b: 0, winner: "a" },
      g(2, 8, 11),
    ];
    const r = computeDoublesElimResult(padded, 3, A, B);
    expect(r.gamesWonA).toBe(1);
    expect(r.gamesWonB).toBe(1);
    expect(r.complete).toBe(false);
  });

  it("a missing team id yields a null winnerId even when complete", () => {
    const r = computeDoublesElimResult([g(1, 11, 2)], 1, null, B);
    expect(r.complete).toBe(true);
    expect(r.winnerId).toBeNull();
    expect(r.loserId).toBe(B);
  });

  it("no games yields zeros and incomplete", () => {
    const r = computeDoublesElimResult([], 3, A, B);
    expect(r).toEqual({
      gamesWonA: 0,
      gamesWonB: 0,
      complete: false,
      winnerId: null,
      loserId: null,
    });
  });
});

describe("bracketAdvanceTarget", () => {
  it("pairs consecutive matches into the next round: 1,2 -> match 0; 3,4 -> match 1", () => {
    expect(bracketAdvanceTarget(1)).toEqual({ nextMatchIndex: 0, slot: "a" });
    expect(bracketAdvanceTarget(2)).toEqual({ nextMatchIndex: 0, slot: "b" });
    expect(bracketAdvanceTarget(3)).toEqual({ nextMatchIndex: 1, slot: "a" });
    expect(bracketAdvanceTarget(4)).toEqual({ nextMatchIndex: 1, slot: "b" });
    expect(bracketAdvanceTarget(5)).toEqual({ nextMatchIndex: 2, slot: "a" });
  });
});
