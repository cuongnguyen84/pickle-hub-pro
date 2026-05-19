/**
 * Sprint 6 — Pro tour adapter contract.
 *
 * This module defines the shape any pro-tour data source must produce
 * after extraction. Today we have one adapter (`rsc-scraper`) that
 * scrapes Next.js-rendered HTML from brackets.pickleballtournaments.com
 * via Cloudflare Browser Rendering. Future adapters could hit the
 * official PPA API once that lands, or accept manual CSV uploads.
 *
 * Adapters return TournamentScrapeResult; the Supabase edge function
 * `pro-tour-ingest` is the single consumer that reconciles ghosts
 * + matches + participants idempotently.
 */

export type SourceProvider =
  | "community"
  | "ppa_tour"
  | "app_tour"
  | "mlp"
  | "other";

export interface ProTourAdapter<Env = unknown> {
  readonly name: "rsc_scraper" | "pickleball_api" | "manual_csv";
  /** True when the adapter recognises the URL. Used by the dispatch
   *  router in the Worker so multiple adapters can coexist. */
  validateUrl(url: string): boolean;
  /** Fetch + parse a tournament's brackets and return a normalized
   *  result. Throws on unrecoverable parse error so the caller can
   *  log status='failed' with the error message. */
  fetchTournament(url: string, env: Env): Promise<TournamentScrapeResult>;
}

export interface TournamentScrapeResult {
  source_provider: SourceProvider;
  source_url: string;
  tournament_name: string;
  tournament_event: string;
  matches: ScrapedMatch[];
  /** Deduped player list (one entry per external_id). The ingest
   *  function reconciles each against profiles via
   *  (source_provider, external_id) lookup and inserts ghost rows
   *  for any miss. */
  players: ScrapedPlayer[];
}

export interface ScrapedMatch {
  /** Stable id derived from the source (bracket UUID + round + slot,
   *  or the source's own match identifier). Required for idempotent
   *  re-import — the ingest function dedupes on
   *  (source_provider, external_match_id). */
  external_match_id: string;
  round_name: string;
  team_one: ScrapedTeam;
  team_two: ScrapedTeam;
  /** Per-game scores. Length = number of games played. Pro-tour
   *  doubles is best-of-5 typically; first-to-11 win-by-2 standard
   *  scoring (parser doesn't validate, just records the integers
   *  the source rendered). */
  scores_team_one: number[];
  scores_team_two: number[];
  winner_team: "one" | "two" | null;
  court: string | null;
  /** ISO 8601 string. Pro-tour brackets typically expose match
   *  scheduled time; if completed-at differs, parser uses completed-at
   *  when available, else scheduled. */
  played_at: string | null;
  source_url: string;
}

export interface ScrapedTeam {
  /** Bracket seed number (1-based). Null when unseeded or not
   *  surfaced by the source. */
  seed: number | null;
  /** External ids of the team's players. Doubles = 2 entries,
   *  singles = 1. Order doesn't matter — match_participants gets
   *  the position field set by the ingest function. */
  player_external_ids: string[];
}

export interface ScrapedPlayer {
  external_id: string;
  external_url: string;
  display_name: string;
  avatar_url: string | null;
  /** ISO 3166-1 alpha-2 ("VN", "US"). Null when source doesn't
   *  expose it. profiles.country_code constraint enforces 2-char. */
  country_code: string | null;
}
