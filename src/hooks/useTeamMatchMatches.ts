import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamMatchTeam } from './useTeamMatchTeams';

export interface TeamMatchMatch {
  id: string;
  tournament_id: string;
  group_id: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  games_won_a: number;
  games_won_b: number;
  total_points_a: number;
  total_points_b: number;
  winner_team_id: string | null;
  status: 'pending' | 'lineup' | 'in_progress' | 'completed';
  round_number: number | null;
  is_playoff: boolean;
  is_repechage?: boolean;   // nhánh Tái sinh (hạng 3,4) — is_playoff vẫn true
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
  score_version: number;
  winner_team_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMatchBracketBranchInput {
  isRepechage: boolean;
  firstRound: Array<{ teamAId: string; teamBId: string }>;
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
    refetchInterval: 15000,
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

  // Generate the full round-robin schedule and all games in one transaction.
  const generateMatchesMutation = useMutation({
    mutationFn: async ({ tournamentId }: {
      tournamentId: string;
    }) => {
      const { data, error } = await supabase.rpc('generate_team_match_round_robin_atomic', {
        p_tournament_id: tournamentId,
        p_groups: [],
        p_randomize_game_order: false,
      });
      const result = (data ?? {}) as { success?: boolean; error?: string };
      if (error || result.success !== true) {
        throw error ?? new Error(result.error ?? 'GENERATE_FAILED');
      }
      return result;
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

  const startRoundMutation = useMutation({
    mutationFn: async ({ tournamentId, roundNumber }: {
      tournamentId: string;
      roundNumber: number;
    }) => {
      const { data, error } = await supabase.rpc('start_team_match_round_atomic', {
        p_tournament_id: tournamentId,
        p_round_number: roundNumber,
      });
      const result = (data ?? {}) as { success?: boolean; error?: string };
      if (error || result.success !== true) {
        throw error ?? new Error(result.error ?? 'START_ROUND_FAILED');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', variables.tournamentId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  // Score one or more games, recompute the match and propagate a playoff
  // result in one version-checked database transaction.
  const updateGameScoresMutation = useMutation({
    mutationFn: async ({ scores, matchId, tournamentId }: {
      scores: Array<{
        gameId: string;
        scoreA: number;
        scoreB: number;
        expectedVersion: number;
      }>;
      matchId: string;
      tournamentId: string;
    }) => {
      const { data, error } = await supabase.rpc('score_team_match_games_atomic', {
        p_match_id: matchId,
        p_scores: scores.map((score) => ({
          game_id: score.gameId,
          score_a: score.scoreA,
          score_b: score.scoreB,
          expected_version: score.expectedVersion,
        })),
      });
      const result = (data ?? {}) as { success?: boolean; error?: string };
      if (error || result.success !== true) {
        const code = result.error ?? error?.message ?? 'SCORE_FAILED';
        if (code === 'VERSION_CONFLICT') {
          throw new Error('Điểm đã được cập nhật ở thiết bị khác. Vui lòng tải lại trước khi lưu.');
        }
        if (code === 'DOWNSTREAM_LOCKED') {
          throw new Error('Không thể sửa người thắng vì trận vòng sau đã bắt đầu.');
        }
        throw error ?? new Error(code);
      }
      return { matchId, tournamentId };
    },
    onSuccess: ({ matchId, tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-games', matchId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-match', matchId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournamentId] });
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

  // Create every requested bracket branch, links and first-round games atomically.
  const generatePlayoffMatchesMutation = useMutation({
    mutationFn: async ({ tournamentId, branches }: {
      tournamentId: string;
      branches: TeamMatchBracketBranchInput[];
    }) => {
      const { data, error } = await supabase.rpc('generate_team_match_brackets_atomic', {
        p_tournament_id: tournamentId,
        p_branches: branches.map(branch => ({
          is_repechage: branch.isRepechage,
          first_round: branch.firstRound.map(pair => ({
            team_a_id: pair.teamAId,
            team_b_id: pair.teamBId,
          })),
        })),
      });
      const result = (data ?? {}) as { success?: boolean; error?: string };
      if (error || result.success !== true) {
        throw error ?? new Error(result.error ?? 'GENERATE_BRACKET_FAILED');
      }
      return result;
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

  // Generate the client-selected first-round draw; the server owns the full tree.
  const generateSingleEliminationMutation = useMutation({
    mutationFn: async ({ tournamentId, teams, pairingType, manualPairings }: {
      tournamentId: string;
      teams: TeamMatchTeam[];
      pairingType: 'random' | 'manual';
      manualPairings?: Array<{ team1Id: string; team2Id: string }>;
    }) => {
      const approvedTeams = teams.filter(t => t.status === 'approved');
      const teamCount = approvedTeams.length;

      // Validate power of 2
      if (teamCount < 2 || (teamCount & (teamCount - 1)) !== 0) {
        throw new Error('Số đội phải là lũy thừa của 2 (4, 8, 16, 32...)');
      }

      const firstRoundMatchCount = teamCount / 2;
      let firstRoundPairings: Array<{ team1Id: string; team2Id: string }>;

      if (pairingType === 'manual' && manualPairings && manualPairings.length === firstRoundMatchCount) {
        // Use provided manual pairings
        firstRoundPairings = manualPairings;
      } else {
        // Random pairing: shuffle teams
        const shuffled = [...approvedTeams].sort(() => Math.random() - 0.5);
        firstRoundPairings = [];
        for (let i = 0; i < shuffled.length; i += 2) {
          if (shuffled[i + 1]) {
            firstRoundPairings.push({
              team1Id: shuffled[i].id,
              team2Id: shuffled[i + 1].id,
            });
          }
        }
      }

      const { data, error } = await supabase.rpc('generate_team_match_brackets_atomic', {
        p_tournament_id: tournamentId,
        p_branches: [{
          is_repechage: false,
          first_round: firstRoundPairings.map(pair => ({
            team_a_id: pair.team1Id,
            team_b_id: pair.team2Id,
          })),
        }],
      });
      const result = (data ?? {}) as { success?: boolean; error?: string };
      if (error || result.success !== true) {
        throw error ?? new Error(result.error ?? 'GENERATE_BRACKET_FAILED');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', variables.tournamentId] });
      toast({
        title: 'Thành công',
        description: 'Đã tạo Bracket Single Elimination',
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
    startRound: startRoundMutation.mutateAsync,
    isStartingRound: startRoundMutation.isPending,
    generatePlayoffMatches: generatePlayoffMatchesMutation.mutateAsync,
    isGeneratingPlayoff: generatePlayoffMatchesMutation.isPending,
    generateSingleElimination: generateSingleEliminationMutation.mutateAsync,
    isGeneratingSE: generateSingleEliminationMutation.isPending,
    updateGameScores: updateGameScoresMutation.mutateAsync,
    isUpdatingScore: updateGameScoresMutation.isPending,
  };
}
