import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Types
export type QuickTableFormat = 'round_robin' | 'large_playoff';
export type QuickTableStatus = 'setup' | 'group_stage' | 'playoff' | 'completed';
export type QuickMatchStatus = 'pending' | 'completed';

export interface QuickTable {
  id: string;
  created_at: string;
  updated_at: string;
  creator_user_id: string | null;
  name: string;
  player_count: number;
  format: QuickTableFormat;
  status: QuickTableStatus;
  group_count: number | null;
  top_per_group: number | null;
  use_wildcard: boolean | null;
  wildcard_count: number | null;
  share_id: string;
  is_public: boolean;
}

export interface QuickTableGroup {
  id: string;
  table_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface QuickTablePlayer {
  id: string;
  table_id: string;
  group_id: string | null;
  name: string;
  team: string | null;
  seed: number | null;
  matches_played: number;
  matches_won: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  is_qualified: boolean | null;
  is_wildcard: boolean | null;
  playoff_seed: number | null;
  round1_result: string | null;
  round2_result: string | null;
  round1_point_diff: number | null;
  is_bye: boolean | null;
  display_order: number;
  created_at: string;
}

export interface QuickTableMatch {
  id: string;
  table_id: string;
  group_id: string | null;
  is_playoff: boolean;
  playoff_round: number | null;
  playoff_match_number: number | null;
  bracket_position: string | null;
  large_playoff_round: number | null;
  player1_id: string | null;
  player2_id: string | null;
  score1: number | null;
  score2: number | null;
  winner_id: string | null;
  status: QuickMatchStatus;
  next_match_id: string | null;
  next_match_slot: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface GroupSuggestion {
  groupCount: number;
  playersPerGroup: number[];
  isRecommended: boolean;
  reason: string;
  wildcardNeeded: number;
  totalPlayoffSpots: number;
}

// Suggest group configurations
export function suggestGroupConfigs(playerCount: number): GroupSuggestion[] {
  const validGroupCounts = [2, 3, 4, 6, 8];
  const suggestions: GroupSuggestion[] = [];

  for (const k of validGroupCounts) {
    if (k > playerCount) continue;
    
    const basePerGroup = Math.floor(playerCount / k);
    const remainder = playerCount % k;
    
    // Calculate min and max group sizes
    const minSize = basePerGroup;
    const maxSize = remainder > 0 ? basePerGroup + 1 : basePerGroup;
    
    // Only allow groups with 3-6 players and difference <= 1
    if (minSize < 3 || maxSize > 6) continue;
    if (maxSize - minSize > 1) continue;
    
    // Randomize distribution of larger/smaller groups
    const playersPerGroup: number[] = [];
    const largerGroupIndices = new Set<number>();
    while (largerGroupIndices.size < remainder) {
      largerGroupIndices.add(Math.floor(Math.random() * k));
    }
    for (let i = 0; i < k; i++) {
      playersPerGroup.push(largerGroupIndices.has(i) ? basePerGroup + 1 : basePerGroup);
    }
    
    // Calculate playoff spots
    const topPerGroup = 2;
    const directSpots = k * topPerGroup;
    
    // Determine ideal playoff size (power of 2)
    let idealPlayoffSize = 4;
    if (directSpots >= 6) idealPlayoffSize = 8;
    if (directSpots >= 12) idealPlayoffSize = 16;
    if (directSpots >= 24) idealPlayoffSize = 32;
    
    const wildcardNeeded = Math.max(0, idealPlayoffSize - directSpots);
    
    // Determine if recommended
    let isRecommended = false;
    let reason = '';
    
    // Best: balanced groups and direct playoff (no wildcard)
    if (wildcardNeeded === 0) {
      isRecommended = true;
      reason = 'Không cần wildcard, vào thẳng playoff';
    } else if (wildcardNeeded <= 4) {
      reason = `Cần ${wildcardNeeded} wildcard`;
    } else {
      reason = `Cần ${wildcardNeeded} wildcard (không khuyến nghị)`;
    }
    
    // Prefer 4 or 8 groups for cleaner brackets
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
  
  // Mark best recommendation
  const recommended = suggestions.find(s => s.wildcardNeeded === 0);
  if (recommended) {
    suggestions.forEach(s => {
      if (s !== recommended) s.isRecommended = false;
    });
  } else if (suggestions.length > 0) {
    // Pick the one with least wildcards
    const sorted = [...suggestions].sort((a, b) => a.wildcardNeeded - b.wildcardNeeded);
    sorted[0].isRecommended = true;
    suggestions.forEach(s => {
      if (s !== sorted[0]) s.isRecommended = false;
    });
  }
  
  return suggestions;
}

// Generate round robin matches for a group
export function generateRoundRobinMatches(playerIds: string[]): Array<{ player1: string; player2: string }> {
  const matches: Array<{ player1: string; player2: string }> = [];
  
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      matches.push({ player1: playerIds[i], player2: playerIds[j] });
    }
  }
  
