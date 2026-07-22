import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { tStandalone } from '@/lib/i18n-standalone';
import type { QuickTableGroup, QuickTablePlayer, QuickTableMatch, QuickTableStatus } from './useQuickTable';
import { distributePlayersToGroups, generateRoundRobinMatches } from '@/lib/quick-table-utils';
import { accumulateGroupStats } from '@/lib/quickTableResult';
import type { Json } from '@/integrations/supabase/types';

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
  | 'setupRosterAtomic'
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
  setupRosterAtomic: false,
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

  const setupRosterAtomic = useCallback(async (
    tableId: string,
    players: Array<{ name: string; player1_name?: string; player2_name?: string; team?: string; seed?: number }>,
    groupCount: number,
    groupAssignments?: number[],
    courts: number[] = [],
    startTime: string | null = null,
  ): Promise<boolean> => {
    setPendingFor('setupRosterAtomic', true);
    try {
      let assignments = groupAssignments;
      if (!assignments) {
        const indexed = players.map((player, index) => ({
          id: String(index),
          name: player.name,
          team: player.team,
          seed: player.seed,
        }));
        const distributed = distributePlayersToGroups(indexed, groupCount);
        assignments = Array(players.length).fill(-1);
        distributed.forEach((bucket, groupIndex) => {
          bucket.forEach((player) => { assignments![Number(player.id)] = groupIndex; });
        });
      }
      if (assignments.length !== players.length || assignments.some(group => group < 0 || group >= groupCount)) {
        throw new Error('INVALID_ASSIGNMENTS');
      }

      const { data, error } = await supabase.rpc('setup_quick_table_roster_atomic', {
        p_table_id: tableId,
        p_roster: players.map(player => ({
          name: player.name,
          player1_name: player.player1_name ?? null,
          player2_name: player.player2_name ?? null,
          team: player.team ?? null,
          seed: player.seed ?? null,
        })) as Json,
        p_group_assignments: assignments as Json,
        p_courts: courts as Json,
        p_start_time: startTime as string | undefined, // RPC DEFAULT NULL; Args type doesn't model that.
      });
      const result = (data ?? {}) as Record<string, unknown>;
      if (error || result.success !== true) throw error ?? new Error(String(result.error ?? 'SETUP_FAILED'));
      return true;
    } catch (error) {
      console.error('[useQuickTableMutations] setupRosterAtomic:', error);
      if (isPermissionDenied(error)) {
        toast.error(tStandalone('toast.table.createGroupMatches.permissionDenied'));
      } else {
        toast.error(tStandalone('toast.table.createGroupMatches.error'));
      }
      return false;
    } finally {
      setPendingFor('setupRosterAtomic', false);
    }
  }, [setPendingFor]);

  const updateMatchScore = useCallback(async (
    matchId: string,
    score1: number,
    score2: number,
  ): Promise<void> => {
    setPendingFor('updateMatchScore', true);
    try {
      const { data: match, error: fetchError } = await supabase
        .from('quick_table_matches')
        .select('score_version')
        .eq('id', matchId)
        .single();

      if (fetchError || !match) {
        console.error('[useQuickTableMutations] updateMatchScore fetch:', fetchError);
        return;
      }

      const { data, error } = await supabase.rpc('score_quick_table_match_atomic', {
        p_match_id: matchId,
        p_score1: score1,
        p_score2: score2,
        p_expected_version: match.score_version,
      });
      const result = (data ?? {}) as Record<string, unknown>;

      if (error || result.success !== true) {
        console.error('[useQuickTableMutations] updateMatchScore:', error || result);
        if (isPermissionDenied(error)) {
          toast.error(tStandalone('toast.table.updateMatchScore.permissionDenied'));
        } else if (result.error === 'VERSION_CONFLICT') {
          toast.error('Điểm vừa được cập nhật ở thiết bị khác. Hãy tải lại.');
        } else if (result.error === 'DOWNSTREAM_LOCKED') {
          toast.error('Không thể sửa vì trận tiếp theo đã bắt đầu.');
        } else {
          toast.error(typeof result.error === 'string' ? result.error : 'Không thể lưu điểm.');
        }
        return;
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

      const stats = accumulateGroupStats(matches, players.map(p => p.id));

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
        toast.error(tStandalone('toast.table.updateTableStatus.permissionDenied'));
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
        toast.error(tStandalone('toast.table.movePlayer.permissionDenied'));
      } else {
        toast.error(tStandalone('toast.table.movePlayer.error'));
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
        toast.error(tStandalone('toast.table.addPlayerToGroup.permissionDenied'));
      } else {
        toast.error(tStandalone('toast.table.addPlayerToGroup.error'));
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
        toast.error(tStandalone('toast.table.removePlayer.permissionDenied'));
      } else {
        toast.error(tStandalone('toast.table.removePlayer.error'));
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
        toast.error(tStandalone('toast.table.regenerateGroupMatches.permissionDenied'));
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
        toast.error(tStandalone('toast.table.updateCourtSettings.permissionDenied'));
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

      const { scheduleMatches } = await import('@/lib/round-robin');

      // Feed the scheduler in (round, group) order so its output is stable; it
      // is pair-aware, so a player is never double-booked into one time slot.
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

      const scheduled = scheduleMatches(
        groupMatches.map(m => ({
          matchId: m.id,
          player1: m.player1_id,
          player2: m.player2_id,
          groupIndex: groups.findIndex(g => g.id === m.group_id),
        })),
        courts,
        groups.length,
        startTime,
        20,
      );

      // Rewrite court, time AND display_order (play order) — so the match list
      // shows matches chronologically and no pair runs >2 rows in a row.
      for (const s of scheduled) {
        await supabase
          .from('quick_table_matches')
          .update({ court_id: s.court, start_at: s.startAt, display_order: s.displayOrder })
          .eq('id', s.matchId);
      }

      return true;
    } catch (error) {
      console.error('[useQuickTableMutations] reassignCourtsAndTimes:', error);
      if (isPermissionDenied(error)) {
        toast.error(tStandalone('toast.table.reassignCourtsAndTimes.permissionDenied'));
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

      toast.success(tStandalone('toast.table.deleteTable.success'));
      return true;
    } catch (error: unknown) {
      console.error('[useQuickTableMutations] deleteTable:', error);
      const msg = error instanceof Error ? error.message : '';
      if (isPermissionDenied(error) || msg.includes('Permission denied')) {
        toast.error(tStandalone('toast.table.deleteTable.permissionDenied'));
      } else {
        toast.error(tStandalone('toast.table.deleteTable.error'));
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
        toast.error(tStandalone('toast.table.updateCourtName.permissionDenied'));
      }
      return false;
    } finally {
      setPendingFor('updateCourtName', false);
    }
  }, [setPendingFor]);

  return {
    setupRosterAtomic,
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
