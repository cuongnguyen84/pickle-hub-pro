/**
 * MLP event-matchups JSON → TournamentScrapeResult.
 *
 * Source: GET https://majorleaguepickleball.co/wp-json/fau-scores-and-stats/v1/event-matchups?event_uuid=<uuid>
 * with Origin https://majorleaguepickleball.co. The public event page
 * publishes `scoreTickerEventUuid` in phpObj; the inline ticker itself is
 * only present while that event is the site-wide "current" event, so a
 * finished event (Nations Cup, Oct 30–Nov 1 2026) is readable here and
 * not from the HTML ticker.
 *
 * Notes JSON matches the shape FeedMlpMatchCard already decodes
 * (format mlp_team_matchup), because assembly goes through
 * buildMlpScrapeResult.
 */

import type { TournamentScrapeResult } from "../types";
import { canonicalRoundName } from "./rsc-scraper";
import {
  buildMlpScrapeResult,
  type ParsedMlpMatchup,
  type MlpMatchupGameLineup,
} from "./mlp-inline-ticker";
import { dedupeScrapedMatches } from "./ppa-scores-feed";

interface MlpGame {
  match_abbreviation?: string | null;
  format_title?: string | null;
  player_group_title?: string | null;
  team_one_player_one_name?: string | null;
  team_one_player_two_name?: string | null;
  team_two_player_one_name?: string | null;
  team_two_player_two_name?: string | null;
  team_one_game_one_score?: number | null;
  team_two_game_one_score?: number | null;
}

interface MlpMatchup {
  uuid?: string | null;
  team_one_title?: string | null;
  team_two_title?: string | null;
  team_one_uuid?: string | null;
  team_two_uuid?: string | null;
  team_one_abbreviation?: string | null;
  team_two_abbreviation?: string | null;
  team_one_logo?: { url?: string | null } | null;
  team_two_logo?: { url?: string | null } | null;
  team_one_score?: number | null;
  team_two_score?: number | null;
  planned_start_date?: string | null;
  venue?: string | null;
  matchup_status?: string | null;
  winner?: number | string | null;
  round_text?: string | null;
  in_bracket_type?: string | null;
  matches?: MlpGame[] | null;
}

interface MlpDay {
  matchup_date?: string;
  divisions?: Array<{ matchups?: MlpMatchup[] }>;
}

export interface MlpEventMatchupsPayload {
  results?: { system_matchups?: MlpDay[] };
}

export interface MlpEventMeta {
  eventUrl: string;
  tournamentName: string;
}

function names(...parts: Array<string | null | undefined>): string[] {
  return parts.filter((p): p is string => Boolean(p && p.trim())).map((p) => p.trim());
}

function gameLabel(g: MlpGame, mixedSoFar: number): string {
  const abbr = g.match_abbreviation?.trim();
  if (abbr) return abbr;
  if (g.format_title === "Singles") return "DB";
  if (g.player_group_title === "Womens") return "WD";
  if (g.player_group_title === "Mens") return "MD";
  return mixedSoFar === 0 ? "MXD1" : "MXD2";
}

/** Final only when the source says the matchup is over, or names winner 1/2. A 2–1 lead is not a winner. */
function matchupPhase(m: MlpMatchup): "final" | "live" | "skip" {
  const status = String(m.matchup_status ?? "");
  const winnerNum = Number(m.winner);
  if (status === "COMPLETED_MATCHUP_STATUS" || winnerNum === 1 || winnerNum === 2) return "final";
  const teamOneScore = m.team_one_score ?? 0;
  const teamTwoScore = m.team_two_score ?? 0;
  const anyGame = (m.matches ?? []).some(
    (g) => (g.team_one_game_one_score ?? 0) > 0 || (g.team_two_game_one_score ?? 0) > 0,
  );
  if (teamOneScore + teamTwoScore > 0 || anyGame) return "live";
  return "skip";
}

