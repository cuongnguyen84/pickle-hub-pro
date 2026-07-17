// ARCH-04 pre-work: the QuickTable match-result rules, extracted verbatim
// from their duplicated copies so they can be characterized before the
// shared-scoring-core refactor:
//   - src/hooks/useQuickTableMutations.ts (updateMatchScore + updatePlayerStats)
//   - apple/.../Core/QuickTable/QuickTableRepository.swift (score/advancePlayoff/
//     recomputeGroupStats) — Swift twin
// Swift mirror tests: apple/Tests/QuickTableResultTests.swift — keep the
// shared-rule cases case-for-case identical. Rule changes happen here and in
// the Swift twin, never in components.
//
// Known platform divergence, pinned by tests on each side: on a tied score
// web records the match completed with a null winner; Swift refuses to save
// a tie at all.

/** Higher score wins; a tie yields no winner (but the web caller still
 *  marks the match completed). */
export function quickTableWinner(
  score1: number,
  score2: number,
  player1Id: string | null,
  player2Id: string | null,
): string | null {
  return score1 > score2 ? player1Id : score1 < score2 ? player2Id : null;
}

/** Single-elimination playoff advancement: the winner of the match at
 *  `positionInRound` (index within the round, ordered by playoff_match_number)
 *  seats into next-round match floor(pos/2), slot player1 for even positions,
 *  player2 for odd. */
export function playoffAdvanceTarget(positionInRound: number): {
  nextMatchIndex: number;
  slot: "player1" | "player2";
} {
  return {
    nextMatchIndex: Math.floor(positionInRound / 2),
    slot: positionInRound % 2 === 0 ? "player1" : "player2",
  };
}

export interface QuickTableStatMatch {
  player1_id: string | null;
  player2_id: string | null;
  score1: number | null;
  score2: number | null;
}

export interface QuickTablePlayerStats {
  played: number;
  won: number;
  pf: number;
  pa: number;
}

/** Group-stage standings accumulation over completed matches. Matches with
 *  a missing player or score are skipped entirely; players not in
 *  `playerIds` are ignored. A tied match counts as played for both and won
 *  by neither. */
export function accumulateGroupStats(
  matches: ReadonlyArray<QuickTableStatMatch>,
  playerIds: ReadonlyArray<string>,
): Record<string, QuickTablePlayerStats> {
  const stats: Record<string, QuickTablePlayerStats> = {};
  for (const id of playerIds) {
    stats[id] = { played: 0, won: 0, pf: 0, pa: 0 };
  }
  for (const match of matches) {
    if (match.player1_id && match.player2_id && match.score1 !== null && match.score2 !== null) {
      const player1Wins = match.score1 > match.score2;
      const player2Wins = match.score2 > match.score1;

      if (stats[match.player1_id]) {
        stats[match.player1_id].played++;
        stats[match.player1_id].pf += match.score1;
        stats[match.player1_id].pa += match.score2;
        if (player1Wins) stats[match.player1_id].won++;
      }
      if (stats[match.player2_id]) {
        stats[match.player2_id].played++;
        stats[match.player2_id].pf += match.score2;
        stats[match.player2_id].pa += match.score1;
        if (player2Wins) stats[match.player2_id].won++;
      }
    }
  }
  return stats;
}
