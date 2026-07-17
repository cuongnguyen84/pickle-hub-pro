// ARCH-04 pre-work: the Flex standings rules, moved verbatim out of
// src/hooks/useFlexStats.ts so they can be characterized before the
// shared-scoring-core refactor. Swift twin: FlexData.singlesStandings /
// pairStandings / teamStandings + rankSort in
// apple/.../Core/Flex/FlexModels.swift. Mirror tests:
// apple/Tests/FlexStandingsTests.swift — keep the shared-rule cases
// case-for-case identical. Rule changes happen here and in the Swift twin,
// never in components.

import type { FlexMatch, FlexGroupItem } from "@/hooks/useFlexTournament";

export interface FlexStatLine {
  wins: number;
  losses: number;
  pointDiff: number;
}

export interface FlexComputeStatsParams {
  matches: FlexMatch[];
  groupItems: FlexGroupItem[];
  includeDoublesInSingles: boolean;
}

/**
 * Compute player stats for a group based on CHILD MATCHES (individual matches within team matches)
 * - Only counts matches where counts_for_standings = true
 * - For singles tab: optionally include doubles matches
 * - A player gets credit if they are in groupItems (directly or via team membership)
 * - Each match = 1 win or 1 loss (not based on score difference)
 * - Point difference is score_a - score_b for perspective of each player
 */
export function computePlayerStats(params: FlexComputeStatsParams): Map<string, FlexStatLine> {
  const { matches, groupItems, includeDoublesInSingles } = params;
  const playerStats = new Map<string, FlexStatLine>();

  // Get player IDs that are in this group
  const groupPlayerIds = new Set(
    groupItems.filter(gi => gi.item_type === 'player' && gi.player_id).map(gi => gi.player_id!)
  );

  for (const match of matches) {
    // Skip matches that don't count for standings
    if (!match.counts_for_standings) continue;

    // Skip matches without a winner
    if (!match.winner_side) continue;

    // Determine if we should include this match
    const isDoubles = match.match_type === 'doubles';
    if (isDoubles && !includeDoublesInSingles) continue;

    // Calculate point difference (absolute) for the match
    const scoreDiff = Math.abs(match.score_a - match.score_b);

    // Get all players on each side
    const sideAPlayers = [match.slot_a1_player_id, match.slot_a2_player_id].filter(Boolean) as string[];
    const sideBPlayers = [match.slot_b1_player_id, match.slot_b2_player_id].filter(Boolean) as string[];

    const winnersPlayers = match.winner_side === 'a' ? sideAPlayers : sideBPlayers;
    const losersPlayers = match.winner_side === 'a' ? sideBPlayers : sideAPlayers;

    // Update stats for winners who are in this group
    // Each player gets +1 win and +scoreDiff
    for (const playerId of winnersPlayers) {
      if (!groupPlayerIds.has(playerId)) continue;

      const existing = playerStats.get(playerId) || { wins: 0, losses: 0, pointDiff: 0 };
      existing.wins += 1;
      existing.pointDiff += scoreDiff;
      playerStats.set(playerId, existing);
    }

    // Update stats for losers who are in this group
    // Each player gets +1 loss and -scoreDiff
    for (const playerId of losersPlayers) {
      if (!groupPlayerIds.has(playerId)) continue;

      const existing = playerStats.get(playerId) || { wins: 0, losses: 0, pointDiff: 0 };
      existing.losses += 1;
      existing.pointDiff -= scoreDiff;
      playerStats.set(playerId, existing);
    }
  }

  return playerStats;
}

/**
 * Compute TEAM stats for a group based on TEAM MATCHES (parent matches with slot_a_team_id/slot_b_team_id)
 * - Only counts matches where counts_for_standings = true and has team assignments
 * - Each team match = 1 win or 1 loss for the team (winner determined by score comparison)
 * - Point difference is score_a - score_b (team match score, not child match sum)
 */
