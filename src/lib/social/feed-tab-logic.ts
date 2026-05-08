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
  /** Optional ?tab= URL override. When set, wins over auto-default. */
  urlOverride?: FeedTab | null;
}

/**
 * Resolve which tab the page should land on initially.
 *
 *   - URL override always wins (deep links / browser back-button).
 *   - Anonymous → trending (no Following feed without follows).
 *   - Authenticated, 0 follows → trending (Empty State A would feel hostile
 *     as the very first thing they see).
 *   - Authenticated, >0 follows → following (the Bet #1 social loop).
 */
export function resolveDefaultTab(ctx: FeedTabContext): FeedTab {
  if (ctx.urlOverride === "following" || ctx.urlOverride === "trending") {
    return ctx.urlOverride;
  }
  if (!ctx.isAuthenticated) return "trending";
  const count = ctx.followingCount ?? 0;
  if (count <= 0) return "trending";
  return "following";
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
