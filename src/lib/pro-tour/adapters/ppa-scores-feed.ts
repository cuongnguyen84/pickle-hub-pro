/**
 * PPA Tour public scores feed → TournamentScrapeResult.
 *
 * Source: https://www.ppatour.com/api/scores/?event=<uuid>
 * The same JSON the event page and the blog recap pipeline read.
 * This adapter does not guess a winner or a score. A match is imported
 * only when the feed marks it completed with exactly one winner, or live
 * with at least one recorded game.
 *
 * Idempotency: external_match_id is the feed's match UUID. pro-tour-ingest
 * dedupes on (source_provider, external_match_id). Re-parsing the same
 * payload yields the same ids; dedupeScrapedMatches collapses duplicates
 * inside one payload and keeps the row that knows more (a winner, then
 * more recorded games).
 */

import type {
  ScrapedMatch,
  ScrapedPlayer,
  TournamentScrapeResult,
} from "../types";
import { canonicalRoundName } from "./rsc-scraper";
import { isPlaceholderExternalId } from "../../../../supabase/functions/pro-tour-ingest/placeholder-slots";

const COMPLETED = new Set(["final", "completed", "finished", "walkover", "retired"]);

const DIVISION_BY_KEY: Record<string, string> = {
  "mens singles": "Men's Singles",
  "womens singles": "Women's Singles",
  "mens doubles": "Men's Doubles",
  "womens doubles": "Women's Doubles",
  "mixed doubles": "Mixed Doubles",
};

export interface PpaScoreTeam {
  players?: unknown;
  seed?: number | null;
  games?: unknown;
  winner?: boolean;
}

export interface PpaScoreMatch {
  id?: string;
  division?: string;
  roundLabel?: string;
  court?: string;
  dateKey?: string;
  status?: string;
  teams?: PpaScoreTeam[];
}

export interface PpaScoresFeed {
  tournamentId?: string;
  matches?: PpaScoreMatch[];
}

export interface PpaEventMeta {
  eventId: string;
  tournamentName: string;
  sourceUrl: string;
  /** Calendar day (YYYY-MM-DD) used when a completed match has no real date. */
  fallbackDate?: string | null;
}

export interface PpaParseOptions {
  /** When true (the default), qualifying and non-pro divisions are dropped. */
  mainDrawOnly?: boolean;
}

/** Main-draw pro division, or null when the label is amateur / qualifying. */
export function normalizeProDivision(raw: string): string | null {
  const qualifying = /qualif/i.test(raw);
  const stripped = raw
    .trim()
    .replace(/^\s*pro\s+/i, "")
    .replace(/\s+-\s+main draw\s*$/i, "")
    .trim();
  const key = stripped.toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ");
  const name = DIVISION_BY_KEY[key];
  if (!name || qualifying) return null;
  return name;
}

function playerNames(team: PpaScoreTeam | undefined): string[] {
  if (!team || !Array.isArray(team.players)) return [];
  return team.players
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .map((p) => p.trim());
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function gameColumn(team: PpaScoreTeam | undefined): Array<number | null> {
  if (!team || !Array.isArray(team.games)) return [];
  return team.games.map((g) => (typeof g === "number" && Number.isFinite(g) ? g : null));
}

/** Drop unplayed 0-0 template slots. A real 11-0 game is kept. */
export function recordedGames(
  a: Array<number | null>,
  b: Array<number | null>,
): { a: number[]; b: number[] } {
  const n = Math.max(a.length, b.length);
  const outA: number[] = [];
  const outB: number[] = [];
  for (let i = 0; i < n; i++) {
    const ga = a[i];
    const gb = b[i];
    if (ga == null && gb == null) continue;
    const na = ga ?? 0;
    const nb = gb ?? 0;
    if (na === 0 && nb === 0) continue;
    outA.push(na);
    outB.push(nb);
  }
  return { a: outA, b: outB };
}

function playedAt(dateKey: string | undefined, fallback: string | null | undefined): string | null {
  const key = typeof dateKey === "string" ? dateKey : "";
  const real = /^\d{4}-\d{2}-\d{2}$/.test(key) && !key.startsWith("9999") ? key : null;
  const day = real ?? (fallback && /^\d{4}-\d{2}-\d{2}$/.test(fallback) ? fallback : null);
  if (!day) return null;
  return `${day}T12:00:00.000Z`;
}

function richness(match: ScrapedMatch): number {
  const games =
    match.scores_team_one.reduce((n, s) => n + (s > 0 ? 1 : 0), 0) +
    match.scores_team_two.reduce((n, s) => n + (s > 0 ? 1 : 0), 0);
  return (match.winner_team ? 100 : 0) + games;
}

/**
 * Collapse rows that share an external_match_id. The survivor is the one
 * with a winner, then the one with more recorded games. First-seen order
 * is preserved so a re-parse of an unchanged feed is byte-stable.
 */
export function dedupeScrapedMatches(matches: ScrapedMatch[]): ScrapedMatch[] {
  const order: string[] = [];
  const byId = new Map<string, ScrapedMatch>();
  for (const match of matches) {
    const id = match.external_match_id.trim();
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev) {
      order.push(id);
      byId.set(id, { ...match, external_match_id: id });
      continue;
    }
    if (richness(match) > richness(prev)) {
      byId.set(id, { ...match, external_match_id: id });
    }
  }
  return order.map((id) => byId.get(id)!);
}