function toParsed(m: MlpMatchup, date: string | undefined): { parsed: ParsedMlpMatchup; live: boolean } | null {
  if (!m.uuid || !m.team_one_title || !m.team_two_title || !m.team_one_uuid || !m.team_two_uuid) {
    return null;
  }
  const phase = matchupPhase(m);
  if (phase === "skip") return null;
  const teamOneScore = m.team_one_score ?? 0;
  const teamTwoScore = m.team_two_score ?? 0;

  const games: MlpMatchupGameLineup[] = [];
  for (const g of m.matches ?? []) {
    const players_a = names(g.team_one_player_one_name, g.team_one_player_two_name);
    const players_b = names(g.team_two_player_one_name, g.team_two_player_two_name);
    const score_a = g.team_one_game_one_score ?? 0;
    const score_b = g.team_two_game_one_score ?? 0;
    if (score_a === 0 && score_b === 0 && players_a.length === 0 && players_b.length === 0) continue;
    games.push({
      label: gameLabel(g, games.filter((x) => x.label.startsWith("MXD")).length),
      score_a,
      score_b,
      players_a,
      players_b,
      // A game score names that game's winner. It does not name the matchup winner.
      winner: score_a > score_b ? "a" : score_b > score_a ? "b" : null,
    });
  }
  if (games.length === 0 && teamOneScore === 0 && teamTwoScore === 0) return null;

  const winnerNum = Number(m.winner);
  const winner =
    phase === "live"
      ? null
      : winnerNum === 1
        ? "a"
        : winnerNum === 2
          ? "b"
          : teamOneScore > teamTwoScore
            ? "a"
            : teamTwoScore > teamOneScore
              ? "b"
              : null;

  return {
    live: phase === "live",
    parsed: {
      team_a: {
        name: m.team_one_title,
        logo: m.team_one_logo?.url ?? null,
        abbr: m.team_one_abbreviation ?? null,
        matchup_wins: teamOneScore,
      },
      team_b: {
        name: m.team_two_title,
        logo: m.team_two_logo?.url ?? null,
        abbr: m.team_two_abbreviation ?? null,
        matchup_wins: teamTwoScore,
      },
      winner,
      planned_start: m.planned_start_date ?? (date ? `${date}T12:00:00.000Z` : null),
      venue: m.venue ?? null,
      games,
      external_id: m.uuid,
    },
  };
}

function roundName(roundText: string | null | undefined, bracket: string | null | undefined): string {
  const title = String(roundText ?? "").trim();
  const code = canonicalRoundName(title, "");
  if (code !== "UNKNOWN") return code;
  if ((bracket ?? "").toUpperCase() === "RR" || /^round\s+\d+/i.test(title)) return "GS";
  return "GS";
}

/**
 * Parse one event-matchups payload. Duplicate matchup UUIDs collapse to
 * the copy that has a winner (then the higher combined team score).
 * Returns null only when the payload has no matchup list at all.
 */
export function parseMlpEventMatchups(
  payload: MlpEventMatchupsPayload,
  meta: MlpEventMeta,
): TournamentScrapeResult | null {
  const days = payload.results?.system_matchups;
  if (!Array.isArray(days)) return null;

  const rounds = new Map<string, string>();
  const liveIds = new Set<string>();
  const best = new Map<string, { parsed: ParsedMlpMatchup; score: number; live: boolean }>();
  const order: string[] = [];

  for (const day of days) {
    for (const div of day.divisions ?? []) {
      for (const raw of div.matchups ?? []) {
        const row = toParsed(raw, day.matchup_date);
        if (!row) continue;
        const { parsed, live } = row;
        const score = (parsed.winner ? 100 : 0) + parsed.team_a.matchup_wins + parsed.team_b.matchup_wins;
        const prev = best.get(parsed.external_id);
        if (!prev) {
          order.push(parsed.external_id);
          best.set(parsed.external_id, { parsed, score, live });
          rounds.set(parsed.external_id, roundName(raw.round_text, raw.in_bracket_type));
        } else if (score > prev.score) {
          best.set(parsed.external_id, { parsed, score, live });
          rounds.set(parsed.external_id, roundName(raw.round_text, raw.in_bracket_type));
        }
      }
    }
  }
  for (const [id, row] of best) {
    if (row.live) liveIds.add(id);
  }

  const matchups = order.map((id) => best.get(id)!.parsed);
  const result = buildMlpScrapeResult(matchups, meta.eventUrl, meta.tournamentName);
  for (const match of result.matches) {
    const uuid = match.external_match_id.replace(/^mlp-/, "");
    match.round_name = rounds.get(uuid) ?? match.round_name;
    if (!liveIds.has(uuid)) continue;
    match.winner_team = null;
    const notes = JSON.parse(match.notes ?? "{}") as { live?: boolean };
    notes.live = true;
    match.notes = JSON.stringify(notes);
  }
  result.matches = dedupeScrapedMatches(result.matches);
  result.tournament_event = meta.tournamentName;
  return result;
}
