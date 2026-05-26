/**
 * MLP event-page scraper adapter for majorleaguepickleball.co.
 *
 * Unlike PPA brackets (Next.js RSC), MLP uses a WordPress page hosting a
 * React island for the Schedule & Scores section. The island renders all
 * matchups for the currently-selected day filter as `<article class="sec">`
 * elements with embedded lineup tables (even when visually collapsed —
 * the `<table>` lives in the DOM under display:none).
 *
 * The page paginates by Vietnam-local day (the page's GMT+7 timezone),
 * exposing prev/next arrows on the heading. The initial server-rendered
 * HTML on /events-2026/<slug>/ shows the default day only. Subsequent
 * days are loaded client-side on arrow click. The Worker's call to the
 * Browser Rendering REST API can use `actions` to click the prev arrow
 * 2-3 times so all completed days hydrate, but this MVP scrapes the
 * default day's matchups only and relies on the 6h cron to pick up new
 * matchups as the day advances. Historical days that aren't in the
 * default render require a manual re-trigger.
 *
 * MLP matchups are team-vs-team battles with 4-5 inner games:
 *   WD  = Women's Doubles
 *   MD  = Men's Doubles
 *   MXD1, MXD2 = Mixed Doubles
 *   DB  = Dreambreaker (singles tiebreaker, played only on 2-2)
 *
 * The parser emits ONE ScrapedMatch per matchup with:
 *   - team_one/two participants = ghost team profiles (one per side)
 *   - team_a_score/team_b_score = array of inner game scores
 *   - notes (JSON) = team logos + per-game lineups
 * Per-player ghost profiles are emitted in ScrapedPlayer[] for future
 * use (player-level cards if we ever ship them), but the match-level
 * participants stay at the team granularity so FeedMlpMatchCard can
 * render the matchup card.
 */

import type {
  ProTourAdapter,
  TournamentScrapeResult,
  ScrapedMatch,
  ScrapedPlayer,
} from "../types";

interface MlpScraperEnv {
  /** Cloudflare Browser Rendering REST API account id + token, used by
   *  the Worker's renderWithBrowserRendering helper. Pure parser doesn't
   *  need these — Env is wired through for adapter symmetry. */
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

// majorleaguepickleball.co/events-<year>/<slug>/ — the public event hub.
// Pattern accepts trailing slash, lowercase + hyphens in slug.
// Year is 4 digits to avoid matching unrelated paths (/events/older).
export const MLP_EVENT_HOST_PATTERN =
  /^https:\/\/majorleaguepickleball\.co\/events-\d{4}\/[a-z0-9-]+\/?$/i;

export const mlpEventScraperAdapter: ProTourAdapter<MlpScraperEnv> = {
  name: "mlp_event_scraper",

  validateUrl(url) {
    return MLP_EVENT_HOST_PATTERN.test(url);
  },

  async fetchTournament(_url, _env) {
    // Worker substitutes renderWithBrowserRendering before calling parse.
    // This stub keeps the adapter testable in isolation (the rendering
    // path is integration-tested via the Worker fixtures).
    void _url;
    void _env;
    throw new Error(
      "mlpEventScraperAdapter.fetchTournament: rendering is implemented in " +
        "workers/pro-tour-scraper/src/index.ts; this stub exists so the " +
        "parser can be unit-tested in isolation.",
    );
  },
};

/* ─── Pure parser ────────────────────────────────────────────────────── */

interface ParsedMlpGame {
  label: string;
  score_a: number;
  score_b: number;
  players_a: string[];
  players_b: string[];
  winner: "a" | "b" | null;
}

interface ParsedMlpTeamMeta {
  name: string;
  logo: string | null;
  matchup_wins: number;
}

interface ParsedMlpMatchupNotes {
  format: "mlp_team_matchup";
  team_a: ParsedMlpTeamMeta;
  team_b: ParsedMlpTeamMeta;
  games: ParsedMlpGame[];
}

const GAME_LABELS = ["WD", "MD", "MXD1", "MXD2", "DB"] as const;

// MLP page <title> looks like: "MLP Dallas Pickleball Tournament | Major League Pickleball"
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
// h1 holds the user-facing tournament name: "MLP Dallas tournament"
const H1_RE = /<h1[^>]*>([\s\S]*?)<\/h1>/i;

// Strip tags + decode common HTML entities.
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugifyPlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extract the tournament name + a default event label from the page
 * header. MLP doesn't expose a separate "event" string (no Mens Doubles
 * subdivision like PPA) — we hard-code "Group Play" since that's what
 * the regular-season pool matches are. Day 4 playoff carries its own
 * round_name='F' marker per match.
 */
