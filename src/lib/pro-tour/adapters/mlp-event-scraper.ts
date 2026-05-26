/**
 * MLP event-page scraper adapter for majorleaguepickleball.co.
 *
 * Architecture (rewrite 2026-05-26)
 * ---------------------------------
 * The earlier version scraped the MLP main page DOM looking for
 * `<article class="sec">` containers. That data turned out to live
 * inside an iframe pointing at brackets.pickleballteamleagues.com,
 * not the main page — so Cloudflare Browser Rendering /content (which
 * captures only the top-level document) returned 0 matchups even with
 * tall viewport, networkidle2, addScriptTag injection, etc.
 *
 * New approach: skip Browser Rendering entirely. Brackets is a Next.js
 * SSR app whose pool pages embed the FULL matchup JSON inside
 * `self.__next_f.push([1, "<chunk>"])` script tags. A raw fetch returns
 * everything — team metadata, matchup-level scores, per-game scores,
 * and player lineups for each WD/MD/MXD1/MXD2 game.
 *
 * Worker orchestration (see workers/pro-tour-scraper/src/index.ts):
 *   1. If URL is majorleaguepickleball.co/events-* → raw-fetch MLP page,
 *      regex the iframe src to get the brackets overview URL.
 *   2. Raw-fetch overview → regex out pool IDs.
 *   3. Raw-fetch each pool URL → pass HTML strings into the parser
 *      below (parseMlpFromBracketsPools).
 *   4. Parser walks the JSON-stringified matchup records, extracts
 *      teams + scores + lineups, returns TournamentScrapeResult.
 *
 * Why JSON-stringified-twice
 *   The bracket page renders RSC chunks as JS string literals containing
 *   a JSON payload. JSON keys/values appear as  \"key\":\"value\"  in
 *   the raw HTML (one layer of \-escaping for the JS string + one for
 *   JSON's own quote-escaping). Regex over that escaped form is more
 *   robust than trying to JSON.parse the chunk strings cleanly, and
 *   matches the pattern the PPA RSC adapter uses.
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

// brackets.pickleballteamleagues.com pool URL (target of raw fetches).
export const MLP_BRACKETS_POOL_PATTERN =
  /^https:\/\/brackets\.pickleballteamleagues\.com\/team-leagues\/[a-f0-9-]+\/tournaments\/[a-f0-9-]+\/pools\/[a-f0-9-]+/i;

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

/* ─── Public types ────────────────────────────────────────────────────── */

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

/* ─── Helpers for raw HTML field extraction ──────────────────────────── */

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract the (escaped-JSON) string field value following a given key
 * within a slice. `\"<key>\":\"<value>\"` shape. Returns null when the
 * field is absent or set to JSON null / `$undefined`.
 */
function extractStringField(slice: string, key: string): string | null {
  const re = new RegExp(`\\\\\"${escapeForRegex(key)}\\\\\"\\s*:\\s*\\\\\"([^\\\\]+)\\\\\"`);
  const m = slice.match(re);
  if (!m) return null;
  const val = m[1];
  if (val === "$undefined" || val === "null") return null;
  // Decode common JSON escapes that may appear in name strings
  return val.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

/**
 * Extract the integer field value. Returns null when missing or null.
 */
function extractIntField(slice: string, key: string): number | null {
  const re = new RegExp(`\\\\\"${escapeForRegex(key)}\\\\\"\\s*:\\s*(-?\\d+|null)`);
  const m = slice.match(re);
  if (!m || m[1] === "null") return null;
  return parseInt(m[1], 10);
}

/** Find the team logo URL nested inside a `teamOneLogo` / `teamTwoLogo`
 *  object literal. The logo object's `url` field is the displayed asset. */
function extractTeamLogo(slice: string, side: "teamOne" | "teamTwo"): string | null {
  // The logo block is non-trivial: `\"teamOneLogo\":{...,\"url\":\"<href>\"...}`
  // Walk a window after the marker and pull the first url field. Bound the
  // window by either the matching "}" or the next major team marker so the
  // teamTwoLogo's url doesn't leak into teamOneLogo's slot.
  const markerRe = new RegExp(`\\\\\"${side}Logo\\\\\":`);
  const m = slice.match(markerRe);
  if (!m) return null;
  const start = (m.index ?? 0) + m[0].length;
  // Window: 1.5KB is more than enough for the logo object; stop early if
  // we hit the start of the OTHER team's logo block.
  const other = side === "teamOne" ? "teamTwo" : "teamOne";
  const otherMarker = `\\"${other}Logo\\":`;
  const otherIdx = slice.indexOf(otherMarker, start);
  const end = otherIdx > 0 ? otherIdx : Math.min(slice.length, start + 2000);
  const window = slice.slice(start, end);
  const urlMatch = window.match(/\\"url\\":\\"([^"\\]+)\\"/);
  return urlMatch ? urlMatch[1] : null;
}

