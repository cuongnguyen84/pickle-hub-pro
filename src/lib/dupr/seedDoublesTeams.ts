// ============================================================================
// seedDoublesTeams — compute team-level DUPR avg + seed source
// ----------------------------------------------------------------------------
// DUPR Phase 1 (2026-05-29). Companion to seedFromDupr.ts which seeds INDIVIDUAL
// players for QuickTables / Mexicano. Doubles Elimination teams have TWO players,
// so the seed value is the team avg DUPR (doubles bucket). One singles fallback
// per player still allowed → seed_source becomes 'approx'. When at least one
// player is missing DUPR entirely the team is uncomputable (returns null avg,
// 'none' source) and the caller seeds it at the bottom alphabetically.
//
// Used by:
//   - DoublesEliminationSetup wizard Step 3 (Auto-seed by DUPR button)
//   - useDoublesElimination.generateBracket (when seedingStrategy='dupr')
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import type { DuprSeedSource } from "@/hooks/useDoublesElimination";

export interface TeamSeedInput {
  /** Local id (TeamInput.id from setup wizard, or row id). Returned for matching. */
  id: string;
  /** Profile id (UUID). When null, no DUPR — team excluded from rated list. */
  player1_user_id: string | null;
  player2_user_id: string | null;
}

export interface TeamSeedResult {
  id: string;
  dupr_avg_rating: number | null;
  dupr_seed_source: DuprSeedSource;
  /** True if at least one player's rating came from singles fallback. */
  hasApprox: boolean;
  /** True when at least one rating is older than 30 days. */
  isStale: boolean;
}

const STALE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fetch DUPR doubles ratings for unique user ids referenced across teams,
 * then compute per-team avg. One round-trip.
 *
 * Returns array same length / same order as input teams.
 *
 * Source rules:
 *   - 'exact'  → both players have dupr_doubles
 *   - 'approx' → at least one player used dupr_singles fallback
 *   - 'none'   → at least one player has no DUPR at all (avg = null)
 *
 * Why doubles-only: Doubles Elimination is by definition a doubles bracket.
 * Singles ratings are only used as a fallback when the player has zero
 * doubles history — matches seedFromDupr.ts singles-fallback policy.
 */
export async function computeTeamDuprSeeds(
  teams: ReadonlyArray<TeamSeedInput>,
): Promise<TeamSeedResult[]> {
  const userIds = new Set<string>();
  for (const t of teams) {
    if (t.player1_user_id) userIds.add(t.player1_user_id);
    if (t.player2_user_id) userIds.add(t.player2_user_id);
  }

  if (userIds.size === 0) {
    return teams.map((t) => ({
      id: t.id,
      dupr_avg_rating: null,
      dupr_seed_source: "none",
      hasApprox: false,
      isStale: false,
    }));
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, dupr_singles, dupr_doubles, dupr_synced_at")
    .in("id", Array.from(userIds));
  if (error) throw error;

  const ratings = new Map<
    string,
    { rating: number | null; syncedAt: string | null; isApprox: boolean }
  >();
  for (const row of (data ?? []) as Array<{
    id: string;
    dupr_singles: number | null;
    dupr_doubles: number | null;
    dupr_synced_at: string | null;
  }>) {
    const primary = row.dupr_doubles;
    const fallback = row.dupr_singles;
    const rating = primary ?? fallback ?? null;
    const isApprox = primary == null && fallback != null;
    ratings.set(row.id, { rating, syncedAt: row.dupr_synced_at, isApprox });
  }

  return teams.map((t) => resolveTeam(t, ratings));
}

function resolveTeam(
  team: TeamSeedInput,
  ratings: Map<string, { rating: number | null; syncedAt: string | null; isApprox: boolean }>,
): TeamSeedResult {
  const p1 = team.player1_user_id ? ratings.get(team.player1_user_id) : undefined;
  const p2 = team.player2_user_id ? ratings.get(team.player2_user_id) : undefined;

  // Team must have both player ids AND both players found with valid ratings
  // for a meaningful avg. Anything else → 'none'.
  const r1 = p1?.rating;
  const r2 = p2?.rating;
  if (r1 == null || r2 == null) {
    return {
      id: team.id,
      dupr_avg_rating: null,
      dupr_seed_source: "none",
      hasApprox: !!(p1?.isApprox || p2?.isApprox),
      isStale: isStale(p1?.syncedAt) || isStale(p2?.syncedAt),
    };
  }

  const avg = Math.round(((r1 + r2) / 2) * 100) / 100;
  const hasApprox = !!(p1?.isApprox || p2?.isApprox);
  return {
    id: team.id,
    dupr_avg_rating: avg,
    dupr_seed_source: hasApprox ? "approx" : "exact",
    hasApprox,
    isStale: isStale(p1?.syncedAt) || isStale(p2?.syncedAt),
  };
}

function isStale(syncedAt: string | null | undefined): boolean {
  if (!syncedAt) return false;
  return Date.now() - new Date(syncedAt).getTime() > STALE_MS;
}

/**
 * Coverage summary for SeedExplainerCard banner.
 * Identical shape to seedCoverage() in seedFromDupr.ts so the existing
 * <SeedExplainerCard> can render this without modification.
 */
export function teamSeedCoverage(
  results: ReadonlyArray<TeamSeedResult>,
): {
  total: number;
  withDupr: number;
  withoutDupr: number;
  stale: number;
  approx: number;
  coveragePct: number;
} {
  const total = results.length;
  let withDupr = 0;
  let stale = 0;
  let approx = 0;
  for (const r of results) {
    if (r.dupr_avg_rating != null) withDupr++;
    if (r.isStale) stale++;
    if (r.dupr_seed_source === "approx") approx++;
  }
  return {
    total,
    withDupr,
    withoutDupr: total - withDupr,
    stale,
    approx,
    coveragePct: total > 0 ? withDupr / total : 0,
  };
}