function sideIsImportable(names: string[]): boolean {
  if (names.length === 0) return false;
  return names.every((name) => !isPlaceholderExternalId(slugifyName(name)));
}

export function parsePpaScoresFeed(
  feed: PpaScoresFeed,
  meta: PpaEventMeta,
  options: PpaParseOptions = {},
): TournamentScrapeResult {
  const mainDrawOnly = options.mainDrawOnly !== false;
  if (feed.tournamentId && feed.tournamentId !== meta.eventId) {
    throw new Error("score_event_id_mismatch");
  }

  const parsed: ScrapedMatch[] = [];
  const players = new Map<string, ScrapedPlayer>();

  for (const match of feed.matches ?? []) {
    const id = typeof match.id === "string" ? match.id.trim() : "";
    if (!id) continue;
    const division = normalizeProDivision(String(match.division ?? ""));
    if (mainDrawOnly && !division) continue;
    const eventLabel = division ? `Pro ${division}` : String(match.division ?? "Pro").trim() || "Pro";

    const status = String(match.status ?? "").toLowerCase();
    const completed = COMPLETED.has(status);
    const live = status === "live";
    if (!completed && !live) continue;

    const teams = match.teams ?? [];
    if (teams.length !== 2) continue;
    const [teamA, teamB] = teams;
    const namesA = playerNames(teamA);
    const namesB = playerNames(teamB);
    if (!sideIsImportable(namesA) || !sideIsImportable(namesB)) continue;

    const winners = teams.filter((t) => t?.winner === true);
    if (completed && winners.length !== 1) continue;
    const winnerTeam = completed ? (teamA?.winner === true ? "one" : "two") : null;

    const games = recordedGames(gameColumn(teamA), gameColumn(teamB));
    if (live && games.a.length === 0 && games.b.length === 0) continue;

    const when = playedAt(match.dateKey, meta.fallbackDate);
    if (!when) continue;

    const idsA = namesA.map(slugifyName);
    const idsB = namesB.map(slugifyName);
    for (const [externalId, displayName] of [...idsA.map((id, i) => [id, namesA[i]] as const), ...idsB.map((id, i) => [id, namesB[i]] as const)]) {
      if (!players.has(externalId)) {
        players.set(externalId, {
          external_id: externalId,
          external_url: `https://pickleball.com/players/${externalId}`,
          display_name: displayName,
          avatar_url: null,
          country_code: null,
        });
      }
    }

    const court = typeof match.court === "string" && match.court.trim() ? match.court.trim() : null;
    parsed.push({
      external_match_id: id,
      round_name: canonicalRoundName(String(match.roundLabel ?? ""), "W"),
      team_one: { seed: typeof teamA?.seed === "number" ? teamA.seed : null, player_external_ids: idsA },
      team_two: { seed: typeof teamB?.seed === "number" ? teamB.seed : null, player_external_ids: idsB },
      scores_team_one: games.a,
      scores_team_two: games.b,
      winner_team: winnerTeam,
      court,
      played_at: when,
      source_url: meta.sourceUrl,
      notes: live ? JSON.stringify({ live: true }) : null,
      court_number: court,
      tournament_event_override: eventLabel,
    });
  }

  return {
    source_provider: "ppa_tour",
    source_url: meta.sourceUrl,
    tournament_name: meta.tournamentName,
    tournament_event: "Pro",
    matches: dedupeScrapedMatches(parsed),
    players: [...players.values()],
  };
}
