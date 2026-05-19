/**
 * Pure utility functions for Quick Table tournament logic
 * No side effects, no Supabase calls — can be unit tested independently
 */

export interface GroupSuggestion {
  groupCount: number;
  playersPerGroup: number[];
  isRecommended: boolean;
  reason: string;
  wildcardNeeded: number;
  totalPlayoffSpots: number;
}

export function suggestGroupConfigs(playerCount: number): GroupSuggestion[] {
  const validGroupCounts = [2, 3, 4, 6, 8];
  const suggestions: GroupSuggestion[] = [];

  for (const k of validGroupCounts) {
    if (k > playerCount) continue;
    
    const basePerGroup = Math.floor(playerCount / k);
    const remainder = playerCount % k;
    
    const minSize = basePerGroup;
    const maxSize = remainder > 0 ? basePerGroup + 1 : basePerGroup;
    
    if (minSize < 3 || maxSize > 6) continue;
    if (maxSize - minSize > 1) continue;
    
    const playersPerGroup: number[] = [];
    const largerGroupIndices = new Set<number>();
    while (largerGroupIndices.size < remainder) {
      largerGroupIndices.add(Math.floor(Math.random() * k));
    }
    for (let i = 0; i < k; i++) {
      playersPerGroup.push(largerGroupIndices.has(i) ? basePerGroup + 1 : basePerGroup);
    }
    
    const topPerGroup = 2;
    const directSpots = k * topPerGroup;
    
    let idealPlayoffSize = 4;
    if (directSpots >= 6) idealPlayoffSize = 8;
    if (directSpots >= 12) idealPlayoffSize = 16;
    if (directSpots >= 24) idealPlayoffSize = 32;
    
    const wildcardNeeded = Math.max(0, idealPlayoffSize - directSpots);
    
    let isRecommended = false;
    let reason = '';
    
    if (wildcardNeeded === 0) {
      isRecommended = true;
      reason = 'Không cần wildcard, vào thẳng playoff';
    } else if (wildcardNeeded <= 4) {
      reason = `Cần ${wildcardNeeded} wildcard`;
    } else {
      reason = `Cần ${wildcardNeeded} wildcard (không khuyến nghị)`;
    }
    
    if ((k === 4 || k === 8) && wildcardNeeded === 0) {
      isRecommended = true;
    }
    
    suggestions.push({
      groupCount: k,
      playersPerGroup,
      isRecommended,
      reason,
      wildcardNeeded,
      totalPlayoffSpots: idealPlayoffSize,
    });
  }
  
  const recommended = suggestions.find(s => s.wildcardNeeded === 0);
  if (recommended) {
    suggestions.forEach(s => {
      if (s !== recommended) s.isRecommended = false;
    });
  } else if (suggestions.length > 0) {
    const sorted = [...suggestions].sort((a, b) => a.wildcardNeeded - b.wildcardNeeded);
    sorted[0].isRecommended = true;
    suggestions.forEach(s => {
      if (s !== sorted[0]) s.isRecommended = false;
    });
  }
  
  return suggestions;
}

export function generateRoundRobinMatches(playerIds: string[]): Array<{ player1: string; player2: string }> {
  const matches: Array<{ player1: string; player2: string }> = [];
  
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      matches.push({ player1: playerIds[i], player2: playerIds[j] });
    }
  }
  
  return matches;
}

export function distributePlayersToGroups(
  players: Array<{ id: string; name: string; team?: string; seed?: number }>,
  groupCount: number
): Array<Array<{ id: string; name: string; team?: string; seed?: number }>> {
  const playerCount = players.length;
  const basePerGroup = Math.floor(playerCount / groupCount);
  const remainder = playerCount % groupCount;
  
  const targetSizes: number[] = Array(groupCount).fill(basePerGroup);
  for (let i = 0; i < remainder; i++) {
    targetSizes[i]++;
  }
  
  const seeded = players.filter(p => p.seed != null && p.seed > 0).sort((a, b) => a.seed! - b.seed!);
  const unseeded = players.filter(p => p.seed == null || p.seed <= 0);
  
  for (let i = unseeded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unseeded[i], unseeded[j]] = [unseeded[j], unseeded[i]];
  }
  
  const groups: Array<Array<typeof players[0]>> = Array.from({ length: groupCount }, () => []);
  
  const getTeamCount = (groupIdx: number, team: string | undefined): number => {
    if (!team) return 0;
    return groups[groupIdx].filter(p => p.team === team).length;
  };
  
  const isGroupFull = (groupIdx: number): boolean => {
    return groups[groupIdx].length >= targetSizes[groupIdx];
  };
  
  const findBestGroupForPlayer = (player: typeof players[0], preferredGroups?: number[]): number => {
    const availableIndices = Array.from({ length: groupCount }, (_, i) => i)
      .filter(i => !isGroupFull(i));
    
    if (availableIndices.length === 0) return 0;
    
    const candidates = preferredGroups 
      ? preferredGroups.filter(i => !isGroupFull(i))
      : availableIndices;
    
    if (candidates.length === 0) return availableIndices[0];
    
    if (!player.team) return candidates[0];
    
    const groupsWithoutTeammate = candidates.filter(i => getTeamCount(i, player.team) === 0);
    
    if (groupsWithoutTeammate.length > 0) return groupsWithoutTeammate[0];
    
    const sortedByTeammates = candidates.sort((a, b) => {
      return getTeamCount(a, player.team) - getTeamCount(b, player.team);
    });
    
    return sortedByTeammates[0];
  };
  
  let snakeDirection = 1;
  let currentGroupIndex = 0;
  
  for (const player of seeded) {
    const preferredOrder: number[] = [];
    if (snakeDirection === 1) {
      for (let i = currentGroupIndex; i < groupCount; i++) preferredOrder.push(i);
      for (let i = currentGroupIndex - 1; i >= 0; i--) preferredOrder.push(i);
    } else {
      for (let i = currentGroupIndex; i >= 0; i--) preferredOrder.push(i);
      for (let i = currentGroupIndex + 1; i < groupCount; i++) preferredOrder.push(i);
    }
    
    const targetGroup = findBestGroupForPlayer(player, preferredOrder);
    groups[targetGroup].push(player);
    
    currentGroupIndex += snakeDirection;
    if (currentGroupIndex >= groupCount) {
      currentGroupIndex = groupCount - 1;
      snakeDirection = -1;
    } else if (currentGroupIndex < 0) {
      currentGroupIndex = 0;
      snakeDirection = 1;
    }
  }
  
  const teamCounts = new Map<string, number>();
  for (const p of unseeded) {
    if (p.team) {
      teamCounts.set(p.team, (teamCounts.get(p.team) || 0) + 1);
    }
  }
  
  const sortedUnseeded = [...unseeded].sort((a, b) => {
    const countA = a.team ? (teamCounts.get(a.team) || 0) : 0;
    const countB = b.team ? (teamCounts.get(b.team) || 0) : 0;
    return countB - countA;
  });
  
  for (const player of sortedUnseeded) {
    const groupsByRoom = Array.from({ length: groupCount }, (_, i) => i)
      .filter(i => !isGroupFull(i))
      .sort((a, b) => {
        const roomA = targetSizes[a] - groups[a].length;
        const roomB = targetSizes[b] - groups[b].length;
        return roomB - roomA;
      });
    
    const targetGroup = findBestGroupForPlayer(player, groupsByRoom);
    groups[targetGroup].push(player);
  }
  
  return groups;
}

export function getWildcardCount(groupCount: number): number {
  switch (groupCount) {
    case 3: return 2;
    case 6: return 4;
    default: return 0;
  }
}
