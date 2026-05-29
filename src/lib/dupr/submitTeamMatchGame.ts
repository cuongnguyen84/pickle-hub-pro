// ============================================================================
// submitTeamMatchGame — push a completed MLP team-match game to DUPR
// ----------------------------------------------------------------------------
// Team Match DUPR Phase 1 (2026-05-29). Mirrors submitDoublesEliminationMatch
// but for the team_match_games table. Each game row is one DUPR match:
//   - WD / MD / MX  → DOUBLES (2 players per side)
//   - WS / MS       → SINGLES (1 player per side)
//   - DreamBreaker  → uses its own game_type to decide format
// scoring_type rally21 → RALLY, sideout11 → SIDEOUT.
//
// The edge function `dupr-match-submit` is reused unchanged with
// internal_source='team_match_game'. That source does NOT trigger the
// matches-table mirror (only 'match'/'club_match' do), so we write the
// matchCode + sync state back onto the team_match_games row directly.
//
// Role note: the edge fn only lets a GLOBAL ADMIN submit this source (the
// club-organizer path is scoped to 'match'/'club_match'). Non-admin callers
// get a 403 captured into dupr_submit_error — the game itself is NOT blocked.
//
// Idempotent (skips when dupr_submitted=true). Soft-fail on every error.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

type GameType = "WD" | "MD" | "MX" | "WS" | "MS";

interface SubmitInput {
  gameId: string;
  gameType: GameType;
  scoringType: "rally21" | "sideout11";
  scoreA: number;
  scoreB: number;
  /** Roster ids (team_match_roster.id) from the game lineup. */
  lineupRosterIdsA: string[];
  lineupRosterIdsB: string[];
  ratingSource: "self" | "dupr" | "either";
  tournamentName: string;
  /** display_name / game label used as the DUPR bracket field. */
  bracketLabel?: string;
  /** Optional DUPR club id from organizations.dupr_club_id. */
  duprClubId?: number | null;
  alreadySubmitted: boolean;
}

export type SubmitOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "ok"; matchCode: string | null }
  | { kind: "error"; message: string };

const SOURCE = "team_match_game";
const SINGLES_TYPES: GameType[] = ["WS", "MS"];

export async function submitTeamMatchGame(input: SubmitInput): Promise<SubmitOutcome> {
  // 1. Idempotency + config gates.
  if (input.alreadySubmitted) {
    return { kind: "skipped", reason: "already-submitted" };
  }
  if (input.ratingSource === "self") {
    return { kind: "skipped", reason: "rating-source-self" };
  }
  if (input.scoreA === input.scoreB) {
    return { kind: "skipped", reason: "no-winner" };
  }

  const isSingles = SINGLES_TYPES.includes(input.gameType);
  const needPerSide = isSingles ? 1 : 2;
  const rosterA = (input.lineupRosterIdsA ?? []).slice(0, needPerSide);
  const rosterB = (input.lineupRosterIdsB ?? []).slice(0, needPerSide);
  if (rosterA.length < needPerSide || rosterB.length < needPerSide) {
    return { kind: "skipped", reason: "incomplete-lineup" };
  }

  // 2. Resolve roster ids → user_id → profiles.dupr_id (two round-trips).
  const allRosterIds = [...rosterA, ...rosterB];
  const { data: rosterRows, error: rosterErr } = await supabase
    .from("team_match_roster")
    .select("id, user_id")
    .in("id", allRosterIds);
  if (rosterErr) {
    await writeError(input.gameId, `roster lookup: ${rosterErr.message}`);
    return { kind: "error", message: rosterErr.message };
  }
  const rosterToUser = new Map<string, string | null>();
  for (const r of (rosterRows ?? []) as Array<{ id: string; user_id: string | null }>) {
    rosterToUser.set(r.id, r.user_id);
  }
  const userIds = allRosterIds.map((id) => rosterToUser.get(id) ?? null);
  if (userIds.some((id) => !id)) {
    return { kind: "skipped", reason: "missing-profile-link" };
  }

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, dupr_id")
    .in("id", userIds as string[]);
  if (profErr) {
    await writeError(input.gameId, `profiles lookup: ${profErr.message}`);
    return { kind: "error", message: profErr.message };
  }
  const userToDupr = new Map<string, string | null>();
  for (const p of (profiles ?? []) as Array<{ id: string; dupr_id: string | null }>) {
    userToDupr.set(p.id, p.dupr_id);
  }

  const duprFor = (rosterId: string): string | null => {
    const uid = rosterToUser.get(rosterId);
    return uid ? userToDupr.get(uid) ?? null : null;
  };

  const aDupr = rosterA.map(duprFor);
  const bDupr = rosterB.map(duprFor);
  if ([...aDupr, ...bDupr].some((d) => !d)) {
    const msg = "missing-dupr-id";
    await writeError(input.gameId, msg);
    return { kind: "skipped", reason: msg };
  }

  // 3. Build single-game CreatePayload.
  const teamA: Record<string, unknown> = { player1: aDupr[0], game1: input.scoreA };
  const teamB: Record<string, unknown> = { player1: bDupr[0], game1: input.scoreB };
  if (!isSingles) {
    teamA.player2 = aDupr[1];
    teamB.player2 = bDupr[1];
  }

  const today = new Date().toISOString().slice(0, 10); // yyyy-MM-dd

  const body = {
    action: "create" as const,
    internal_source: SOURCE,
    internal_match_id: input.gameId,
    match_date: today,
    format: (isSingles ? "SINGLES" : "DOUBLES") as "SINGLES" | "DOUBLES",
    match_type: (input.scoringType === "rally21" ? "RALLY" : "SIDEOUT") as "RALLY" | "SIDEOUT",
    event: input.tournamentName,
    bracket: input.bracketLabel || "MLP Team Match",
    club_id: input.duprClubId ?? undefined,
    team_a: teamA,
    team_b: teamB,
  };

  // 4. Invoke edge function.
  const { data, error } = await supabase.functions.invoke<{
    match_code?: string;
    matchCode?: string;
    error?: string;
  }>("dupr-match-submit", { body });
  if (error) {
    const msg = (error as Error).message || String(error);
    await writeError(input.gameId, msg);
    return { kind: "error", message: msg };
  }
  if (data?.error) {
    await writeError(input.gameId, data.error);
    return { kind: "error", message: data.error };
  }

  const matchCode = data?.match_code ?? data?.matchCode ?? null;

  // 5. Mirror sync state onto the team_match_games row.
  const { error: updateErr } = await supabase
    .from("team_match_games")
    .update({
      dupr_submitted: true,
      dupr_match_code: matchCode,
      dupr_submitted_at: new Date().toISOString(),
      dupr_submit_error: null,
    })
    .eq("id", input.gameId);
  if (updateErr) {
    console.warn("[submitTeamMatchGame] mirror update:", updateErr);
  }
  return { kind: "ok", matchCode };
}

async function writeError(gameId: string, message: string) {
  const truncated = message.length > 500 ? message.slice(0, 500) : message;
  await supabase
    .from("team_match_games")
    .update({ dupr_submit_error: truncated })
    .eq("id", gameId);
}