  return matches;
}

// Distribute players to groups (avoiding same team, spreading seeds)
export function distributePlayersToGroups(
  players: Array<{ id: string; name: string; team?: string; seed?: number }>,
  groupCount: number
): Array<Array<{ id: string; name: string; team?: string; seed?: number }>> {
  const playerCount = players.length;
  const basePerGroup = Math.floor(playerCount / groupCount);
  const remainder = playerCount % groupCount;
  
  // Calculate target sizes for each group (randomize which groups get extra)
  const targetSizes: number[] = Array(groupCount).fill(basePerGroup);
  const extraIndices = new Set<number>();
  while (extraIndices.size < remainder) {
    extraIndices.add(Math.floor(Math.random() * groupCount));
  }
  extraIndices.forEach(i => { targetSizes[i]++; });
  
  // Sort by seed (highest first, then randomize unseeded)
  const sorted = [...players].sort((a, b) => {
    if (a.seed && b.seed) return b.seed - a.seed;
    if (a.seed) return -1;
    if (b.seed) return 1;
    return Math.random() - 0.5;
  });
  
  const groups: Array<Array<typeof players[0]>> = Array.from({ length: groupCount }, () => []);
  
  // Track team distribution per group for better constraint satisfaction
  const getTeamCount = (groupIdx: number, team: string | undefined): number => {
    if (!team) return 0;
    return groups[groupIdx].filter(p => p.team === team).length;
  };
  
  // Find best group for a player considering team constraints
  const findBestGroup = (player: typeof players[0]): number => {
    // Get all available groups (not full)
    const availableGroups = targetSizes
      .map((size, idx) => ({ idx, size, currentSize: groups[idx].length }))
      .filter(g => g.currentSize < g.size);
    
    if (availableGroups.length === 0) return 0; // Shouldn't happen
    
    // If player has no team, just pick the group with least players (for balance)
    if (!player.team) {
      return availableGroups.sort((a, b) => a.currentSize - b.currentSize)[0].idx;
    }
    
    // Find groups with no teammates first
    const groupsWithoutTeammate = availableGroups.filter(
      g => getTeamCount(g.idx, player.team) === 0
    );
    
    if (groupsWithoutTeammate.length > 0) {
      // Prefer group with fewer players for balance
      return groupsWithoutTeammate.sort((a, b) => a.currentSize - b.currentSize)[0].idx;
    }
    
    // If all groups have teammate, find group with fewest teammates
    const sortedByTeammates = availableGroups.sort((a, b) => {
      const teamCountA = getTeamCount(a.idx, player.team);
      const teamCountB = getTeamCount(b.idx, player.team);
      if (teamCountA !== teamCountB) return teamCountA - teamCountB;
      return a.currentSize - b.currentSize; // Secondary: balance group sizes
    });
    
    return sortedByTeammates[0].idx;
  };
  
  // Distribute players
  for (const player of sorted) {
    const targetGroup = findBestGroup(player);
    groups[targetGroup].push(player);
  }
  
  return groups;
}

export function useQuickTable() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createTable = useCallback(async (
    name: string,
    playerCount: number,
    format: QuickTableFormat,
    groupCount?: number
  ): Promise<QuickTable | null> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để tạo bảng đấu');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quick_tables')
        .insert({
          name,
          player_count: playerCount,
          format,
          group_count: groupCount,
          creator_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Cast to our type
      return data as unknown as QuickTable;
    } catch (error) {
      console.error('Error creating table:', error);
      toast.error('Không thể tạo bảng đấu');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getTableByShareId = useCallback(async (shareId: string): Promise<{
    table: QuickTable;
    groups: QuickTableGroup[];
    players: QuickTablePlayer[];
    matches: QuickTableMatch[];
  } | null> => {
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('quick_tables')
        .select('*')
        .eq('share_id', shareId)
        .maybeSingle();

      if (tableError) throw tableError;
      if (!tableData) return null;

      const table = tableData as unknown as QuickTable;

      const [groupsRes, playersRes, matchesRes] = await Promise.all([
        supabase.from('quick_table_groups').select('*').eq('table_id', table.id).order('display_order'),
        supabase.from('quick_table_players').select('*').eq('table_id', table.id).order('display_order'),
        supabase.from('quick_table_matches').select('*').eq('table_id', table.id).order('display_order'),
      ]);

      return {
        table,
        groups: (groupsRes.data || []) as unknown as QuickTableGroup[],
        players: (playersRes.data || []) as unknown as QuickTablePlayer[],
        matches: (matchesRes.data || []) as unknown as QuickTableMatch[],
      };
    } catch (error) {
      console.error('Error fetching table:', error);
      return null;
    }
  }, []);

  const addPlayers = useCallback(async (
    tableId: string,
    players: Array<{ name: string; team?: string; seed?: number }>
  ): Promise<QuickTablePlayer[]> => {
    try {
      const { data, error } = await supabase
        .from('quick_table_players')
        .insert(
          players.map((p, i) => ({
            table_id: tableId,
            name: p.name,
            team: p.team || null,
            seed: p.seed || null,
            display_order: i,
          }))
        )
        .select();

      if (error) throw error;
      return (data || []) as unknown as QuickTablePlayer[];
    } catch (error) {
      console.error('Error adding players:', error);
      toast.error('Không thể thêm người chơi');
      return [];
    }
  }, []);

  const createGroups = useCallback(async (
    tableId: string,
    groupCount: number
  ): Promise<QuickTableGroup[]> => {
    try {
      const groupNames = Array.from({ length: groupCount }, (_, i) => 
        String.fromCharCode(65 + i) // A, B, C, ...
      );

      const { data, error } = await supabase
        .from('quick_table_groups')
        .insert(
          groupNames.map((name, i) => ({
            table_id: tableId,
            name,
            display_order: i,
          }))
        )
        .select();

      if (error) throw error;
      return (data || []) as unknown as QuickTableGroup[];
    } catch (error) {
      console.error('Error creating groups:', error);
      toast.error('Không thể tạo bảng');
      return [];
    }
  }, []);

  const assignPlayersToGroups = useCallback(async (
    players: QuickTablePlayer[],
    groups: QuickTableGroup[]
  ): Promise<void> => {
    const playerData = players.map(p => ({
      id: p.id,
      name: p.name,
      team: p.team || undefined,
      seed: p.seed || undefined,
    }));

    const distributed = distributePlayersToGroups(playerData, groups.length);

    // Update each player with their group
    const updates = distributed.flatMap((groupPlayers, groupIndex) =>
      groupPlayers.map(p => ({
        id: p.id,
        group_id: groups[groupIndex].id,
      }))
    );

    for (const update of updates) {
      await supabase
        .from('quick_table_players')
        .update({ group_id: update.group_id })
        .eq('id', update.id);
    }
  }, []);

  const createGroupMatches = useCallback(async (
    tableId: string,
    groupId: string,
    playerIds: string[]
  ): Promise<QuickTableMatch[]> => {
    const matchPairs = generateRoundRobinMatches(playerIds);

    const { data, error } = await supabase
      .from('quick_table_matches')
      .insert(
        matchPairs.map((pair, i) => ({
          table_id: tableId,
          group_id: groupId,
          is_playoff: false,
          player1_id: pair.player1,
          player2_id: pair.player2,
          display_order: i,
        }))
      )
      .select();

    if (error) throw error;
    return (data || []) as unknown as QuickTableMatch[];
  }, []);

  const updateMatchScore = useCallback(async (
    matchId: string,
    score1: number,
    score2: number
  ): Promise<void> => {
    const winnerId = score1 > score2 ? 'player1' : score1 < score2 ? 'player2' : null;

    // First get the match to know player IDs and playoff info
    const { data: match } = await supabase
      .from('quick_table_matches')
      .select('player1_id, player2_id, is_playoff, playoff_round, playoff_match_number, table_id, winner_id')
      .eq('id', matchId)
      .single();

    if (!match) return;

    const newWinner = winnerId === 'player1' ? match.player1_id : 
                      winnerId === 'player2' ? match.player2_id : null;
    const oldWinner = match.winner_id;

    await supabase
      .from('quick_table_matches')
      .update({
        score1,
        score2,
        winner_id: newWinner,
        status: 'completed' as QuickMatchStatus,
      })
      .eq('id', matchId);

    // If this is a playoff match and winner changed, update next round match
    if (match.is_playoff && match.playoff_round !== null && oldWinner !== newWinner) {
      const nextRound = match.playoff_round + 1;
      const matchNumber = match.playoff_match_number || 0;
      
      // Calculate which match in next round this feeds into
      // Matches are paired: 1-2 -> next match 1 (slot 1-2), 3-4 -> next match 2 (slot 1-2), etc.
      const nextMatchIndex = Math.floor((matchNumber - 1) / 2);
      const slot = (matchNumber - 1) % 2; // 0 = player1 slot, 1 = player2 slot
      
      // Get next round matches
      const { data: nextRoundMatches } = await supabase
        .from('quick_table_matches')
        .select('id, playoff_match_number')
        .eq('table_id', match.table_id)
        .eq('is_playoff', true)
        .eq('playoff_round', nextRound)
        .order('playoff_match_number');
      
      if (nextRoundMatches && nextRoundMatches.length > nextMatchIndex) {
        const nextMatch = nextRoundMatches[nextMatchIndex];
        
        // Update the correct slot in next match
        const updateData = slot === 0 
          ? { player1_id: newWinner }
          : { player2_id: newWinner };
        
        await supabase
          .from('quick_table_matches')
          .update(updateData)
          .eq('id', nextMatch.id);
      }
    }
  }, []);

  const updatePlayerStats = useCallback(async (
    tableId: string,
    groupId: string
  ): Promise<void> => {
    // Get all completed matches in this group
    const { data: matches } = await supabase
      .from('quick_table_matches')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'completed');

    if (!matches) return;

    // Get all players in this group
    const { data: players } = await supabase
      .from('quick_table_players')
      .select('*')
      .eq('group_id', groupId);

    if (!players) return;

    // Calculate stats for each player
    const stats: Record<string, { played: number; won: number; pf: number; pa: number }> = {};

    for (const player of players) {
      stats[player.id] = { played: 0, won: 0, pf: 0, pa: 0 };
    }

    for (const match of matches) {
      if (match.player1_id && match.player2_id && match.score1 !== null && match.score2 !== null) {
        stats[match.player1_id].played++;
        stats[match.player2_id].played++;
        stats[match.player1_id].pf += match.score1;
        stats[match.player1_id].pa += match.score2;
        stats[match.player2_id].pf += match.score2;
        stats[match.player2_id].pa += match.score1;

        if (match.winner_id === match.player1_id) {
          stats[match.player1_id].won++;
        } else if (match.winner_id === match.player2_id) {
          stats[match.player2_id].won++;
        }
      }
    }

    // Update all players
    for (const [playerId, stat] of Object.entries(stats)) {
      await supabase
        .from('quick_table_players')
        .update({
          matches_played: stat.played,
          matches_won: stat.won,
          points_for: stat.pf,
          points_against: stat.pa,
        })
        .eq('id', playerId);
    }
  }, []);

