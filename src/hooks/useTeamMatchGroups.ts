import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { generateCircleMethodMatches } from '@/lib/round-robin';
import type { TeamMatchTeam } from './useTeamMatchTeams';

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

  // Create groups and assign teams, then generate group stage matches
  const createGroupsMutation = useMutation({
    mutationFn: async ({ 
      tournamentId, 
      groupCount,
      distribution,
      gameTemplates,
      hasDreambreaker,
    }: {
      tournamentId: string;
      groupCount: number;
      distribution: Array<Array<{ id: string; name: string }>>;
      gameTemplates: { game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS'; scoring_type: 'rally21' | 'sideout11'; display_name: string | null; order_index: number }[];
      hasDreambreaker?: boolean;
    }) => {
      // 1. Create groups
      const groupsToInsert = distribution.map((_, index) => ({
        tournament_id: tournamentId,
        name: `Bảng ${String.fromCharCode(65 + index)}`,
        display_order: index,
      }));

      const { data: groups, error: groupsError } = await supabase
        .from('team_match_groups')
        .insert(groupsToInsert)
        .select();

      if (groupsError) throw groupsError;
      if (!groups) throw new Error('Failed to create groups');

      // 2. Assign teams to groups
      for (let i = 0; i < distribution.length; i++) {
        const group = groups[i];
        const teamsInGroup = distribution[i];

        for (const team of teamsInGroup) {
          const { error } = await supabase
            .from('team_match_teams')
            .update({ group_id: group.id })
            .eq('id', team.id);

          if (error) throw error;
        }
      }

      // 3. Update tournament with group_count
      const { error: tournamentError } = await supabase
        .from('team_match_tournaments')
        .update({ 
          group_count: groupCount,
          status: 'ongoing' 
        })
        .eq('id', tournamentId);

      if (tournamentError) throw tournamentError;

      // 4. Generate round-robin matches for each group
      const allMatches: any[] = [];
      let globalDisplayOrder = 0;

      for (let i = 0; i < distribution.length; i++) {
        const group = groups[i];
        const teamsInGroup = distribution[i];

        // Use circle method for round-robin
        const teamIds = teamsInGroup.map(t => t.id);
        const rrMatches = generateCircleMethodMatches(teamIds);

        for (const match of rrMatches) {
          // Skip BYE matches
          if (match.player1 === 'BYE' || match.player2 === 'BYE') continue;

          allMatches.push({
            tournament_id: tournamentId,
            group_id: group.id,
            team_a_id: match.player1,
            team_b_id: match.player2,
            games_won_a: 0,
            games_won_b: 0,
            total_points_a: 0,
            total_points_b: 0,
            winner_team_id: null,
            status: 'pending',
            round_number: match.rrRoundNumber,
            is_playoff: false,
            playoff_round: null,
            bracket_position: null,
            next_match_id: null,
            next_match_slot: null,
            lineup_a_submitted: false,
            lineup_b_submitted: false,
            display_order: globalDisplayOrder++,
          });
        }
      }

      // Insert all matches
      const { data: insertedMatches, error: matchError } = await supabase
        .from('team_match_matches')
        .insert(allMatches)
        .select();

      if (matchError) throw matchError;

      // 5. Create games for each match based on templates
      if (insertedMatches && gameTemplates.length > 0) {
        const isEvenGames = gameTemplates.length % 2 === 0;
        const shouldAddDreambreaker = hasDreambreaker && isEvenGames;
        
        const games = insertedMatches.flatMap(match => {
          const regularGames = gameTemplates.map((template, index) => ({
            match_id: match.id,
            order_index: index,
            game_type: template.game_type,
            scoring_type: template.scoring_type,
            display_name: template.display_name,
            is_dreambreaker: false,
            score_a: 0,
            score_b: 0,
            status: 'pending',
          }));
          
          // Add dreambreaker as the last game
          if (shouldAddDreambreaker) {
            regularGames.push({
              match_id: match.id,
              order_index: gameTemplates.length,
              game_type: 'MS' as const,
              scoring_type: 'rally21' as const,
              display_name: 'Dreambreaker',
              is_dreambreaker: true,
              score_a: 0,
              score_b: 0,
              status: 'pending',
            });
          }
          
          return regularGames;
        });

        const { error: gamesError } = await supabase
          .from('team_match_games')
          .insert(games);

        if (gamesError) throw gamesError;
      }

      return { groups, matchCount: insertedMatches?.length || 0 };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-groups', variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-tournament'] });
      toast({
        title: 'Thành công',
        description: `Đã chia ${result.groups.length} bảng và tạo ${result.matchCount} trận đấu`,
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
      // Delete groups (cascades to remove group_id from teams/matches)
      const { error } = await supabase
        .from('team_match_groups')
        .delete()
        .eq('tournament_id', tournamentId);

      if (error) throw error;

      // Reset tournament group_count
      await supabase
        .from('team_match_tournaments')
        .update({ group_count: null })
        .eq('id', tournamentId);

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
