/**
 * Logged-in website visitors who open / or /vi land on the feed.
 *
 * The iOS app home tab is native SwiftUI (HomeView.swift). It does not load
 * this page, so this rule does not change the app. Logged-out visitors and
 * crawlers have no session, so the editorial homepage — and its SEO — stay.
 *
 * ?home=1 is the way back to livestreams, tournaments, and news. The flag
 * is not stored: the next plain visit to / still opens the feed.
 */

export interface LoggedInFeedRedirectInput {
  pathname: string;
  search: string;
  isAuthenticated: boolean;
  /** False while the session is still resolving. Do not redirect yet. */
  authResolved: boolean;
}

export function editorialHomeHref(language: "en" | "vi"): string {
  return language === "vi" ? "/vi?home=1" : "/?home=1";
}

export function wantsEditorialHome(search: string): boolean {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw).get("home") === "1";
}

export function loggedInFeedRedirect(input: LoggedInFeedRedirectInput): "/feed" | "/vi/feed" | null {
  if (!input.authResolved || !input.isAuthenticated) return null;
  if (wantsEditorialHome(input.search)) return null;
  if (input.pathname === "/") return "/feed";
  if (input.pathname === "/vi" || input.pathname === "/vi/") return "/vi/feed";
  return null;
}
