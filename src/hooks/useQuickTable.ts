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
  // Registration settings
  requires_registration: boolean;
  requires_skill_level: boolean;
  min_skill_level: number | null;
  max_skill_level: number | null;
  skill_rating_system: string | null;
  auto_approve_registrations: boolean;
  registration_message: string | null;
  // Court and time settings
  courts: string[] | null;
  start_time: string | null;
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
  // Court and time
  court_id: number | null;
  start_at: string | null;
  rr_round_number: number | null;
  rr_match_index: number | null;
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

// Generate round robin matches for a group (legacy - simple pairing)
export function generateRoundRobinMatches(playerIds: string[]): Array<{ player1: string; player2: string }> {
  const matches: Array<{ player1: string; player2: string }> = [];
  
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      matches.push({ player1: playerIds[i], player2: playerIds[j] });
    }
  }
  
  return matches;
}

// Re-export circle method for use by setup page
export { generateCircleMethodMatches, parseCourtsInput, assignCourtsToMatches, calculateMatchTimes, mergeMatchesByRound, optimizeMatchOrder } from '@/lib/round-robin';

// Distribute players to groups (avoiding same team, spreading seeds)
export function distributePlayersToGroups(
  players: Array<{ id: string; name: string; team?: string; seed?: number }>,
  groupCount: number
): Array<Array<{ id: string; name: string; team?: string; seed?: number }>> {
  const playerCount = players.length;
  const basePerGroup = Math.floor(playerCount / groupCount);
  const remainder = playerCount % groupCount;
  
  // Calculate target sizes for each group
  const targetSizes: number[] = Array(groupCount).fill(basePerGroup);
  for (let i = 0; i < remainder; i++) {
    targetSizes[i]++;
  }
  
  // Separate seeded and unseeded players
  // Lower seed number = stronger player (seed 1 is the best)
  const seeded = players.filter(p => p.seed != null && p.seed > 0).sort((a, b) => a.seed! - b.seed!);
  const unseeded = players.filter(p => p.seed == null || p.seed <= 0);
  
  // Shuffle unseeded players
  for (let i = unseeded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unseeded[i], unseeded[j]] = [unseeded[j], unseeded[i]];
  }
  
  const groups: Array<Array<typeof players[0]>> = Array.from({ length: groupCount }, () => []);
  
  // Helper functions
  const getTeamCount = (groupIdx: number, team: string | undefined): number => {
    if (!team) return 0;
    return groups[groupIdx].filter(p => p.team === team).length;
  };
  
  const isGroupFull = (groupIdx: number): boolean => {
    return groups[groupIdx].length >= targetSizes[groupIdx];
  };
  
  // Find best group for a player, avoiding same team
  const findBestGroupForPlayer = (player: typeof players[0], preferredGroups?: number[]): number => {
    // Get all groups that aren't full
    const availableIndices = Array.from({ length: groupCount }, (_, i) => i)
      .filter(i => !isGroupFull(i));
    
    if (availableIndices.length === 0) {
      // All groups full - shouldn't happen, but fallback to first available
      return 0;
    }
    
    // Use preferred groups if provided (for snake draft order)
    const candidates = preferredGroups 
      ? preferredGroups.filter(i => !isGroupFull(i))
      : availableIndices;
    
    if (candidates.length === 0) {
      // Fallback to any available
      return availableIndices[0];
    }
    
    if (!player.team) {
      // No team constraint - just pick first available from candidates
      return candidates[0];
    }
    
    // Find groups with no teammates
    const groupsWithoutTeammate = candidates.filter(i => getTeamCount(i, player.team) === 0);
    
    if (groupsWithoutTeammate.length > 0) {
      return groupsWithoutTeammate[0];
    }
    
    // All candidate groups have teammate - find one with fewest
    const sortedByTeammates = candidates.sort((a, b) => {
      return getTeamCount(a, player.team) - getTeamCount(b, player.team);
    });
    
    return sortedByTeammates[0];
  };
  
  // Step 1: Distribute seeded players using snake draft
  // Round 1: group 0, 1, 2, 3 (ascending)
  // Round 2: group 3, 2, 1, 0 (descending)
  // This ensures balanced strength across groups
  let snakeDirection = 1;
  let currentGroupIndex = 0;
  
  for (const player of seeded) {
    // Build preferred order based on snake position
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
    
    // Move to next position in snake
    currentGroupIndex += snakeDirection;
    if (currentGroupIndex >= groupCount) {
      currentGroupIndex = groupCount - 1;
      snakeDirection = -1;
    } else if (currentGroupIndex < 0) {
      currentGroupIndex = 0;
      snakeDirection = 1;
    }
  }
  
  // Step 2: Distribute unseeded players, prioritizing team separation
  // Sort unseeded by team to try placing same-team players in different groups
  const teamCounts = new Map<string, number>();
  for (const p of unseeded) {
    if (p.team) {
      teamCounts.set(p.team, (teamCounts.get(p.team) || 0) + 1);
    }
  }
  
  // Sort: players from larger teams first (harder to place, so do first)
  const sortedUnseeded = [...unseeded].sort((a, b) => {
    const countA = a.team ? (teamCounts.get(a.team) || 0) : 0;
    const countB = b.team ? (teamCounts.get(b.team) || 0) : 0;
    return countB - countA;
  });
  
  for (const player of sortedUnseeded) {
    // Find groups with most room first
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

export function useQuickTable() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Get user's quick table count for quota display
  const getUserQuickTableCount = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    
    try {
      const { data, error } = await supabase.rpc('get_user_quick_table_count', {
        _user_id: user.id
      });
      
      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Error getting user quick table count:', error);
      return 0;
    }
  }, [user]);

  const createTable = useCallback(async (
    name: string,
    playerCount: number,
    format: QuickTableFormat,
    groupCount?: number,
    registrationOptions?: {
      requires_registration?: boolean;
      requires_skill_level?: boolean;
      min_skill_level?: number;
      max_skill_level?: number;
      auto_approve_registrations?: boolean;
      registration_message?: string;
    }
  ): Promise<QuickTable | null> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để tạo bảng đấu');
      return null;
    }

    setLoading(true);
    try {
      // Use RPC with quota enforcement
      const { data, error } = await supabase.rpc('create_quick_table_with_quota', {
        _name: name,
        _player_count: playerCount,
        _format: format,
        _group_count: groupCount || null,
        _requires_registration: registrationOptions?.requires_registration || false,
        _requires_skill_level: registrationOptions?.requires_skill_level || false,
        _auto_approve_registrations: registrationOptions?.auto_approve_registrations || false,
        _registration_message: registrationOptions?.registration_message || null,
      });

      if (error) throw error;
      
      // Parse RPC response
      const result = data as { success: boolean; error?: string; table?: unknown; count?: number };
      
      if (!result.success) {
        if (result.error === 'LIMIT_REACHED') {
          toast.error('Đã đạt giới hạn soft launch: mỗi tài khoản chỉ được tạo tối đa 3 giải.');
          return null;
        }
        if (result.error === 'AUTH_REQUIRED') {
          toast.error('Vui lòng đăng nhập để tạo bảng đấu');
          return null;
        }
        throw new Error(result.error || 'Unknown error');
      }
      
      // Cast to our type
      return result.table as QuickTable;
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
    playerIds: string[],
    groupIndex: number = 0
  ): Promise<QuickTableMatch[]> => {
    // Use Circle Method for proper round-based scheduling
    const { generateCircleMethodMatches } = await import('@/lib/round-robin');
    const matchPairs = generateCircleMethodMatches(playerIds);

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
          rr_round_number: pair.rrRoundNumber,
          rr_match_index: pair.rrMatchIndex,
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

    // Update match: set score, status, winner, and clear live_referee_id
    const { error: updateError } = await supabase
      .from('quick_table_matches')
      .update({
        score1,
        score2,
        winner_id: newWinner,
        status: 'completed' as QuickMatchStatus,
        live_referee_id: null, // Clear live scoring when completing match
      })
      .eq('id', matchId);
    
    if (updateError) {
      console.error('[updateMatchScore] Error updating match:', updateError);
      return;
    }

    // If this is a playoff match, always update next round match (even if same winner, ensures consistency)
    if (match.is_playoff && match.playoff_round !== null) {
      const currentRound = match.playoff_round;
      const nextRound = currentRound + 1;
      
      // Get all matches in current round to calculate relative position
      const { data: currentRoundMatches } = await supabase
        .from('quick_table_matches')
        .select('id, playoff_match_number')
        .eq('table_id', match.table_id)
        .eq('is_playoff', true)
        .eq('playoff_round', currentRound)
        .order('playoff_match_number');
      
      if (!currentRoundMatches) return;
      
      // Find position of this match within its round (0-indexed)
      const positionInRound = currentRoundMatches.findIndex(m => m.id === matchId);
      
      // Calculate which match in next round this feeds into
      // Matches are paired: position 0,1 -> next match 0, position 2,3 -> next match 1, etc.
      const nextMatchIndex = Math.floor(positionInRound / 2);
      const slot = positionInRound % 2; // 0 = player1 slot, 1 = player2 slot
      
      console.log('[updateMatchScore] Playoff match update:', {
        matchId,
        currentRound,
        positionInRound,
        nextRound,
        nextMatchIndex,
        slot,
        oldWinner,
        newWinner
      });
      
      // Get next round matches
      const { data: nextRoundMatches } = await supabase
        .from('quick_table_matches')
        .select('id, playoff_match_number, player1_id, player2_id')
        .eq('table_id', match.table_id)
        .eq('is_playoff', true)
        .eq('playoff_round', nextRound)
        .order('playoff_match_number');
      
      console.log('[updateMatchScore] Next round matches:', nextRoundMatches);
      
      if (nextRoundMatches && nextRoundMatches.length > nextMatchIndex) {
        const nextMatch = nextRoundMatches[nextMatchIndex];
        
        // Update the correct slot in next match
        const updateData = slot === 0 
          ? { player1_id: newWinner }
          : { player2_id: newWinner };
        
        console.log('[updateMatchScore] Updating next match:', nextMatch.id, updateData);
        
        const { error: updateError } = await supabase
          .from('quick_table_matches')
          .update(updateData)
          .eq('id', nextMatch.id);
          
        if (updateError) {
          console.error('[updateMatchScore] Error updating next match:', updateError);
        } else {
          console.log('[updateMatchScore] Successfully updated next match');
        }
      } else {
        // No next round matches found - this might be the final match
        // Confirm it's the final by checking if current round only has 1 match
        const isFinalMatch = currentRoundMatches.length === 1;
        console.log('[updateMatchScore] No next match found, isFinalMatch:', isFinalMatch);
        
        if (isFinalMatch && newWinner) {
          console.log('[updateMatchScore] Final match completed, marking tournament as completed');
          await supabase
            .from('quick_tables')
            .update({ status: 'completed' as QuickTableStatus })
            .eq('id', match.table_id);
        }
      }
    }
  }, []);

  const updatePlayerStats = useCallback(async (
    tableId: string,
    groupId: string
  ): Promise<void> => {
    console.log('[updatePlayerStats] Starting for groupId:', groupId);
    
    // Get all completed matches in this group
    const { data: matches, error: matchError } = await supabase
      .from('quick_table_matches')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'completed');

    if (matchError) {
      console.error('[updatePlayerStats] Error fetching matches:', matchError);
      return;
    }
    
    console.log('[updatePlayerStats] Found completed matches:', matches?.length);

    if (!matches || matches.length === 0) {
      console.log('[updatePlayerStats] No completed matches found');
      return;
    }

    // Get all players in this group
    const { data: players, error: playerError } = await supabase
      .from('quick_table_players')
      .select('*')
      .eq('group_id', groupId);

    if (playerError) {
      console.error('[updatePlayerStats] Error fetching players:', playerError);
      return;
    }
    
    console.log('[updatePlayerStats] Found players:', players?.length);

    if (!players || players.length === 0) return;

    // Calculate stats for each player
    const stats: Record<string, { played: number; won: number; pf: number; pa: number }> = {};

    for (const player of players) {
      stats[player.id] = { played: 0, won: 0, pf: 0, pa: 0 };
    }

    for (const match of matches) {
      if (match.player1_id && match.player2_id && match.score1 !== null && match.score2 !== null) {
        // Calculate winner from scores directly (more reliable than winner_id)
        const player1Wins = match.score1 > match.score2;
        const player2Wins = match.score2 > match.score1;
        
        // Only update if player exists in stats (safety check)
        if (stats[match.player1_id]) {
          stats[match.player1_id].played++;
          stats[match.player1_id].pf += match.score1;
          stats[match.player1_id].pa += match.score2;
          if (player1Wins) {
            stats[match.player1_id].won++;
          }
        }
        if (stats[match.player2_id]) {
          stats[match.player2_id].played++;
          stats[match.player2_id].pf += match.score2;
          stats[match.player2_id].pa += match.score1;
          if (player2Wins) {
            stats[match.player2_id].won++;
          }
        }
      }
    }

    console.log('[updatePlayerStats] Calculated stats:', stats);

    // Update all players with calculated stats
    // Note: point_diff is a generated column (points_for - points_against), so we don't update it directly
    for (const [playerId, stat] of Object.entries(stats)) {
      const { error: updateError } = await supabase
        .from('quick_table_players')
        .update({
          matches_played: stat.played,
          matches_won: stat.won,
          points_for: stat.pf,
          points_against: stat.pa,
          // point_diff is auto-calculated by the database as (points_for - points_against)
        })
        .eq('id', playerId);
      
      if (updateError) {
        console.error('[updatePlayerStats] Error updating player:', playerId, updateError);
      } else {
        console.log('[updatePlayerStats] Updated player:', playerId, stat);
      }
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

  // Create playoff matches in database (IDEMPOTENT: DELETE + INSERT approach)
  const createPlayoffMatches = useCallback(async (
    tableId: string,
    bracketMatches: Array<{ player1: QuickTablePlayer | null; player2: QuickTablePlayer | null; bracketPosition: string; matchNumber: number }>
  ): Promise<QuickTableMatch[]> => {
    const totalMatches = bracketMatches.length;
    const round = totalMatches <= 2 ? 2 : totalMatches <= 4 ? 1 : 0; // 0=R16, 1=QF, 2=SF

    // IDEMPOTENT: Delete existing playoff matches for round 0/1 (initial bracket) then re-insert
    // This prevents duplicates even if called multiple times or race conditions occur
    const { error: deleteError } = await supabase
      .from('quick_table_matches')
      .delete()
      .eq('table_id', tableId)
      .eq('is_playoff', true)
      .eq('playoff_round', round);

    if (deleteError) {
      console.error('Error clearing existing playoff matches:', deleteError);
      throw deleteError;
    }

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

    if (error) {
      console.error('Error creating playoff matches:', error);
      throw error;
    }
    
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

  // Create next playoff round (Semi-finals or Finals) - IDEMPOTENT with DELETE + INSERT
  const createNextPlayoffRound = useCallback(async (
    tableId: string,
    currentRound: number,
    currentMatches: QuickTableMatch[]
  ): Promise<QuickTableMatch[]> => {
    const nextRound = currentRound + 1;

    // Get completed matches from current round
    const completedMatches = currentMatches
      .filter(m => m.is_playoff && m.playoff_round === currentRound && m.status === 'completed')
      .sort((a, b) => (a.playoff_match_number || 0) - (b.playoff_match_number || 0));

    if (completedMatches.length < 2) return [];

    // Calculate next round
    const nextMatchCount = Math.floor(completedMatches.length / 2);

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

    // IDEMPOTENT: Delete existing matches for this round then re-insert
    const { error: deleteError } = await supabase
      .from('quick_table_matches')
      .delete()
      .eq('table_id', tableId)
      .eq('is_playoff', true)
      .eq('playoff_round', nextRound);

    if (deleteError) {
      console.error('Error clearing existing next round matches:', deleteError);
      throw deleteError;
    }

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
      throw error;
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

  // Update table courts and start time
  const updateTableCourtSettings = useCallback(async (
    tableId: string,
    courts: string[],
    startTime: string | null
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quick_tables')
        .update({ 
          courts: courts.length > 0 ? courts : [],
          start_time: startTime 
        })
        .eq('id', tableId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating court settings:', error);
      return false;
    }
  }, []);

  // Reassign courts and times to all group matches
  const reassignCourtsAndTimes = useCallback(async (
    tableId: string,
    courts: number[],
    startTime: string | null,
    groups: QuickTableGroup[],
    matches: QuickTableMatch[]
  ): Promise<boolean> => {
    if (courts.length === 0) {
      // Clear court assignments
      try {
        const groupMatchIds = matches.filter(m => !m.is_playoff && m.group_id).map(m => m.id);
        if (groupMatchIds.length > 0) {
          await supabase
            .from('quick_table_matches')
            .update({ court_id: null, start_at: null })
            .in('id', groupMatchIds);
        }
        return true;
      } catch (error) {
        console.error('Error clearing courts:', error);
        return false;
      }
    }

    try {
      const { assignCourtsToMatches, calculateMatchTimes } = await import('@/lib/round-robin');
      
      // Get group matches sorted by round number then by group
      const groupMatches = matches
        .filter(m => !m.is_playoff && m.group_id)
        .sort((a, b) => {
          // Sort by round number first, then by group
          if ((a.rr_round_number || 0) !== (b.rr_round_number || 0)) {
            return (a.rr_round_number || 0) - (b.rr_round_number || 0);
          }
          const groupAIdx = groups.findIndex(g => g.id === a.group_id);
          const groupBIdx = groups.findIndex(g => g.id === b.group_id);
          return groupAIdx - groupBIdx;
        });

      // Create match data with group index
      const matchData = groupMatches.map((m, idx) => ({
        matchIndex: idx,
        matchId: m.id,
        groupIndex: groups.findIndex(g => g.id === m.group_id),
      }));

      // Assign courts
      const courtAssignments = assignCourtsToMatches(
        matchData.map(m => ({ groupIndex: m.groupIndex })),
        courts,
        groups.length
      );

      // Calculate times
      const timeAssignments = startTime 
        ? calculateMatchTimes(courtAssignments, courts, startTime, 20)
        : new Map<number, string>();

      // Update each match
      for (const md of matchData) {
        const courtId = courtAssignments.get(md.matchIndex) || null;
        const startAt = timeAssignments.get(md.matchIndex) || null;
        
        await supabase
          .from('quick_table_matches')
          .update({ court_id: courtId, start_at: startAt })
          .eq('id', md.matchId);
      }

      return true;
    } catch (error) {
      console.error('Error reassigning courts:', error);
      return false;
    }
  }, []);

  return {
    loading,
    createTable,
    getTableByShareId,
    getUserTables,
    getUserQuickTableCount,
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
    updateTableCourtSettings,
    reassignCourtsAndTimes,
  };
}
