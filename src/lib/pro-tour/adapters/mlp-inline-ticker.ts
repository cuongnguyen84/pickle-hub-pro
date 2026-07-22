/**
 * MLP inline-ticker parser + shared matchup→result assembly.
 *
 * Around 2026-07-17 majorleaguepickleball.co dropped the
 * brackets.pickleballteamleagues.com iframe and started inlining the
 * full matchup payload into the event page itself:
 *
 *   <script id="fauElementScripts-js-extra">
 *     var phpObj = { ..., "initialTicker": { "eventUuid": "...",
 *       "matchups": [ { teamOneTitle, teamOneScore, matches: [ {
 *         matchAbbreviation: "WD", teamOnePlayerOneName, ... } ] } ] } }
 *   </script>
 *
 * Unlike the old RSC chunks this is PLAIN JSON — no `\"key\"` escaping —
 * so we brace-scan the object out of the HTML and JSON.parse it.
 *
 * This lives in its own module (not mlp-event-scraper.ts) so the unit
 * tests only pull THIS file into the coverage scope — the legacy
 * brackets-pool regex parser has no fixture coverage and would tank the
 * global statements threshold if test-imported.
 */

import type {
  TournamentScrapeResult,
  ScrapedMatch,
  ScrapedPlayer,
} from "../types";

/* ─── Shared matchup shapes (also consumed by mlp-event-scraper.ts and
       the feed UI via re-export) ───────────────────────────────────── */

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

