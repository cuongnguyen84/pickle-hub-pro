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
      // First get the match to check if it's a playoff match
      const { data: match, error: fetchError } = await supabase
        .from('team_match_matches')
        .select('next_match_id, next_match_slot, is_playoff')
        .eq('id', matchId)
        .single();
      
      if (fetchError) throw fetchError;

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

      // If playoff match completed, advance winner to next match
      if (match.is_playoff && winnerId && match.next_match_id) {
        const slot = match.next_match_slot; // 1 = team_a, 2 = team_b
        const updateField = slot === 1 ? 'team_a_id' : 'team_b_id';
        
        const { error: advanceError } = await supabase
          .from('team_match_matches')
          .update({ [updateField]: winnerId })
          .eq('id', match.next_match_id);
        
        if (advanceError) throw advanceError;

        // Check if next match now has both teams, create games if needed
        const { data: nextMatch } = await supabase
          .from('team_match_matches')
          .select('id, team_a_id, team_b_id')
          .eq('id', match.next_match_id)
          .single();

        if (nextMatch?.team_a_id && nextMatch?.team_b_id) {
          // Check if games already exist
          const { data: existingGames } = await supabase
            .from('team_match_games')
            .select('id')
            .eq('match_id', nextMatch.id)
            .limit(1);

          if (!existingGames || existingGames.length === 0) {
            // Get game templates for this tournament
            const { data: templates } = await supabase
              .from('team_match_game_templates')
              .select('*')
              .eq('tournament_id', tournamentId)
              .order('order_index');

            if (templates && templates.length > 0) {
              const games = templates.map((template, index) => ({
                match_id: nextMatch.id,
                order_index: index,
                game_type: template.game_type,
                scoring_type: template.scoring_type,
                display_name: template.display_name,
                is_dreambreaker: false,
                score_a: 0,
                score_b: 0,
                status: 'pending',
              }));

              await supabase.from('team_match_games').insert(games);
            }
          }
        }
      }

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

  // Generate playoff matches
  const generatePlayoffMatchesMutation = useMutation({
    mutationFn: async ({ tournamentId, qualifyingTeams, gameTemplates }: {
      tournamentId: string;
      qualifyingTeams: { teamId: string; seed: number }[];
      gameTemplates: { game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS'; scoring_type: 'rally21' | 'sideout11'; display_name: string | null; order_index: number }[];
    }) => {
      const teamCount = qualifyingTeams.length;
      if (teamCount < 2 || (teamCount & (teamCount - 1)) !== 0) {
        throw new Error('Số đội phải là lũy thừa của 2 (2, 4, 8, 16...)');
      }

      const totalRounds = Math.log2(teamCount);
      const matches: Omit<TeamMatchMatch, 'id' | 'created_at' | 'updated_at' | 'team_a' | 'team_b'>[] = [];
      
      // First round matches (highest round number)
      const firstRoundMatchCount = teamCount / 2;
      
      for (let i = 0; i < firstRoundMatchCount; i++) {
        // Standard seeding: 1 vs N, 2 vs N-1, etc.
        const seed1 = i + 1;
        const seed2 = teamCount - i;
        
        const team1 = qualifyingTeams.find(t => t.seed === seed1);
        const team2 = qualifyingTeams.find(t => t.seed === seed2);
        
        matches.push({
          tournament_id: tournamentId,
          team_a_id: team1?.teamId || null,
          team_b_id: team2?.teamId || null,
          games_won_a: 0,
          games_won_b: 0,
          total_points_a: 0,
          total_points_b: 0,
          winner_team_id: null,
          status: 'pending',
          round_number: null,
          is_playoff: true,
          playoff_round: totalRounds,
          bracket_position: i,
          next_match_id: null,
          next_match_slot: null, // Will be set when next_match_id is set
          lineup_a_submitted: false,
          lineup_b_submitted: false,
          display_order: i,
        });
      }
      
      // Create later round matches (without teams yet)
      for (let round = totalRounds - 1; round >= 1; round--) {
        const matchesInRound = Math.pow(2, round - 1);
        
        for (let i = 0; i < matchesInRound; i++) {
          matches.push({
            tournament_id: tournamentId,
            team_a_id: null,
            team_b_id: null,
            games_won_a: 0,
            games_won_b: 0,
            total_points_a: 0,
            total_points_b: 0,
            winner_team_id: null,
            status: 'pending',
            round_number: null,
            is_playoff: true,
            playoff_round: round,
            bracket_position: i,
            next_match_id: null,
            next_match_slot: null, // Will be set when next_match_id is set
            lineup_a_submitted: false,
            lineup_b_submitted: false,
            display_order: 100 + (totalRounds - round) * 10 + i,
          });
        }
      }

      // Insert all matches
      const { data: insertedMatches, error: matchError } = await supabase
        .from('team_match_matches')
        .insert(matches)
        .select();

      if (matchError) throw matchError;
      if (!insertedMatches) throw new Error('Không thể tạo trận đấu playoff');

      // Update next_match_id references
      // Group by playoff_round
      const matchesByRound = insertedMatches.reduce((acc, match) => {
        const round = match.playoff_round || 1;
        if (!acc[round]) acc[round] = [];
        acc[round].push(match);
        return acc;
      }, {} as Record<number, typeof insertedMatches>);

      // Link each match to its next round match
      for (let round = totalRounds; round > 1; round--) {
        const currentRoundMatches = (matchesByRound[round] || []).sort((a, b) => 
          (a.bracket_position || 0) - (b.bracket_position || 0)
        );
        const nextRoundMatches = (matchesByRound[round - 1] || []).sort((a, b) => 
          (a.bracket_position || 0) - (b.bracket_position || 0)
        );

        for (let i = 0; i < currentRoundMatches.length; i++) {
          const nextMatchIndex = Math.floor(i / 2);
          const nextMatch = nextRoundMatches[nextMatchIndex];
          
          if (nextMatch) {
            const { error: updateError } = await supabase
              .from('team_match_matches')
              .update({ 
                next_match_id: nextMatch.id,
                next_match_slot: (i % 2) + 1, // 1 = team_a, 2 = team_b (matches constraint)
              })
              .eq('id', currentRoundMatches[i].id);
            
            if (updateError) {
              console.error('Error linking match:', updateError);
            }
          }
        }
      }

      // Create games for first round matches (matches with teams)
      const firstRoundMatches = insertedMatches.filter(m => 
        m.playoff_round === totalRounds && m.team_a_id && m.team_b_id
      );
      
      if (firstRoundMatches.length > 0 && gameTemplates.length > 0) {
        const games = firstRoundMatches.flatMap(match => 
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
        description: 'Đã tạo vòng Playoff',
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
    generatePlayoffMatches: generatePlayoffMatchesMutation.mutateAsync,
    isGeneratingPlayoff: generatePlayoffMatchesMutation.isPending,
    updateGameScore: updateGameScoreMutation.mutateAsync,
    isUpdatingScore: updateGameScoreMutation.isPending,
    updateMatchResult: updateMatchResultMutation.mutateAsync,
    isUpdatingResult: updateMatchResultMutation.isPending,
    deleteMatches: deleteMatchesMutation.mutateAsync,
    isDeletingMatches: deleteMatchesMutation.isPending,
  };
}
