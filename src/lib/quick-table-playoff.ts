/**
 * Playoff bracket logic for Quick Table tournaments with 6 groups.
 * Handles global seeding, pairing, and group-conflict resolution.
 * Pure functions — no side effects, no Supabase calls.
 */

import type { QuickTablePlayer, QuickTableMatch, QuickTableGroup } from '@/hooks/useQuickTable';

export interface SeededPlayer {
  playerId: string;
  name: string;
  seed: number;
  sourceGroupId: string;
  wins: number;
  pointDiff: number;
  pointsFor: number;
  tier: 'winner' | 'runner_up' | 'wildcard';
}

export interface BracketPairing {
  player1: SeededPlayer;
  player2: SeededPlayer;
  matchNumber: number;
}

export interface ConflictResolutionResult {
  pairings: BracketPairing[];
  hasConflicts: boolean;
  unresolvedPairs: number[];
}

/**
 * Compute point_diff for a 3rd-place player counting ONLY matches
 * against the top-2 players in their group.
 */
export function computeBest3rdAdjustedStats(
  player: QuickTablePlayer,
  allMatches: QuickTableMatch[],
  top2PlayerIds: Set<string>
): { adjustedPointDiff: number; adjustedPointsFor: number; adjustedWins: number } {
  let adjustedPointDiff = 0;
  let adjustedPointsFor = 0;
  let adjustedWins = 0;

  for (const m of allMatches) {
    if (m.score1 === null || m.score2 === null) continue;

    if (m.player1_id === player.id && top2PlayerIds.has(m.player2_id || '')) {
      adjustedPointDiff += m.score1 - m.score2;
      adjustedPointsFor += m.score1;
      if (m.score1 > m.score2) adjustedWins++;
    } else if (m.player2_id === player.id && top2PlayerIds.has(m.player1_id || '')) {
      adjustedPointDiff += m.score2 - m.score1;
      adjustedPointsFor += m.score2;
      if (m.score2 > m.score1) adjustedWins++;
    }
  }

  return { adjustedPointDiff, adjustedPointsFor, adjustedWins };
}

/**
 * Rank players within a single group by matches_won DESC, point_diff DESC.
 */
function rankGroupPlayers(
  players: QuickTablePlayer[],
  groupId: string
): QuickTablePlayer[] {
  return players
    .filter(p => p.group_id === groupId)
    .sort((a, b) => {
      if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
      if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
      return b.points_for - a.points_for;
    });
}

/**
 * Generate global seeding for 6-group playoff (16 players).
 *
 * Seeds 1-6:  group winners sorted by wins DESC, point_diff DESC
 * Seeds 7-12: runners-up sorted by wins DESC, point_diff DESC
 * Seeds 13-16: best 4 third-place, sorted by adjusted stats (vs top-2 only)
 */
export function generateGlobalSeeding(
  groups: QuickTableGroup[],
  players: QuickTablePlayer[],
  matches: QuickTableMatch[]
): SeededPlayer[] {
  if (groups.length !== 6) {
    throw new Error(`generateGlobalSeeding expects 6 groups, got ${groups.length}`);
  }

  const winners: Array<QuickTablePlayer & { groupId: string }> = [];
  const runnersUp: Array<QuickTablePlayer & { groupId: string }> = [];
  const thirdPlace: Array<QuickTablePlayer & { groupId: string }> = [];
  const top2ByGroup = new Map<string, Set<string>>();

  for (const group of groups) {
    const ranked = rankGroupPlayers(players, group.id);
    if (ranked.length < 2) {
      throw new Error(`Group ${group.name} has fewer than 2 players`);
    }

    const top2Ids = new Set<string>();
    if (ranked[0]) {
      winners.push({ ...ranked[0], groupId: group.id });
      top2Ids.add(ranked[0].id);
    }
    if (ranked[1]) {
      runnersUp.push({ ...ranked[1], groupId: group.id });
      top2Ids.add(ranked[1].id);
    }
    if (ranked[2]) {
      thirdPlace.push({ ...ranked[2], groupId: group.id });
    }
    top2ByGroup.set(group.id, top2Ids);
  }

  const sortByStats = (a: QuickTablePlayer, b: QuickTablePlayer): number => {
    if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
    if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
    return b.points_for - a.points_for;
  };

  winners.sort(sortByStats);
  runnersUp.sort(sortByStats);

  // Best 3rd: sort by adjusted stats (only matches vs top-2 in their group)
  const groupMatches = matches.filter(m => !m.is_playoff);
  const thirdPlaceWithAdjusted = thirdPlace.map(p => {
    const top2Ids = top2ByGroup.get(p.groupId) || new Set<string>();
    const adjusted = computeBest3rdAdjustedStats(p, groupMatches, top2Ids);
    return { ...p, adjusted };
  });

  thirdPlaceWithAdjusted.sort((a, b) => {
    if (b.adjusted.adjustedWins !== a.adjusted.adjustedWins) {
      return b.adjusted.adjustedWins - a.adjusted.adjustedWins;
    }
    if (b.adjusted.adjustedPointDiff !== a.adjusted.adjustedPointDiff) {
      return b.adjusted.adjustedPointDiff - a.adjusted.adjustedPointDiff;
    }
    return b.adjusted.adjustedPointsFor - a.adjusted.adjustedPointsFor;
  });

  const best4Third = thirdPlaceWithAdjusted.slice(0, 4);

  const seeded: SeededPlayer[] = [];
  let seed = 1;

  for (const w of winners) {
    seeded.push({
      playerId: w.id,
      name: w.name,
      seed: seed++,
      sourceGroupId: w.groupId,
      wins: w.matches_won,
      pointDiff: w.point_diff,
      pointsFor: w.points_for,
      tier: 'winner',
    });
  }
  for (const r of runnersUp) {
    seeded.push({
      playerId: r.id,
      name: r.name,
      seed: seed++,
      sourceGroupId: r.groupId,
      wins: r.matches_won,
      pointDiff: r.point_diff,
      pointsFor: r.points_for,
      tier: 'runner_up',
    });
  }
  for (const t of best4Third) {
    seeded.push({
      playerId: t.id,
      name: t.name,
      seed: seed++,
      sourceGroupId: t.groupId,
      wins: t.matches_won,
      pointDiff: t.point_diff,
      pointsFor: t.points_for,
      tier: 'wildcard',
    });
  }

  return seeded;
}

