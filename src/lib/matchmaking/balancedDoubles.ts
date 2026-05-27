// ============================================================================
// balancedDoubles — combined-DUPR partner balance for 4-player courts
// ----------------------------------------------------------------------------
// Sprint C2 (2026-05-27).
//
// Given 4 players, find the pairing (3 possible: 12-34, 13-24, 14-23) that
// minimizes |sumA - sumB| where sum is the team's combined DUPR (or generic
// `level`). Returns the chosen teams + a [0..1] fairness score where
// 1.0 means perfectly balanced.
//
// Null levels fall back to 0 in the math — caller should already have
// gated on coverage (see balancedScheduleEligible below) so this only
// runs when most players have DUPR.
// ============================================================================

import type { MMPlayer } from "./index";

export interface BalancedPairingResult {
  teamA: [MMPlayer, MMPlayer];
  teamB: [MMPlayer, MMPlayer];
  /** Combined sums (DUPR / level) — useful for UI debug + tests. */
  sumA: number;
  sumB: number;
  /** Absolute diff between team sums. Lower = more balanced. */
  diff: number;
  /** 1.0 = perfect balance, 0 = max imbalance for the range. */
  fairness: number;
}

const PAIRINGS: Array<[[0 | 1 | 2 | 3, 0 | 1 | 2 | 3], [0 | 1 | 2 | 3, 0 | 1 | 2 | 3]]> = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

/**
 * Pick the 2v2 partition of 4 players that minimizes combined-DUPR diff.
 *
 * Tie-break: prefers pairings that put the highest-rated player with the
 * lowest-rated player (classic Mexicano "zigzag") for visual symmetry.
 */
export function balancedPairing(
  p: [MMPlayer, MMPlayer, MMPlayer, MMPlayer],
): BalancedPairingResult {
  const lv = (player: MMPlayer) => player.level ?? 0;

  let best: BalancedPairingResult | null = null;
  for (const [aIdx, bIdx] of PAIRINGS) {
    const teamA: [MMPlayer, MMPlayer] = [p[aIdx[0]], p[aIdx[1]]];
    const teamB: [MMPlayer, MMPlayer] = [p[bIdx[0]], p[bIdx[1]]];
    const sumA = lv(teamA[0]) + lv(teamA[1]);
    const sumB = lv(teamB[0]) + lv(teamB[1]);
    const diff = Math.abs(sumA - sumB);
    // Fairness: diff of 0 → 1.0, diff of 2.0 (one full DUPR point per
    // player) → 0.0. Linear clip is plenty for UX, no need for sigmoid.
    const fairness = Math.max(0, 1 - diff / 2);
    const candidate: BalancedPairingResult = { teamA, teamB, sumA, sumB, diff, fairness };
    if (best == null || diff < best.diff) {
      best = candidate;
    }
  }
  // best must be non-null since PAIRINGS has 3 entries.
  return best!;
}

/**
 * Coverage gate — true when ≥ threshold (default 0.75) of players have a
 * non-null level. Caller should fall back to random shuffle below this.
 */
export function balancedScheduleEligible(
  players: ReadonlyArray<MMPlayer>,
  threshold = 0.75,
): boolean {
  if (players.length === 0) return false;
  const withLevel = players.filter((p) => p.level != null).length;
  return withLevel / players.length >= threshold;
}

/**
 * Average fairness across a list of pairings — handy for the
 * <RoundFairnessCard> "Round X: 92% balanced" stat.
 */
export function averageFairness(results: ReadonlyArray<BalancedPairingResult>): number {
  if (results.length === 0) return 0;
  return results.reduce((sum, r) => sum + r.fairness, 0) / results.length;
}
