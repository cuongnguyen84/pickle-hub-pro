/**
 * MLP event-page scraper adapter (2026-06 rewrite).
 *
 * MLP migrated off the brackets.pickleballteamleagues.com iframe model
 * around 2026-05 → 2026-06. Schedule data now lives in a WordPress
 * plugin (`fau-scores-and-stats`) whose REST endpoints are:
 *
 *   GET /wp-json/fau-scores-and-stats/v1/event-matchups?event_uuid=<uuid>
 *
 * The `event_uuid` is embedded in the MLP event page as a `data-event-uuid`
 * attribute on `<div id="event-matches">`. The endpoint has a same-origin
 * gate (returns 403 "rest_forbidden_origin" without it), so we send an
 * Origin + Referer header pinned to majorleaguepickleball.co.
 *
 * Response shape (camel→snake from the old API):
 *   results.system_matchups[] = date buckets
 *     divisions[] = group/pool buckets
 *       matchups[] = TEAM-vs-TEAM matchup records
 *         matches[] = 5 inner game records (WD/MD/MXD1/MXD2/DB), each
 *           with team_*_player_*_name + team_*_game_one_score + etc.
 *
 * Net benefit over the old brackets RSC scraper:
 *   - 1 API call (clean JSON) vs 3+ raw HTML fetches with escaped-JSON
 *     regex tunnelling.
 *   - All data populated up-front (no separate per-pool fetch).
 *   - Player lineups land alongside matchup metadata — no second-source
 *     reconciliation.
 */

import type {
  ProTourAdapter,
  TournamentScrapeResult,
  ScrapedMatch,
  ScrapedPlayer,
} from "../types";

