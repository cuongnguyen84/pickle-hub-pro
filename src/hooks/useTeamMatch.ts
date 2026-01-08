import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types based on database schema
export interface TeamMatchTournament {
  id: string;
  share_id: string;
  name: string;
  team_roster_size: number;
  team_count: number;
  format: string;
  playoff_team_count: number | null;
  require_registration: boolean;
  has_dreambreaker: boolean;
  dreambreaker_game_type: string | null;
  dreambreaker_scoring_type: string | null;
  require_min_games_per_player: boolean;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameTemplate {
  id: string;
  tournament_id: string;
  order_index: number;
  game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS';
  display_name: string | null;
  scoring_type: 'rally21' | 'sideout11';
}

export interface CreateTournamentInput {
  name: string;
  team_roster_size: 4 | 6 | 8;
  team_count: number;
  format: 'round_robin' | 'single_elimination' | 'rr_playoff';
  playoff_team_count?: number;
  require_registration: boolean;
  has_dreambreaker: boolean;
  // Dreambreaker is always Singles (4 players) with Rally Scoring - stored as null in DB
  // The frontend handles the fixed format logic
  require_min_games_per_player: boolean;
  game_templates: Omit<GameTemplate, 'id' | 'tournament_id'>[];
}

// Generate a random share ID
const generateShareId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export function useTeamMatch() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's tournaments
  const { data: myTournaments, isLoading: isLoadingMy } = useQuery({
    queryKey: ['team-match-tournaments', 'my', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('team_match_tournaments')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TeamMatchTournament[];
    },
    enabled: !!user,
  });

  // Fetch public ongoing tournaments
  const { data: publicTournaments, isLoading: isLoadingPublic } = useQuery({
    queryKey: ['team-match-tournaments', 'public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_match_tournaments')
        .select('*')
        .in('status', ['registration', 'ongoing'])
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as TeamMatchTournament[];
    },
  });

  // Create tournament mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateTournamentInput) => {
      if (!user) throw new Error('Not authenticated');

      const shareId = generateShareId();
      
      // Create tournament - default to 'registration' status
      // Note: dreambreaker_game_type and dreambreaker_scoring_type are set to null
      // because Dreambreaker is now fixed: Singles (4 players) + Rally Scoring
      const { data: tournament, error: tournamentError } = await supabase
        .from('team_match_tournaments')
        .insert({
          share_id: shareId,
          name: input.name,
          team_roster_size: input.team_roster_size,
          team_count: input.team_count,
          format: input.format,
          playoff_team_count: input.playoff_team_count || null,
          require_registration: input.require_registration,
          has_dreambreaker: input.has_dreambreaker,
          dreambreaker_game_type: null, // Fixed: Singles
          dreambreaker_scoring_type: null, // Fixed: Rally Scoring
          require_min_games_per_player: input.require_min_games_per_player,
          created_by: user.id,
          status: 'registration', // Default to open registration
        })
        .select()
        .single();

      if (tournamentError) throw tournamentError;

      // Create game templates
      if (input.game_templates.length > 0) {
        const templates = input.game_templates.map((t, index) => ({
          tournament_id: tournament.id,
          order_index: index,
          game_type: t.game_type,
          display_name: t.display_name || null,
          scoring_type: t.scoring_type,
        }));

        const { error: templatesError } = await supabase
          .from('team_match_game_templates')
          .insert(templates);

        if (templatesError) throw templatesError;
      }

      return tournament as TeamMatchTournament;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-match-tournaments'] });
      toast({
        title: 'Thành công',
        description: 'Đã tạo giải đấu đồng đội mới',
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

  // Delete tournament mutation
  const deleteMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { error } = await supabase
        .from('team_match_tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-match-tournaments'] });
      toast({
        title: 'Đã xóa',
        description: 'Giải đấu đã được xóa',
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

  // Update tournament status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ tournamentId, status }: { tournamentId: string; status: 'setup' | 'registration' | 'ongoing' | 'completed' }) => {
      const { error } = await supabase
        .from('team_match_tournaments')
        .update({ status })
        .eq('id', tournamentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-match-tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['team-match-tournament'] });
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật trạng thái giải đấu',
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
    myTournaments: myTournaments || [],
    publicTournaments: publicTournaments || [],
    isLoading: isLoadingMy || isLoadingPublic,
    createTournament: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deleteTournament: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    updateTournamentStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,
  };
}

// Hook to fetch a single tournament
export function useTeamMatchTournament(shareId: string | undefined) {
  return useQuery({
    queryKey: ['team-match-tournament', shareId],
    queryFn: async () => {
      if (!shareId) return null;
      
      const { data, error } = await supabase
        .from('team_match_tournaments')
        .select('*')
        .eq('share_id', shareId)
        .single();
      
      if (error) throw error;
      return data as TeamMatchTournament;
    },
    enabled: !!shareId,
  });
}
