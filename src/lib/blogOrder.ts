// ============================================================================
// blogOrder — "recently touched" ordering for blog listings
// ----------------------------------------------------------------------------
// The homepage and /blog used to sort on publishedDate alone, so a living post
// that got refreshed mid-event never resurfaced. That bit us during the World
// Cup week (2026-08-31): the Group A article was rewritten that morning with
// the fact readers were searching for, and still sat at position 8 with the
// homepage slicing the top 6, because it had been published on Aug 17.
//
// Ordering is by the LATER of published and updated. Two consequences that
// callers must respect:
//
//  1. Display the same date you sorted on. Ranking a post by its update date
//     while printing its publish date puts an item dated Aug 17 above one
//     dated Aug 26, which reads as a bug. Use `isRefreshed` to label it.
//  2. `datePublished` in schema is NOT this value. This is presentation order
//     only — never feed it back into structured data, or the post starts
//     claiming a publication date it does not have.
//
// On the VI side `updated_at` is written by a database trigger on every row
// write, so any admin edit — including a typo fix — lifts that post. That is
// the accepted cost of the VI branch reading the same signal as EN; if it ever
// gets noisy, the fix is a separate hand-controlled column, not a re-sort here.
// ============================================================================

const parse = (value: string | null | undefined): number => {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/** Sort key: the later of published and updated, in epoch ms. */
export function effectiveDateMs(
  publishedAt: string | null | undefined,
  updatedAt: string | null | undefined,
): number {
  return Math.max(parse(publishedAt), parse(updatedAt));
}

/** The ISO date a listing should display — the one it sorted on. */
export function effectiveDateIso(
  publishedAt: string | null | undefined,
  updatedAt: string | null | undefined,
): string | null {
  return parse(updatedAt) > parse(publishedAt)
    ? (updatedAt ?? publishedAt ?? null)
    : (publishedAt ?? null);
}

/**
 * True when the post has been meaningfully updated since publication, so the
 * listing can label the date instead of silently showing a newer one.
 *
 * Same-day updates don't count: a post published and tweaked within one day was
 * never "refreshed", and labelling it would put "Updated" on brand-new posts.
 */
export function isRefreshed(
  publishedAt: string | null | undefined,
  updatedAt: string | null | undefined,
): boolean {
  const published = parse(publishedAt);
  const updated = parse(updatedAt);
  if (!published || !updated) return false;
  return updated - published >= 86_400_000;
}

/** Comparator for newest-touched-first listings. */
export function byEffectiveDateDesc<T>(
  getPublished: (item: T) => string | null | undefined,
  getUpdated: (item: T) => string | null | undefined,
) {
  return (a: T, b: T): number =>
    effectiveDateMs(getPublished(b), getUpdated(b)) -
    effectiveDateMs(getPublished(a), getUpdated(a));
}

// ============================================================================
// World Cup week pin (lệnh #77, 2026-09-02)
// ----------------------------------------------------------------------------
// The homepage renders only the top TWO stories. The live results article
// updates itself every minute through the wc_pro_matches widget, but its
// static updatedDate does not move — so every hand-edit to another World Cup
// post buries the one page that is actually freshest. VI dodges this only
// because its DB trigger bumps updated_at; EN has no such signal.
//
// While the event is running, the results article (either language twin)
// holds the top slot. Self-expires after finals day — safe to delete after.
// ============================================================================

const WC_PIN_UNTIL = Date.parse("2026-09-07T00:00:00+07:00");
const WC_PIN_SLUGS = new Set([
  "pickleball-world-cup-2026-da-nang-results",
  "ket-qua-pickleball-world-cup-2026-da-nang",
]);

/** Lift the live World Cup results post to the front while the event runs. */
export function pinWorldCupResults<T>(
  list: T[],
  slugOf: (item: T) => string,
  now: number = Date.now(),
): T[] {
  if (now > WC_PIN_UNTIL) return list;
  const i = list.findIndex((item) => WC_PIN_SLUGS.has(slugOf(item)));
  return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
}