/**
 * Create classic bracket pairings: 1v16, 2v15, ..., 8v9.
 */
export function generateSeededPairings(seeded: SeededPlayer[]): BracketPairing[] {
  if (seeded.length !== 16) {
    throw new Error(`generateSeededPairings expects 16 players, got ${seeded.length}`);
  }

  const pairings: BracketPairing[] = [];
  for (let i = 0; i < 8; i++) {
    pairings.push({
      player1: seeded[i],
      player2: seeded[15 - i],
      matchNumber: i + 1,
    });
  }
  return pairings;
}

/**
 * Resolve group conflicts: if two players in a pairing come from the same group,
 * swap lower seeds between pairs to eliminate conflicts.
 *
 * Max recursion depth = 3 to prevent infinite loops.
 */
export function resolveGroupConflicts(
  pairings: BracketPairing[],
  maxDepth: number = 3
): ConflictResolutionResult {
  if (maxDepth <= 0) {
    const unresolvedPairs = pairings
      .map((p, i) => (p.player1.sourceGroupId === p.player2.sourceGroupId ? i : -1))
      .filter(i => i >= 0);
    return {
      pairings,
      hasConflicts: unresolvedPairs.length > 0,
      unresolvedPairs,
    };
  }

  const conflicts: number[] = [];
  for (let i = 0; i < pairings.length; i++) {
    if (pairings[i].player1.sourceGroupId === pairings[i].player2.sourceGroupId) {
      conflicts.push(i);
    }
  }

  if (conflicts.length === 0) {
    return { pairings, hasConflicts: false, unresolvedPairs: [] };
  }

  // Deep clone pairings to avoid mutation
  const resolved = pairings.map(p => ({ ...p }));

  for (const conflictIndex of conflicts) {
    // Re-check after previous swaps
    if (resolved[conflictIndex].player1.sourceGroupId !== resolved[conflictIndex].player2.sourceGroupId) {
      continue;
    }

    const lowerSeed = resolved[conflictIndex].player2;
    let bestSwapTarget: number | null = null;
    let bestSwapDistance = Infinity;

    for (let j = 0; j < resolved.length; j++) {
      if (j === conflictIndex) continue;

      const candidate = resolved[j].player2;

      const wouldConflictHere =
        candidate.sourceGroupId === resolved[conflictIndex].player1.sourceGroupId;
      const wouldConflictThere =
        lowerSeed.sourceGroupId === resolved[j].player1.sourceGroupId;

      if (!wouldConflictHere && !wouldConflictThere) {
        const distance = Math.abs(conflictIndex - j);
        if (distance < bestSwapDistance) {
          bestSwapTarget = j;
          bestSwapDistance = distance;
        }
      }
    }

    if (bestSwapTarget !== null) {
      const temp = resolved[conflictIndex].player2;
      resolved[conflictIndex] = { ...resolved[conflictIndex], player2: resolved[bestSwapTarget].player2 };
      resolved[bestSwapTarget] = { ...resolved[bestSwapTarget], player2: temp };
    }
  }

  // Recursive re-check
  return resolveGroupConflicts(resolved, maxDepth - 1);
}
