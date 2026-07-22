import type { FlexPlayerStats, FlexPairStats } from './useFlexTournament';
import { computePlayerStats, computePairStats, flexRankSort } from '@/lib/flexStats';

export function useFlexStats() {
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

  return {
    computePlayerStats,
    computePairStats,
    getGroupStandings,
    getPairStandings,
  };
}
