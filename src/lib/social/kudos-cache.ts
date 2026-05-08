/**
 * Pure helpers for the optimistic kudos cache patch.
 *
 * Extracted from useKudosMutation so the row-update logic can be exercised
 * by unit tests without spinning up React Query. The hook still owns the
 * cache walk + snapshot management — these functions only touch the row
 * shape itself.
 */

export interface FeedRowKudosShape {
  match_id: string;
  kudos_count?: number;
  viewer_kudoed?: boolean;
}

export interface FeedPagesShape<R = FeedRowKudosShape> {
  pages?: R[][];
  pageParams?: unknown[];
}

export interface KudosDelta {
  /** +1 for kudo, -1 for unkudo. */
  count: number;
  /** New kudoed state (true after kudo, false after unkudo). */
  kudoed: boolean;
}

/**
 * Apply a kudos delta to every page in an infinite-query feed cache. Only
 * rows whose match_id matches are patched; everything else passes through
 * untouched. kudos_count never goes below 0 (defends against stale reads
 * where the cached count is already 0 but the optimistic delta would
 * subtract).
 *
 * Returns a NEW object — input is not mutated, so the snapshot saved
 * before patching is a faithful rollback target.
 */
export function patchFeedPages<R extends FeedRowKudosShape>(
  data: FeedPagesShape<R>,
  matchId: string,
  delta: KudosDelta,
): FeedPagesShape<R> {
  if (!data.pages) return data;
  return {
    ...data,
    pages: data.pages.map((page) =>
      page.map((row) =>
        row.match_id === matchId
          ? {
              ...row,
              kudos_count: Math.max(0, (row.kudos_count ?? 0) + delta.count),
              viewer_kudoed: delta.kudoed,
            }
          : row,
      ),
    ),
  };
}
