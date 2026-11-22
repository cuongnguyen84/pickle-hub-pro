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

function toParsed(m: MlpMatchup, date: string | undefined): ParsedMlpMatchup | null {
  if (!m.uuid || !m.team_one_title || !m.team_two_title || !m.team_one_uuid || !m.team_two_uuid) {
    return null;
  }
  const status = String(m.matchup_status ?? "");
  const teamOneScore = m.team_one_score ?? 0;
  const teamTwoScore = m.team_two_score ?? 0;
  const completed = status === "COMPLETED_MATCHUP_STATUS" || teamOneScore + teamTwoScore > 0;
  if (!completed) return null;

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
      winner: score_a > score_b ? "a" : score_b > score_a ? "b" : null,
    });
  }
  if (games.length === 0 && teamOneScore === 0 && teamTwoScore === 0) return null;

  const winnerNum = Number(m.winner);
  const winner =
    winnerNum === 1 ? "a" : winnerNum === 2 ? "b" : teamOneScore > teamTwoScore ? "a" : teamTwoScore > teamOneScore ? "b" : null;

  return {
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
  const best = new Map<string, { parsed: ParsedMlpMatchup; score: number }>();
  const order: string[] = [];

  for (const day of days) {
    for (const div of day.divisions ?? []) {
      for (const raw of div.matchups ?? []) {
        const parsed = toParsed(raw, day.matchup_date);
        if (!parsed) continue;
        const score = (parsed.winner ? 100 : 0) + parsed.team_a.matchup_wins + parsed.team_b.matchup_wins;
        const prev = best.get(parsed.external_id);
        if (!prev) {
          order.push(parsed.external_id);
          best.set(parsed.external_id, { parsed, score });
          rounds.set(parsed.external_id, roundName(raw.round_text, raw.in_bracket_type));
        } else if (score > prev.score) {
          best.set(parsed.external_id, { parsed, score });
          rounds.set(parsed.external_id, roundName(raw.round_text, raw.in_bracket_type));
        }
      }
    }
  }

  const matchups = order.map((id) => best.get(id)!.parsed);
  const result = buildMlpScrapeResult(matchups, meta.eventUrl, meta.tournamentName);
  for (const match of result.matches) {
    const uuid = match.external_match_id.replace(/^mlp-/, "");
    match.round_name = rounds.get(uuid) ?? match.round_name;
  }
  result.matches = dedupeScrapedMatches(result.matches);
  result.tournament_event = meta.tournamentName;
  return result;
}
