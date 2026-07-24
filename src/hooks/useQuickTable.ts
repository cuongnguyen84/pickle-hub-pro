import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { tStandalone } from '@/lib/i18n-standalone';
import { sanitizeString } from '@/lib/validation';
import { useQuickTableMutations } from './useQuickTableMutations';
import type { Json } from '@/integrations/supabase/types';
import {
  suggestGroupConfigs,
  generateRoundRobinMatches,
  distributePlayersToGroups,
  getWildcardCount,
} from '@/lib/quick-table-utils';
import type { GroupSuggestion } from '@/lib/quick-table-utils';

// Re-export pure functions and types for backward compatibility
export { suggestGroupConfigs, generateRoundRobinMatches, distributePlayersToGroups };
export type { GroupSuggestion };

// Re-export round-robin utilities
export { generateCircleMethodMatches, parseCourtsInput, assignCourtsToMatches, calculateMatchTimes, mergeMatchesByRound, optimizeMatchOrder } from '@/lib/round-robin';

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
  requires_registration: boolean;
  requires_skill_level: boolean;
  min_skill_level: number | null;
  max_skill_level: number | null;
  skill_rating_system: string | null;
  // Sprint B1.1 — opt-in DUPR enforcement (added 2026-05-27).
  rating_source: "self" | "dupr" | "either";
  auto_approve_registrations: boolean;
  registration_message: string | null;
  courts: string[] | null;
  start_time: string | null;
  is_doubles: boolean;
  parent_tournament_id: string | null;
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
  player1_name: string | null;   // tên VĐV 1 (đôi/đơn) — cho màn trọng tài
  player2_name: string | null;   // tên VĐV 2 (chỉ đôi)
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
  court_id: number | null;
  court_name: string | null;
  start_at: string | null;
  rr_round_number: number | null;
  rr_match_index: number | null;
}