  const updateTableStatus = useCallback(async (
    tableId: string,
    status: QuickTableStatus
  ): Promise<void> => {
    await supabase
      .from('quick_tables')
      .update({ status })
      .eq('id', tableId);
  }, []);

  const isOwner = useCallback((table: QuickTable): boolean => {
    return !!user && table.creator_user_id === user.id;
  }, [user]);

  // Get qualified players from each group (top N per group)
  const getQualifiedPlayers = useCallback((
    groups: QuickTableGroup[],
    players: QuickTablePlayer[],
    topPerGroup: number = 2
  ): { qualified: QuickTablePlayer[]; thirdPlace: QuickTablePlayer[] } => {
    const qualified: QuickTablePlayer[] = [];
    const thirdPlace: QuickTablePlayer[] = [];

    for (const group of groups) {
      const groupPlayers = players
        .filter(p => p.group_id === group.id)
        .sort((a, b) => {
          if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
          return b.point_diff - a.point_diff;
        });

      groupPlayers.slice(0, topPerGroup).forEach((p, idx) => {
        qualified.push({ ...p, playoff_seed: idx + 1 }); // 1 = first, 2 = second
      });

      // Third place for wildcard consideration
      if (groupPlayers[topPerGroup]) {
        thirdPlace.push(groupPlayers[topPerGroup]);
      }
    }

    return { qualified, thirdPlace };
  }, []);

