// ARCH-04 scoring S1: the MatchScoring manual-scoreboard rules, extracted
// verbatim from src/pages/MatchScoring.tsx so they can be characterized
// before the shared-scoring-core expansion (S2-S4: persistence contract,
// dual-mode RefereeScoringScreen, thin-loader migration — Cuong's calls
// 2026-07-17: both modes, full-state spectator broadcast, DB persistence).
// Rule changes happen here, never in the page.

export type SetScore = {
  s1: number;
  s2: number;
};

export type HistoryEntry = {
  action: 'score' | 'swap_sides' | 'swap_serve' | 'end_set' | 'timeout' | 'medical';
  player?: 1 | 2;
  delta?: number;
  set?: number;
  prevServingSide?: number;
  prevSidesSwapped?: boolean;
  prevScore1?: number;
  prevScore2?: number;
  prevSetScores?: SetScore[];
  prevCurrentSet?: number;
  prevServerNumber?: number;
  side?: 1 | 2;
};

/** Manual score adjustment: clamp at zero, no upper bound, no win target —
 *  the referee decides when the game ends. */
export function applyScoreDelta(score: number, delta: number): number {
  return Math.max(0, score + delta);
}

/** Manual serve rotation cycle: A2 → B1 → B2 → A1 → A2. Side 1 = A, 2 = B;
 *  serverNumber = "tay 1"/"tay 2" in doubles. */
export function nextServe(servingSide: number, serverNumber: number): {
  servingSide: number;
  serverNumber: number;
} {
  if (servingSide === 1 && serverNumber === 2) return { servingSide: 2, serverNumber: 1 }; // A2 -> B1
  if (servingSide === 2 && serverNumber === 1) return { servingSide: 2, serverNumber: 2 }; // B1 -> B2
  if (servingSide === 2 && serverNumber === 2) return { servingSide: 1, serverNumber: 1 }; // B2 -> A1
  if (servingSide === 1 && serverNumber === 1) return { servingSide: 1, serverNumber: 2 }; // A1 -> A2
  // Out-of-domain input passes through unchanged (matches the page's
  // if/else chain, which falls through without mutating).
  return { servingSide, serverNumber };
}

/** End-set transition: archive the live score as a set, advance the set
 *  counter, reset the live score to 0-0. */
export function endSetTransition(
  setScores: readonly SetScore[],
  currentSet: number,
  score1: number,
  score2: number,
): { setScores: SetScore[]; currentSet: number } {
  return {
    setScores: [...setScores, { s1: score1, s2: score2 }],
    currentSet: currentSet + 1,
  };
}

/** Winner of a manual match. Multi-set: archived sets are tallied, and the
 *  LIVE score counts as one more set for whichever side leads it (even at
 *  1-0). Single-set: higher live score wins. Ties yield null. */
export function computeManualWinner(
  totalSets: number,
  setScores: readonly SetScore[],
  score1: number,
  score2: number,
  player1Id: string | null,
  player2Id: string | null,
): string | null {
  if (totalSets > 1) {
    let sets1 = 0, sets2 = 0;
    for (const s of setScores) {
      if (s.s1 > s.s2) sets1++;
      else if (s.s2 > s.s1) sets2++;
    }
    if (score1 > score2) sets1++;
    else if (score2 > score1) sets2++;

    // `!== null` (not truthiness): the old page gated on the player OBJECT,
    // so an empty-string id was still returned. Codex review 2026-07-17.
    if (sets1 > sets2 && player1Id !== null) return player1Id;
    if (sets2 > sets1 && player2Id !== null) return player2Id;
    return null;
  }
  if (score1 > score2 && player1Id !== null) return player1Id;
  if (score2 > score1 && player2Id !== null) return player2Id;
  return null;
}

/** Final set_scores written on match end: the live score is archived as a
 *  set only when at least one side has scored. */
export function finalizeSetScores(
  setScores: readonly SetScore[],
  score1: number,
  score2: number,
): SetScore[] {
  if (score1 > 0 || score2 > 0) {
    return [...setScores, { s1: score1, s2: score2 }];
  }
  return [...setScores];
}

export interface UndoResult {
  score1?: number;
  score2?: number;
  sidesSwapped?: boolean;
  servingSide?: number;
  serverNumber?: number;
  setScores?: SetScore[];
  currentSet?: number;
  /** Which side's counter to decrement (floored at 0 by the caller). */
  timeoutSide?: 1 | 2;
  medicalSide?: 1 | 2;
}

/** Undo semantics: restore exactly the prev* fields the entry recorded;
 *  timeout/medical entries decrement the side's used counter instead. */
export function applyUndo(entry: HistoryEntry): UndoResult {
  const out: UndoResult = {};
  switch (entry.action) {
    case 'score':
      if (entry.prevScore1 !== undefined) out.score1 = entry.prevScore1;
      if (entry.prevScore2 !== undefined) out.score2 = entry.prevScore2;
      break;
    case 'swap_sides':
      if (entry.prevSidesSwapped !== undefined) out.sidesSwapped = entry.prevSidesSwapped;
      break;
    case 'swap_serve':
      if (entry.prevServingSide !== undefined) out.servingSide = entry.prevServingSide;
      if (entry.prevServerNumber !== undefined) out.serverNumber = entry.prevServerNumber;
      break;
    case 'end_set':
      if (entry.prevScore1 !== undefined) out.score1 = entry.prevScore1;
      if (entry.prevScore2 !== undefined) out.score2 = entry.prevScore2;
      if (entry.prevSetScores) out.setScores = entry.prevSetScores;
      if (entry.prevCurrentSet !== undefined) out.currentSet = entry.prevCurrentSet;
      break;
    case 'timeout':
      if (entry.side !== undefined) out.timeoutSide = entry.side;
      break;
    case 'medical':
      if (entry.side !== undefined) out.medicalSide = entry.side;
      break;
  }
  return out;
}
