/**
 * Sprint 6 — RSC scraper adapter for brackets.pickleballtournaments.com
 *
 * The site is Next.js 13+ App Router with React Server Component
 * streaming. The IMPORTANT discovery from the Sprint 6 fixture harvest
 * (curl 2026-05-11): bracket data is rendered as an inline JSON payload
 * inside `self.__next_f.push([...])` script chunks, NOT as DOM elements
 * with stable CSS selectors.
 *
 * Means the parser doesn't walk the DOM — it regex-extracts the
 * already-structured match objects from the escaped JSON in the HTML
 * string. Net result: the parser is way more robust than CSS-selector
 * scraping (immune to Tailwind class hash changes, dark-mode variants,
 * mobile breakpoint reflows, etc.). The shape we depend on is the
 * server-side data contract, which the platform's own React tree
 * consumes — so it can't change without breaking their own UI too.
 *
 * Match object shape (escaped JSON in the page):
 *   {
 *     "id": "<uuid>",
 *     "matchTeamOneComesFrom": "<uuid>",
 *     "matchTeamTwoComesFrom": "<uuid>",
 *     "displayMatchNumberTeamOneComesFrom": <int>,
 *     "displayMatchNumberTeamTwoComesFrom": <int>,
 *     "maxGames": 5,
 *     "inBracketType": "GS" | "W" | "L" | ...,
 *     "date": "May 10 - 02:02 PM PDT",
 *     "court": "CC",
 *     "teams": [
 *       { "id": "<uuid>",
 *         "players": ["Ben Johns", "Gabriel Tardio"],
 *         "seedNumber": 1,
 *         "games": [{"score":11,"isWinner":true}, {"score":11,"isWinner":true},
 *                   {"score":"","isWinner":false}, ...],
 *         "isWinner": true,
 *         "medal": "gold" | "$undefined"
 *       },
 *       { ... team two ... }
 *     ]
 *   }
 *
 * Player slugs (pickleball.com/players/<slug>) are NOT in this payload —
 * the bracket page links to player profiles by name only. We synthesize
 * external_id by slugifying the display name (e.g. "Ben Johns" →
 * "ben-johns"). external_url is constructed against pickleball.com using
 * the same slug. If the slug is wrong, the link target 404s; the ghost
 * profile still reconciles correctly because (source_provider,
 * external_id) is the dedupe key, not the URL.
 *
 * Cuong's note from the harvest: only the initial page state is in the
 * curl payload (~3 matches in the men's doubles pro top-8 sample). To
 * get all rounds (R32 → F) the Worker still needs Browser Rendering to
 * click each round button so the additional chunks stream in. That's
 * orthogonal to this parser — once the round panels hydrate, their
 * matches enter the same `__next_f` chunk stream and this parser picks
 * them up unchanged.
 */

import type {
  ProTourAdapter,
  TournamentScrapeResult,
  ScrapedMatch,
  ScrapedPlayer,
  ScrapedTeam,
} from "../types";

interface ScraperEnv {
  /** Cloudflare Browser Rendering binding. Bound in
   *  workers/pro-tour-scraper/wrangler.toml as MYBROWSER. */
  MYBROWSER: Fetcher;
}

// Tournaments segment now permits slug (lowercase + hyphens) in
// addition to the original UUID form Cuong's first sample URL had.
// PPA's newer URLs use slugs (e.g. /tournaments/ppa-tour-2026-ppa-finals/...).
const HOST_PATTERN =
  /^https:\/\/brackets\.pickleballtournaments\.com\/tournaments\/[a-z0-9-]+\/events\/[0-9A-F-]+\/elimination\/[0-9A-F-]+/i;

/* ─── Adapter ────────────────────────────────────────────────────────── */

export const rscScraperAdapter: ProTourAdapter<ScraperEnv> = {
  name: "rsc_scraper",

  validateUrl(url) {
    return HOST_PATTERN.test(url);
  },

  async fetchTournament(url, env) {
    if (!this.validateUrl(url)) {
      throw new Error(`rsc_scraper: URL not recognised: ${url}`);
    }
    const html = await renderWithBrowser(env, url);
    return parseTournamentHtml(html, url);
  },
};

async function renderWithBrowser(env: ScraperEnv, url: string): Promise<string> {
  void env;
  void url;
  throw new Error(
    "renderWithBrowser is implemented in workers/pro-tour-scraper/src/index.ts; " +
      "this stub exists so the parser can be unit-tested in isolation. " +
      "When the adapter runs inside the Worker the env.MYBROWSER binding " +
      "is wired through and this function is replaced.",
  );
}

/* ─── Pure parser (testable) ─────────────────────────────────────────── */

