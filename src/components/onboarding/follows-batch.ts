/**
 * Reconciliation helper for the Suggested Follows step's "Finish" handler.
 *
 * Although the per-row FollowButton owns the canonical insert into
 * social_follows (commit 5754108), Cuong observed a case where the wizard's
 * UI counter incremented but social_follows was empty after Finish. The
 * realistic failure modes that produce that pattern are all racy:
 *
 *   - Mutation in flight when the user taps Finish; navigate("/") unmounts
 *     the wizard and an outgoing fetch is aborted by the browser before the
 *     write commits.
 *   - Slow 3G / tab backgrounded mid-insert.
 *   - Any silent FollowButton failure where onSuccess fired but the network
 *     write was actually rolled back.
 *
 * Defence: at Finish time we re-emit the selected ids as an idempotent
 * upsert. Existing rows are no-ops (composite PK conflict ignored), missing
 * rows get filled in. This keeps the FollowButton optimistic UX intact while
 * guaranteeing DB convergence with the wizard's final selected_user_ids.
 */

export interface FollowRow {
  follower_id: string;
  followed_id: string;
}

/**
 * Build the upsert payload, dropping invalid candidates:
 *   - empty/falsy ids
 *   - self-follow (would violate social_follows_no_self CHECK)
 *   - duplicates within the same payload
 */
export function buildFollowsBatchRows(
  followerId: string,
  selectedIds: ReadonlyArray<string>,
): FollowRow[] {
  if (!followerId) return [];
  const seen = new Set<string>();
  const rows: FollowRow[] = [];
  for (const id of selectedIds) {
    if (!id) continue;
    if (id === followerId) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({ follower_id: followerId, followed_id: id });
  }
  return rows;
}