  // Generate playoff bracket mapping based on group count
  const generatePlayoffBracket = useCallback((
    groupCount: number,
    qualified: QuickTablePlayer[],
    wildcards: QuickTablePlayer[],
    groups: QuickTableGroup[]
  ): Array<{ player1: QuickTablePlayer | null; player2: QuickTablePlayer | null; bracketPosition: string; matchNumber: number }> => {
    const matches: Array<{ player1: QuickTablePlayer | null; player2: QuickTablePlayer | null; bracketPosition: string; matchNumber: number }> = [];

    // Track used wildcard indices to avoid reusing same wildcard
    let wildcardIndex = 0;

    // Helper to get player by group name and seed
    const getPlayer = (groupName: string, seed: number): QuickTablePlayer | null => {
      const group = groups.find(g => g.name === groupName);
      if (!group) return null;
      return qualified.find(p => p.group_id === group.id && p.playoff_seed === seed) || null;
    };

    // Get next available wildcard (not from specific group preferably)
    const getNextWildcard = (excludeGroupId?: string): QuickTablePlayer | null => {
      if (wildcardIndex >= wildcards.length) return null;
      
      // Try to find one not from excluded group
      const preferredIdx = wildcards.findIndex((w, idx) => 
        idx >= wildcardIndex && w.group_id !== excludeGroupId
      );
      
      if (preferredIdx >= wildcardIndex) {
        const wc = wildcards[preferredIdx];
        // Swap to maintain order
        [wildcards[wildcardIndex], wildcards[preferredIdx]] = [wildcards[preferredIdx], wildcards[wildcardIndex]];
        wildcardIndex++;
        return wc;
      }
      
      // Just use the next one
      const wc = wildcards[wildcardIndex];
      wildcardIndex++;
      return wc;
    };

    switch (groupCount) {
      case 2: // 4 players → 2 matches semifinal
        matches.push({ player1: getPlayer('A', 1), player2: getPlayer('B', 2), bracketPosition: 'upper', matchNumber: 1 });
        matches.push({ player1: getPlayer('B', 1), player2: getPlayer('A', 2), bracketPosition: 'lower', matchNumber: 2 });
        break;

      case 3: // 6 players + 2 wildcards = 8 → quarterfinal
        matches.push({ player1: getPlayer('A', 1), player2: getPlayer('B', 2), bracketPosition: 'upper', matchNumber: 1 });
        matches.push({ player1: getPlayer('C', 1), player2: getNextWildcard(), bracketPosition: 'upper', matchNumber: 2 });
        matches.push({ player1: getPlayer('B', 1), player2: getPlayer('A', 2), bracketPosition: 'lower', matchNumber: 3 });
        matches.push({ player1: getPlayer('C', 2), player2: getNextWildcard(), bracketPosition: 'lower', matchNumber: 4 });
        break;

      case 4: // 8 players → quarterfinal
        matches.push({ player1: getPlayer('A', 1), player2: getPlayer('B', 2), bracketPosition: 'upper', matchNumber: 1 });
        matches.push({ player1: getPlayer('C', 1), player2: getPlayer('D', 2), bracketPosition: 'upper', matchNumber: 2 });
        matches.push({ player1: getPlayer('B', 1), player2: getPlayer('A', 2), bracketPosition: 'lower', matchNumber: 3 });
        matches.push({ player1: getPlayer('D', 1), player2: getPlayer('C', 2), bracketPosition: 'lower', matchNumber: 4 });
        break;

      case 6: { // 12 players + 4 wildcards = 16 → Round of 16
        const groupE = groups.find(g => g.name === 'E');
        const groupF = groups.find(g => g.name === 'F');
        
        // Upper bracket - each wildcard is used only once
        matches.push({ player1: getPlayer('A', 1), player2: getPlayer('B', 2), bracketPosition: 'upper', matchNumber: 1 });
        matches.push({ player1: getPlayer('C', 1), player2: getPlayer('D', 2), bracketPosition: 'upper', matchNumber: 2 });
        matches.push({ player1: getPlayer('E', 1), player2: getNextWildcard(groupE?.id), bracketPosition: 'upper', matchNumber: 3 });
        matches.push({ player1: getPlayer('F', 1), player2: getNextWildcard(groupF?.id), bracketPosition: 'upper', matchNumber: 4 });
        // Lower bracket
        matches.push({ player1: getPlayer('B', 1), player2: getPlayer('A', 2), bracketPosition: 'lower', matchNumber: 5 });
        matches.push({ player1: getPlayer('D', 1), player2: getPlayer('C', 2), bracketPosition: 'lower', matchNumber: 6 });
        matches.push({ player1: getPlayer('E', 2), player2: getNextWildcard(groupE?.id), bracketPosition: 'lower', matchNumber: 7 });
        matches.push({ player1: getPlayer('F', 2), player2: getNextWildcard(groupF?.id), bracketPosition: 'lower', matchNumber: 8 });
        break;
      }

      case 8: // 16 players → Round of 16
        matches.push({ player1: getPlayer('A', 1), player2: getPlayer('B', 2), bracketPosition: 'upper', matchNumber: 1 });
        matches.push({ player1: getPlayer('C', 1), player2: getPlayer('D', 2), bracketPosition: 'upper', matchNumber: 2 });
        matches.push({ player1: getPlayer('E', 1), player2: getPlayer('F', 2), bracketPosition: 'upper', matchNumber: 3 });
        matches.push({ player1: getPlayer('G', 1), player2: getPlayer('H', 2), bracketPosition: 'upper', matchNumber: 4 });
        matches.push({ player1: getPlayer('B', 1), player2: getPlayer('A', 2), bracketPosition: 'lower', matchNumber: 5 });
        matches.push({ player1: getPlayer('D', 1), player2: getPlayer('C', 2), bracketPosition: 'lower', matchNumber: 6 });
        matches.push({ player1: getPlayer('F', 1), player2: getPlayer('E', 2), bracketPosition: 'lower', matchNumber: 7 });
        matches.push({ player1: getPlayer('H', 1), player2: getPlayer('G', 2), bracketPosition: 'lower', matchNumber: 8 });
        break;
    }

    return matches;
  }, []);

