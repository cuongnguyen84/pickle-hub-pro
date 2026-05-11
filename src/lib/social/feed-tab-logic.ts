/**
 * Pure helpers for the /feed page tab state. Extracted so the default-tab
 * decision tree is unit-testable without rendering the page.
 *
 * The Feed page mirrors the design rationale (Frame 01/02): Following first,
 * Trending second. But the *default* depends on auth + follow graph state.
 */

export type FeedTab = "following" | "trending";

export interface FeedTabContext {
  /** True when a session is present (useAuth user !== null). */
  isAuthenticated: boolean;
  /**
   * How many people the viewer follows. When undefined, we assume zero so
   * a logged-in user without stats yet falls back to Trending — gentler
   * than landing them on an empty Following feed.
   */
  followingCount: number | null | undefined;
  /** Optional ?tab= URL override. Validated against tab visibility below. */
  urlOverride?: FeedTab | null;
}

/**
 * Resolve which tab the page should land on initially.
 *
 *   - URL override "trending" always honoured (visible to everyone).
 *   - URL override "following" honoured only when authenticated. Anonymous
 *     deep-links to ?tab=following coerce to trending — otherwise we'd
 *     render Following content while the Following tab is hidden, creating
 *     a keyboard trap (Codex P2 fix on PR #16).
 *   - No URL override: ALWAYS land on Trending. Sprint 6 product call:
 *     Trending now leads with PPA / APP / MLP pro matches (boosted in
 *     get_trending_feed) so even cold-start users see fresh, recognizable
 *     content before deciding to follow anyone. This trumps the previous
 *     "logged-in with >0 follows → following" heuristic — that path landed
 *     low-engagement viewers on a sometimes-stale Following timeline.
 */
export function resolveDefaultTab(ctx: FeedTabContext): FeedTab {
  if (ctx.urlOverride === "trending") {
    return "trending";
  }
  if (ctx.urlOverride === "following") {
    return ctx.isAuthenticated ? "following" : "trending";
  }
  // No override: Trending is the cold-start default for everyone. The
  // Following tab remains one click away (and the deep-link still works
  // for users who bookmark ?tab=following).
  return "trending";
}

/** True only when the Following tab should be visible. */
export function shouldShowFollowingTab(isAuthenticated: boolean): boolean {
  return isAuthenticated;
}

/** Parse a raw URL search-param value into a FeedTab or null. */
export function parseTabParam(value: string | null | undefined): FeedTab | null {
  if (value === "following" || value === "trending") return value;
  return null;
}
