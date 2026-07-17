import { supabase } from '@/integrations/supabase/client';
import type { FlexMatch, FlexPlayerStats, FlexPairStats, FlexGroupItem } from './useFlexTournament';
import { computePlayerStats, computePairStats, flexRankSort } from '@/lib/flexStats';

export function useFlexStats() {
  // ARCH-04 pre-work: the pure standings rules (computePlayerStats,
  // computeTeamStats, computePairStats, flexRankSort) moved verbatim to
  // src/lib/flexStats.ts so they can be characterized. This hook keeps the
  // DB-facing recompute/persist flows.

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

      // 2. Get all group items (players/teams in this group)
      const { data: groupItems, error: itemsError } = await supabase
        .from('flex_group_items')
        .select('*')
        .eq('group_id', groupId);

      if (itemsError) throw itemsError;

      // 3. Get only matches that belong to THIS group (not all tournament matches)
      const { data: matches, error: matchesError } = await supabase
        .from('flex_matches')
        .select('*')
        .eq('group_id', groupId)
        .eq('counts_for_standings', true);

      if (matchesError) throw matchesError;

      const typedMatches = (matches || []) as FlexMatch[];
      const typedGroupItems = (groupItems || []) as FlexGroupItem[];
      const includeDoubles = group.include_doubles_in_singles ?? true;

      // Check if this is a team-based group
      const isTeamGroup = typedGroupItems.length > 0 && typedGroupItems[0].item_type === 'team';
      
      // 4. Get player IDs - either from direct player items OR from team members
      let groupPlayerIds: Set<string>;
      
      if (isTeamGroup) {
        // Get team IDs from group items
        const teamIds = typedGroupItems.filter(gi => gi.team_id).map(gi => gi.team_id!);
        
        // Get all team members
        const { data: teamMembers, error: teamMembersError } = await supabase
          .from('flex_team_members')
          .select('player_id')
          .in('team_id', teamIds);
        
        if (teamMembersError) throw teamMembersError;
        
        groupPlayerIds = new Set((teamMembers || []).map(m => m.player_id));
      } else {
        groupPlayerIds = new Set(
          typedGroupItems.filter(gi => gi.item_type === 'player' && gi.player_id).map(gi => gi.player_id!)
        );
      }
      
      // Create fake groupItems with player type for the stats computation
      const virtualPlayerGroupItems: FlexGroupItem[] = Array.from(groupPlayerIds).map(playerId => ({
        id: playerId,
        group_id: groupId,
        player_id: playerId,
        team_id: null as string | null,
        item_type: 'player',
        display_order: 0,
        created_at: new Date().toISOString(),
      }));

      // 5. Compute player stats
      const playerStatsMap = computePlayerStats({
        matches: typedMatches,
        groupItems: virtualPlayerGroupItems,
        includeDoublesInSingles: includeDoubles,
      });

      // 6. Compute pair stats
      const pairStatsMap = computePairStats(typedMatches, groupPlayerIds);

      // 7. Clear existing stats for this group
      await Promise.all([
        supabase.from('flex_player_stats').delete().eq('group_id', groupId),
        supabase.from('flex_pair_stats').delete().eq('group_id', groupId),
      ]);

      // 8. Insert new player stats
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

      // 9. Insert new pair stats
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
    playerStats: FlexPlayerStats[]
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
      .sort(flexRankSort);
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
      .sort(flexRankSort);
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
