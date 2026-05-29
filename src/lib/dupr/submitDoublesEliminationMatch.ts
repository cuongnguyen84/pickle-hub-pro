// ============================================================================
// submitDoublesEliminationMatch — call dupr-match-submit after a match ends
// ----------------------------------------------------------------------------
// DUPR Phase 2 (2026-05-29). Mirrors the matches-table flow used by
// MatchConfirmation but for the standalone doubles_elimination_matches table.
// The edge function `dupr-match-submit` is reused unchanged; we just pass
// internal_source='doubles_elim_match' and write the result back to our row.
//
// Idempotent: skips when row.dupr_submitted=true.
// Soft-fail: any error is captured into dupr_submit_error so the organizer
// sees the reason in the UI, and the match itself is NOT blocked.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import type { GameScore } from "@/hooks/useDoublesElimination";

interface TeamSlotInfo {
  id: string;
  player1_user_id: string | null;
  player2_user_id: string | null;
}

interface SubmitInput {
  matchId: string;
  /** Already-saved games array from the completed match. */
  games: GameScore[];
  /** Tournament-level config. */
  ratingSource: "self" | "dupr" | "either";
  tournamentName: string;
  /** Both teams with profile ids (player_user_ids). Null user_ids → bail. */
  teamA: TeamSlotInfo;
  teamB: TeamSlotInfo;
  /** Optional DUPR club id from organizations.dupr_club_id. */
  duprClubId?: number | null;
  /** Already-submitted flag to short-circuit retries. */
  alreadySubmitted: boolean;
}

export type SubmitOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "ok"; matchCode: string | null }
  | { kind: "error"; message: string };

const SOURCE = "doubles_elim_match";

export async function submitDoublesEliminationMatch(input: SubmitInput): Promise<SubmitOutcome> {
  // 1. Idempotency + config gates.
  if (input.alreadySubmitted) {
    return { kind: "skipped", reason: "already-submitted" };
  }
  if (input.ratingSource === "self") {
    return { kind: "skipped", reason: "rating-source-self" };
  }
  const userIds = [
    input.teamA.player1_user_id,
    input.teamA.player2_user_id,
    input.teamB.player1_user_id,
    input.teamB.player2_user_id,
  ];
  if (userIds.some((id) => !id)) {
    return { kind: "skipped", reason: "missing-profile-link" };
  }

  // 2. Resolve DUPR IDs for the 4 players. Single round-trip.
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, dupr_id")
    .in("id", userIds as string[]);
  if (profErr) {
    await writeError(input.matchId, `profiles lookup: ${profErr.message}`);
    return { kind: "error", message: profErr.message };
  }
  const duprMap = new Map<string, string | null>();
  for (const p of (profiles ?? []) as Array<{ id: string; dupr_id: string | null }>) {
    duprMap.set(p.id, p.dupr_id);
  }
  const aP1 = duprMap.get(input.teamA.player1_user_id!);
  const aP2 = duprMap.get(input.teamA.player2_user_id!);
  const bP1 = duprMap.get(input.teamB.player1_user_id!);
  const bP2 = duprMap.get(input.teamB.player2_user_id!);
  if (!aP1 || !aP2 || !bP1 || !bP2) {
    const msg = "missing-dupr-id";
    await writeError(input.matchId, msg);
    return { kind: "skipped", reason: msg };
  }

  // 3. Build CreatePayload. games array → flatten to game1..game5 per team.
  //    DUPR spec: each team carries its OWN score per game (not a single
  //    score_a/score_b for the match). Pickleball doubles default RALLY.
  const games = input.games.slice(0, 5);
  const teamA = {
    player1: aP1,
    player2: aP2,
    game1: games[0]?.score_a ?? 0,
    game2: games[1]?.score_a,
    game3: games[2]?.score_a,
    game4: games[3]?.score_a,
    game5: games[4]?.score_a,
  };
  const teamB = {
    player1: bP1,
    player2: bP2,
    game1: games[0]?.score_b ?? 0,
    game2: games[1]?.score_b,
    game3: games[2]?.score_b,
    game4: games[3]?.score_b,
    game5: games[4]?.score_b,
  };

  const today = new Date().toISOString().slice(0, 10); // yyyy-MM-dd

  const body = {
    action: "create" as const,
    internal_source: SOURCE,
    internal_match_id: input.matchId,
    match_date: today,
    format: "DOUBLES" as const,
    match_type: "RALLY" as const,
    event: input.tournamentName,
    bracket: "Doubles Elimination",
    club_id: input.duprClubId ?? undefined,
    team_a: teamA,
    team_b: teamB,
  };

  // 4. Invoke edge function.
  const { data, error } = await supabase.functions.invoke<{
    matchCode?: string;
    error?: string;
  }>("dupr-match-submit", { body });
  if (error) {
    const msg = (error as Error).message || String(error);
    await writeError(input.matchId, msg);
    return { kind: "error", message: msg };
  }
  if (data?.error) {
    await writeError(input.matchId, data.error);
    return { kind: "error", message: data.error };
  }

  const matchCode = data?.matchCode ?? null;

  // 5. Mirror sync state onto our matches row.
  const { error: updateErr } = await supabase
    .from("doubles_elimination_matches")
    .update({
      dupr_submitted: true,
      dupr_match_code: matchCode,
      dupr_submitted_at: new Date().toISOString(),
      dupr_submit_error: null,
    })
    .eq("id", input.matchId);
  if (updateErr) {
    console.warn("[submitDoublesEliminationMatch] mirror update:", updateErr);
  }
  return { kind: "ok", matchCode };
}

async function writeError(matchId: string, message: string) {
  const truncated = message.length > 500 ? message.slice(0, 500) : message;
  await supabase
    .from("doubles_elimination_matches")
    .update({ dupr_submit_error: truncated })
    .eq("id", matchId);
}