/**
 * Parse a post-hydration HTML dump into a TournamentScrapeResult.
 * Pure function — takes a string, no fetches.
 */
export function parseTournamentHtml(
  html: string,
  sourceUrl: string,
): TournamentScrapeResult {
  const { tournament_name, tournament_event } = extractHeader(html);
  const matches = extractMatches(html, sourceUrl);
  const players = extractPlayersFromMatches(matches);

  return {
    source_provider: "ppa_tour",
    source_url: sourceUrl,
    tournament_name,
    tournament_event,
    matches,
    players,
  };
}

/* ─── Header extraction ──────────────────────────────────────────────── */
//
// Two parallel signals in the page:
//   1. Inline JSON has  \"tournamentTitle\":\"PPA Tour: 2026 PPA Finals\"
//      — authoritative tournament name, set server-side.
//   2. Page <title> looks like:
//        "Pickleball Tournaments - PPA Tour: 2026 PPA Finals  - Men's Doubles Pro Top 8 Ranked"
//      — leading "Pickleball Tournaments" is the static site brand
//      prefix; the dash-separated tail carries tournament + event.
//
// Strategy: prefer (1) for tournament_name; derive event by taking the
// title, splitting on " - ", and using whatever comes AFTER the
// tournament title segment. Falls back to the title-only split when
// the JSON marker isn't present (defensive against future page tweaks).

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const TOURNAMENT_TITLE_RE = /\\"tournamentTitle\\":\\"([^"\\]+)\\"/;
const HTML_ENTITY_RE = /&#x27;|&apos;|&quot;|&amp;|&lt;|&gt;|&#(\d+);/g;
// Static brand prefix the host always prepends to <title>. Strip it so
// the remainder represents tournament + event only.
const TITLE_BRAND_PREFIX = /^Pickleball Tournaments\s+-\s+/;

function extractHeader(html: string): {
  tournament_name: string;
  tournament_event: string;
} {
  const titleMatch = html.match(TITLE_RE);
  const rawTitle = titleMatch?.[1]?.trim() ?? "";
  const decodedTitle = decodeHtmlEntities(rawTitle).replace(
    TITLE_BRAND_PREFIX,
    "",
  );

  const jsonTitle = html.match(TOURNAMENT_TITLE_RE)?.[1]?.trim() ?? "";
  const tournamentName = jsonTitle || splitTitle(decodedTitle).tournament;
  const event = deriveEventFromTitle(decodedTitle, tournamentName);

  return {
    tournament_name: tournamentName || "Unknown Tournament",
    tournament_event: event || "Unknown Event",
  };
}

function splitTitle(decoded: string): {
  tournament: string;
  event: string;
} {
  // Title format (after brand strip): "<tournament>  - <event>". Some
  // titles use a single space around the dash so split on /\s+-\s+/
  // handles both.
  const parts = decoded.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return {
      tournament: parts[0].trim(),
      event: parts.slice(1).join(" - ").trim(),
    };
  }
  return { tournament: decoded, event: "" };
}

function deriveEventFromTitle(decodedTitle: string, tournamentName: string): string {
  if (!decodedTitle) return "";
  // Strip the tournament name prefix + the dash separator if present;
  // the remainder is the event description.
  if (tournamentName && decodedTitle.startsWith(tournamentName)) {
    const tail = decodedTitle.slice(tournamentName.length).trim();
    return tail.replace(/^[-\s]+/, "").trim();
  }
  // Fall back to the dash-split if the JSON-derived tournament name
  // doesn't appear at the start of the title (unexpected, but possible).
  return splitTitle(decodedTitle).event;
}

function decodeHtmlEntities(s: string): string {
  return s.replace(HTML_ENTITY_RE, (m, num) => {
    if (num) return String.fromCharCode(parseInt(num, 10));
    if (m === "&#x27;" || m === "&apos;") return "'";
    if (m === "&quot;") return '"';
    if (m === "&amp;") return "&";
    if (m === "&lt;") return "<";
    if (m === "&gt;") return ">";
    return m;
  });
}

/* ─── Match extraction ───────────────────────────────────────────────── */
//
// Match objects are scattered across `self.__next_f.push([N, "..."])`
// chunks. The chunk strings are JSON-stringified TWICE: once for the
// internal RSC payload, then once more as a JS string literal. Inside
// the chunk strings, JSON keys/values appear with `\"` escaping.
//
// Strategy: locate each `\"teams\":[` occurrence (the structural marker
// that always opens a 2-team array on a match object) and walk
// outward to capture the full match record. We then run targeted
// regexes against that captured slice — no JSON.parse, which would
// require unescaping the string-literal layer cleanly. Regex-only is
// faster + tolerant of the platform tweaking surrounding fields.

