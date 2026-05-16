import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { QuickTable, QuickTableGroup, QuickTablePlayer, QuickTableMatch, QuickMatchStatus, QuickTableStatus } from './useQuickTable';
import { generateRoundRobinMatches } from '@/lib/quick-table-utils';

// W1.2 — Helper to extract Postgres error code from a Supabase error.
// We use this to surface specific user-facing messages for known RLS
// failures (42501 = permission denied) instead of a single generic
// "something went wrong" toast that hides the real cause.
function pgErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const c = (error as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return null;
}

function isPermissionDenied(error: unknown): boolean {
  // Postgres 42501 = insufficient_privilege (RLS row blocked or
  // missing GRANT). Toast text differs from the generic case so the
  // organizer can distinguish "I don't own this row" from "the
  // server is broken".
  return pgErrorCode(error) === '42501';
}

// Names of every mutation exposed by this hook. Used as keys in the
// `pending` map below so consumers can disable the specific button
// that's in flight without disabling unrelated UI.
type MutationName =
  | 'addPlayers'
  | 'createGroups'
  | 'createGroupMatches'
  | 'updateMatchScore'
  | 'updatePlayerStats'
  | 'updateTableStatus'
  | 'movePlayerToGroup'
  | 'addPlayerToGroup'
  | 'removePlayerFromGroup'
  | 'regenerateGroupMatches'
  | 'updateTableCourtSettings'
  | 'reassignCourtsAndTimes'
  | 'deleteTable'
  | 'updateCourtName';

export type QuickTableMutationsPending = Record<MutationName, boolean>;

const EMPTY_PENDING: QuickTableMutationsPending = {
  addPlayers: false,
  createGroups: false,
  createGroupMatches: false,
  updateMatchScore: false,
  updatePlayerStats: false,
  updateTableStatus: false,
  movePlayerToGroup: false,
  addPlayerToGroup: false,
  removePlayerFromGroup: false,
  regenerateGroupMatches: false,
  updateTableCourtSettings: false,
  reassignCourtsAndTimes: false,
  deleteTable: false,
  updateCourtName: false,
};