export function useQuickTable() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const mutations = useQuickTableMutations();

  const getUserQuickTableCount = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    try {
      const { data, error } = await supabase.rpc('get_user_quick_table_count', { _user_id: user.id });
      if (error) throw error;
      return data || 0;
    } catch {
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
      is_doubles?: boolean;
      // Sprint B1.3 — DUPR enforcement fields applied via post-RPC UPDATE
      // so the RPC signature (and its plpgsql body) doesn't need to change.
      rating_source?: "self" | "dupr" | "either";
    }
  ): Promise<QuickTable | null> => {
    if (!user) {
      toast.error(tStandalone('toast.table.createTable.authRequired'));
      return null;
    }

    setLoading(true);
    try {
      const safeName = sanitizeString(name, 100);
      if (!safeName) {
        toast.error(tStandalone('toast.table.createTable.nameRequired'));
        return null;
      }
      const safeMessage = registrationOptions?.registration_message
        ? sanitizeString(registrationOptions.registration_message, 500)
        : null;
      const safePlayerCount = Math.min(Math.max(playerCount, 2), 200);

      const { data, error } = await supabase.rpc('create_quick_table_with_quota', {
        _name: safeName,
        _player_count: safePlayerCount,
        _format: format,
        _group_count: groupCount || undefined,
        _requires_registration: registrationOptions?.requires_registration || false,
        _requires_skill_level: registrationOptions?.requires_skill_level || false,
        _auto_approve_registrations: registrationOptions?.auto_approve_registrations || false,
        _registration_message: safeMessage ?? undefined,
        _is_doubles: registrationOptions?.is_doubles ?? true,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; table?: unknown; count?: number };
      
      if (!result.success) {
        if (result.error === 'LIMIT_REACHED') {
          toast.error(tStandalone('toast.table.createTable.limitReached'));
          return null;
        }
        if (result.error === 'AUTH_REQUIRED') {
          toast.error(tStandalone('toast.table.createTable.authRequired'));
          return null;
        }
        throw new Error(result.error || 'Unknown error');
      }

      // Sprint B1.3 — apply DUPR fields via UPDATE since the RPC doesn't
      // know about them. Skipped when caller is at defaults (avoids an
      // extra round-trip for tables that don't use DUPR enforcement).
      const createdTable = result.table as QuickTable;
      const wantsDupr =
        registrationOptions?.rating_source && registrationOptions.rating_source !== 'self';
      const hasMin = registrationOptions?.min_skill_level != null;
      const hasMax = registrationOptions?.max_skill_level != null;
      if (wantsDupr || hasMin || hasMax) {
        const { error: updateErr } = await supabase
          .from('quick_tables')
          .update({
            rating_source: registrationOptions?.rating_source ?? 'self',
            min_skill_level: registrationOptions?.min_skill_level ?? null,
            max_skill_level: registrationOptions?.max_skill_level ?? null,
          })
          .eq('id', createdTable.id);
        if (updateErr) {
          // Non-fatal — table already exists. Surface error but return table.
          console.warn('createTable: DUPR fields update failed', updateErr);
          toast.error('Lưu cài đặt DUPR thất bại — vui lòng chỉnh trong settings');
        } else {
          // Mirror values into returned object so caller sees the truth.
          createdTable.rating_source = registrationOptions?.rating_source ?? 'self';
          createdTable.min_skill_level = registrationOptions?.min_skill_level ?? null;
          createdTable.max_skill_level = registrationOptions?.max_skill_level ?? null;
        }
      }
      return createdTable;
    } catch {
      toast.error(tStandalone('toast.table.createTable.error'));
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
    } catch {
      return null;
    }
  }, []);

  const isOwner = useCallback((table: QuickTable): boolean => {
    return !!user && table.creator_user_id === user.id;
  }, [user]);

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
        qualified.push({ ...p, playoff_seed: idx + 1 });
      });

      if (groupPlayers[topPerGroup]) {
        thirdPlace.push(groupPlayers[topPerGroup]);
      }
    }

    return { qualified, thirdPlace };
  }, []);

  const generatePlayoffBracket = useCallback((
    groupCount: number,
    qualified: QuickTablePlayer[],
    wildcards: QuickTablePlayer[],
    groups: QuickTableGroup[]
  ): Array<{ player1: QuickTablePlayer | null; player2: QuickTablePlayer | null; bracketPosition: string; matchNumber: number }> => {
    const matches: Array<{ player1: QuickTablePlayer | null; player2: QuickTablePlayer | null; bracketPosition: string; matchNumber: number }> = [];

    let wildcardIndex = 0;

    const getPlayer = (groupName: string, seed: number): QuickTablePlayer | null => {
      const group = groups.find(g => g.name === groupName);
      if (!group) return null;
      return qualified.find(p => p.group_id === group.id && p.playoff_seed === seed) || null;
    };

    const getNextWildcard = (excludeGroupId?: string): QuickTablePlayer | null => {
      if (wildcardIndex >= wildcards.length) return null;
      
      const preferredIdx = wildcards.findIndex((w, idx) => 
        idx >= wildcardIndex && w.group_id !== excludeGroupId
      );
      
      if (preferredIdx >= wildcardIndex) {
        const wc = wildcards[preferredIdx];
        [wildcards[wildcardIndex], wildcards[preferredIdx]] = [wildcards[preferredIdx], wildcards[wildcardIndex]];
        wildcardIndex++;
        return wc;
      }
      
      const wc = wildcards[wildcardIndex];
      wildcardIndex++;
      return wc;
    };

    switch (groupCount) {
      case 2:
        matches.push({ player1: getPlayer('A', 1), player2: getPlayer('B', 2), bracketPosition: 'upper', matchNumber: 1 });
        matches.push({ player1: getPlayer('B', 1), player2: getPlayer('A', 2), bracketPosition: 'lower', matchNumber: 2 });
        break;

      case 3:
        matches.push({ player1: getPlayer('A', 1), player2: getPlayer('B', 2), bracketPosition: 'upper', matchNumber: 1 });
        matches.push({ player1: getPlayer('C', 1), player2: getNextWildcard(), bracketPosition: 'upper', matchNumber: 2 });
        matches.push({ player1: getPlayer('B', 1), player2: getPlayer('A', 2), bracketPosition: 'lower', matchNumber: 3 });
        matches.push({ player1: getPlayer('C', 2), player2: getNextWildcard(), bracketPosition: 'lower', matchNumber: 4 });
        break;

      case 4:
        matches.push({ player1: getPlayer('A', 1), player2: getPlayer('B', 2), bracketPosition: 'upper', matchNumber: 1 });
        matches.push({ player1: getPlayer('C', 1), player2: getPlayer('D', 2), bracketPosition: 'upper', matchNumber: 2 });
        matches.push({ player1: getPlayer('B', 1), player2: getPlayer('A', 2), bracketPosition: 'lower', matchNumber: 3 });
        matches.push({ player1: getPlayer('D', 1), player2: getPlayer('C', 2), bracketPosition: 'lower', matchNumber: 4 });
        break;

      case 6: {
        const groupE = groups.find(g => g.name === 'E');
        const groupF = groups.find(g => g.name === 'F');
        matches.push({ player1: getPlayer('A', 1), player2: getPlayer('B', 2), bracketPosition: 'upper', matchNumber: 1 });
        matches.push({ player1: getPlayer('C', 1), player2: getPlayer('D', 2), bracketPosition: 'upper', matchNumber: 2 });
        matches.push({ player1: getPlayer('E', 1), player2: getNextWildcard(groupE?.id), bracketPosition: 'upper', matchNumber: 3 });
        matches.push({ player1: getPlayer('F', 1), player2: getNextWildcard(groupF?.id), bracketPosition: 'upper', matchNumber: 4 });
        matches.push({ player1: getPlayer('B', 1), player2: getPlayer('A', 2), bracketPosition: 'lower', matchNumber: 5 });
        matches.push({ player1: getPlayer('D', 1), player2: getPlayer('C', 2), bracketPosition: 'lower', matchNumber: 6 });
        matches.push({ player1: getPlayer('E', 2), player2: getNextWildcard(groupE?.id), bracketPosition: 'lower', matchNumber: 7 });
        matches.push({ player1: getPlayer('F', 2), player2: getNextWildcard(groupF?.id), bracketPosition: 'lower', matchNumber: 8 });
        break;
      }

      case 8:
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

  const createPlayoffAtomic = useCallback(async (
    tableId: string,
    qualified: QuickTablePlayer[],
    wildcards: QuickTablePlayer[],
    bracketMatches: Array<{
      player1: QuickTablePlayer | null;
      player2: QuickTablePlayer | null;
      bracketPosition: string;
      matchNumber: number;
    }>,
  ): Promise<void> => {
    const qualifiers = [
      ...qualified.map((player, index) => ({
        player_id: player.id,
        playoff_seed: player.playoff_seed ?? player.seed ?? index + 1,
        is_wildcard: false,
      })),
      ...wildcards.map((player, index) => ({
        player_id: player.id,
        playoff_seed: player.playoff_seed ?? 100 + index,
        is_wildcard: true,
      })),
    ];
    const { data, error } = await supabase.rpc('create_quick_table_playoff_atomic', {
      p_table_id: tableId,
      p_qualifiers: qualifiers as Json,
      p_first_round: bracketMatches.map(match => ({
        player1_id: match.player1?.id ?? null,
        player2_id: match.player2?.id ?? null,
        bracket_position: match.bracketPosition,
        match_number: match.matchNumber,
      })) as Json,
    });
    const result = (data ?? {}) as Record<string, unknown>;
    if (error || result.success !== true) {
      throw error ?? new Error(String(result.error ?? 'PLAYOFF_CREATE_FAILED'));
    }
  }, []);

  const isGroupStageComplete = useCallback((matches: QuickTableMatch[]): boolean => {
    const groupMatches = matches.filter(m => !m.is_playoff);
    return groupMatches.length > 0 && groupMatches.every(m => m.status === 'completed');
  }, []);

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
    } catch {
      return [];
    }
  }, [user]);

  const getUserQuotaInfo = useCallback(async (): Promise<{ current_count: number; quota: number } | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.rpc('get_user_quota_info', { _user_id: user.id });
      if (error) throw error;
      return data as { current_count: number; quota: number };
    } catch {
      return null;
    }
  }, [user]);

  return {
    loading,
    createTable,
    getTableByShareId,
    getUserTables,
    getUserQuickTableCount,
    getUserQuotaInfo,
    isOwner,
    suggestGroupConfigs,
    getQualifiedPlayers,
    generatePlayoffBracket,
    createPlayoffAtomic,
    isGroupStageComplete,
    getWildcardCount,
    // Spread mutations
    ...mutations,
  };
}
