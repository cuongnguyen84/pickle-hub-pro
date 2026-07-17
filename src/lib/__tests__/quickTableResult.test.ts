// ARCH-04 pre-work: characterization of the QuickTable result rules as they
// behave today, BEFORE the shared-scoring-core extraction. These tests pin
// current behavior — including quirks — they do not bless it.
// Swift mirror: apple/Tests/QuickTableResultTests.swift (shared-rule cases
// case-for-case identical; the tie rule diverges — see quickTableWinner).

import { describe, it, expect } from "vitest";
import {
  quickTableWinner,
  playoffAdvanceTarget,
  accumulateGroupStats,
  type QuickTableStatMatch,
} from "../quickTableResult";

const P1 = "player-1";
const P2 = "player-2";

describe("quickTableWinner", () => {
  it("higher score wins", () => {
    expect(quickTableWinner(11, 7, P1, P2)).toBe(P1);
    expect(quickTableWinner(7, 11, P1, P2)).toBe(P2);
  });

  it("QUIRK: a tie yields a null winner — but the web caller still marks the match completed (Swift refuses to save a tie at all)", () => {
    expect(quickTableWinner(9, 9, P1, P2)).toBeNull();
  });

  it("a missing player id yields a null winner for that side", () => {
    expect(quickTableWinner(11, 7, null, P2)).toBeNull();
    expect(quickTableWinner(7, 11, P1, null)).toBeNull();
  });
});

describe("playoffAdvanceTarget", () => {
  it("pairs consecutive positions into the next round: 0,1 -> match 0; 2,3 -> match 1", () => {
    expect(playoffAdvanceTarget(0)).toEqual({ nextMatchIndex: 0, slot: "player1" });
    expect(playoffAdvanceTarget(1)).toEqual({ nextMatchIndex: 0, slot: "player2" });
    expect(playoffAdvanceTarget(2)).toEqual({ nextMatchIndex: 1, slot: "player1" });
    expect(playoffAdvanceTarget(3)).toEqual({ nextMatchIndex: 1, slot: "player2" });
    expect(playoffAdvanceTarget(4)).toEqual({ nextMatchIndex: 2, slot: "player1" });
  });

  it("QUIRK: position -1 (match not found in its round) maps to index -1, slot player2", () => {
    // updateMatchScore feeds findIndex() straight in; -1 has never been
    // guarded. Pinned, not blessed.
    expect(playoffAdvanceTarget(-1)).toEqual({ nextMatchIndex: -1, slot: "player2" });
  });
});

describe("accumulateGroupStats", () => {
  const m = (p1: string | null, p2: string | null, s1: number | null, s2: number | null): QuickTableStatMatch => ({
    player1_id: p1,
    player2_id: p2,
    score1: s1,
    score2: s2,
  });

  it("accumulates played/won/points-for/points-against per player", () => {
    const stats = accumulateGroupStats(
      [m(P1, P2, 11, 7), m(P1, P2, 5, 11)],
      [P1, P2],
    );
    expect(stats[P1]).toEqual({ played: 2, won: 1, pf: 16, pa: 18 });
    expect(stats[P2]).toEqual({ played: 2, won: 1, pf: 18, pa: 16 });
  });

  it("skips matches with a missing player or score", () => {
    const stats = accumulateGroupStats(
      [m(null, P2, 11, 7), m(P1, P2, 11, null), m(P1, P2, 0, 0)],
      [P1, P2],
    );
    // Only the 0-0 match survives the guard (0 is a valid score, not null).
    expect(stats[P1]).toEqual({ played: 1, won: 0, pf: 0, pa: 0 });
    expect(stats[P2]).toEqual({ played: 1, won: 0, pf: 0, pa: 0 });
  });

  it("a tied match counts as played for both and won by neither", () => {
    const stats = accumulateGroupStats([m(P1, P2, 9, 9)], [P1, P2]);
    expect(stats[P1]).toEqual({ played: 1, won: 0, pf: 9, pa: 9 });
    expect(stats[P2]).toEqual({ played: 1, won: 0, pf: 9, pa: 9 });
  });

  it("ignores matches involving players outside the group list", () => {
    const stats = accumulateGroupStats([m("ghost", P2, 11, 7)], [P1, P2]);
    expect(stats[P1]).toEqual({ played: 0, won: 0, pf: 0, pa: 0 });
    expect(stats[P2]).toEqual({ played: 1, won: 0, pf: 7, pa: 11 });
    expect(stats["ghost"]).toBeUndefined();
  });

  it("players with no matches keep zeroed stats", () => {
    const stats = accumulateGroupStats([], [P1]);
    expect(stats[P1]).toEqual({ played: 0, won: 0, pf: 0, pa: 0 });
  });
});
