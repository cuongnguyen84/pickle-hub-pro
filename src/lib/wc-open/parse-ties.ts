// ============================================================================
// wc-open/parse-ties — extract the OPEN team-competition ties (nation vs
// nation) from the same sporttora.com delegations page parse.ts reads the
// draw from.
//
// Since the team competition started on 2026-09-03, the page server-renders
// the full OPEN schedule twice over:
//   * one object per TIE        `{"id":"open_team_coed____default__m<N>", ...}`
//     with groupId, entryA/entryB (delegation slugs), courtLabel, scheduledAt.
//     Its own `status` stays "scheduled" while sub-matches are in play and is
//     only trusted here when it turns terminal.
//   * one object per SUB-MATCH  `{"id":"…__m<N>__sub-<discipline>", ...}`
//     (WD, MD, XD#1, XD#2, WS, MS — six per tie) carrying its own status and,
//     once decided, an explicit `winnerId` (the winning side's entryId).
//
// A tie's score in wc_open_matches is "sub-matches won" per side — exactly
// what a group table needs — so this module counts `winnerId`s rather than
// re-deriving winners from point scores. Sub-matches can appear more than
// once in the flight (the schedule list AND the on-court-now board render the
// same match), so they are deduped by id keeping the most advanced status.
//
// Same contract as parse.ts: pure, DOM-free, fixture-testable, and it THROWS
// ParseGuardError when the shape it depends on is gone, so the worker alerts
// instead of overwriting good rows with a half-parsed schedule.
// ============================================================================

import { decodeFlight, matchBalanced, ParseGuardError } from "./parse";

/** Mirrors a wc_open_matches row; the worker maps field names 1:1. */
export interface WcOpenTie {
  matchId: string;
  group: string; // "A".."P"
  round: string; // "group" — knockout ties are not ingested yet (no groupId)
  homeSlug: string;
  awaySlug: string;
  homeScore: number | null; // sub-matches won; null until the tie starts
  awayScore: number | null;
  status: "scheduled" | "live" | "final";
  court: string | null;
  /** Organizers' Vietnam wall-clock, stored verbatim (same convention as
   *  wc_pro_matches.scheduled_at — see that column's comment). */
  startTime: string | null;
}

export interface WcOpenTiesParseResult {
  ties: WcOpenTie[];
  /** Deduped OPEN sub-matches seen, surfaced for the worker's digest/guards. */
  subMatchCount: number;
  liveTieCount: number;
}

// The group stage is the fixed 16 groups × 4 teams draw parse.ts guards, so
// its schedule is exactly 6 ties per group. The 32 knockout ties render
// without a groupId and with TBD entries; they are skipped here (the /live
// panel and wc_open_matches.group_letter are group-shaped) — revisit when the
// knockout starts on Sep 5.
const EXPECTED_GROUP_TIES = 96;

const TIE_ID_RE = /\{"id":"(open_team_coed____default__m\d+)","/g;
const SUB_ID_RE = /\{"id":"(open_team_coed____default__m\d+__sub-[^"]+)","/g;

interface RawEntry {
  delegationId?: string;
  entryId?: string;
}
interface RawTie {
  id: string;
  groupId?: string;
  entryA?: RawEntry;
  entryB?: RawEntry;
  courtLabel?: string;
  scheduledAt?: string;
  status?: string;
}
interface RawSub {
  id: string;
  tieId?: string;
  status?: string;
  winnerId?: string;
}

/** Every balanced JSON object whose opening matches `re`, deduped by id.
 *  `prefer` decides which duplicate wins (higher = keep). */
function extractObjects<T extends { id: string }>(
  flight: string,
  re: RegExp,
  prefer: (o: T) => number,
): Map<string, T> {
  const out = new Map<string, T>();
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flight)) !== null) {
    const raw = matchBalanced(flight, m.index);
    if (!raw) continue;
    let obj: T;
    try {
      obj = JSON.parse(raw) as T;
    } catch {
      continue; // an unrelated fragment that happened to match the opening
    }
    const existing = out.get(obj.id);
    if (!existing || prefer(obj) > prefer(existing)) out.set(obj.id, obj);
  }
  return out;
}