/* ─── Matchup extraction from a pool's HTML ──────────────────────────── */

/**
 * Walk every `\"teamOneUuid\":\"<uuid>\"` marker in the pool HTML, scope
 * a slice around each, extract teams + matchup-level scores + the inner
 * matches[] array + per-game lineups. Returns one ParsedMlpMatchup per
 * non-BYE matchup.
 */
interface ParsedMlpMatchup {
  team_a: { name: string; logo: string | null; abbr: string | null; matchup_wins: number };
  team_b: { name: string; logo: string | null; abbr: string | null; matchup_wins: number };
  winner: "a" | "b" | null;
  planned_start: string | null;
  venue: string | null;
  games: MlpMatchupGameLineup[];
  external_id: string;
}

const PLAYER_GROUP_TO_LABEL: Record<string, string> = {
  Womens: "WD",
  Mens: "MD",
  Mixed1: "MXD1",
  Mixed2: "MXD2",
  Dreambreaker: "DB",
};

/**
 * Extract per-game lineups from an array of game-record slices.
 * Each slice is one game (WD/MD/MXD1/MXD2/DB) — the brackets payload
 * emits these as separate top-level wrappers, NOT as nested matches[]
 * entries. See header comment on extractMatchupsFromPool for the
 * flattened structure.
 */
function parseGameSlices(gameSlices: string[]): MlpMatchupGameLineup[] {
  const games: MlpMatchupGameLineup[] = [];

  for (const block of gameSlices) {

    // Determine game label from playerGroupTitle (Womens/Mens/Mixed) +
    // formatTitle (Doubles/Singles). The brackets payload doesn't
    // surface MXD1 vs MXD2 directly; rely on the order returned by the
    // server (Womens, Mens, Mixed, Mixed, Singles) → WD/MD/MXD1/MXD2/DB.
    const playerGroup = extractStringField(block, "playerGroupTitle") ?? "";
    const formatTitle = extractStringField(block, "formatTitle") ?? "";
    const isDb = formatTitle === "Singles";

    // Players (null for unplayed matches, e.g. BYE or future games)
    const players_a = [
      extractStringField(block, "teamOnePlayerOneName"),
      extractStringField(block, "teamOnePlayerTwoName"),
    ].filter((p): p is string => Boolean(p && p.trim() && p.trim() !== " "));
    const players_b = [
      extractStringField(block, "teamTwoPlayerOneName"),
      extractStringField(block, "teamTwoPlayerTwoName"),
    ].filter((p): p is string => Boolean(p && p.trim() && p.trim() !== " "));

    // Per-game scores: extract the first-game score (game one). Brackets
    // pages do expose game two-through-five as well, but MLP regular
    // season is best-of-1 inside each game-format (one game to 11 wins
    // that format slot), so the first-game score is the canonical score
    // for the matchup's contribution. Server confirms by leaving game
    // two-through-five as null for finished MLP regular-season matches.
    const score_a = extractIntField(block, "teamOneGameOneScore") ?? 0;
    const score_b = extractIntField(block, "teamTwoGameOneScore") ?? 0;

    // Skip empty/unplayed matches: zero scores AND no players AND no
    // winner. Helps when a matchup's matches[] is preallocated with
    // empty slots for games that haven't been played yet.
    if (score_a === 0 && score_b === 0 && players_a.length === 0 && players_b.length === 0) {
      continue;
    }

    // Game label by index: matches[] is emitted in canonical order
    // WD, MD, MXD1, MXD2, DB. Use index → label mapping with an
    // override for the Dreambreaker singles slot.
    let label: string;
    if (isDb) {
      label = "DB";
    } else if (playerGroup === "Womens") {
      label = "WD";
    } else if (playerGroup === "Mens") {
      label = "MD";
    } else {
      // Mixed (first Mixed = MXD1, second = MXD2)
      const mixedCount = games.filter((g) => g.label.startsWith("MXD")).length;
      label = mixedCount === 0 ? "MXD1" : "MXD2";
    }

    // Suppress the unused PLAYER_GROUP_TO_LABEL constant in production
    // code (lint sweep). Kept as documentation reference above.
    void PLAYER_GROUP_TO_LABEL;

    const winner =
      score_a > score_b ? "a" : score_b > score_a ? "b" : null;

    games.push({
      label,
      score_a,
      score_b,
      players_a,
      players_b,
      winner,
    });
  }

  return games;
}