  // Create playoff matches in database
  const createPlayoffMatches = useCallback(async (
    tableId: string,
    bracketMatches: Array<{ player1: QuickTablePlayer | null; player2: QuickTablePlayer | null; bracketPosition: string; matchNumber: number }>
  ): Promise<QuickTableMatch[]> => {
    // Check if playoff matches already exist for this table
    const { data: existingMatches } = await supabase
      .from('quick_table_matches')
      .select('id')
      .eq('table_id', tableId)
      .eq('is_playoff', true)
      .limit(1);

    if (existingMatches && existingMatches.length > 0) {
      console.log('Playoff matches already exist, skipping creation');
      return [];
    }

    const totalMatches = bracketMatches.length;
    const round = totalMatches <= 2 ? 2 : totalMatches <= 4 ? 1 : 0; // 0=R16, 1=QF, 2=SF

    const { data, error } = await supabase
      .from('quick_table_matches')
      .insert(
        bracketMatches.map((m, i) => ({
          table_id: tableId,
          is_playoff: true,
          playoff_round: round,
          playoff_match_number: m.matchNumber,
          bracket_position: m.bracketPosition,
          player1_id: m.player1?.id || null,
          player2_id: m.player2?.id || null,
          display_order: i,
        }))
      )
      .select();

    if (error) throw error;
    return (data || []) as unknown as QuickTableMatch[];
  }, []);

