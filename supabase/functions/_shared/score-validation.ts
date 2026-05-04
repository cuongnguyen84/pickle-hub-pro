// ============================================================================
// _shared/score-validation.ts — Deno port of src/lib/social/score-validation.ts
// ----------------------------------------------------------------------------
// Server-side enforcement for the match-create edge function. Mirrors the
// client-side logic (FIX 1 clean — no tied series). Inlines the type
// definitions to avoid pulling client-only @/types/social aliases that
// don't resolve in Deno.
// ============================================================================

export type ScoringFormat =
  | "11_rally"
  | "11_traditional"
  | "15_rally"
  | "21_rally";
export type Team = "a" | "b";

const TARGET: Record<ScoringFormat, number> = {
  "11_rally": 11,
  "11_traditional": 11,
  "15_rally": 15,
  "21_rally": 21,
};

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
  if (a < target && b < target) {
    return { a, b, winner: null, reason: "Game chưa kết thúc." };
  }
  if (format === "11_traditional") {
    if (a >= target && a > b) return { a, b, winner: "a" };
    if (b >= target && b > a) return { a, b, winner: "b" };
    return { a, b, winner: null, reason: "Tỷ số bằng nhau." };
  }
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
      return {
        valid: false,
        reason: `Game ${i + 1}: ${out.reason ?? "không hợp lệ."}`,
      };
    }
    if (out.winner === "a") aWins++;
    else bWins++;
  }

  // FIX 1 (PR #4 Codex): require floor(N/2)+1 wins, reject ties.
  const required = Math.floor(teamA.length / 2) + 1;
  if (aWins < required && bWins < required) {
    return { valid: false, reason: "Chưa đội nào thắng đủ số game cần thiết." };
  }
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
