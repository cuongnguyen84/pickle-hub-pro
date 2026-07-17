// ARCH-04 scoring S3b — the engine's manual scoreboard mode. Semantics
// mirror the legacy MatchScoring scoreboard (characterized in
// manualScoring.test.ts): clamp-0 adjustments, hand-driven A2→B1→B2→A1
// serve cycle, no win target, no auto game-over.

import { describe, it, expect } from "vitest";
import {
  startState,
  applyRally,
  isGameOver,
  winnerSide,
  callout,
  manualAdjust,
  manualNextServe,
  manualToggleServer,
  parseLiveState,
  makeLiveState,
  type ScoreState,
} from "../refereeScoring";

const manual = (over: Partial<ScoreState> = {}): ScoreState => ({
  ...startState({ mode: "manual", isSingles: false, winTarget: 11, firstServer: "a" }),
  ...over,
});

describe("manual mode engine", () => {
  it("doubles start at serverNumber 2 (start exception), no rotation tracking", () => {
    const s = manual();
    expect(s.serverNumber).toBe(2);
    expect(s.rotation).toBeNull();
  });

  it("never auto-ends: isGameOver false and winnerSide null at any score", () => {
    const s = manual({ a: 99, b: 0 });
    expect(isGameOver(s)).toBe(false);
    expect(winnerSide(s)).toBeNull();
  });

  it("callout is the plain a-b score", () => {
    expect(callout(manual({ a: 7, b: 4 }))).toBe("7-4");
  });

  it("applyRally is a no-op in manual mode (manual transitions only)", () => {
    const s = manual({ a: 3, b: 2 });
    expect(applyRally(s, "a")).toBe(s);
  });

  it("manualAdjust: ±1 with zero clamp, serve untouched", () => {
    const s = manual({ a: 0, b: 5 });
    expect(manualAdjust(s, "a", -1).a).toBe(0);
    expect(manualAdjust(s, "b", 1).b).toBe(6);
    expect(manualAdjust(s, "b", 1).serving).toBe(s.serving);
  });

  it("manualNextServe cycles A2 -> B1 -> B2 -> A1 -> A2", () => {
    let s = manual(); // a, 2
    s = manualNextServe(s);
    expect([s.serving, s.serverNumber]).toEqual(["b", 1]);
    s = manualNextServe(s);
    expect([s.serving, s.serverNumber]).toEqual(["b", 2]);
    s = manualNextServe(s);
    expect([s.serving, s.serverNumber]).toEqual(["a", 1]);
    s = manualNextServe(s);
    expect([s.serving, s.serverNumber]).toEqual(["a", 2]);
  });

  it("manualNextServe passes out-of-domain state through unchanged (legacy parity)", () => {
    const s = manual({ serverNumber: 3 });
    expect(manualNextServe(s)).toBe(s);
  });

  it("manualToggleServer flips tay 1/2 without moving the serve", () => {
    const s = manual(); // a, 2
    const t = manualToggleServer(s);
    expect([t.serving, t.serverNumber]).toEqual(["a", 1]);
  });

  it("manual transitions are no-ops on non-manual states", () => {
    const rally = startState({ mode: "rally", isSingles: false, winTarget: 11 });
    expect(manualAdjust(rally, "a", 1)).toBe(rally);
    expect(manualNextServe(rally)).toBe(rally);
    expect(manualToggleServer(rally)).toBe(rally);
  });

  it("a manual-mode envelope round-trips through parseLiveState", () => {
    const env = makeLiveState({
      state: manual({ a: 4, b: 2 }),
      history: [manual()],
      usedReg: { a: 0, b: 0 },
      usedMed: { a: 0, b: 0 },
      notes: { a: "", b: "" },
      regularTO: 2,
    });
    expect(parseLiveState(JSON.stringify(env))).toEqual(env);
  });
});