  // Mark players as qualified/wildcard
  const markPlayersQualified = useCallback(async (
    qualified: QuickTablePlayer[],
    wildcards: QuickTablePlayer[]
  ): Promise<void> => {
    for (const player of qualified) {
      await supabase
        .from('quick_table_players')
        .update({ is_qualified: true, is_wildcard: false, playoff_seed: player.playoff_seed })
        .eq('id', player.id);
    }

    for (let i = 0; i < wildcards.length; i++) {
      await supabase
        .from('quick_table_players')
        .update({ is_qualified: true, is_wildcard: true, playoff_seed: 100 + i })
        .eq('id', wildcards[i].id);
    }
  }, []);

  // Check if current playoff round is complete
  const isPlayoffRoundComplete = useCallback((matches: QuickTableMatch[], round: number): boolean => {
    const roundMatches = matches.filter(m => m.is_playoff && m.playoff_round === round);
    return roundMatches.length > 0 && roundMatches.every(m => m.status === 'completed');
  }, []);

  // Create next playoff round (Semi-finals or Finals)
  const createNextPlayoffRound = useCallback(async (
    tableId: string,
    currentRound: number,
    currentMatches: QuickTableMatch[]
  ): Promise<QuickTableMatch[]> => {
    const nextRound = currentRound + 1;

    // Check if next round already exists in database (avoid duplicates)
    const { data: existingNextRound } = await supabase
      .from('quick_table_matches')
      .select('id')
      .eq('table_id', tableId)
      .eq('is_playoff', true)
      .eq('playoff_round', nextRound)
      .limit(1);

    if (existingNextRound && existingNextRound.length > 0) {
      console.log('Next round already exists, skipping creation');
      return [];
    }

    // Get completed matches from current round
    const completedMatches = currentMatches
      .filter(m => m.is_playoff && m.playoff_round === currentRound && m.status === 'completed')
      .sort((a, b) => (a.playoff_match_number || 0) - (b.playoff_match_number || 0));

    if (completedMatches.length < 2) return [];

    // Calculate next round
    const nextMatchCount = Math.floor(completedMatches.length / 2);
    
    // Determine next round name info
    let roundName = '';
    if (nextMatchCount === 1) roundName = 'final';
    else if (nextMatchCount === 2) roundName = 'semi';
    else if (nextMatchCount <= 4) roundName = 'quarter';

    // Pair winners for next round matches
    const nextRoundMatches: Array<{
      player1_id: string | null;
      player2_id: string | null;
      bracket_position: string;
      match_number: number;
    }> = [];

    // Get the highest match number from existing matches
    const maxMatchNumber = Math.max(...currentMatches.map(m => m.playoff_match_number || 0), 0);

    for (let i = 0; i < completedMatches.length; i += 2) {
      const match1 = completedMatches[i];
      const match2 = completedMatches[i + 1];
      
      if (!match2) break; // Need pairs

      nextRoundMatches.push({
        player1_id: match1.winner_id,
        player2_id: match2.winner_id,
        bracket_position: match1.bracket_position || 'upper',
        match_number: maxMatchNumber + 1 + (i / 2),
      });
    }

    if (nextRoundMatches.length === 0) return [];

    // Insert next round matches
    const { data, error } = await supabase
      .from('quick_table_matches')
      .insert(
        nextRoundMatches.map((m, idx) => ({
          table_id: tableId,
          is_playoff: true,
          playoff_round: nextRound,
          playoff_match_number: m.match_number,
          bracket_position: nextMatchCount === 1 ? 'final' : m.bracket_position,
          player1_id: m.player1_id,
          player2_id: m.player2_id,
          display_order: 100 + idx,
        }))
      )
      .select();

    if (error) {
      console.error('Error creating next round:', error);
      return [];
    }

    return (data || []) as unknown as QuickTableMatch[];
  }, []);