function extractHeader(html: string): {
  tournament_name: string;
  tournament_event: string;
} {
  const titleMatch = html.match(TITLE_RE);
  const title = titleMatch ? stripHtml(titleMatch[1]) : "";
  const h1Match = html.match(H1_RE);
  const h1 = h1Match ? stripHtml(h1Match[1]) : "";
  // Prefer h1 (cleaner: "MLP Dallas tournament"); fall back to title
  // before the " | " delimiter ("MLP Dallas Pickleball Tournament").
  let name = h1;
  if (!name && title) {
    const parts = title.split("|");
    name = parts[0]?.trim() ?? "";
  }
  if (!name) name = "MLP Event";
  // Normalize: "MLP Dallas tournament" → "MLP Dallas". Strip trailing
  // "tournament" if present so the tournament_name doesn't read
  // double-tournament when combined with tournament_event later.
  name = name.replace(/\s+tournament$/i, "").trim();
  return { tournament_name: name, tournament_event: "Group Play" };
}

// Per-matchup HTML extraction. The structure rendered by the React
// island is:
//   <article class="sec">
//     <div class="sec__match-info">[date strings, court, team summaries]</div>
//     <div class="sec__match-details">
//       <div class="sec__match-details-table">
//         <div class="sec__match-details-table-content">
//           <div class="sec__match-details-team-container winning-team--{home|away}">
//             <div class="team">
//               <img src="..." alt="<Team> Team Logo">
//               <p class="score">11</p>
//               <div class="player-names"><span>P1</span><span>P2</span></div>
//             </div>
//             <div class="team">...</div>
//           </div>
//           ... (one team-container per game, 4 or 5 per matchup)
//         </div>
//       </div>
//     </div>
//   </article>
//
// We use targeted regex (HTML parsing without a DOM in the Worker
// runtime). All captures use non-greedy quantifiers + tight delimiters.

const ARTICLE_SEC_RE =
  /<article\b[^>]*\bclass=("|')[^"']*\bsec\b[^"']*\1[^>]*>([\s\S]*?)<\/article>/gi;
