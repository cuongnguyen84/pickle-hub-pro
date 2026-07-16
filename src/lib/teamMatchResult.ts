// Pure match-result computation for Team Match (MLP-style) — QA-07.
//
// Characterized behavior (identical on web and Swift, pinned by tests):
// - totalPoints A/B = SUM of all game scores. In total-score mode each game
//   plays to 7, so a 4-game match totals whatever was actually scored — the
//   sum is NOT a fixed 28.
// - The match winner is the team winning the MAJORITY of games
//   (ceil(games/2)), in EVERY mode. Cumulative total points never decide the
//   winner — even in total-score mode they are display/standings-tiebreak
//   data only. If the product rule should be "higher total wins" in
//   total-score mode, that is a deliberate behavior change to make here, in
//   one place.
// - A tied game (a === b) counts for neither side; if neither team reaches
//   the majority, winnerId is null (match stays in progress).

export interface GameScorePair {
  a: number;
  b: number;
}

export interface TeamMatchResult {
  gamesWonA: number;
  gamesWonB: number;
  totalPointsA: number;
  totalPointsB: number;
  winnerId: string | null;
}

export function computeTeamMatchResult(
  scores: GameScorePair[],
  teamAId: string | null | undefined,
  teamBId: string | null | undefined,
): TeamMatchResult {
  let gamesWonA = 0;
  let gamesWonB = 0;
  let totalPointsA = 0;
  let totalPointsB = 0;

  for (const { a, b } of scores) {
    totalPointsA += a;
    totalPointsB += b;
    if (a > b) gamesWonA++;
    else if (b > a) gamesWonB++;
  }

  const requiredToWin = Math.ceil(scores.length / 2);
  let winnerId: string | null = null;
  if (scores.length > 0) {
    if (gamesWonA >= requiredToWin && teamAId) {
      winnerId = teamAId;
    } else if (gamesWonB >= requiredToWin && teamBId) {
      winnerId = teamBId;
    }
  }

  return { gamesWonA, gamesWonB, totalPointsA, totalPointsB, winnerId };
}