  // Check if all group matches are completed
  const isGroupStageComplete = useCallback((matches: QuickTableMatch[]): boolean => {
    const groupMatches = matches.filter(m => !m.is_playoff);
    return groupMatches.length > 0 && groupMatches.every(m => m.status === 'completed');
  }, []);

  // Get number of wildcards needed based on group count
  const getWildcardCount = useCallback((groupCount: number): number => {
    switch (groupCount) {
      case 3: return 2; // 6 → 8
      case 6: return 4; // 12 → 16
      default: return 0;
    }
  }, []);

  // Get all tables created by the current user
  const getUserTables = useCallback(async (): Promise<QuickTable[]> => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('quick_tables')
        .select('*')
        .eq('creator_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as QuickTable[];
    } catch (error) {
      console.error('Error fetching user tables:', error);
      return [];
    }
  }, [user]);

  // Move a player from one group to another
  const movePlayerToGroup = useCallback(async (
    playerId: string,
    newGroupId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quick_table_players')
        .update({ group_id: newGroupId })
        .eq('id', playerId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error moving player:', error);
      return false;
    }
  }, []);

  // Add a new player to a group
  const addPlayerToGroup = useCallback(async (
    tableId: string,
    groupId: string,
    playerData: { name: string; team?: string; seed?: number }
  ): Promise<QuickTablePlayer | null> => {
    try {
      const { data, error } = await supabase
        .from('quick_table_players')
        .insert({
          table_id: tableId,
          group_id: groupId,
          name: playerData.name,
          team: playerData.team || null,
          seed: playerData.seed || null,
          display_order: 999, // Will be at end
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as QuickTablePlayer;
    } catch (error) {
      console.error('Error adding player:', error);
      return null;
    }
  }, []);

  // Remove a player from the table (soft delete - just remove from group)
  const removePlayerFromGroup = useCallback(async (
    playerId: string
  ): Promise<boolean> => {
    try {
      // First delete any matches involving this player
      await supabase
        .from('quick_table_matches')
        .delete()
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

      // Then delete the player
      const { error } = await supabase
        .from('quick_table_players')
        .delete()
        .eq('id', playerId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing player:', error);
      return false;
    }
  }, []);

  // Regenerate all matches for a group (after player changes)
  const regenerateGroupMatches = useCallback(async (
    tableId: string,
    groupId: string,
    playerIds: string[]
  ): Promise<boolean> => {
    try {
      // Delete existing matches for this group
      await supabase
        .from('quick_table_matches')
        .delete()
        .eq('group_id', groupId)
        .eq('is_playoff', false);

      // Create new matches
      const matchPairs = generateRoundRobinMatches(playerIds);
      
      const { error } = await supabase
        .from('quick_table_matches')
        .insert(
          matchPairs.map((pair, i) => ({
            table_id: tableId,
            group_id: groupId,
            is_playoff: false,
            player1_id: pair.player1,
            player2_id: pair.player2,
            display_order: i,
          }))
        );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error regenerating matches:', error);
      return false;
    }
  }, []);

  return {
    loading,
    createTable,
    getTableByShareId,
    getUserTables,
    addPlayers,
    createGroups,
    assignPlayersToGroups,
    createGroupMatches,
    updateMatchScore,
    updatePlayerStats,
    updateTableStatus,
    isOwner,
    suggestGroupConfigs,
    getQualifiedPlayers,
    generatePlayoffBracket,
    createPlayoffMatches,
    markPlayersQualified,
    isPlayoffRoundComplete,
    createNextPlayoffRound,
    isGroupStageComplete,
    getWildcardCount,
    movePlayerToGroup,
    addPlayerToGroup,
    removePlayerFromGroup,
    regenerateGroupMatches,
  };
}
