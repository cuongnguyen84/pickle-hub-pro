import { supabase } from '@/integrations/supabase/client';
import type { FlexMatch, FlexPlayerStats, FlexPairStats } from './useFlexTournament';

interface StatsMap {
  wins: number;
  losses: number;
  pointDiff: number;
}

export function useFlexStats() {
  // Recompute all stats for a group based on its matches
  async function recomputeGroupStats(groupId: string): Promise<boolean> {
    try {
      // 1. Get all matches in this group
      const { data: matches, error: matchesError } = await supabase
        .from('flex_matches')
        .select('*')
        .eq('group_id', groupId);

      if (matchesError) throw matchesError;

      // 2. Calculate stats
      const playerStats = new Map<string, StatsMap>();
      const pairStats = new Map<string, StatsMap>();

      for (const match of (matches || []) as FlexMatch[]) {
        if (!match.winner_side) continue;

        const scoreDiff = Math.abs(match.score_a - match.score_b);

        // Get players on each side
        const sideAPlayers = [match.slot_a1_player_id, match.slot_a2_player_id].filter(Boolean) as string[];
        const sideBPlayers = [match.slot_b1_player_id, match.slot_b2_player_id].filter(Boolean) as string[];

        const winners = match.winner_side === 'a' ? sideAPlayers : sideBPlayers;
        const losers = match.winner_side === 'a' ? sideBPlayers : sideAPlayers;
        const winnerPointDiff = match.winner_side === 'a' ? scoreDiff : -scoreDiff;

        // Update individual player stats
        for (const playerId of winners) {
          const existing = playerStats.get(playerId) || { wins: 0, losses: 0, pointDiff: 0 };
          existing.wins += 1;
          existing.pointDiff += scoreDiff;
          playerStats.set(playerId, existing);
        }

        for (const playerId of losers) {
          const existing = playerStats.get(playerId) || { wins: 0, losses: 0, pointDiff: 0 };
          existing.losses += 1;
          existing.pointDiff -= scoreDiff;
          playerStats.set(playerId, existing);
        }

        // Update pair stats for doubles matches
        if (match.match_type === 'doubles') {
          if (sideAPlayers.length === 2) {
            const pairKey = sideAPlayers.sort().join('|');
            const existing = pairStats.get(pairKey) || { wins: 0, losses: 0, pointDiff: 0 };
            if (match.winner_side === 'a') {
              existing.wins += 1;
              existing.pointDiff += scoreDiff;
            } else {
              existing.losses += 1;
              existing.pointDiff -= scoreDiff;
            }
            pairStats.set(pairKey, existing);
          }

          if (sideBPlayers.length === 2) {
            const pairKey = sideBPlayers.sort().join('|');
            const existing = pairStats.get(pairKey) || { wins: 0, losses: 0, pointDiff: 0 };
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

      // 3. Clear existing stats for this group
      await Promise.all([
        supabase.from('flex_player_stats').delete().eq('group_id', groupId),
        supabase.from('flex_pair_stats').delete().eq('group_id', groupId),
      ]);

      // 4. Insert new stats
      const playerStatsToInsert = Array.from(playerStats.entries()).map(([playerId, stats]) => ({
        group_id: groupId,
        player_id: playerId,
        wins: stats.wins,
        losses: stats.losses,
        point_diff: stats.pointDiff,
      }));

      const pairStatsToInsert = Array.from(pairStats.entries()).map(([pairKey, stats]) => {
        const [player1_id, player2_id] = pairKey.split('|');
        return {
          group_id: groupId,
          player1_id,
          player2_id,
          wins: stats.wins,
          losses: stats.losses,
          point_diff: stats.pointDiff,
        };
      });

      if (playerStatsToInsert.length > 0) {
        await supabase.from('flex_player_stats').insert(playerStatsToInsert);
      }

      if (pairStatsToInsert.length > 0) {
        await supabase.from('flex_pair_stats').insert(pairStatsToInsert);
      }

      return true;
    } catch (error) {
      console.error('Error recomputing group stats:', error);
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

  return {
    recomputeGroupStats,
    getGroupStandings,
    getPairStandings,
  };
}
