// Pure match-result computation for Team Match (MLP-style) — QA-07.
// Swift twin: TeamMatchRepository.computeMatchResult — keep the two in sync.
//
// Rules (pinned by src/lib/__tests__/teamMatchResult.test.ts):
// - totalPoints A/B = SUM of all game scores. In total-score mode each game
//   plays to points_per_game, so a 4-game match totals whatever was actually
//   scored — the sum is NOT a fixed 28.
// - Default mode: the winner is the team winning the MAJORITY of games
//   (ceil(games/2)); cumulative points are display/standings-tiebreak data.
// - Total-score mode (Cuong's rule, 2026-07-16): the winner is the team with
//   the HIGHER CUMULATIVE TOTAL — but only once every game is decided (a
//   tied/unplayed 0-0 game means the match is still in progress; otherwise a
//   7-5 first game would complete the match early). Equal totals leave
//   winnerId null (dreambreaker/organizer resolves).

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
  totalScoreMode = false,
): TeamMatchResult {
  let gamesWonA = 0;
  let gamesWonB = 0;
  let totalPointsA = 0;
  let totalPointsB = 0;
  let undecidedGames = 0;

  for (const { a, b } of scores) {
    totalPointsA += a;
    totalPointsB += b;
    if (a > b) gamesWonA++;
    else if (b > a) gamesWonB++;
    else undecidedGames++;
  }

  let winnerId: string | null = null;
  if (scores.length > 0) {
    if (totalScoreMode) {
      if (undecidedGames === 0) {
        if (totalPointsA > totalPointsB && teamAId) winnerId = teamAId;
        else if (totalPointsB > totalPointsA && teamBId) winnerId = teamBId;
      }
    } else {
      const requiredToWin = Math.ceil(scores.length / 2);
      if (gamesWonA >= requiredToWin && teamAId) winnerId = teamAId;
      else if (gamesWonB >= requiredToWin && teamBId) winnerId = teamBId;
    }
  }

  return { gamesWonA, gamesWonB, totalPointsA, totalPointsB, winnerId };
}
