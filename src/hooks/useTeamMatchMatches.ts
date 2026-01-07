import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamMatchTeam } from './useTeamMatchTeams';

export interface TeamMatchMatch {
  id: string;
  tournament_id: string;
  team_a_id: string | null;
  team_b_id: string | null;
  games_won_a: number;
  games_won_b: number;
  total_points_a: number;
  total_points_b: number;
  winner_team_id: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  round_number: number | null;
  is_playoff: boolean;
  playoff_round: number | null;
  bracket_position: number | null;
  next_match_id: string | null;
  next_match_slot: number | null;
  lineup_a_submitted: boolean;
  lineup_b_submitted: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  team_a?: TeamMatchTeam;
  team_b?: TeamMatchTeam;
}

export interface TeamMatchGame {
  id: string;
  match_id: string;
  template_id: string | null;
  order_index: number;
  game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS';
  scoring_type: 'rally21' | 'sideout11';
  display_name: string | null;
  is_dreambreaker: boolean;
  lineup_team_a: string[] | null;
  lineup_team_b: string[] | null;
  score_a: number;
  score_b: number;
  winner_team_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Hook for fetching matches of a tournament
export function useTeamMatchMatches(tournamentId: string | undefined) {
  return useQuery({
    queryKey: ['team-match-matches', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return [];
      
      const { data, error } = await supabase
        .from('team_match_matches')
        .select(`
          *,
          team_a:team_match_teams!team_match_matches_team_a_id_fkey(id, team_name, status),
          team_b:team_match_teams!team_match_matches_team_b_id_fkey(id, team_name, status)
        `)
        .eq('tournament_id', tournamentId)
        .order('round_number', { ascending: true })
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as unknown as TeamMatchMatch[];
    },
    enabled: !!tournamentId,
  });
}

// Hook for fetching a single match with games
export function useTeamMatchMatch(matchId: string | undefined) {
  const matchQuery = useQuery({
    queryKey: ['team-match-match', matchId],
    queryFn: async () => {
      if (!matchId) return null;
      
      const { data, error } = await supabase
        .from('team_match_matches')
        .select(`
          *,
          team_a:team_match_teams!team_match_matches_team_a_id_fkey(id, team_name, status),
          team_b:team_match_teams!team_match_matches_team_b_id_fkey(id, team_name, status)
        `)
        .eq('id', matchId)
        .single();
      
      if (error) throw error;
      return data as unknown as TeamMatchMatch;
    },
    enabled: !!matchId,
  });

  const gamesQuery = useQuery({
    queryKey: ['team-match-games', matchId],
    queryFn: async () => {
      if (!matchId) return [];
      
      const { data, error } = await supabase
        .from('team_match_games')
        .select('*')
        .eq('match_id', matchId)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as TeamMatchGame[];
    },
    enabled: !!matchId,
  });

  return {
    match: matchQuery.data,
    games: gamesQuery.data || [],
    isLoading: matchQuery.isLoading || gamesQuery.isLoading,
  };
}

// Hook for match management operations
export function useTeamMatchMatchManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate round-robin matches
  const generateMatchesMutation = useMutation({
    mutationFn: async ({ tournamentId, teams, gameTemplates }: {
      tournamentId: string;
      teams: TeamMatchTeam[];
      gameTemplates: { game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS'; scoring_type: 'rally21' | 'sideout11'; display_name: string | null; order_index: number }[];
    }) => {
      // Generate round-robin schedule
      const approvedTeams = teams.filter(t => t.status === 'approved');
      const n = approvedTeams.length;
      
      if (n < 2) throw new Error('Cần ít nhất 2 đội để tạo lịch thi đấu');

      const matches: Omit<TeamMatchMatch, 'id' | 'created_at' | 'updated_at' | 'team_a' | 'team_b'>[] = [];
      
      // Round-robin algorithm
      const teamsForSchedule = [...approvedTeams];
      if (n % 2 !== 0) {
        teamsForSchedule.push({ id: 'BYE' } as TeamMatchTeam); // Add BYE if odd number
      }
      
      const numRounds = teamsForSchedule.length - 1;
      const halfSize = teamsForSchedule.length / 2;

      for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < halfSize; i++) {
          const teamA = teamsForSchedule[i];
          const teamB = teamsForSchedule[teamsForSchedule.length - 1 - i];
          
          // Skip BYE matches
          if (teamA.id === 'BYE' || teamB.id === 'BYE') continue;
          
          matches.push({
            tournament_id: tournamentId,
            team_a_id: teamA.id,
            team_b_id: teamB.id,
            games_won_a: 0,
            games_won_b: 0,
            total_points_a: 0,
            total_points_b: 0,
            winner_team_id: null,
            status: 'pending',
            round_number: round + 1,
            is_playoff: false,
            playoff_round: null,
            bracket_position: null,
            next_match_id: null,
            next_match_slot: null,
            lineup_a_submitted: false,
            lineup_b_submitted: false,
            display_order: matches.length,
          });
        }
        
        // Rotate teams (keep first team fixed)
        teamsForSchedule.splice(1, 0, teamsForSchedule.pop()!);
      }

      // Insert matches
      const { data: insertedMatches, error: matchError } = await supabase
        .from('team_match_matches')
        .insert(matches)
        .select();

      if (matchError) throw matchError;

      // Create games for each match based on templates
      if (insertedMatches && gameTemplates.length > 0) {
        const games = insertedMatches.flatMap(match => 
          gameTemplates.map((template, index) => ({
            match_id: match.id,
            order_index: index,
            game_type: template.game_type,
            scoring_type: template.scoring_type,
            display_name: template.display_name,
            is_dreambreaker: false,
            score_a: 0,
            score_b: 0,
            status: 'pending',
          }))
        );

        const { error: gamesError } = await supabase
          .from('team_match_games')
          .insert(games);

        if (gamesError) throw gamesError;
      }

      return insertedMatches;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', variables.tournamentId] });
      toast({
        title: 'Thành công',
        description: 'Đã tạo lịch thi đấu',
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

  // Update game score
  const updateGameScoreMutation = useMutation({
    mutationFn: async ({ gameId, scoreA, scoreB, matchId }: {
      gameId: string;
      scoreA: number;
      scoreB: number;
      matchId: string;
    }) => {
      const winnerId = scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : null;
      
      const { error } = await supabase
        .from('team_match_games')
        .update({
          score_a: scoreA,
          score_b: scoreB,
          status: winnerId ? 'completed' : 'in_progress',
        })
        .eq('id', gameId);

      if (error) throw error;
      return { gameId, matchId };
    },
    onSuccess: ({ matchId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-games', matchId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-match', matchId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update match result
  const updateMatchResultMutation = useMutation({
    mutationFn: async ({ matchId, gamesWonA, gamesWonB, totalPointsA, totalPointsB, winnerId, tournamentId }: {
      matchId: string;
      gamesWonA: number;
      gamesWonB: number;
      totalPointsA: number;
      totalPointsB: number;
      winnerId: string | null;
      tournamentId: string;
    }) => {
      const { error } = await supabase
        .from('team_match_matches')
        .update({
          games_won_a: gamesWonA,
          games_won_b: gamesWonB,
          total_points_a: totalPointsA,
          total_points_b: totalPointsB,
          winner_team_id: winnerId,
          status: winnerId ? 'completed' : 'in_progress',
        })
        .eq('id', matchId);

      if (error) throw error;
      return { matchId, tournamentId };
    },
    onSuccess: ({ matchId, tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-match', matchId] });
      toast({
        title: 'Đã lưu',
        description: 'Kết quả trận đấu đã được cập nhật',
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

  // Delete all matches of a tournament
  const deleteMatchesMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { error } = await supabase
        .from('team_match_matches')
        .delete()
        .eq('tournament_id', tournamentId);

      if (error) throw error;
      return tournamentId;
    },
    onSuccess: (tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournamentId] });
      toast({
        title: 'Đã xóa',
        description: 'Đã xóa tất cả trận đấu',
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
    generateMatches: generateMatchesMutation.mutateAsync,
    isGenerating: generateMatchesMutation.isPending,
    updateGameScore: updateGameScoreMutation.mutateAsync,
    isUpdatingScore: updateGameScoreMutation.isPending,
    updateMatchResult: updateMatchResultMutation.mutateAsync,
    isUpdatingResult: updateMatchResultMutation.isPending,
    deleteMatches: deleteMatchesMutation.mutateAsync,
    isDeletingMatches: deleteMatchesMutation.isPending,
  };
}
