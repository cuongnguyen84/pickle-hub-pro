import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TeamMatchGroup {
  id: string;
  tournament_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

// Hook for fetching groups of a tournament
export function useTeamMatchGroups(tournamentId: string | undefined) {
  return useQuery({
    queryKey: ['team-match-groups', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return [];
      
      const { data, error } = await supabase
        .from('team_match_groups')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as TeamMatchGroup[];
    },
    enabled: !!tournamentId,
  });
}

// Hook for group management operations
export function useTeamMatchGroupManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create groups, assignments, matches and games in one transaction.
  const createGroupsMutation = useMutation({
    mutationFn: async ({
      tournamentId,
      distribution,
      randomizeGameOrder,
    }: {
      tournamentId: string;
      distribution: Array<Array<{ id: string; name: string }>>;
      /** Randomize the game order within each match (per match). */
      randomizeGameOrder?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('generate_team_match_round_robin_atomic', {
        p_tournament_id: tournamentId,
        p_groups: distribution.map(group => group.map(team => team.id)),
        p_randomize_game_order: randomizeGameOrder ?? false,
      });
      const result = (data ?? {}) as {
        success?: boolean;
        error?: string;
        group_count?: number;
        match_count?: number;
      };
      if (error || result.success !== true) {
        throw error ?? new Error(result.error ?? 'GROUP_SETUP_FAILED');
      }
      return {
        groupCount: result.group_count ?? distribution.length,
        matchCount: result.match_count ?? 0,
      };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-groups', variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-tournament'] });
      toast({
        title: 'Thành công',
        description: `Đã chia ${result.groupCount} bảng và tạo ${result.matchCount} trận đấu`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete all groups (reset group stage)
  const deleteGroupsMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { data, error } = await supabase.rpc('reset_team_match_lifecycle_atomic', {
        p_tournament_id: tournamentId,
        p_scope: 'group_stage',
      });
      const result = (data ?? {}) as { success?: boolean; error?: string };
      if (error || result.success !== true) {
        throw error ?? new Error(result.error ?? 'RESET_FAILED');
      }

      return tournamentId;
    },
    onSuccess: (tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-groups', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournamentId] });
      toast({
        title: 'Đã xóa',
        description: 'Đã xóa tất cả bảng đấu',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    createGroups: createGroupsMutation.mutateAsync,
    isCreatingGroups: createGroupsMutation.isPending,
    deleteGroups: deleteGroupsMutation.mutateAsync,
    isDeletingGroups: deleteGroupsMutation.isPending,
  };
}
