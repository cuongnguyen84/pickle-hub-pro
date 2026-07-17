// ARCH-04 scoring S3b2 — best-of sets in the engine's manual mode.
// Winner/finalization semantics mirror the legacy MatchScoring scoreboard
// (manualScoring.test.ts): the live score votes as one more set; the live
// score is archived on finish only when at least one side scored.

import { describe, it, expect } from "vitest";
import {
  startState,
  manualEndSet,
  manualSetsWon,
  manualMatchWinner,
  manualFinalSetScores,
  parseLiveState,
  makeLiveState,
  type ScoreState,
} from "../refereeScoring";

const bo3 = (over: Partial<ScoreState> = {}): ScoreState => ({
  ...startState({ mode: "manual", isSingles: false, winTarget: 11, firstServer: "a", totalSets: 3 }),
  ...over,
});

describe("manual sets", () => {
  it("startState with totalSets>1 carries empty sets; single-set carries none", () => {
    expect(bo3().sets).toEqual([]);
    expect(bo3().totalSets).toBe(3);
    const single = startState({ mode: "manual", isSingles: false, winTarget: 11, totalSets: 1 });
    expect(single.sets).toBeUndefined();
    const rally = startState({ mode: "rally", isSingles: false, winTarget: 11, totalSets: 3 });
    expect(rally.sets).toBeUndefined();
  });

  it("manualEndSet archives the live score and resets to 0-0", () => {
    const s = manualEndSet(bo3({ a: 11, b: 7 }));
    expect(s.sets).toEqual([{ s1: 11, s2: 7 }]);
    expect([s.a, s.b]).toEqual([0, 0]);
  });

  it("manualEndSet refuses on the final set and on single-set/non-manual games", () => {
    const lastSet = bo3({ sets: [{ s1: 11, s2: 7 }, { s1: 5, s2: 11 }], a: 9, b: 9 });
    expect(manualEndSet(lastSet)).toBe(lastSet);
    const single = startState({ mode: "manual", isSingles: false, winTarget: 11, totalSets: 1 });
    expect(manualEndSet(single)).toBe(single);
    const rally = startState({ mode: "rally", isSingles: false, winTarget: 11 });
    expect(manualEndSet(rally)).toBe(rally);
  });

  it("manualSetsWon: archived tally plus the live score as one more set (legacy parity)", () => {
    const s = bo3({ sets: [{ s1: 11, s2: 5 }, { s1: 6, s2: 11 }], a: 1, b: 0 });
    expect(manualSetsWon(s)).toEqual({ a: 2, b: 1 });
  });

  it("manualMatchWinner: sets majority for multi-set, tie -> null", () => {
    expect(manualMatchWinner(bo3({ sets: [{ s1: 11, s2: 5 }, { s1: 6, s2: 11 }], a: 11, b: 9 }))).toBe("a");
    expect(manualMatchWinner(bo3({ sets: [{ s1: 11, s2: 5 }, { s1: 6, s2: 11 }], a: 0, b: 0 }))).toBeNull();
  });

  it("manualMatchWinner: single-set manual falls back to the live score", () => {
    const single = { ...startState({ mode: "manual", isSingles: false, winTarget: 11 }), a: 11, b: 7 };
    expect(manualMatchWinner(single)).toBe("a");
  });

  it("manualFinalSetScores archives the live score only when someone scored", () => {
    expect(manualFinalSetScores(bo3({ sets: [{ s1: 11, s2: 7 }], a: 9, b: 11 })))
      .toEqual([{ s1: 11, s2: 7 }, { s1: 9, s2: 11 }]);
    expect(manualFinalSetScores(bo3({ sets: [{ s1: 11, s2: 7 }], a: 0, b: 0 })))
      .toEqual([{ s1: 11, s2: 7 }]);
  });

  it("envelope round-trips sets; malformed sets reject the blob", () => {
    const env = makeLiveState({
      state: bo3({ sets: [{ s1: 11, s2: 7 }], a: 3, b: 2 }),
      history: [],
      usedReg: { a: 0, b: 0 },
      usedMed: { a: 0, b: 0 },
      notes: { a: "", b: "" },
      regularTO: 2,
    });
    expect(parseLiveState(JSON.stringify(env))).toEqual(env);
    expect(parseLiveState({ ...env, state: { ...env.state, sets: [{ s1: "x" }] } })).toBeNull();
  });
});