export function useQuickTableMutations() {
  // W1.2 — per-mutation pending state. Lets a consumer wire
  // `disabled={pending.deleteTable}` on a delete button so a double
  // tap can't fire two RPCs (especially dangerous for delete and
  // create_quick_table_with_quota which decrements the user quota).
  const [pending, setPending] = useState<QuickTableMutationsPending>(EMPTY_PENDING);

  const setPendingFor = useCallback((name: MutationName, value: boolean) => {
    setPending((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }));
  }, []);

  const addPlayers = useCallback(async (
    tableId: string,
    players: Array<{ name: string; team?: string; seed?: number }>,
  ): Promise<QuickTablePlayer[]> => {
    setPendingFor('addPlayers', true);
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
          })),
        )
        .select();

      if (error) throw error;
      return (data || []) as unknown as QuickTablePlayer[];
    } catch (error) {
      console.error('[useQuickTableMutations] addPlayers:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền thêm VĐV cho giải này');
      } else {
        toast.error('Không thể thêm người chơi');
      }
      return [];
    } finally {
      setPendingFor('addPlayers', false);
    }
  }, [setPendingFor]);

  const createGroups = useCallback(async (
    tableId: string,
    groupCount: number,
  ): Promise<QuickTableGroup[]> => {
    setPendingFor('createGroups', true);
    try {
      const groupNames = Array.from({ length: groupCount }, (_, i) =>
        String.fromCharCode(65 + i),
      );

      const { data, error } = await supabase
        .from('quick_table_groups')
        .insert(
          groupNames.map((name, i) => ({
            table_id: tableId,
            name,
            display_order: i,
          })),
        )
        .select();

      if (error) throw error;
      return (data || []) as unknown as QuickTableGroup[];
    } catch (error) {
      console.error('[useQuickTableMutations] createGroups:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền tạo bảng cho giải này');
      } else {
        toast.error('Không thể tạo bảng');
      }
      return [];
    } finally {
      setPendingFor('createGroups', false);
    }
  }, [setPendingFor]);

  const createGroupMatches = useCallback(async (
    tableId: string,
    groupId: string,
    playerIds: string[],
    _groupIndex: number = 0,
  ): Promise<QuickTableMatch[]> => {
    setPendingFor('createGroupMatches', true);
    try {
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
          })),
        )
        .select();

      if (error) throw error;
      return (data || []) as unknown as QuickTableMatch[];
    } catch (error) {
      console.error('[useQuickTableMutations] createGroupMatches:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền tạo trận đấu');
      } else {
        toast.error('Không thể tạo trận đấu');
      }
      return [];
    } finally {
      setPendingFor('createGroupMatches', false);
    }
  }, [setPendingFor]);

  const updateMatchScore = useCallback(async (
    matchId: string,
    score1: number,
    score2: number,
  ): Promise<void> => {
    setPendingFor('updateMatchScore', true);
    try {
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

      if (updateError) {
        console.error('[useQuickTableMutations] updateMatchScore:', updateError);
        if (isPermissionDenied(updateError)) {
          toast.error('Bạn không có quyền chấm điểm trận này');
        }
        return;
      }

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
    } finally {
      setPendingFor('updateMatchScore', false);
    }
  }, [setPendingFor]);

  const updatePlayerStats = useCallback(async (
    _tableId: string,
    groupId: string,
  ): Promise<void> => {
    setPendingFor('updatePlayerStats', true);
    try {
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
    } finally {
      setPendingFor('updatePlayerStats', false);
    }
  }, [setPendingFor]);

  const updateTableStatus = useCallback(async (
    tableId: string,
    status: QuickTableStatus,
  ): Promise<void> => {
    setPendingFor('updateTableStatus', true);
    try {
      const { error } = await supabase
        .from('quick_tables')
        .update({ status })
        .eq('id', tableId);
      if (error) throw error;
    } catch (error) {
      console.error('[useQuickTableMutations] updateTableStatus:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền cập nhật trạng thái giải');
      }
    } finally {
      setPendingFor('updateTableStatus', false);
    }
  }, [setPendingFor]);

  const movePlayerToGroup = useCallback(async (
    playerId: string,
    newGroupId: string,
  ): Promise<boolean> => {
    setPendingFor('movePlayerToGroup', true);
    try {
      const { error } = await supabase
        .from('quick_table_players')
        .update({ group_id: newGroupId })
        .eq('id', playerId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[useQuickTableMutations] movePlayerToGroup:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền di chuyển VĐV');
      } else {
        toast.error('Không thể di chuyển VĐV');
      }
      return false;
    } finally {
      setPendingFor('movePlayerToGroup', false);
    }
  }, [setPendingFor]);

  const addPlayerToGroup = useCallback(async (
    tableId: string,
    groupId: string,
    playerData: { name: string; team?: string; seed?: number },
  ): Promise<QuickTablePlayer | null> => {
    setPendingFor('addPlayerToGroup', true);
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
    } catch (error) {
      console.error('[useQuickTableMutations] addPlayerToGroup:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền thêm VĐV vào bảng');
      } else {
        toast.error('Không thể thêm VĐV');
      }
      return null;
    } finally {
      setPendingFor('addPlayerToGroup', false);
    }
  }, [setPendingFor]);

  const removePlayerFromGroup = useCallback(async (
    playerId: string,
  ): Promise<boolean> => {
    setPendingFor('removePlayerFromGroup', true);
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
    } catch (error) {
      console.error('[useQuickTableMutations] removePlayerFromGroup:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền xoá VĐV');
      } else {
        toast.error('Không thể xoá VĐV');
      }
      return false;
    } finally {
      setPendingFor('removePlayerFromGroup', false);
    }
  }, [setPendingFor]);

  const regenerateGroupMatches = useCallback(async (
    tableId: string,
    groupId: string,
    playerIds: string[],
  ): Promise<boolean> => {
    setPendingFor('regenerateGroupMatches', true);
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
          })),
        );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[useQuickTableMutations] regenerateGroupMatches:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền tạo lại trận');
      }
      return false;
    } finally {
      setPendingFor('regenerateGroupMatches', false);
    }
  }, [setPendingFor]);

  const updateTableCourtSettings = useCallback(async (
    tableId: string,
    courts: string[],
    startTime: string | null,
  ): Promise<boolean> => {
    setPendingFor('updateTableCourtSettings', true);
    try {
      const { error } = await supabase
        .from('quick_tables')
        .update({
          courts: courts.length > 0 ? courts : [],
          start_time: startTime,
        })
        .eq('id', tableId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[useQuickTableMutations] updateTableCourtSettings:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền cập nhật sân/giờ');
      }
      return false;
    } finally {
      setPendingFor('updateTableCourtSettings', false);
    }
  }, [setPendingFor]);

  const reassignCourtsAndTimes = useCallback(async (
    tableId: string,
    courts: number[],
    startTime: string | null,
    groups: QuickTableGroup[],
    matches: QuickTableMatch[],
  ): Promise<boolean> => {
    setPendingFor('reassignCourtsAndTimes', true);
    try {
      if (courts.length === 0) {
        const groupMatchIds = matches.filter(m => !m.is_playoff && m.group_id).map(m => m.id);
        if (groupMatchIds.length > 0) {
          await supabase
            .from('quick_table_matches')
            .update({ court_id: null, start_at: null })
            .in('id', groupMatchIds);
        }
        return true;
      }

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
        groups.length,
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
    } catch (error) {
      console.error('[useQuickTableMutations] reassignCourtsAndTimes:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền cập nhật lịch');
      }
      return false;
    } finally {
      setPendingFor('reassignCourtsAndTimes', false);
    }
  }, [setPendingFor]);

  const deleteTable = useCallback(async (tableId: string): Promise<boolean> => {
    setPendingFor('deleteTable', true);
    try {
      const { error } = await supabase.rpc('delete_quick_table', {
        _table_id: tableId,
      });

      if (error) throw error;

      toast.success('Đã xoá giải đấu');
      return true;
    } catch (error: unknown) {
      console.error('[useQuickTableMutations] deleteTable:', error);
      const msg = error instanceof Error ? error.message : '';
      if (isPermissionDenied(error) || msg.includes('Permission denied')) {
        toast.error('Bạn không có quyền xoá giải đấu này');
      } else {
        toast.error('Không thể xoá giải đấu');
      }
      return false;
    } finally {
      setPendingFor('deleteTable', false);
    }
  }, [setPendingFor]);

  const updateCourtName = useCallback(async (
    matchId: string,
    courtName: string,
  ): Promise<boolean> => {
    setPendingFor('updateCourtName', true);
    try {
      const { error } = await supabase
        .from('quick_table_matches')
        .update({ court_name: courtName })
        .eq('id', matchId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[useQuickTableMutations] updateCourtName:', error);
      if (isPermissionDenied(error)) {
        toast.error('Bạn không có quyền đổi tên sân');
      }
      return false;
    } finally {
      setPendingFor('updateCourtName', false);
    }
  }, [setPendingFor]);

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
    updateCourtName,
    // W1.2 — per-mutation pending state. Backward compatible: existing
    // consumers that only destructure callbacks keep working. New
    // consumers can wire `disabled={pending.deleteTable}` etc on
    // critical buttons to prevent double-fire.
    pending,
  };
}