interface MlpScraperEnv {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

// majorleaguepickleball.co/events-<year>/<slug>/ — the public event hub.
export const MLP_EVENT_HOST_PATTERN =
  /^https:\/\/majorleaguepickleball\.co\/events-\d{4}\/[a-z0-9-]+\/?$/i;

// MLP plugin REST endpoint used by scrapeMlpViaApi in the Worker.
export const MLP_API_HOST =
  "https://majorleaguepickleball.co/wp-json/fau-scores-and-stats/v1";

export const mlpEventScraperAdapter: ProTourAdapter<MlpScraperEnv> = {
  name: "mlp_event_scraper",
  validateUrl(url) {
    return MLP_EVENT_HOST_PATTERN.test(url);
  },
  async fetchTournament(_url, _env) {
    void _url;
    void _env;
    throw new Error(
      "mlpEventScraperAdapter.fetchTournament: orchestration lives in " +
        "workers/pro-tour-scraper/src/index.ts; this stub keeps the adapter " +
        "testable in isolation.",
    );
  },
};

/* ─── Public types — match the FeedMlpMatchCard notes JSON contract ─── */

export interface MlpMatchupGameLineup {
  label: string; // "WD" | "MD" | "MXD1" | "MXD2" | "DB"
  score_a: number;
  score_b: number;
  players_a: string[];
  players_b: string[];
  winner: "a" | "b" | null;
}

export interface MlpMatchupTeamMeta {
  name: string;
  logo: string | null;
  matchup_wins: number;
}

export interface MlpMatchupNotes {
  format: "mlp_team_matchup";
  team_a: MlpMatchupTeamMeta;
  team_b: MlpMatchupTeamMeta;
  games: MlpMatchupGameLineup[];
}

/* ─── API response types (loosely typed; only the fields we read) ──── */

interface FauLogo {
  url?: string | null;
}

interface FauMatch {
  match_uuid?: string;
  team_one_player_one_name?: string | null;
  team_one_player_two_name?: string | null;
  team_two_player_one_name?: string | null;
  team_two_player_two_name?: string | null;
  team_one_game_one_score?: number | null;
  team_two_game_one_score?: number | null;
  player_group_title?: string | null; // "Womens" | "Mens" | "Mixed" | "Coed"
  format_title?: string | null; // "Doubles" | "Singles"
  winner?: number | null; // 1 = team_one, 2 = team_two, 0 = none
}

interface FauMatchup {
  uuid?: string;
  team_one_uuid?: string | null;
  team_two_uuid?: string | null;
  team_one_title?: string | null;
  team_two_title?: string | null;
  team_one_abbreviation?: string | null;
  team_two_abbreviation?: string | null;
  team_one_logo?: FauLogo | null;
  team_two_logo?: FauLogo | null;
  team_one_score?: number;
  team_two_score?: number;
  matchup_status?: string;
  winner?: number;
  planned_start_date?: string | null;
  venue?: string | null;
  matches?: FauMatch[];
}

interface FauDivision {
  division_title?: string;
  matchups?: FauMatchup[];
}

interface FauSystemBucket {
  matchup_date?: string;
  divisions?: FauDivision[];
}

interface FauApiResponse {
  total_records?: number;
  results?: { system_matchups?: FauSystemBucket[] };
}

/* ─── Per-game label resolution ──────────────────────────────────────── */

function deriveGameLabel(
  match: FauMatch,
  mixedSeenInMatchup: number,
): { label: string; mixedSeen: number } {
  const fmt = (match.format_title ?? "").toLowerCase();
  const grp = (match.player_group_title ?? "").toLowerCase();
  if (fmt === "singles") return { label: "DB", mixedSeen: mixedSeenInMatchup };
  if (grp === "womens" || grp === "women") {
    return { label: "WD", mixedSeen: mixedSeenInMatchup };
  }
  if (grp === "mens" || grp === "men") {
    return { label: "MD", mixedSeen: mixedSeenInMatchup };
  }
  if (grp === "mixed") {
    const label = mixedSeenInMatchup === 0 ? "MXD1" : "MXD2";
    return { label, mixedSeen: mixedSeenInMatchup + 1 };
  }
  return { label: "G?", mixedSeen: mixedSeenInMatchup };
}

function nonEmptyName(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed || trimmed === " ") return null;
  return trimmed;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ─── Top-level parser ───────────────────────────────────────────────── */

/**
 * Parse a fau-scores-and-stats event-matchups response into a
 * TournamentScrapeResult. Worker fetches the JSON (with Origin header
 * spoofed to majorleaguepickleball.co) and hands it here.
 */
export function parseMlpFromApi(
  api: FauApiResponse,
  mlpEventUrl: string,
  tournamentName: string,
): TournamentScrapeResult {
  const matches: ScrapedMatch[] = [];
  const teamMap = new Map<string, ScrapedPlayer>();
  const playerMap = new Map<string, ScrapedPlayer>();
  const seenExtIds = new Set<string>();

  const dateBuckets = api.results?.system_matchups ?? [];

  for (const bucket of dateBuckets) {
    for (const div of bucket.divisions ?? []) {
      for (const matchup of div.matchups ?? []) {
        // Skip BYE matchups and any matchup missing both team names.
        const t1 = nonEmptyName(matchup.team_one_title);
        const t2 = nonEmptyName(matchup.team_two_title);
        if (!t1 || !t2) continue;
        if (
          matchup.matchup_status === "BYE_MATCHUP_STATUS" ||
          !matchup.team_two_uuid
        ) {
          continue;
        }

        // Walk inner games. parseMatchesArray-style logic, but typed.
        const games: MlpMatchupGameLineup[] = [];
        let mixedSeen = 0;
        for (const inner of matchup.matches ?? []) {
          const players_a = [
            nonEmptyName(inner.team_one_player_one_name),
            nonEmptyName(inner.team_one_player_two_name),
          ].filter((x): x is string => !!x);
          const players_b = [
            nonEmptyName(inner.team_two_player_one_name),
            nonEmptyName(inner.team_two_player_two_name),
          ].filter((x): x is string => !!x);
          const score_a = inner.team_one_game_one_score ?? 0;
          const score_b = inner.team_two_game_one_score ?? 0;

          // Skip empty games (DB not played: zero scores + no players).
          if (
            score_a === 0 &&
            score_b === 0 &&
            players_a.length === 0 &&
            players_b.length === 0
          ) {
            continue;
          }

          const { label, mixedSeen: nextMixed } = deriveGameLabel(
            inner,
            mixedSeen,
          );
          mixedSeen = nextMixed;

          let winner: "a" | "b" | null = null;
          if (inner.winner === 1) winner = "a";
          else if (inner.winner === 2) winner = "b";
          else if (score_a > score_b) winner = "a";
          else if (score_b > score_a) winner = "b";

          games.push({
            label,
            score_a,
            score_b,
            players_a,
            players_b,
            winner,
          });
        }

        // Skip matchups with no completed inner games — those are
        // schedule placeholders.
        if (games.length === 0) continue;

        // Register team ghosts.
        const teamASlug = slugify(t1);
        const teamBSlug = slugify(t2);
        if (!teamMap.has(teamASlug)) {
          teamMap.set(teamASlug, {
            external_id: teamASlug,
            external_url: `https://majorleaguepickleball.co/team/${teamASlug}/`,
            display_name: t1,
            avatar_url: matchup.team_one_logo?.url ?? null,
            country_code: "US",
          });
        }
        if (!teamMap.has(teamBSlug)) {
          teamMap.set(teamBSlug, {
            external_id: teamBSlug,
            external_url: `https://majorleaguepickleball.co/team/${teamBSlug}/`,
            display_name: t2,
            avatar_url: matchup.team_two_logo?.url ?? null,
            country_code: "US",
          });
        }

        // Register per-player ghosts for future per-player surfaces.
        for (const g of games) {
          for (const p of [...g.players_a, ...g.players_b]) {
            const slug = slugify(p);
            if (!playerMap.has(slug)) {
              playerMap.set(slug, {
                external_id: slug,
                external_url: `https://majorleaguepickleball.co/player/${slug}/`,
                display_name: p,
                avatar_url: null,
                country_code: null,
              });
            }
          }
        }

        // Matchup-level winner: prefer the API's winner field, fall back
        // to score comparison.
        let matchupWinner: "a" | "b" | null = null;
        if (matchup.winner === 1) matchupWinner = "a";
        else if (matchup.winner === 2) matchupWinner = "b";
        else {
          const aw = matchup.team_one_score ?? 0;
          const bw = matchup.team_two_score ?? 0;
          if (aw > bw) matchupWinner = "a";
          else if (bw > aw) matchupWinner = "b";
        }

        const notesObj: MlpMatchupNotes = {
          format: "mlp_team_matchup",
          team_a: {
            name: t1,
            logo: matchup.team_one_logo?.url ?? null,
            matchup_wins: matchup.team_one_score ?? 0,
          },
          team_b: {
            name: t2,
            logo: matchup.team_two_logo?.url ?? null,
            matchup_wins: matchup.team_two_score ?? 0,
          },
          games,
        };

        const extId = `${matchup.team_one_uuid ?? teamASlug}-vs-${matchup.team_two_uuid ?? teamBSlug}`;
        if (seenExtIds.has(extId)) continue;
        seenExtIds.add(extId);

        matches.push({
          external_match_id: `mlp-${extId}`,
          round_name: "GP",
          team_one: { seed: null, player_external_ids: [teamASlug] },
          team_two: { seed: null, player_external_ids: [teamBSlug] },
          scores_team_one: games.map((g) => g.score_a),
          scores_team_two: games.map((g) => g.score_b),
          winner_team:
            matchupWinner === "a"
              ? "one"
              : matchupWinner === "b"
                ? "two"
                : null,
          court: null,
          played_at: matchup.planned_start_date ?? null,
          source_url: mlpEventUrl,
          notes: JSON.stringify(notesObj),
          court_number: null,
          tournament_event_override: "Group Play",
        });
      }
    }
  }

  const players: ScrapedPlayer[] = [
    ...Array.from(teamMap.values()),
    ...Array.from(playerMap.values()),
  ];

  return {
    source_provider: "mlp",
    source_url: mlpEventUrl,
    tournament_name: tournamentName || "MLP Event",
    tournament_event: "Group Play",
    matches,
    players,
  };
}

/* ─── MLP page → event_uuid extraction ───────────────────────────────── */

/**
 * Extract `data-event-uuid` from `<div id="event-matches" ...>` on the
 * MLP event page HTML. Returns null when the attribute can't be found
 * (e.g. the page hasn't been published with a schedule binding yet).
 */
export function extractEventUuidFromMlpPage(mlpHtml: string): string | null {
  const re =
    /<div\b[^>]*\bid=("|')event-matches\1[^>]*\bdata-event-uuid=("|')([a-f0-9-]+)\2/i;
  const m = mlpHtml.match(re);
  return m ? m[3] : null;
}

/**
 * Extract the event year from the MLP URL path (`/events-<year>/<slug>/`).
 */
export function eventYearFromUrl(sourceUrl: string): number {
  const m = sourceUrl.match(/\/events-(\d{4})\//);
  if (m) {
    const y = parseInt(m[1], 10);
    if (y >= 2020 && y <= 2100) return y;
  }
  return new Date().getUTCFullYear();
}

/**
 * Extract a human tournament name from the MLP page HTML — looks at the
 * <h1> first, falls back to the <title>'s leading segment.
 */
export function extractTournamentName(mlpHtml: string): string {
  const h1 = mlpHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const txt = h1[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s+tournament$/i, "");
    if (txt) return txt;
  }
  const title = mlpHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    return title[1].split("|")[0]?.trim() ?? "MLP Event";
  }
  return "MLP Event";
}

/* ─── Legacy DOM parser stub kept for type compatibility ─────────── */

/**
 * @deprecated The DOM parser pre-2026-06. Kept as a no-op so any stale
 * import doesn't break the build. Real entry point is parseMlpFromApi().
 */
export function parseMlpEventHtml(
  html: string,
  sourceUrl: string,
): TournamentScrapeResult {
  void html;
  return {
    source_provider: "mlp",
    source_url: sourceUrl,
    tournament_name: "MLP Event",
    tournament_event: "Group Play",
    matches: [],
    players: [],
  };
}

/**
 * @deprecated Old brackets-pools entry. The brackets iframe no longer
 * exists on MLP pages — parseMlpFromApi is the replacement.
 */
export function parseMlpFromBracketsPools(
  _poolHtmls: string[],
  mlpEventUrl: string,
  tournamentName: string,
): TournamentScrapeResult {
  void _poolHtmls;
  return {
    source_provider: "mlp",
    source_url: mlpEventUrl,
    tournament_name: tournamentName || "MLP Event",
    tournament_event: "Group Play",
    matches: [],
    players: [],
  };
}

// Compat re-exports for callers that still reference the old helpers.
// These return null/[] so the Worker's orchestration can detect they're
// unusable and switch to the new path.
export function extractBracketsIframeUrl(_mlpHtml: string): string | null {
  void _mlpHtml;
  return null;
}
export function extractPoolIds(_overviewHtml: string): string[] {
  void _overviewHtml;
  return [];
}
export function bracketsPoolUrl(_overviewUrl: string, _poolId: string): string {
  void _overviewUrl;
  void _poolId;
  return "";
}
