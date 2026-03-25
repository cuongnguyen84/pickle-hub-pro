import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { QuickTable, QuickTableGroup, QuickTablePlayer, QuickTableMatch, QuickMatchStatus, QuickTableStatus } from './useQuickTable';
import { generateRoundRobinMatches } from '@/lib/quick-table-utils';

export function useQuickTableMutations() {
  const { user } = useAuth();

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
        String.fromCharCode(65 + i)
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
      toast.error('Không thể tạo bảng');
      return [];
    }
  }, []);

  const createGroupMatches = useCallback(async (
    tableId: string,
    groupId: string,
    playerIds: string[],
    _groupIndex: number = 0
  ): Promise<QuickTableMatch[]> => {
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

    const { data: match } = await supabase
      .from('quick_table_matches')
      .select('player1_id, player2_id, is_playoff, playoff_round, playoff_match_number, table_id, winner_id')
      .eq('id', matchId)
      .single();

    if (!match) return;

    const newWinner = winnerId === 'player1' ? match.player1_id : 
                      winnerId === 'player2' ? match.player2_id : null;

    const { error: updateError } = await supabase
      .from('quick_table_matches')
      .update({
        score1,
        score2,
        winner_id: newWinner,
        status: 'completed' as QuickMatchStatus,
        live_referee_id: null,
      })
      .eq('id', matchId);
    
    if (updateError) return;

    if (match.is_playoff && match.playoff_round !== null) {
      const currentRound = match.playoff_round;
      const nextRound = currentRound + 1;
      
      const { data: currentRoundMatches } = await supabase
        .from('quick_table_matches')
        .select('id, playoff_match_number')
        .eq('table_id', match.table_id)
        .eq('is_playoff', true)
        .eq('playoff_round', currentRound)
        .order('playoff_match_number');
      
      if (!currentRoundMatches) return;
      
      const positionInRound = currentRoundMatches.findIndex(m => m.id === matchId);
      const nextMatchIndex = Math.floor(positionInRound / 2);
      const slot = positionInRound % 2;
      
      const { data: nextRoundMatches } = await supabase
        .from('quick_table_matches')
        .select('id, playoff_match_number, player1_id, player2_id')
        .eq('table_id', match.table_id)
        .eq('is_playoff', true)
        .eq('playoff_round', nextRound)
        .order('playoff_match_number');
      
      if (nextRoundMatches && nextRoundMatches.length > nextMatchIndex) {
        const nextMatch = nextRoundMatches[nextMatchIndex];
        const updateData = slot === 0 
          ? { player1_id: newWinner }
          : { player2_id: newWinner };
        
        await supabase
          .from('quick_table_matches')
          .update(updateData)
          .eq('id', nextMatch.id);
      } else {
        const isFinalMatch = currentRoundMatches.length === 1;
        if (isFinalMatch && newWinner) {
          await supabase
            .from('quick_tables')
            .update({ status: 'completed' as QuickTableStatus })
            .eq('id', match.table_id);
        }
      }
    }
  }, []);

  const updatePlayerStats = useCallback(async (
    _tableId: string,
    groupId: string
  ): Promise<void> => {
    const { data: matches, error: matchError } = await supabase
      .from('quick_table_matches')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'completed');

    if (matchError || !matches || matches.length === 0) return;

    const { data: players, error: playerError } = await supabase
      .from('quick_table_players')
      .select('*')
      .eq('group_id', groupId);

    if (playerError || !players || players.length === 0) return;

    const stats: Record<string, { played: number; won: number; pf: number; pa: number }> = {};

    for (const player of players) {
      stats[player.id] = { played: 0, won: 0, pf: 0, pa: 0 };
    }

    for (const match of matches) {
      if (match.player1_id && match.player2_id && match.score1 !== null && match.score2 !== null) {
        const player1Wins = match.score1 > match.score2;
        const player2Wins = match.score2 > match.score1;
        
        if (stats[match.player1_id]) {
          stats[match.player1_id].played++;
          stats[match.player1_id].pf += match.score1;
          stats[match.player1_id].pa += match.score2;
          if (player1Wins) stats[match.player1_id].won++;
        }
        if (stats[match.player2_id]) {
          stats[match.player2_id].played++;
          stats[match.player2_id].pf += match.score2;
          stats[match.player2_id].pa += match.score1;
          if (player2Wins) stats[match.player2_id].won++;
        }
      }
    }

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
    } catch {
      return false;
    }
  }, []);

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
          display_order: 999,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as QuickTablePlayer;
    } catch {
      return null;
    }
  }, []);

  const removePlayerFromGroup = useCallback(async (
    playerId: string
  ): Promise<boolean> => {
    try {
      await supabase
        .from('quick_table_matches')
        .delete()
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

      const { error } = await supabase
        .from('quick_table_players')
        .delete()
        .eq('id', playerId);
      
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  }, []);

  const regenerateGroupMatches = useCallback(async (
    tableId: string,
    groupId: string,
    playerIds: string[]
  ): Promise<boolean> => {
    try {
      await supabase
        .from('quick_table_matches')
        .delete()
        .eq('group_id', groupId)
        .eq('is_playoff', false);

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
    } catch {
      return false;
    }
  }, []);

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
    } catch {
      return false;
    }
  }, []);

  const reassignCourtsAndTimes = useCallback(async (
    tableId: string,
    courts: number[],
    startTime: string | null,
    groups: QuickTableGroup[],
    matches: QuickTableMatch[]
  ): Promise<boolean> => {
    if (courts.length === 0) {
      try {
        const groupMatchIds = matches.filter(m => !m.is_playoff && m.group_id).map(m => m.id);
        if (groupMatchIds.length > 0) {
          await supabase
            .from('quick_table_matches')
            .update({ court_id: null, start_at: null })
            .in('id', groupMatchIds);
        }
        return true;
      } catch {
        return false;
      }
    }

    try {
      const { assignCourtsToMatches, calculateMatchTimes } = await import('@/lib/round-robin');
      
      const groupMatches = matches
        .filter(m => !m.is_playoff && m.group_id)
        .sort((a, b) => {
          if ((a.rr_round_number || 0) !== (b.rr_round_number || 0)) {
            return (a.rr_round_number || 0) - (b.rr_round_number || 0);
          }
          const groupAIdx = groups.findIndex(g => g.id === a.group_id);
          const groupBIdx = groups.findIndex(g => g.id === b.group_id);
          return groupAIdx - groupBIdx;
        });

      const matchData = groupMatches.map((m, idx) => ({
        matchIndex: idx,
        matchId: m.id,
        groupIndex: groups.findIndex(g => g.id === m.group_id),
      }));

      const courtAssignments = assignCourtsToMatches(
        matchData.map(m => ({ groupIndex: m.groupIndex })),
        courts,
        groups.length
      );

      const timeAssignments = startTime 
        ? calculateMatchTimes(courtAssignments, courts, startTime, 20)
        : new Map<number, string>();

      for (const md of matchData) {
        const courtId = courtAssignments.get(md.matchIndex) || null;
        const startAt = timeAssignments.get(md.matchIndex) || null;
        
        await supabase
          .from('quick_table_matches')
          .update({ court_id: courtId, start_at: startAt })
          .eq('id', md.matchId);
      }

      return true;
    } catch {
      return false;
    }
  }, []);

  const deleteTable = useCallback(async (tableId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('delete_quick_table', {
        _table_id: tableId
      });
      
      if (error) throw error;
      
      toast.success('Đã xoá giải đấu');
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Permission denied')) {
        toast.error('Bạn không có quyền xoá giải đấu này');
      } else {
        toast.error('Không thể xoá giải đấu');
      }
      return false;
    }
  }, []);

  return {
    addPlayers,
    createGroups,
    createGroupMatches,
    updateMatchScore,
    updatePlayerStats,
    updateTableStatus,
    movePlayerToGroup,
    addPlayerToGroup,
    removePlayerFromGroup,
    regenerateGroupMatches,
    updateTableCourtSettings,
    reassignCourtsAndTimes,
    deleteTable,
  };
}