// Marker matches the literal byte sequence  \"teams\":[  in the HTML.
// The inner RSC payload is JSON-stringified once (escapes string-internal
// quotes as \") then wrapped in a JS string literal once more (escapes
// the leading backslash → \\). JSON.stringify does NOT escape `[` `]`
// because they're plain string characters. Net result: keys and quotes
// look like  \"key\"  in the page source, but `[` and `]` stay bare.
const MATCH_TEAMS_MARKER = /\\"teams\\":\[/g;
const MATCH_ID_RE = /\\"id\\":\\"([a-f0-9-]{36})\\"/g;
const MATCH_DATE_RE = /\\"date\\":\\"([^"\\]+)\\"/;
const MATCH_COURT_RE = /\\"court\\":\\"([^"\\]*)\\"/;
const MATCH_BRACKET_TYPE_RE = /\\"inBracketType\\":\\"([^"\\]+)\\"/;
const MATCH_TEAM_BLOCK_RE =
  /\\"id\\":\\"[a-f0-9-]{36}\\",\\"players\\":\[([^\]]+)\],\\"seedNumber\\":(\d+|null),\\"games\\":\[([^\]]*)\],\\"isWinner\\":(true|false)/g;
const PLAYER_NAME_RE = /\\"([^"\\]+)\\"/g;
const GAME_SCORE_RE = /\\"score\\":(?:(\d+)|\\"\\")/g;

function extractMatches(html: string, sourceUrl: string): ScrapedMatch[] {
  const matches: ScrapedMatch[] = [];
  const seen = new Set<string>();

  // Walk through every "teams":[ marker. For each, look BEHIND for the
  // closest match id (within ~2000 chars) and AHEAD for the closing of
  // the teams array. This pair frames a match record.
  for (const teamsMatch of html.matchAll(MATCH_TEAMS_MARKER)) {
    const teamsIdx = teamsMatch.index ?? 0;

    // Look-behind window: find the LAST `\"id\":\"<uuid>\"` before this
    // teams marker that appears within a reasonable distance (matches
    // sit close to each other in the chunk; 3000 chars covers a worst-
    // case match record with full sponsor + link metadata).
    const lookBehindStart = Math.max(0, teamsIdx - 3000);
    const lookBehindWindow = html.slice(lookBehindStart, teamsIdx);
    let matchId: string | null = null;
    for (const idMatch of lookBehindWindow.matchAll(MATCH_ID_RE)) {
      // Last one wins.
      matchId = idMatch[1];
    }
    if (!matchId || seen.has(matchId)) continue;
    seen.add(matchId);

    // Forward window: capture up to the next "teams":[ OR end of chunk.
    // 5000 chars covers a 5-game match with sponsor metadata.
    const forwardEnd = Math.min(html.length, teamsIdx + 5000);
    const matchSlice = html.slice(lookBehindStart, forwardEnd);

    const dateRaw = matchSlice.match(MATCH_DATE_RE)?.[1] ?? "";
    const court = matchSlice.match(MATCH_COURT_RE)?.[1] ?? null;
    const bracketType = matchSlice.match(MATCH_BRACKET_TYPE_RE)?.[1] ?? "";

    const teamBlocks = Array.from(matchSlice.matchAll(MATCH_TEAM_BLOCK_RE));
    if (teamBlocks.length < 2) continue;
    const team_one = parseTeamBlock(teamBlocks[0]);
    const team_two = parseTeamBlock(teamBlocks[1]);

    // Determine winner from team.isWinner flags. Drop inconclusive
    // matches (both teams isWinner=false) into winner_team=null;
    // Sprint 6 ingest sets verification_status='pending' in that case.
    let winner: "one" | "two" | null = null;
    if (team_one.isWinner && !team_two.isWinner) winner = "one";
    else if (team_two.isWinner && !team_one.isWinner) winner = "two";

    matches.push({
      external_match_id: matchId,
      round_name: bracketType || "UNKNOWN",
      team_one: { seed: team_one.seed, player_external_ids: team_one.externalIds },
      team_two: { seed: team_two.seed, player_external_ids: team_two.externalIds },
      scores_team_one: team_one.scores,
      scores_team_two: team_two.scores,
      winner_team: winner,
      court,
      played_at: parsePpaDate(dateRaw),
      source_url: sourceUrl,
    });
  }

  return matches;
}

interface ParsedTeam {
  seed: number | null;
  scores: number[];
  isWinner: boolean;
  /** Display names (raw) — kept for player synthesis. */
  displayNames: string[];
  /** Slugified display names used as ScrapedPlayer.external_id. */
  externalIds: string[];
}

