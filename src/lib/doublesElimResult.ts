// ARCH-04 pre-work: the doubles-elimination match-result rule, extracted
// verbatim from its duplicated copies so it can be characterized before the
// shared-scoring-core refactor:
//   - src/pages/DoublesEliminationScoring.tsx (handleSaveGame)
//   - src/components/tournament/DoublesEliminationBracket.tsx (handleSaveGameScore)
//   - apple/.../Core/DoublesElim/DoublesElimRepository.swift score() — Swift twin
// Swift mirror tests: apple/Tests/DoublesElimResultTests.swift — keep the
// shared-rule cases case-for-case identical. Rule changes happen here and in
// the Swift twin, never in components.

export interface DoublesElimGame {
  game: number;
  score_a: number;
  score_b: number;
  winner: "a" | "b";
}

export interface DoublesElimResult {
  gamesWonA: number;
  gamesWonB: number;
  complete: boolean;
  winnerId: string | null;
  loserId: string | null;
}

/**
 * Games-won majority decides the match: first side to ceil(best_of / 2)
 * game wins completes it. Games arrays can be sparse (the bracket inline
 * edit writes by index), so holes count for neither side.
 */
export function computeDoublesElimResult(
  games: ReadonlyArray<DoublesElimGame | undefined>,
  bestOf: number,
  teamAId: string | null,
  teamBId: string | null,
): DoublesElimResult {
  const gamesWonA = games.filter((g) => g?.winner === "a").length;
  const gamesWonB = games.filter((g) => g?.winner === "b").length;
  const winsNeeded = Math.ceil(bestOf / 2);
  const complete = gamesWonA >= winsNeeded || gamesWonB >= winsNeeded;
  const winnerId = complete ? (gamesWonA > gamesWonB ? teamAId : teamBId) : null;
  const loserId = complete ? (gamesWonA > gamesWonB ? teamBId : teamAId) : null;
  return { gamesWonA, gamesWonB, complete, winnerId, loserId };
}

/**
 * R4+ bracket advancement: the winner of match N seats into next-round
 * match floor((N-1)/2), slot "a" for odd N, "b" for even N. The caller
 * excludes third_place from the next-round list before indexing.
 */
export function bracketAdvanceTarget(matchNumber: number): {
  nextMatchIndex: number;
  slot: "a" | "b";
} {
  const matchIndex = matchNumber - 1;
  return {
    nextMatchIndex: Math.floor(matchIndex / 2),
    slot: matchIndex % 2 === 0 ? "a" : "b",
  };
}
