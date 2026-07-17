// ARCH-04 scoring S1: characterization of the MatchScoring manual-scoreboard
// rules as they behave today. These tests pin current behavior — including
// quirks — they do not bless it. They are the safety net for S2-S4 (engine
// persistence contract, dual-mode referee screen, thin-loader migration).

import { describe, it, expect } from "vitest";
import {
  applyScoreDelta,
  nextServe,
  endSetTransition,
  computeManualWinner,
  finalizeSetScores,
  applyUndo,
  type HistoryEntry,
} from "../manualScoring";

const P1 = "player-1";
const P2 = "player-2";

describe("applyScoreDelta", () => {
  it("clamps at zero and has no upper bound or win target", () => {
    expect(applyScoreDelta(0, -1)).toBe(0);
    expect(applyScoreDelta(5, -1)).toBe(4);
    expect(applyScoreDelta(98, 1)).toBe(99);
  });
});

describe("nextServe", () => {
  it("cycles A2 -> B1 -> B2 -> A1 -> A2", () => {
    expect(nextServe(1, 2)).toEqual({ servingSide: 2, serverNumber: 1 }); // A2 -> B1
    expect(nextServe(2, 1)).toEqual({ servingSide: 2, serverNumber: 2 }); // B1 -> B2
    expect(nextServe(2, 2)).toEqual({ servingSide: 1, serverNumber: 1 }); // B2 -> A1
    expect(nextServe(1, 1)).toEqual({ servingSide: 1, serverNumber: 2 }); // A1 -> A2
  });

  it("QUIRK: out-of-domain input passes through unchanged (page's if/else falls through)", () => {
    expect(nextServe(3, 1)).toEqual({ servingSide: 3, serverNumber: 1 });
  });
});

describe("endSetTransition", () => {
  it("archives the live score as a set, advances the counter", () => {
    const r = endSetTransition([{ s1: 11, s2: 7 }], 2, 9, 11);
    expect(r.setScores).toEqual([{ s1: 11, s2: 7 }, { s1: 9, s2: 11 }]);
    expect(r.currentSet).toBe(3);
  });

  it("QUIRK: a 0-0 set can be archived — no guard against ending an unplayed set", () => {
    const r = endSetTransition([], 1, 0, 0);
    expect(r.setScores).toEqual([{ s1: 0, s2: 0 }]);
  });
});

describe("computeManualWinner", () => {
  it("single-set: higher live score wins; tie yields null", () => {
    expect(computeManualWinner(1, [], 11, 7, P1, P2)).toBe(P1);
    expect(computeManualWinner(1, [], 7, 11, P1, P2)).toBe(P2);
    expect(computeManualWinner(1, [], 9, 9, P1, P2)).toBeNull();
  });

  it("multi-set: archived sets tally plus the live score as one more set", () => {
    // Sets 1-1, live score 11-9 -> P1 leads 2-1
    const sets = [{ s1: 11, s2: 5 }, { s1: 6, s2: 11 }];
    expect(computeManualWinner(3, sets, 11, 9, P1, P2)).toBe(P1);
  });

  it("QUIRK: the live score votes as a full set even at 1-0", () => {
    const sets = [{ s1: 11, s2: 5 }, { s1: 6, s2: 11 }];
    expect(computeManualWinner(3, sets, 1, 0, P1, P2)).toBe(P1);
  });

  it("multi-set: equal sets (live score tied) yields null", () => {
    const sets = [{ s1: 11, s2: 5 }, { s1: 6, s2: 11 }];
    expect(computeManualWinner(3, sets, 0, 0, P1, P2)).toBeNull();
  });

  it("a missing player id yields null even for the leading side", () => {
    expect(computeManualWinner(1, [], 11, 7, null, P2)).toBeNull();
  });

  it("QUIRK: an empty-string id is a valid winner (old page gated on the object, not the id)", () => {
    expect(computeManualWinner(1, [], 11, 7, "", P2)).toBe("");
  });
});

describe("finalizeSetScores", () => {
  it("archives the live score only when at least one side scored", () => {
    expect(finalizeSetScores([{ s1: 11, s2: 7 }], 9, 11)).toEqual([
      { s1: 11, s2: 7 },
      { s1: 9, s2: 11 },
    ]);
    expect(finalizeSetScores([{ s1: 11, s2: 7 }], 0, 0)).toEqual([{ s1: 11, s2: 7 }]);
  });
});

describe("applyUndo", () => {
  it("score: restores exactly the recorded prev scores", () => {
    const entry: HistoryEntry = { action: "score", player: 1, delta: 1, prevScore1: 5, prevScore2: 3 };
    expect(applyUndo(entry)).toEqual({ score1: 5, score2: 3 });
  });

  it("swap_serve: restores side and server number", () => {
    const entry: HistoryEntry = { action: "swap_serve", prevServingSide: 2, prevServerNumber: 1 };
    expect(applyUndo(entry)).toEqual({ servingSide: 2, serverNumber: 1 });
  });

  it("end_set: restores scores, archived sets, and the set counter", () => {
    const entry: HistoryEntry = {
      action: "end_set",
      prevScore1: 11,
      prevScore2: 9,
      prevSetScores: [{ s1: 11, s2: 7 }],
      prevCurrentSet: 2,
    };
    expect(applyUndo(entry)).toEqual({
      score1: 11,
      score2: 9,
      setScores: [{ s1: 11, s2: 7 }],
      currentSet: 2,
    });
  });

  it("timeout/medical: reports the side whose counter must decrement", () => {
    expect(applyUndo({ action: "timeout", side: 2 })).toEqual({ timeoutSide: 2 });
    expect(applyUndo({ action: "medical", side: 1 })).toEqual({ medicalSide: 1 });
  });

  it("swap_sides: restores the recorded orientation", () => {
    expect(applyUndo({ action: "swap_sides", prevSidesSwapped: false })).toEqual({ sidesSwapped: false });
  });

  it("an entry with no recorded prev fields undoes nothing (matches the page's guards)", () => {
    expect(applyUndo({ action: "score" })).toEqual({});
  });
});
