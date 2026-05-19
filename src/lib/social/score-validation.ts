/**
 * Pickleball score validation.
 *
 * Spec acceptance: "Score validation đúng" (§12). Server-side enforcement
 * lives in the match-create edge function (Sprint 2); client-side mirrors
 * the same rules so users get instant feedback in the score input.
 *
 * Rules summary:
 *   - Game format determines target score: 11, 15, 21
 *   - Win-by-2 is mandatory unless format is "11_traditional" (also 11)
 *   - Best-of: pickleball matches typically 1, 3, or 5 games. We accept
 *     1-5 game arrays; a "match" is decided when one team wins majority
 *     of games (1 of 1, 2 of 3, 3 of 5).
 *   - Per-game scores are integers ≥ 0 and ≤ a sane max (target + 30)
 *
 * Returns a structured result with the inferred winner — caller writes
 * `winning_team` to the matches row.
 */

import type { ScoringFormat, Team } from "@/types/social";

const TARGET: Record<ScoringFormat, number> = {
  "11_rally": 11,
  "11_traditional": 11,
  "15_rally": 15,
  "21_rally": 21,
};

/** Result with parsed metadata. `valid: false` carries a humanized reason. */
export type ScoreValidationResult =
  | {
      valid: true;
      games_played: number;
      games_a: number;
      games_b: number;
      winner: Team;
    }
  | {
      valid: false;
      reason: string;
    };

interface GameOutcome {
  a: number;
  b: number;
  winner: Team | null;
  reason?: string;
}

function evalGame(a: number, b: number, format: ScoringFormat): GameOutcome {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return { a, b, winner: null, reason: "Tỷ số phải là số nguyên không âm." };
  }
  const target = TARGET[format];
  if (a > target + 30 || b > target + 30) {
    return { a, b, winner: null, reason: `Tỷ số quá cao (>${target + 30}).` };
  }

  // No team yet at target → not finished
  if (a < target && b < target) {
    return { a, b, winner: null, reason: "Game chưa kết thúc." };
  }

  if (format === "11_traditional") {
    // Win-by-2 not required; first to 11
    if (a >= target && a > b) return { a, b, winner: "a" };
    if (b >= target && b > a) return { a, b, winner: "b" };
    return { a, b, winner: null, reason: "Tỷ số bằng nhau." };
  }

  // Rally / win-by-2 formats
  const margin = Math.abs(a - b);
  if (a >= target || b >= target) {
    if (margin < 2) {
      return { a, b, winner: null, reason: "Game phải thắng cách biệt 2 điểm." };
    }
    return { a, b, winner: a > b ? "a" : "b" };
  }
  return { a, b, winner: null, reason: "Game chưa kết thúc." };
}

export function validateScores(
  teamA: number[],
  teamB: number[],
  format: ScoringFormat,
): ScoreValidationResult {
  if (!Array.isArray(teamA) || !Array.isArray(teamB)) {
    return { valid: false, reason: "Tỷ số phải là mảng số." };
  }
  if (teamA.length !== teamB.length) {
    return { valid: false, reason: "Số game của 2 đội phải bằng nhau." };
  }
  if (teamA.length < 1 || teamA.length > 5) {
    return { valid: false, reason: "Trận có 1-5 game." };
  }

  let aWins = 0;
  let bWins = 0;
  for (let i = 0; i < teamA.length; i++) {
    const out = evalGame(teamA[i], teamB[i], format);
    if (out.winner === null) {
      return { valid: false, reason: `Game ${i + 1}: ${out.reason ?? "không hợp lệ."}` };
    }
    if (out.winner === "a") aWins++;
    else bWins++;
  }

  // Best-of-N: a team needs floor(N/2) + 1 game wins to win the series.
  //   N=1 → 1 (1-0)
  //   N=2 → 2 (2-0; 1-1 is unfinished)
  //   N=3 → 2 (2-0 or 2-1)
  //   N=4 → 3 (3-0, 3-1; 2-2 is unfinished)
  //   N=5 → 3 (3-0, 3-1, 3-2)
  // The previous Math.ceil(N/2) formula was wrong for even N (it allowed
  // 1-1 in 2-game submissions and 2-2 in 4-game submissions to "win") —
  // Codex bot caught this on PR #4.
  const required = Math.floor(teamA.length / 2) + 1;
  if (aWins < required && bWins < required) {
    return { valid: false, reason: "Chưa đội nào thắng đủ số game cần thiết." };
  }

  // Defensive: with the corrected required threshold, both teams reaching
  // it simultaneously is mathematically impossible (would require sum of
  // wins to exceed games_played). Guard anyway so a future refactor can't
  // silently regress to the original bug.
  if (aWins === bWins) {
    return { valid: false, reason: "Hòa game count — cần thêm game tie-breaker." };
  }

  return {
    valid: true,
    games_played: teamA.length,
    games_a: aWins,
    games_b: bWins,
    winner: aWins > bWins ? "a" : "b",
  };
}
