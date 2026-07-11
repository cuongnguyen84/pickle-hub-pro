/**
 * Games a side must win to take a best-of-N match.
 *
 * Guards `best_of` explicitly: it is a required domain value, but the DB column
 * is nullable. A null/invalid best_of previously slipped into
 * `Math.ceil(null / 2) === 0`, which made `winsNeeded = 0` and marked EVERY
 * match complete after zero games. We return null so the caller surfaces a
 * data-integrity error instead of silently completing the match.
 */
export function matchWinsNeeded(bestOf: number | null | undefined): number | null {
  if (bestOf == null || !Number.isFinite(bestOf) || bestOf < 1) return null;
  return Math.ceil(bestOf / 2);
}
