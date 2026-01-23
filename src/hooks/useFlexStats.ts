import { supabase } from '@/integrations/supabase/client';
import type { FlexMatch, FlexPlayerStats, FlexPairStats, FlexGroupItem } from './useFlexTournament';

interface StatsMap {
  wins: number;
  losses: number;
  pointDiff: number;
}

interface ComputeStatsParams {
  matches: FlexMatch[];
  groupItems: FlexGroupItem[];
  includeDoublesInSingles: boolean;
}

export function useFlexStats() {
  /**
   * Compute player stats for a group based on matches
   * - Only counts matches where counts_for_standings = true
   * - For singles tab: optionally include doubles matches
   * - A player gets credit in a group if they are in groupItems
   */
  function computePlayerStats(params: ComputeStatsParams): Map<string, StatsMap> {
    const { matches, groupItems, includeDoublesInSingles } = params;
    const playerStats = new Map<string, StatsMap>();

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

      const scoreDiff = Math.abs(match.score_a - match.score_b);

      // Get all players on each side
      const sideAPlayers = [match.slot_a1_player_id, match.slot_a2_player_id].filter(Boolean) as string[];
      const sideBPlayers = [match.slot_b1_player_id, match.slot_b2_player_id].filter(Boolean) as string[];

      const winnersPlayers = match.winner_side === 'a' ? sideAPlayers : sideBPlayers;
      const losersPlayers = match.winner_side === 'a' ? sideBPlayers : sideAPlayers;

      // Update stats for winners who are in this group
      for (const playerId of winnersPlayers) {
        if (!groupPlayerIds.has(playerId)) continue;
        
        const existing = playerStats.get(playerId) || { wins: 0, losses: 0, pointDiff: 0 };
        existing.wins += 1;
        existing.pointDiff += scoreDiff;
        playerStats.set(playerId, existing);
      }

      // Update stats for losers who are in this group
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
   * Compute pair stats for doubles matches
   * Each unique pair (sorted by ID) is a separate entry
   */
  function computePairStats(matches: FlexMatch[], groupPlayerIds: Set<string>): Map<string, StatsMap & { player1_id: string; player2_id: string }> {
    const pairStats = new Map<string, StatsMap & { player1_id: string; player2_id: string }>();

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

  // Recompute all stats for a group based on its matches (legacy support)
  async function recomputeGroupStats(groupId: string): Promise<boolean> {
    try {
      // 1. Get the group to check include_doubles_in_singles setting
      const { data: group, error: groupError } = await supabase
        .from('flex_groups')
        .select('*, tournament_id, include_doubles_in_singles')
        .eq('id', groupId)
        .single();

      if (groupError || !group) throw groupError;

      // 2. Get all group items (players in this group)
      const { data: groupItems, error: itemsError } = await supabase
        .from('flex_group_items')
        .select('*')
        .eq('group_id', groupId);

      if (itemsError) throw itemsError;

      // 3. Get all matches in the tournament that count for standings
      const { data: matches, error: matchesError } = await supabase
        .from('flex_matches')
        .select('*')
        .eq('tournament_id', group.tournament_id)
        .eq('counts_for_standings', true);

      if (matchesError) throw matchesError;

      const typedMatches = (matches || []) as FlexMatch[];
      const typedGroupItems = (groupItems || []) as FlexGroupItem[];
      const includeDoubles = group.include_doubles_in_singles ?? true;

      // 4. Compute player stats
      const playerStatsMap = computePlayerStats({
        matches: typedMatches,
        groupItems: typedGroupItems,
        includeDoublesInSingles: includeDoubles,
      });

      // 5. Compute pair stats
      const groupPlayerIds = new Set(
        typedGroupItems.filter(gi => gi.item_type === 'player' && gi.player_id).map(gi => gi.player_id!)
      );
      const pairStatsMap = computePairStats(typedMatches, groupPlayerIds);

      // 6. Clear existing stats for this group
      await Promise.all([
        supabase.from('flex_player_stats').delete().eq('group_id', groupId),
        supabase.from('flex_pair_stats').delete().eq('group_id', groupId),
      ]);

      // 7. Insert new player stats
      const playerStatsToInsert = Array.from(playerStatsMap.entries()).map(([playerId, stats]) => ({
        group_id: groupId,
        player_id: playerId,
        wins: stats.wins,
        losses: stats.losses,
        point_diff: stats.pointDiff,
      }));

      if (playerStatsToInsert.length > 0) {
        await supabase.from('flex_player_stats').insert(playerStatsToInsert);
      }

      // 8. Insert new pair stats
      const pairStatsToInsert = Array.from(pairStatsMap.values()).map(stats => ({
        group_id: groupId,
        player1_id: stats.player1_id,
        player2_id: stats.player2_id,
        wins: stats.wins,
        losses: stats.losses,
        point_diff: stats.pointDiff,
      }));

      if (pairStatsToInsert.length > 0) {
        await supabase.from('flex_pair_stats').insert(pairStatsToInsert);
      }

      return true;
    } catch (error) {
      console.error('Error recomputing group stats:', error);
      return false;
    }
  }

  // Recompute stats for ALL groups in a tournament (used when match changes)
  async function recomputeAllGroupStats(tournamentId: string): Promise<boolean> {
    try {
      const { data: groups, error } = await supabase
        .from('flex_groups')
        .select('id')
        .eq('tournament_id', tournamentId);

      if (error) throw error;

      for (const group of (groups || [])) {
        await recomputeGroupStats(group.id);
      }

      return true;
    } catch (error) {
      console.error('Error recomputing all group stats:', error);
      return false;
    }
  }

  // Get standings for a group (sorted by wins, then point diff)
  function getGroupStandings(
    groupItems: { id: string; name: string; type: 'player' | 'team' }[],
    playerStats: FlexPlayerStats[],
    players: { id: string; name: string }[]
  ) {
    const statsMap = new Map<string, { wins: number; losses: number; pointDiff: number }>();
    
    for (const stat of playerStats) {
      statsMap.set(stat.player_id, {
        wins: stat.wins,
        losses: stat.losses,
        pointDiff: stat.point_diff,
      });
    }

    return groupItems
      .map(item => {
        const stats = statsMap.get(item.id) || { wins: 0, losses: 0, pointDiff: 0 };
        return {
          ...item,
          ...stats,
        };
      })
      .sort((a, b) => {
        // Sort by wins desc, then point diff desc
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointDiff - a.pointDiff;
      });
  }

  // Get pair standings for doubles
  function getPairStandings(
    pairStats: FlexPairStats[],
    players: { id: string; name: string }[]
  ) {
    const playerMap = new Map(players.map(p => [p.id, p.name]));

    return pairStats
      .map(stat => ({
        player1Id: stat.player1_id,
        player2Id: stat.player2_id,
        name: `${playerMap.get(stat.player1_id) || 'Unknown'} / ${playerMap.get(stat.player2_id) || 'Unknown'}`,
        wins: stat.wins,
        losses: stat.losses,
        pointDiff: stat.point_diff,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointDiff - a.pointDiff;
      });
  }

  // Update include_doubles_in_singles setting for a group
  async function updateGroupIncludeDoubles(groupId: string, includeDoubles: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('flex_groups')
      .update({ include_doubles_in_singles: includeDoubles })
      .eq('id', groupId);

    if (error) {
      console.error('Error updating include_doubles_in_singles:', error);
      return false;
    }

    // Recompute stats after changing the setting
    await recomputeGroupStats(groupId);
    return true;
  }

  return {
    computePlayerStats,
    computePairStats,
    recomputeGroupStats,
    recomputeAllGroupStats,
    getGroupStandings,
    getPairStandings,
    updateGroupIncludeDoubles,
  };
}