export interface ParsedMlpMatchup {
  team_a: { name: string; logo: string | null; abbr: string | null; matchup_wins: number };
  team_b: { name: string; logo: string | null; abbr: string | null; matchup_wins: number };
  winner: "a" | "b" | null;
  planned_start: string | null;
  venue: string | null;
  games: MlpMatchupGameLineup[];
  external_id: string;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ─── Shared assembly ────────────────────────────────────────────────── */

/**
 * Assemble a TournamentScrapeResult from parsed matchups. Shared by the
 * legacy brackets-pool path and the inline-ticker path so both produce
 * identical ghost profiles / external_match_ids.
 */
export function buildMlpScrapeResult(
  matchups: ParsedMlpMatchup[],
  mlpEventUrl: string,
  tournamentName: string,
): TournamentScrapeResult {
  const matches: ScrapedMatch[] = [];
  const teamMap = new Map<string, ScrapedPlayer>();
  const playerMap = new Map<string, ScrapedPlayer>();
  const seenExtIds = new Set<string>();

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

/* ─── Inline-ticker extraction ───────────────────────────────────────── */

/** Fields we read off one entry of initialTicker.matchups[].matches[]. */
interface InlineTickerGame {
  matchAbbreviation?: string | null;
  formatTitle?: string | null;
  playerGroupTitle?: string | null;
  teamOnePlayerOneName?: string | null;
  teamOnePlayerTwoName?: string | null;
  teamTwoPlayerOneName?: string | null;
  teamTwoPlayerTwoName?: string | null;
  teamOneGameOneScore?: number | null;
  teamTwoGameOneScore?: number | null;
}

/** Fields we read off one entry of initialTicker.matchups[]. */
interface InlineTickerMatchup {
  teamOneUuid?: string | null;
  teamTwoUuid?: string | null;
  teamOneTitle?: string | null;
  teamTwoTitle?: string | null;
  teamOneAbbreviation?: string | null;
  teamTwoAbbreviation?: string | null;
  teamOneLogo?: { url?: string | null } | null;
  teamTwoLogo?: { url?: string | null } | null;
  teamOneScore?: number | null;
  teamTwoScore?: number | null;
  plannedStartDate?: string | null;
  venue?: string | null;
  matches?: InlineTickerGame[] | null;
}

/**
 * Return the balanced `{...}` JSON object starting at `start` (which
 * must point at a `{`), respecting string literals and escapes.
 */
function extractJsonObjectAt(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Pull initialTicker.matchups[] out of the raw event-page HTML.
 * Returns null when the page has no inline ticker (pre-redesign pages).
 */
export function extractInlineTickerMatchups(
  mlpHtml: string,
): InlineTickerMatchup[] | null {
  const marker = mlpHtml.indexOf('"initialTicker"');
  if (marker < 0) return null;
  const brace = mlpHtml.indexOf("{", marker);
  if (brace < 0) return null;
  const raw = extractJsonObjectAt(mlpHtml, brace);
  if (!raw) return null;
  try {
    const ticker = JSON.parse(raw) as { matchups?: unknown };
    return Array.isArray(ticker.matchups)
      ? (ticker.matchups as InlineTickerMatchup[])
      : null;
  } catch {
    return null;
  }
}

function nonBlank(p: string | null | undefined): p is string {
  return Boolean(p && p.trim());
}

/** Map one inline-ticker matchup to the shared ParsedMlpMatchup shape.
 *  Returns null for BYEs and fully-unplayed (future) matchups — same
 *  skip rules as the legacy brackets-pool parser. */
function inlineMatchupToParsed(
  m: InlineTickerMatchup,
): ParsedMlpMatchup | null {
  if (!m.teamOneTitle || !m.teamTwoTitle || !m.teamOneUuid || !m.teamTwoUuid) {
    return null;
  }

  const games: MlpMatchupGameLineup[] = [];
  for (const g of m.matches ?? []) {
    const players_a = [g.teamOnePlayerOneName, g.teamOnePlayerTwoName].filter(nonBlank);
    const players_b = [g.teamTwoPlayerOneName, g.teamTwoPlayerTwoName].filter(nonBlank);
    const score_a = g.teamOneGameOneScore ?? 0;
    const score_b = g.teamTwoGameOneScore ?? 0;
    if (score_a === 0 && score_b === 0 && players_a.length === 0 && players_b.length === 0) {
      continue;
    }
    // The inline payload carries the slot label directly (WD/MD/MXD1/
    // MXD2/DB); fall back to the legacy playerGroup heuristic if absent.
    let label = g.matchAbbreviation?.trim() ?? "";
    if (!label) {
      if (g.formatTitle === "Singles") label = "DB";
      else if (g.playerGroupTitle === "Womens") label = "WD";
      else if (g.playerGroupTitle === "Mens") label = "MD";
      else {
        const mixedCount = games.filter((x) => x.label.startsWith("MXD")).length;
        label = mixedCount === 0 ? "MXD1" : "MXD2";
      }
    }
    games.push({
      label,
      score_a,
      score_b,
      players_a,
      players_b,
      winner: score_a > score_b ? "a" : score_b > score_a ? "b" : null,
    });
  }

  const teamOneScore = m.teamOneScore ?? 0;
  const teamTwoScore = m.teamTwoScore ?? 0;
  if (games.length === 0 && teamOneScore === 0 && teamTwoScore === 0) {
    return null;
  }

  return {
    team_a: {
      name: m.teamOneTitle,
      logo: m.teamOneLogo?.url ?? null,
      abbr: m.teamOneAbbreviation ?? null,
      matchup_wins: teamOneScore,
    },
    team_b: {
      name: m.teamTwoTitle,
      logo: m.teamTwoLogo?.url ?? null,
      abbr: m.teamTwoAbbreviation ?? null,
      matchup_wins: teamTwoScore,
    },
    winner:
      teamOneScore > teamTwoScore ? "a" : teamTwoScore > teamOneScore ? "b" : null,
    planned_start: m.plannedStartDate ?? null,
    venue: m.venue ?? null,
    games,
    external_id: `${m.teamOneUuid}-vs-${m.teamTwoUuid}`,
  };
}

/**
 * Parse an event page that inlines its matchup payload. Returns null
 * when the page has no inline ticker at all (caller should fall back
 * to the legacy brackets-iframe crawl).
 */
export function parseMlpFromInlineTicker(
  mlpHtml: string,
  mlpEventUrl: string,
  tournamentName: string,
): TournamentScrapeResult | null {
  const raw = extractInlineTickerMatchups(mlpHtml);
  if (!raw) return null;
  const matchups = raw
    .map(inlineMatchupToParsed)
    .filter((m): m is ParsedMlpMatchup => m !== null);
  return buildMlpScrapeResult(matchups, mlpEventUrl, tournamentName);
}

/**
 * Extract a human tournament name from the MLP page HTML — looks at the
 * <h1> first, falls back to the <title>'s leading segment.
 */
export function extractTournamentName(mlpHtml: string): string {
  const h1 = mlpHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    // Fixpoint tag-strip so nested fragments cannot reassemble into a tag
    // after one pass (CodeQL js/incomplete-multi-character-sanitization).
    let stripped = h1[1];
    let prev: string;
    do {
      prev = stripped;
      stripped = stripped.replace(/<[^>]+>/g, "");
    } while (stripped !== prev);
    const txt = stripped
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