export function computeTeamStats(matches: FlexMatch[], groupTeamIds: Set<string>): Map<string, FlexStatLine> {
  const teamStats = new Map<string, FlexStatLine>();

  for (const match of matches) {
    // Only count team matches (with team assignments)
    if (!match.slot_a_team_id && !match.slot_b_team_id) continue;

    // Skip matches that don't count for standings
    if (!match.counts_for_standings) continue;

    // Skip matches without a winner
    if (!match.winner_side) continue;

    const scoreDiff = Math.abs(match.score_a - match.score_b);
    const teamAId = match.slot_a_team_id;
    const teamBId = match.slot_b_team_id;

    // Update stats for Team A
    if (teamAId && groupTeamIds.has(teamAId)) {
      const existing = teamStats.get(teamAId) || { wins: 0, losses: 0, pointDiff: 0 };
      if (match.winner_side === 'a') {
        existing.wins += 1;
        existing.pointDiff += scoreDiff;
      } else {
        existing.losses += 1;
        existing.pointDiff -= scoreDiff;
      }
      teamStats.set(teamAId, existing);
    }

    // Update stats for Team B
    if (teamBId && groupTeamIds.has(teamBId)) {
      const existing = teamStats.get(teamBId) || { wins: 0, losses: 0, pointDiff: 0 };
      if (match.winner_side === 'b') {
        existing.wins += 1;
        existing.pointDiff += scoreDiff;
      } else {
        existing.losses += 1;
        existing.pointDiff -= scoreDiff;
      }
      teamStats.set(teamBId, existing);
    }
  }

  return teamStats;
}

/**
 * Compute pair stats for doubles matches
 * Each unique pair (sorted by ID) is a separate entry
 */
export function computePairStats(matches: FlexMatch[], groupPlayerIds: Set<string>): Map<string, FlexStatLine & { player1_id: string; player2_id: string }> {
  const pairStats = new Map<string, FlexStatLine & { player1_id: string; player2_id: string }>();

  for (const match of matches) {
    // Only count doubles matches with standings
    if (match.match_type !== 'doubles') continue;
    if (!match.counts_for_standings) continue;
    if (!match.winner_side) continue;

    const scoreDiff = Math.abs(match.score_a - match.score_b);

    // Get pairs on each side
    const sideAPlayers = [match.slot_a1_player_id, match.slot_a2_player_id].filter(Boolean) as string[];
    const sideBPlayers = [match.slot_b1_player_id, match.slot_b2_player_id].filter(Boolean) as string[];

    // Process side A pair
    if (sideAPlayers.length === 2) {
      // Check if at least one player is in the group
      const inGroup = sideAPlayers.some(p => groupPlayerIds.has(p));
      if (inGroup) {
        const [p1, p2] = sideAPlayers.sort();
        const pairKey = `${p1}|${p2}`;
        const existing = pairStats.get(pairKey) || { wins: 0, losses: 0, pointDiff: 0, player1_id: p1, player2_id: p2 };

        if (match.winner_side === 'a') {
          existing.wins += 1;
          existing.pointDiff += scoreDiff;
        } else {
          existing.losses += 1;
          existing.pointDiff -= scoreDiff;
        }
        pairStats.set(pairKey, existing);
      }
    }

    // Process side B pair
    if (sideBPlayers.length === 2) {
      const inGroup = sideBPlayers.some(p => groupPlayerIds.has(p));
      if (inGroup) {
        const [p1, p2] = sideBPlayers.sort();
        const pairKey = `${p1}|${p2}`;
        const existing = pairStats.get(pairKey) || { wins: 0, losses: 0, pointDiff: 0, player1_id: p1, player2_id: p2 };

        if (match.winner_side === 'b') {
          existing.wins += 1;
          existing.pointDiff += scoreDiff;
        } else {
          existing.losses += 1;
          existing.pointDiff -= scoreDiff;
        }
        pairStats.set(pairKey, existing);
      }
    }
  }

  return pairStats;
}

/** Standings sort: wins desc, then point diff desc. Swift twin: rankSort. */
export function flexRankSort(
  a: { wins: number; pointDiff: number },
  b: { wins: number; pointDiff: number },
): number {
  if (b.wins !== a.wins) return b.wins - a.wins;
  return b.pointDiff - a.pointDiff;
}