// A sub-match rendered twice (schedule + on-court board) keeps its most
// advanced copy: a final beats a live snapshot beats the scheduled slot.
const SUB_STATUS_RANK: Record<string, number> = {
  completed: 3,
  walkover: 3,
  in_progress: 2,
  scheduled: 1,
};

const isTerminal = (status: string | undefined): boolean =>
  status === "completed" || status === "walkover";

/**
 * Parse the delegations HTML into the OPEN group-stage ties. Throws
 * ParseGuardError when the schedule is not the 96-tie shape the fixed draw
 * dictates — the caller alerts and keeps last-good rows.
 */
export function parseWcOpenTies(
  html: string,
  // Overridable only so the fixture test can exercise the full pipeline on a
  // hand-sized schedule; the worker always uses the real 96.
  expectedGroupTies = EXPECTED_GROUP_TIES,
): WcOpenTiesParseResult {
  const flight = decodeFlight(html);
  if (!flight) {
    throw new ParseGuardError("no RSC flight chunks found — not the expected page");
  }

  const tieObjs = extractObjects<RawTie>(flight, TIE_ID_RE, (o) =>
    SUB_STATUS_RANK[o.status ?? ""] ?? 0,
  );
  const subObjs = extractObjects<RawSub>(flight, SUB_ID_RE, (o) =>
    SUB_STATUS_RANK[o.status ?? ""] ?? 0,
  );

  if (tieObjs.size === 0) {
    throw new ParseGuardError("no OPEN tie objects found — source layout changed");
  }

  // winnerId / live counts per tie, from the deduped sub-matches.
  const perTie = new Map<string, { wins: Map<string, number>; live: number; terminal: number; total: number }>();
  for (const sub of subObjs.values()) {
    if (!sub.tieId) continue;
    let t = perTie.get(sub.tieId);
    if (!t) {
      t = { wins: new Map(), live: 0, terminal: 0, total: 0 };
      perTie.set(sub.tieId, t);
    }
    t.total += 1;
    if (sub.status === "in_progress") t.live += 1;
    if (isTerminal(sub.status)) {
      t.terminal += 1;
      if (sub.winnerId) t.wins.set(sub.winnerId, (t.wins.get(sub.winnerId) ?? 0) + 1);
    }
  }

  const ties: WcOpenTie[] = [];
  let liveTieCount = 0;
  for (const tie of tieObjs.values()) {
    const group = tie.groupId;
    if (!group) continue; // knockout — not ingested yet, see EXPECTED_GROUP_TIES
    const homeSlug = tie.entryA?.delegationId;
    const awaySlug = tie.entryB?.delegationId;
    if (!homeSlug || !awaySlug) {
      throw new ParseGuardError(`group tie ${tie.id} is missing a delegation — source layout changed`);
    }

    const subs = perTie.get(tie.id);
    const homeWins = subs?.wins.get(tie.entryA?.entryId ?? "") ?? 0;
    const awayWins = subs?.wins.get(tie.entryB?.entryId ?? "") ?? 0;
    const started = (subs?.live ?? 0) > 0 || (subs?.terminal ?? 0) > 0;

    // Final when the organizers close the tie, or when every sub-match is
    // decided. While decided-but-not-closed (between sub-matches, or if the
    // organizers end a tie early), it stays live so the UI keeps watching it.
    let status: WcOpenTie["status"];
    if (isTerminal(tie.status) || (subs != null && subs.total > 0 && subs.terminal === subs.total)) {
      status = "final";
    } else if (started) {
      status = "live";
      liveTieCount += 1;
    } else {
      status = "scheduled";
    }

    ties.push({
      matchId: tie.id,
      group,
      round: "group",
      homeSlug,
      awaySlug,
      homeScore: started || status === "final" ? homeWins : null,
      awayScore: started || status === "final" ? awayWins : null,
      status,
      court: tie.courtLabel ?? null,
      startTime: tie.scheduledAt ?? null,
    });
  }

  if (ties.length !== expectedGroupTies) {
    throw new ParseGuardError(
      `expected ${expectedGroupTies} OPEN group ties, parsed ${ties.length} — source layout changed`,
    );
  }

  return { ties, subMatchCount: subObjs.size, liveTieCount };
}
