// ============================================================================
// pro-tour shared types — Sprint 6
// ----------------------------------------------------------------------------
// Mirror of src/lib/pro-tour/types.ts so the Deno edge function can import
// without crossing the deno/node module boundary. Keep these in sync —
// the contract between the Worker (which produces TournamentScrapeResult)
// and the edge function (which consumes it) lives here.
// ============================================================================

export type SourceProvider =
  | "community"
  | "ppa_tour"
  | "app_tour"
  | "mlp"
  | "other";

export interface TournamentScrapeResult {
  source_provider: SourceProvider;
  source_url: string;
  tournament_name: string;
  tournament_event: string;
  matches: ScrapedMatch[];
  players: ScrapedPlayer[];
}

export interface ScrapedMatch {
  external_match_id: string;
  round_name: string;
  team_one: ScrapedTeam;
  team_two: ScrapedTeam;
  scores_team_one: number[];
  scores_team_two: number[];
  winner_team: "one" | "two" | null;
  court: string | null;
  played_at: string | null;
  source_url: string;
}

export interface ScrapedTeam {
  seed: number | null;
  player_external_ids: string[];
}

export interface ScrapedPlayer {
  external_id: string;
  external_url: string;
  display_name: string;
  avatar_url: string | null;
  country_code: string | null;
}