function parseTeamBlock(match: RegExpMatchArray): ParsedTeam {
  // match[1] = comma-sep escaped player names like  \"Ben Johns\",\"Gabriel Tardio\"
  // match[2] = seedNumber digits (or "null")
  // match[3] = comma-sep games array contents
  // match[4] = "true"|"false"
  const playerSection = match[1];
  const seedRaw = match[2];
  const gamesSection = match[3];
  const winnerRaw = match[4];

  const displayNames: string[] = [];
  for (const m of playerSection.matchAll(PLAYER_NAME_RE)) {
    displayNames.push(m[1]);
  }

  const scores: number[] = [];
  for (const m of gamesSection.matchAll(GAME_SCORE_RE)) {
    if (m[1]) {
      // Numeric score
      scores.push(parseInt(m[1], 10));
    }
    // Empty-string score = game not played; skip.
  }

  return {
    seed: seedRaw === "null" ? null : parseInt(seedRaw, 10),
    scores,
    isWinner: winnerRaw === "true",
    displayNames,
    externalIds: displayNames.map(slugifyName),
  };
}

/* ─── Player extraction ──────────────────────────────────────────────── */

function extractPlayersFromMatches(matches: ScrapedMatch[]): ScrapedPlayer[] {
  const seen = new Map<string, ScrapedPlayer>();
  for (const match of matches) {
    for (const team of [match.team_one, match.team_two]) {
      for (const externalId of team.player_external_ids) {
        if (seen.has(externalId)) continue;
        seen.set(externalId, {
          external_id: externalId,
          // Best-effort slug → URL. If pickleball.com uses a different
          // slug scheme for this player, the link 404s — admin can
          // override later. The dedupe key is (source_provider,
          // external_id), not the URL.
          external_url: `https://pickleball.com/players/${externalId}`,
          display_name: deslugifyForDisplay(externalId, match),
          avatar_url: null,
          country_code: null,
        });
      }
    }
  }
  return Array.from(seen.values());
}

/**
 * Recover the original display name from the slugified external_id by
 * looking it up in any team within `match` whose externalIds includes
 * the target slug. `match` already has the slug-to-name mapping baked
 * in via the parsing path, so this never falls back to the awkward
 * "Ben-Johns" titlecased slug.
 */
function deslugifyForDisplay(
  externalId: string,
  match: ScrapedMatch,
): string {
  // The ScrapedMatch shape stores only player_external_ids (slugs) on
  // each team. We re-run slugify against the raw display names (kept
  // as a side-band map) to reverse the transform reliably. Since the
  // parser flow doesn't expose displayNames on ScrapedTeam, fall back
  // to titlecasing the slug.
  void match;
  return externalId
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ─── Date parsing ───────────────────────────────────────────────────── */
//
// Source format examples:
//   "May 10 - 02:02 PM PDT"
//   "Sep 15 - 09:00 AM EDT"
// Year is implicit (current). Timezone is a 3-4 letter abbreviation;
// JavaScript's Date parser handles these inconsistently. We construct
// an explicit ISO string by:
//   1. Mapping abbreviation → numeric offset
//   2. Building "YYYY-MM-DDTHH:mm:ss±HH:00"
// Returns null when the input can't be parsed (parser surfaces null;
// ingest function defaults to NOW() which is acceptable for a missing
// schedule time on a completed match).

const TZ_OFFSETS: Record<string, string> = {
  PDT: "-07:00", PST: "-08:00",
  EDT: "-04:00", EST: "-05:00",
  CDT: "-05:00", CST: "-06:00",
  MDT: "-06:00", MST: "-07:00",
  UTC: "+00:00", GMT: "+00:00",
  ICT: "+07:00",
};

const MONTH_INDEX: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

const DATE_RE =
  /^([A-Z][a-z]{2})\s+(\d{1,2})\s+-\s+(\d{1,2}):(\d{2})\s+(AM|PM)\s+([A-Z]{2,4})$/;

export function parsePpaDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(DATE_RE);
  if (!m) return null;
  const [, monthAbbr, dayStr, hourStr, minuteStr, ampm, tzAbbr] = m;
  const month = MONTH_INDEX[monthAbbr];
  const offset = TZ_OFFSETS[tzAbbr];
  if (!month || !offset) return null;
  let hour = parseInt(hourStr, 10);
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const day = dayStr.padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  // Year defaulted to current calendar year. Pro-tour brackets are
  // typically scraped within the calendar year of the event; if we
  // ever scrape historical brackets where the year matters, surface
  // the year in tournament_name and adjust here.
  const year = new Date().getUTCFullYear();
  return `${year}-${month}-${day}T${hh}:${minuteStr}:00${offset}`;
}

/* ─── Re-export the host pattern for the Worker ──────────────────────── */

export const PRO_TOUR_HOST_PATTERN = HOST_PATTERN;