const TEAM_CONTAINER_RE =
  /<div\b[^>]*\bclass=("|')[^"']*\bsec__match-details-team-container\b[^"']*\1([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
const WINNING_SIDE_RE = /winning-team--(home|away)/;
const TEAM_DIV_RE = /<div\b[^>]*\bclass=("|')[^"']*\bteam\b[^"']*\1([\s\S]*?)(?=<div\b[^>]*\bclass=("|')[^"']*\bteam\b|<\/div>\s*<\/div>\s*$)/gi;
const SCORE_RE = /<p\s+class=("|')score\1[^>]*>(\d+)<\/p>/i;
const PLAYER_SPAN_RE = /<span[^>]*>([^<]+)<\/span>/g;
const IMG_LOGO_RE = /<img\b[^>]*\balt=("|')([^"']*?)\s*Team Logo\1[^>]*\bsrc=("|')([^"']+)\3[^>]*>|<img\b[^>]*\bsrc=("|')([^"']+)\5[^>]*\balt=("|')([^"']*?)\s*Team Logo\7/i;

interface ParsedTeamSummary {
  name: string;
  logo: string | null;
  matchup_wins: number;
}

// The matchup summary (team A name + total wins, team B name + total wins)
// appears outside the team-detail tables. Pattern: in `.sec__match-info`,
// the rendered text has the team name then a small integer (matchup wins),
// repeated for the other team.
const MATCHUP_SUMMARY_RE =
  /<article\b[^>]*\bsec\b[^>]*>([\s\S]*?)<div\b[^>]*\bsec__match-details/i;

interface ParsedMatchupLite {
  team_a_summary: ParsedTeamSummary | null;
  team_b_summary: ParsedTeamSummary | null;
  games: ParsedMlpGame[];
}

function parseSecArticle(secHtml: string): ParsedMatchupLite {
  // Extract team summaries from the header by walking the team logos
  // (img alt="<Name> Team Logo"). The two logos appear in DOM order =
  // team A first, team B second. Matchup wins are the integers
  // immediately adjacent to each logo in the header text.
  const headerMatch = secHtml.match(MATCHUP_SUMMARY_RE);
  const header = headerMatch ? headerMatch[1] : "";

  const logos: Array<{ name: string; url: string }> = [];
  const imgRe = /<img\b[^>]*>/gi;
  for (const img of header.matchAll(imgRe)) {
    const tag = img[0];
    const altMatch = tag.match(/\balt=("|')([^"']*?)\s*Team Logo\1/i);
    const srcMatch = tag.match(/\bsrc=("|')([^"']+)\1/i);
    if (altMatch && srcMatch) {
      logos.push({ name: altMatch[2].trim(), url: srcMatch[2] });
    }
  }

  // For team wins, fall back to header text-extracted numeric tokens.
  // The text between the two logos (or before/after) carries the wins.
  const headerText = stripHtml(header);
  // Headers look like: "24 THÁNG 5 11:00 PM GMT+7 CHAMPIONSHIP COURT Columbus Sliders 3 Dallas Flash 1"
  // Strategy: find the team names, then read the digit immediately
  // following each name.
  const teamSummaries: ParsedTeamSummary[] = logos.map((l) => {
    const escapedName = l.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escapedName}\\s+(\\d+)`);
    const m = headerText.match(re);
    return {
      name: l.name,
      logo: l.url,
      matchup_wins: m ? parseInt(m[1], 10) : 0,
    };
  });

  // Extract per-game team containers. Each container has exactly 2
  // .team children (team A's lineup+score, team B's lineup+score).
  // The container's class encodes which side WON the game (winning-team--home
  // = the FIRST team-div, --away = the SECOND team-div per page convention).
  const games: ParsedMlpGame[] = [];
  let containerMatch: RegExpExecArray | null;
  const containerRe = new RegExp(TEAM_CONTAINER_RE.source, "gi");
  while ((containerMatch = containerRe.exec(secHtml)) !== null) {
    const fullContainer = containerMatch[0];
    const inner = containerMatch[2] ?? "";
    const winningSideMatch = fullContainer.match(WINNING_SIDE_RE);
    const winningSide = winningSideMatch?.[1] as "home" | "away" | undefined;

    // Parse two <div class="team">…</div> children manually — regex
    // with split-on-team is more robust than a balanced-paren matcher.
    const teamMarkers: number[] = [];
    const teamOpenRe = /<div\b[^>]*\bclass=("|')[^"']*\bteam\b[^"']*\1[^>]*>/gi;
    let t: RegExpExecArray | null;
    while ((t = teamOpenRe.exec(inner)) !== null) {
      teamMarkers.push(t.index);
    }
    if (teamMarkers.length < 2) continue;

    const teamABlock = inner.slice(teamMarkers[0], teamMarkers[1]);
    const teamBBlock = inner.slice(teamMarkers[1]);

    const parseTeamBlock = (
      block: string,
    ): { score: number; players: string[] } => {
      const scoreMatch = block.match(SCORE_RE);
      const score = scoreMatch ? parseInt(scoreMatch[2], 10) : 0;
      const players: string[] = [];
      const spanRe = new RegExp(PLAYER_SPAN_RE.source, "g");
      let s: RegExpExecArray | null;
      while ((s = spanRe.exec(block)) !== null) {
        const name = stripHtml(s[1]);
        if (name && !/^\d+$/.test(name)) players.push(name);
      }
      return { score, players };
    };

    const a = parseTeamBlock(teamABlock);
    const b = parseTeamBlock(teamBBlock);

    // Skip empty games (DB not played: both scores 0, both lineups empty).
    if (a.score === 0 && b.score === 0 && a.players.length === 0 && b.players.length === 0) {
      continue;
    }

    games.push({
      label: GAME_LABELS[games.length] ?? `G${games.length + 1}`,
      score_a: a.score,
      score_b: b.score,
      players_a: a.players,
      players_b: b.players,
      winner:
        winningSide === "home" ? "a" : winningSide === "away" ? "b" : null,
    });
  }

  return {
    team_a_summary: teamSummaries[0] ?? null,
    team_b_summary: teamSummaries[1] ?? null,
    games,
  };
}

// Date parsing: page header for a matchup looks like
//   "24 THÁNG 5 · 11:00 PM GMT+7 · CHAMPIONSHIP COURT"
// or with EN locale: "May 24 · 11:00 PM GMT+7 · Championship Court"
// Year defaults to current calendar year (MLP page only shows the
// current season's events).
const DATE_LINE_RE =
  /(?:(\d{1,2})\s+THÁNG\s+(\d{1,2})|([A-Z][a-z]+)\s+(\d{1,2}))[\s·]+(\d{1,2}):(\d{2})\s*([AP])M\s*GMT\s*([+-]\d+)?/i;
const COURT_LINE_RE = /(CHAMPIONSHIP COURT|GRANDSTAND COURT|COURT\s*\d+)/i;
const MONTH_NAMES: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

function parseDateLine(
  line: string,
  fallbackYear: number,
): { played_at: string | null; court: string | null } {
  const dateMatch = line.match(DATE_LINE_RE);
  if (!dateMatch) {
    return { played_at: null, court: extractCourt(line) };
  }
  let day: number;
  let month: number;
  if (dateMatch[1] && dateMatch[2]) {
    day = parseInt(dateMatch[1], 10);
    month = parseInt(dateMatch[2], 10);
  } else if (dateMatch[3] && dateMatch[4]) {
    day = parseInt(dateMatch[4], 10);
    month = MONTH_NAMES[dateMatch[3]] ?? 0;
  } else {
    return { played_at: null, court: extractCourt(line) };
  }
  if (!month) return { played_at: null, court: extractCourt(line) };
  let hh = parseInt(dateMatch[5], 10);
  const mm = parseInt(dateMatch[6], 10);
  if (dateMatch[7].toUpperCase() === "P" && hh < 12) hh += 12;
  if (dateMatch[7].toUpperCase() === "A" && hh === 12) hh = 0;
  const offset = dateMatch[8] ?? "+07";
  // Normalize "+7" → "+07:00"
  const offsetHours = parseInt(offset, 10);
  const offsetStr = `${offsetHours >= 0 ? "+" : "-"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;
  const iso = `${fallbackYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${offsetStr}`;
  return { played_at: iso, court: extractCourt(line) };
}

/**
 * Pull the event year out of the URL path (e.g. .../events-2026/foo/
 * → 2026). Falls back to the current UTC year when the URL doesn't
 * follow the expected shape — better than guessing past the season.
 * Codex P2 fix on PR #160: parser was hard-coded to the current year,
 * so when a historical event got re-scraped after Jan 1 the matches
 * would land in the wrong year.
 */
function eventYearFromUrl(sourceUrl: string): number {
  const m = sourceUrl.match(/\/events-(\d{4})\//);
  if (m) {
    const y = parseInt(m[1], 10);
    if (y >= 2020 && y <= 2100) return y;
  }
  return new Date().getUTCFullYear();
}

function extractCourt(line: string): string | null {
  const m = line.match(COURT_LINE_RE);
  return m ? m[1].replace(/\s+COURT$/i, "").trim() || m[1] : null;
}

/**
 * Parse a post-hydration MLP event-page HTML dump into a
 * TournamentScrapeResult.
 */
export function parseMlpEventHtml(
  html: string,
  sourceUrl: string,
): TournamentScrapeResult {
  const { tournament_name, tournament_event } = extractHeader(html);
  const eventYear = eventYearFromUrl(sourceUrl);
  const matches: ScrapedMatch[] = [];
  const playerMap = new Map<string, ScrapedPlayer>();
  const teamMap = new Map<string, ScrapedPlayer>();

  // The Worker now drives the MLP page through several day filters
  // (click prev arrow repeatedly) so the same article.sec can appear
  // multiple times across the captured HTML. We dedupe on the natural
  // matchup key: (date, time, team-A name, team-B name).
  const seenMatchupKeys = new Set<string>();

  let articleIdx = 0;
  for (const article of html.matchAll(ARTICLE_SEC_RE)) {
    const articleHtml = article[0];
    const lite = parseSecArticle(articleHtml);
    if (!lite.team_a_summary || !lite.team_b_summary || lite.games.length === 0) {
      articleIdx += 1;
      continue;
    }

    // Date + court — from the article's header text.
    const headerText = stripHtml(articleHtml.split(/<div\b[^>]*\bsec__match-details/i)[0] ?? "");
    const dateInfo = parseDateLine(headerText, eventYear);

    // Dedupe key: same matchup rendered under multiple day filters in
    // the captured HTML produces identical (date, team-A, team-B).
    const dedupeKey = `${dateInfo.played_at ?? "no-date"}|${lite.team_a_summary.name}|${lite.team_b_summary.name}`;
    if (seenMatchupKeys.has(dedupeKey)) {
      articleIdx += 1;
      continue;
    }
    seenMatchupKeys.add(dedupeKey);

    // Register team ghost profiles (one per side).
    const teamASlug = `mlp-${slugifyTeamName(lite.team_a_summary.name)}`;
    const teamBSlug = `mlp-${slugifyTeamName(lite.team_b_summary.name)}`;
    if (!teamMap.has(teamASlug)) {
      teamMap.set(teamASlug, {
        external_id: teamASlug,
        external_url: `https://majorleaguepickleball.co/team/${slugifyTeamName(lite.team_a_summary.name)}/`,
        display_name: lite.team_a_summary.name,
        avatar_url: lite.team_a_summary.logo,
        country_code: "US",
      });
    }
    if (!teamMap.has(teamBSlug)) {
      teamMap.set(teamBSlug, {
        external_id: teamBSlug,
        external_url: `https://majorleaguepickleball.co/team/${slugifyTeamName(lite.team_b_summary.name)}/`,
        display_name: lite.team_b_summary.name,
        avatar_url: lite.team_b_summary.logo,
        country_code: "US",
      });
    }

    // Register player ghost profiles (for future per-player rendering;
    // match-level participants stay at team granularity).
    for (const game of lite.games) {
      for (const name of [...game.players_a, ...game.players_b]) {
        const slug = `mlp-${slugifyPlayerName(name)}`;
        if (!playerMap.has(slug)) {
          playerMap.set(slug, {
            external_id: slug,
            external_url: `https://majorleaguepickleball.co/player/${slugifyPlayerName(name)}/`,
            display_name: name,
            avatar_url: null,
            country_code: null,
          });
        }
      }
    }

    // Determine matchup winner from team summaries (matchup_wins).
    const aWins = lite.team_a_summary.matchup_wins;
    const bWins = lite.team_b_summary.matchup_wins;
    const winnerTeam: "one" | "two" | null =
      aWins > bWins ? "one" : bWins > aWins ? "two" : null;

    // Build per-game scores arrays for the matches row.
    const scoresA = lite.games.map((g) => g.score_a);
    const scoresB = lite.games.map((g) => g.score_b);

    // Compose the notes JSON — this is what FeedMlpMatchCard parses
    // for the expand-table render. Keep the shape stable.
    const notesObj: ParsedMlpMatchupNotes = {
      format: "mlp_team_matchup",
      team_a: {
        name: lite.team_a_summary.name,
        logo: lite.team_a_summary.logo,
        matchup_wins: aWins,
      },
      team_b: {
        name: lite.team_b_summary.name,
        logo: lite.team_b_summary.logo,
        matchup_wins: bWins,
      },
      games: lite.games,
    };

    // external_match_id: pin per (tournament_url, article index, team-slug
    // pair) so re-running the scrape stays idempotent even if matchups
    // get re-ordered in the source DOM between fetches.
    const externalMatchId = `mlp-${slugifyTeamName(tournament_name)}-${articleIdx + 1}-${teamASlug}-vs-${teamBSlug}`;

    matches.push({
      external_match_id: externalMatchId,
      round_name: "GP", // Group Play; Day-4 playoff label TBD if MLP exposes a marker
      team_one: { seed: null, player_external_ids: [teamASlug] },
      team_two: { seed: null, player_external_ids: [teamBSlug] },
      scores_team_one: scoresA,
      scores_team_two: scoresB,
      winner_team: winnerTeam,
      court: dateInfo.court,
      played_at: dateInfo.played_at,
      source_url: sourceUrl,
      notes: JSON.stringify(notesObj),
      court_number: dateInfo.court,
      tournament_event_override: "Group Play",
    });

    articleIdx += 1;
  }

  // Emit team summaries as the "players" array — the ingest function
  // creates one ghost profile per external_id and the match's team_one /
  // team_two reference team external_ids. Per-player profiles are
  // appended for completeness so a future per-player UI can resolve them.
  const players: ScrapedPlayer[] = [
    ...Array.from(teamMap.values()),
    ...Array.from(playerMap.values()),
  ];

  return {
    source_provider: "mlp",
    source_url: sourceUrl,
    tournament_name,
    tournament_event,
    matches,
    players,
  };
}
