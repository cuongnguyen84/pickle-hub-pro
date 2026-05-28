// ============================================================================
// seedFromDupr — adapter wiring profiles.dupr_* into bracket seed positions
// ----------------------------------------------------------------------------
// Sprint B2.1 (2026-05-27). Pure functions — no React, no DB writes. The
// React hook (useDuprSeeds) handles fetching; this module handles the
// ranking math.
//
// Used by:
//   - QuickTable bracket setup (B2.2) for snake-distribution
//   - DoublesElimination (future)
//   - Mexicano partner balancing (Sprint C — different util)
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export type SeedFormat = "singles" | "doubles";

export interface SeedablePlayer {
  /** Profile id (UUID). If null, player has no profile (ghost/guest). */
  id: string | null;
  /** Display label. Used as tie-breaker for unrated players. */
  name: string;
  /** Optional pre-existing seed override (manual). */
  manualSeed?: number | null;
}

export interface RankedPlayer extends SeedablePlayer {
  /** Computed seed (1 = strongest). */
  seed: number;
  /** DUPR rating used to compute the seed; null when missing. */
  dupr: number | null;
  /** When dupr_synced_at is older than STALE_DAYS days. */
  isStale: boolean;
  /** True when the rating came from the fallback bucket (doubles when
   *  format=singles and the player has no singles rating). UI labels
   *  this as "ước tính" so organizers know it's not direct. */
  isApprox?: boolean;
}

const STALE_DAYS = 30;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Fetch DUPR ratings for a batch of user ids in one round-trip.
 * Returns a Map keyed by user_id; missing rows return null.
 *
 * Singles-fallback policy (Sprint B2 follow-up 2026-05-27):
 *   When format='singles' and a player has no dupr_singles, we fall
 *   back to their dupr_doubles. Reason: in VN the vast majority of
 *   DUPR-rated players have only competed in doubles events, so
 *   strict singles-only seeding would mark them as "no DUPR" and seed
 *   them alphabetically — confusing for organizers who can see those
 *   players have a public DUPR. The `isApprox` flag lets UI surface
 *   "(approx from doubles)" when that happens.
 *   Doubles tables stay strict — no fallback to singles.
 */
export async function fetchDuprSeeds(
  userIds: ReadonlyArray<string>,
  format: SeedFormat,
): Promise<Map<string, { rating: number | null; syncedAt: string | null; isApprox?: boolean }>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, dupr_singles, dupr_doubles, dupr_synced_at")
    .in("id", [...userIds]);
  if (error) throw error;
  const out = new Map<
    string,
    { rating: number | null; syncedAt: string | null; isApprox?: boolean }
  >();
  for (const row of (data ?? []) as Array<{
    id: string;
    dupr_singles: number | null;
    dupr_doubles: number | null;
    dupr_synced_at: string | null;
  }>) {
    const primary = format === "singles" ? row.dupr_singles : row.dupr_doubles;
    const fallback = format === "singles" ? row.dupr_doubles : null;
    const rating = primary ?? fallback ?? null;
    const isApprox = primary == null && fallback != null;
    out.set(row.id, { rating, syncedAt: row.dupr_synced_at, isApprox });
  }
  return out;
}

/**
 * Sort players by DUPR rating descending (highest = seed #1).
 *
 * Tie-breaking order:
 *   1. Manual seed override (lower wins)
 *   2. Has DUPR vs missing → players with DUPR rank higher
 *   3. DUPR value descending
 *   4. Alphabetical by name (stable, locale-aware Vietnamese-friendly)
 *
 * Returns a new array — does NOT mutate input.
 */
export function rankBySeed(
  players: ReadonlyArray<SeedablePlayer>,
  ratings: Map<string, { rating: number | null; syncedAt: string | null; isApprox?: boolean }>,
): RankedPlayer[] {
  const enriched = players.map((p) => {
    const row = p.id ? ratings.get(p.id) : undefined;
    const rating = row?.rating ?? null;
    const syncedAt = row?.syncedAt ?? null;
    return {
      ...p,
      dupr: rating,
      isApprox: row?.isApprox ?? false,
      isStale:
        syncedAt != null && Date.now() - new Date(syncedAt).getTime() > STALE_MS,
    };
  });

  enriched.sort((a, b) => {
    // 1. Manual seed override wins outright
    if (a.manualSeed != null && b.manualSeed != null) {
      return a.manualSeed - b.manualSeed;
    }
    if (a.manualSeed != null) return -1;
    if (b.manualSeed != null) return 1;
    // 2. Has DUPR ranks higher than missing
    if (a.dupr != null && b.dupr == null) return -1;
    if (a.dupr == null && b.dupr != null) return 1;
    // 3. DUPR descending
    if (a.dupr != null && b.dupr != null && a.dupr !== b.dupr) {
      return b.dupr - a.dupr;
    }
    // 4. Alphabetical fallback (Vietnamese locale)
    return a.name.localeCompare(b.name, "vi");
  });

  return enriched.map((p, idx) => ({ ...p, seed: idx + 1 }));
}

/**
 * Coverage summary for the BracketSetupDialog banner.
 */
export function seedCoverage(ranked: ReadonlyArray<RankedPlayer>): {
  total: number;
  withDupr: number;
  withoutDupr: number;
  stale: number;
  approx: number;
  coveragePct: number;
} {
  const total = ranked.length;
  let withDupr = 0;
  let stale = 0;
  let approx = 0;
  for (const p of ranked) {
    if (p.dupr != null) withDupr++;
    if (p.isStale) stale++;
    if (p.isApprox) approx++;
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