/**
 * Walk the pool HTML and group flat brackets-API slices into team-level
 * matchups.
 *
 * Discovered layout of the brackets payload (RSC chunks):
 *   The poolRounds[].matchups[] array DOES NOT emit one entry per
 *   team-level matchup. It emits ONE entry per game-format slot. A
 *   single COL-vs-NJ matchup shows up as 6 consecutive `teamOneUuid`
 *   markers in the HTML:
 *     1. Matchup WRAPPER (has teamOneTitle + teamTwoTitle, matchup
 *        scores, plannedStartDate). No playerGroupTitle.
 *     2-6. Game records (WD, MD, MXD1, MXD2, DB). teamOneTitle = null,
 *        but each has playerGroupTitle ("Womens" | "Mens" | "Mixed" |
 *        "Coed"), formatTitle, teamOnePlayerOneName, etc.
 *
 * Strategy: walk all markers, treat each slice with non-null
 * teamOneTitle as the start of a new matchup, collect subsequent
 * slices (those with null title) as that matchup's game records, stop
 * when the next title-having slice arrives.
 */
function extractMatchupsFromPool(poolHtml: string): ParsedMlpMatchup[] {
  const results: ParsedMlpMatchup[] = [];
  const markerRe = /\\"teamOneUuid\\":\\"([a-f0-9-]+)\\"/g;
  const markers: Array<{ idx: number; uuid: string }> = [];
  let mm: RegExpExecArray | null;
  while ((mm = markerRe.exec(poolHtml)) !== null) {
    markers.push({ idx: mm.index, uuid: mm[1] });
  }
  markers.push({ idx: poolHtml.length, uuid: "" });

  // Pre-split slices.
  const slices: string[] = [];
  for (let i = 0; i < markers.length - 1; i++) {
    slices.push(poolHtml.slice(markers[i].idx, markers[i + 1].idx));
  }

  // Walk slices grouping consecutive null-title game slices under the
  // preceding title-having matchup wrapper.
  let currentWrapper: { slice: string } | null = null;
  let currentGames: string[] = [];

  const flush = () => {
    if (!currentWrapper) return;
    const slice = currentWrapper.slice;
    const teamOneTitle = extractStringField(slice, "teamOneTitle");
    const teamTwoTitle = extractStringField(slice, "teamTwoTitle");
    if (!teamOneTitle || !teamTwoTitle) {
      currentWrapper = null;
      currentGames = [];
      return;
    }
    const teamOneAbbr = extractStringField(slice, "teamOneAbbreviation");
    const teamTwoAbbr = extractStringField(slice, "teamTwoAbbreviation");
    const teamOneLogo = extractTeamLogo(slice, "teamOne");
    const teamTwoLogo = extractTeamLogo(slice, "teamTwo");
    const teamOneScore = extractIntField(slice, "teamOneScore") ?? 0;
    const teamTwoScore = extractIntField(slice, "teamTwoScore") ?? 0;
    const plannedStart = extractStringField(slice, "plannedStartDate");
    const venue = extractStringField(slice, "venue");
    const teamTwoUuid = extractStringField(slice, "teamTwoUuid");
    if (!teamTwoUuid) {
      // BYE matchup — no opponent.
      currentWrapper = null;
      currentGames = [];
      return;
    }
    const winner =
      teamOneScore > teamTwoScore ? "a" : teamTwoScore > teamOneScore ? "b" : null;

    // IMPORTANT: the wrapper slice itself contains the WD game's data
    // (teamOnePlayerOneName + teamOneGameOneScore + playerGroupTitle:
    // "Womens"). The remaining 4 game slices are MD, MXD1, MXD2, DB.
    // Treat the wrapper as game[0] (WD) by prepending its slice.
    const games = parseGameSlices([slice, ...currentGames]);

    // Skip empty matchups (no games + no scores).
    if (games.length === 0 && teamOneScore === 0 && teamTwoScore === 0) {
      currentWrapper = null;
      currentGames = [];
      return;
    }

    // Extract the wrapper's teamOneUuid directly from the slice (every
    // marker slice begins with `\"teamOneUuid\":\"<uuid>\"`).
    const t1uMatch = slice.match(/\\"teamOneUuid\\":\\"([a-f0-9-]+)\\"/);
    const teamOneUuid = t1uMatch ? t1uMatch[1] : "unknown";
    results.push({
      team_a: { name: teamOneTitle, logo: teamOneLogo, abbr: teamOneAbbr, matchup_wins: teamOneScore },
      team_b: { name: teamTwoTitle, logo: teamTwoLogo, abbr: teamTwoAbbr, matchup_wins: teamTwoScore },
      winner,
      planned_start: plannedStart,
      venue,
      games,
      external_id: `${teamOneUuid}-vs-${teamTwoUuid}`,
    });
    currentWrapper = null;
    currentGames = [];
  };

  for (const s of slices) {
    const hasTitle = /\\"teamOneTitle\\":\\"[^"\\]+\\"/.test(s);
    if (hasTitle) {
      // Close out previous matchup, start a new one.
      flush();
      currentWrapper = { slice: s };
    } else if (currentWrapper) {
      // Continuation: this is a game record belonging to the open matchup.
      currentGames.push(s);
    }
    // Slices with no title AND no open wrapper are ignored (unrelated chunks).
  }
  // Flush trailing matchup.
  flush();

  return results;
}

