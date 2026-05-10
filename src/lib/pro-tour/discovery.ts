/**
 * Sprint 7 PR-A — Tournament auto-discovery (skeleton)
 *
 * Phase 1 scope per spec: scrape pickleballtournaments.com listing pages
 * filtered to PPA Tour Asia / Vietnam events and auto-add matches to
 * pro_tour_watchlist with status='active'. Phase 2 (defer) broadens to
 * arbitrary pro tours.
 *
 * ⚠️ STATUS — skeleton.
 * The discoverTournaments() body is a stub returning []. Real
 * implementation depends on the listing-page DOM which Sprint 7 PR-B
 * harvests alongside the SSE format. The function signature + return
 * shape are final so the surrounding admin trigger code (Sprint 7 PR-A
 * admin UI tab 4) can be reviewable now.
 */

export interface TournamentDiscoveryFilter {
  /** Geographic region. Phase 1 supports 'asia' / 'vietnam' only;
   *  Phase 2 expands to 'us', 'eu', 'global'. */
  region?: "vietnam" | "asia" | "global";
  /** Tour family. Phase 1 = PPA only. */
  tour?: "ppa_tour" | "app_tour" | "mlp";
  /** ISO date — only return tournaments after this date. Defaults to
   *  start-of-current-month so admin workflow surfaces upcoming + recent. */
  since?: string;
}

export interface DiscoveredTournament {
  /** brackets.pickleballtournaments.com URL ready for the watchlist. */
  tournament_url: string;
  tournament_name: string;
  source_provider: "ppa_tour" | "app_tour" | "mlp" | "other";
  /** ISO date when the tournament starts. */
  start_date: string | null;
  /** Best-effort city/region (e.g. "Da Nang", "Asia"). Null when source
   *  doesn't expose it. */
  location: string | null;
}

/**
 * Walk the tournament listing pages and surface anything matching the
 * filter. Caller (admin UI tab) decides whether to persist into
 * pro_tour_watchlist (manual approve flow).
 *
 * Sprint 7 PR-A returns []. PR-B implements the real fetch + parse.
 */
export async function discoverTournaments(
  filter: TournamentDiscoveryFilter,
): Promise<DiscoveredTournament[]> {
  void filter;
  // PLACEHOLDER — Sprint 7 PR-B fills in. Returning empty array means
  // the admin discovery tab renders "no tournaments found" until then.
  return [];
}
