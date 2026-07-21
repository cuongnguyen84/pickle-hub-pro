// Team Match playoff propagation — ARCH-03.
//
// Lifted out of useTeamMatchMatches.updateMatchResultMutation so the bracket
// side effects are reachable without react-query: this is the only path that
// writes teams into a match nobody has scored yet, and it was the one piece of
// Team Match orchestration with no test at all.
//
// Pinned by src/lib/__tests__/teamMatchAdvancement.test.ts.

import { supabase } from '@/integrations/supabase/client';
import { buildTeamMatchGames } from '@/lib/teamMatchGames';

/** The fields of the just-completed match that decide where results flow. */
export interface CompletedPlayoffMatch {
  next_match_id: string | null;
  next_match_slot: number | null;
  is_playoff: boolean | null;
  is_repechage?: boolean | null;
  playoff_round: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
}

type SlotField = 'team_a_id' | 'team_b_id';

/**
 * Seed the game slots for a match that just had both teams assigned.
 *
 * Idempotent under concurrency, not just on paper. The existence pre-check is a
 * cheap fast path, but two propagations can pass it at the same instant (both
 * semifinals resolving at once, or a re-scored playoff), so the insert itself
 * must also be safe: it upserts on the `(match_id, order_index)` UNIQUE
 * constraint with duplicates ignored, so the second writer no-ops at the DB
 * instead of doubling the game list. Shared by the third-place and next-match
 * paths, which used to carry byte-identical copies of this block.
 */
export async function createGamesIfMissing(
  matchId: string,
  tournamentId: string,
  hasDreambreaker: boolean,
): Promise<void> {
  const { data: existingGames } = await supabase
    .from('team_match_games')
    .select('id')
    .eq('match_id', matchId)
    .limit(1);

  if (existingGames && existingGames.length > 0) return;

  const { data: templates } = await supabase
    .from('team_match_game_templates')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('order_index');

  if (!templates || templates.length === 0) return;

  const games = buildTeamMatchGames(templates, matchId, hasDreambreaker);
  if (games.length > 0) {
    await supabase
      .from('team_match_games')
      .upsert(games, { onConflict: 'match_id,order_index', ignoreDuplicates: true });
  }
}

/**
 * Claim one empty slot of `matchId` for `teamId`.
 *
 * DB-00 confirmed this race shape; DB-02a fixed it for DoublesElimination and
 * never covered Team Match. Two semifinals finishing at once both read the
 * same empty third-place match, both picked `team_a_id`, and the second
 * unguarded UPDATE clobbered the first — one losing team silently vanished
 * from the bracket.
 *
 * `.is(field, null)` makes each write a claim: Postgres serializes the row, so
 * exactly one claimer matches and the loser falls through to the next slot.
 * Returns the match id when the team is seated, null when there was no room.
 */
export async function claimEmptySlot(
  matchId: string,
  teamId: string,
  current: { team_a_id: string | null; team_b_id: string | null },
): Promise<string | null> {
  // Re-scoring a match must not seat the same team twice.
  if (current.team_a_id === teamId || current.team_b_id === teamId) return matchId;

  for (const field of ['team_a_id', 'team_b_id'] as const satisfies readonly SlotField[]) {
    if (current[field]) continue;
    const { data: claimed } = await supabase
      .from('team_match_matches')
      .update({ [field]: teamId } as { team_a_id?: string; team_b_id?: string })
      .eq('id', matchId)
      .is(field, null)
      .select('id')
      .maybeSingle();
    if (claimed) return claimed.id;
    // Slot was taken by a concurrent propagation — try the next one.
  }

  return null;
}

/** Create the games for `matchId` once both of its slots are filled. */
async function seedGamesWhenReady(
  matchId: string,
  tournamentId: string,
  hasDreambreaker: boolean,
): Promise<void> {
  // Re-read: a concurrent propagation may have filled the other slot after
  // our own write landed.
  const { data: match } = await supabase
    .from('team_match_matches')
    .select('id, team_a_id, team_b_id')
    .eq('id', matchId)
    .maybeSingle();

  if (match?.team_a_id && match?.team_b_id) {
    await createGamesIfMissing(match.id, tournamentId, hasDreambreaker);
  }
}

/**
 * Advance a completed playoff match: winner to the next round, semifinal loser
 * to the third-place match, and games seeded for whichever of those is now
 * ready to be played. No-op for non-playoff or undecided matches.
 */
export async function advancePlayoffResult(
  match: CompletedPlayoffMatch,
  {
    winnerId,
    tournamentId,
    hasDreambreaker,
  }: { winnerId: string | null; tournamentId: string; hasDreambreaker?: boolean },
): Promise<void> {
  if (!match.is_playoff || !winnerId || !match.next_match_id) return;

  // The next-round slot is assigned at bracket generation (1 = A, 2 = B), so
  // sibling matches write disjoint columns and cannot lose each other's
  // update — no claim needed on that path.
  //
  // But nothing at the DB level ENFORCES that slot is 1 or 2. A NULL used to
  // fall into the `team_b_id` branch, so two siblings that both had a NULL
  // slot would both write team_b_id and the second would clobber the first —
  // reintroducing exactly the lost-update bug this module fixes for the
  // third-place match. Prod currently has zero rows with next_match_id set and
  // next_match_slot NULL, so the invariant holds today; it just holds by
  // convention. Treat an unknown slot as "claim whatever is free" instead of
  // guessing, which is correct under concurrency and costs one extra read on a
  // path that should never execute.
  if (match.next_match_slot === 1 || match.next_match_slot === 2) {
    const nextField: SlotField = match.next_match_slot === 1 ? 'team_a_id' : 'team_b_id';

    const { error: advanceError } = await supabase
      .from('team_match_matches')
      .update({ [nextField]: winnerId } as { team_a_id?: string; team_b_id?: string })
      .eq('id', match.next_match_id);

    if (advanceError) throw advanceError;
  } else {
    const { data: nextMatch, error: readError } = await supabase
      .from('team_match_matches')
      .select('id, team_a_id, team_b_id')
      .eq('id', match.next_match_id)
      .maybeSingle();

    if (readError) throw readError;
    if (nextMatch) {
      await claimEmptySlot(nextMatch.id, winnerId, nextMatch);
    }
  }

  // Semifinal (playoff_round 2) losers meet in the third-place match. Nhánh
  // Tái sinh không có trận tranh hạng 3 → bỏ qua.
  if (match.playoff_round === 2 && !match.is_repechage) {
    const loserId = match.team_a_id === winnerId ? match.team_b_id : match.team_a_id;

    if (loserId) {
      const { data: thirdPlaceMatch } = await supabase
        .from('team_match_matches')
        .select('id, team_a_id, team_b_id')
        .eq('tournament_id', tournamentId)
        .eq('is_third_place', true)
        .maybeSingle();

      if (thirdPlaceMatch) {
        const seated = await claimEmptySlot(thirdPlaceMatch.id, loserId, thirdPlaceMatch);
        if (seated) {
          await seedGamesWhenReady(seated, tournamentId, !!hasDreambreaker);
        }
      }
    }
  }

  await seedGamesWhenReady(match.next_match_id, tournamentId, !!hasDreambreaker);
}