/* ─── Top-level parser ───────────────────────────────────────────────── */

/**
 * Parse one or more pool HTML payloads into a TournamentScrapeResult.
 * The Worker fetches each pool's raw HTML and hands the array in here.
 */
export function parseMlpFromBracketsPools(
  poolHtmls: string[],
  mlpEventUrl: string,
  tournamentName: string,
): TournamentScrapeResult {
  const matches: ScrapedMatch[] = [];
  const teamMap = new Map<string, ScrapedPlayer>();
  const playerMap = new Map<string, ScrapedPlayer>();
  const seenExtIds = new Set<string>();

  for (const html of poolHtmls) {
    const matchups = extractMatchupsFromPool(html);
    for (const m of matchups) {
      if (seenExtIds.has(m.external_id)) continue;
      seenExtIds.add(m.external_id);

      // external_id is the slug-only form ("columbus-sliders"). The
      // ingest function adds the `mlp-` prefix when composing the
      // username, so we don't double-prefix here. This also matches the
      // pre-existing team ghost profiles seeded manually before the
      // adapter shipped (which used slug-only external_ids), avoiding a
      // username UNIQUE conflict on first ingest after the manual seed.
      const teamASlug = slugify(m.team_a.name);
      const teamBSlug = slugify(m.team_b.name);

      if (!teamMap.has(teamASlug)) {
        teamMap.set(teamASlug, {
          external_id: teamASlug,
          external_url: `https://majorleaguepickleball.co/team/${slugify(m.team_a.name)}/`,
          display_name: m.team_a.name,
          avatar_url: m.team_a.logo,
          country_code: "US",
        });
      }
      if (!teamMap.has(teamBSlug)) {
        teamMap.set(teamBSlug, {
          external_id: teamBSlug,
          external_url: `https://majorleaguepickleball.co/team/${slugify(m.team_b.name)}/`,
          display_name: m.team_b.name,
          avatar_url: m.team_b.logo,
          country_code: "US",
        });
      }

      // Build per-player ghost profiles for future use (per-player cards).
      // Slug-only external_id (same convention as teams above).
      for (const g of m.games) {
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

      const notesObj: MlpMatchupNotes = {
        format: "mlp_team_matchup",
        team_a: {
          name: m.team_a.name,
          logo: m.team_a.logo,
          matchup_wins: m.team_a.matchup_wins,
        },
        team_b: {
          name: m.team_b.name,
          logo: m.team_b.logo,
          matchup_wins: m.team_b.matchup_wins,
        },
        games: m.games,
      };

      matches.push({
        external_match_id: `mlp-${m.external_id}`,
        round_name: "GP",
        team_one: { seed: null, player_external_ids: [teamASlug] },
        team_two: { seed: null, player_external_ids: [teamBSlug] },
        scores_team_one: m.games.map((g) => g.score_a),
        scores_team_two: m.games.map((g) => g.score_b),
        winner_team: m.winner === "a" ? "one" : m.winner === "b" ? "two" : null,
        court: null,
        played_at: m.planned_start,
        source_url: mlpEventUrl,
        notes: JSON.stringify(notesObj),
        court_number: null,
        tournament_event_override: "Group Play",
      });
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ─── Iframe URL extraction from raw MLP page HTML ───────────────────── */

/**
 * Pull the brackets iframe URL out of the MLP event page HTML.
 * Returns the absolute URL (https://brackets.pickleballteamleagues.com/...).
 * Worker uses this to discover the source-of-truth API for matchups.
 */
export function extractBracketsIframeUrl(mlpHtml: string): string | null {
  const iframeRe =
    /<iframe\b[^>]*\bsrc=("|')(https:\/\/brackets\.pickleballteamleagues\.com\/[^"']+)\1/i;
  const m = mlpHtml.match(iframeRe);
  return m ? m[2] : null;
}

/**
 * Extract pool IDs from the overview HTML (the `\"poolId\":\"<uuid>\"`
 * fields embedded in the team standings RSC payload).
 */
export function extractPoolIds(overviewHtml: string): string[] {
  const seen = new Set<string>();
  const re = /\\"poolId\\":\\"([a-f0-9-]+)\\"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(overviewHtml)) !== null) {
    seen.add(m[1]);
  }
  return Array.from(seen);
}

/**
 * Build the brackets pool URL given the overview URL and a pool id.
 * Pattern: .../tournaments/<t>/pools/<pool-id>?showBracketTitle=false
 */
export function bracketsPoolUrl(overviewUrl: string, poolId: string): string {
  // overview URL ends in /overview or /overview?showBracketTitle=false
  const base = overviewUrl.replace(/\/overview\b[^/]*$/i, `/pools/${poolId}`);
  if (base.includes("?")) return base;
  return `${base}?showBracketTitle=false`;
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

/* ─── Legacy DOM parser retained for unit tests / fallback ───────────── */

/**
 * @deprecated Kept for unit-test snapshots from the pre-pivot DOM
 * parser. The Worker now uses parseMlpFromBracketsPools() exclusively.
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
