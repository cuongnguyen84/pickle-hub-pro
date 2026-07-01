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
  has_third_place_match: boolean;
  bracket_pairing_type: 'random' | 'manual' | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  group_count: number | null;
  top_per_group: number | null;
  // MLP DUPR-gated registration
  require_dupr?: boolean;
  dupr_max_male?: number | null;
  dupr_max_female?: number | null;
  // Joined from profiles
  creator_display_name?: string;
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
  has_third_place_match?: boolean;
  bracket_pairing_type?: 'random' | 'manual';
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

  // Fetch public ongoing tournaments with creator info
  const { data: publicTournaments, isLoading: isLoadingPublic } = useQuery({
    queryKey: ['team-match-tournaments', 'public'],
    queryFn: async () => {
      // First fetch tournaments
      const { data: tournaments, error } = await supabase
        .from('team_match_tournaments')
        .select('*')
        .in('status', ['registration', 'ongoing'])
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      if (!tournaments || tournaments.length === 0) return [];
      
      // Get unique creator IDs
      const creatorIds = [...new Set(tournaments.map(t => t.created_by).filter(Boolean))];
      
      if (creatorIds.length === 0) {
        return tournaments as TeamMatchTournament[];
      }
      
      // Fetch profiles for all creators
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, display_name')
        .in('id', creatorIds);
      
      // Map profiles to tournaments
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return tournaments.map((t: any) => {
        const profile = t.created_by ? profileMap.get(t.created_by) : null;
        return {
          ...t,
          creator_display_name: profile?.display_name,
        };
      }) as TeamMatchTournament[];
    },
  });

  // Create tournament mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateTournamentInput) => {
      if (!user) throw new Error('Not authenticated');

      const shareId = generateShareId();

      // W3.2 — call quota-enforced RPC. Mirrors useQuickTable/useFlex.
      // RPC handles the tournament row insert + quota enforcement against
      // profiles.tournament_create_quota (default 3). Game templates are
      // still inserted client-side after the parent row exists.
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'create_team_match_with_quota' as any,
        {
          _name: input.name,
          _share_id: shareId,
          _team_roster_size: input.team_roster_size,
          _team_count: input.team_count,
          _format: input.format,
          _playoff_team_count: input.playoff_team_count || null,
          _require_registration: input.require_registration,
          _has_dreambreaker: input.has_dreambreaker,
          _require_min_games_per_player: input.require_min_games_per_player,
          _has_third_place_match: input.has_third_place_match || false,
          _bracket_pairing_type: input.bracket_pairing_type || 'random',
        },
      );

      if (rpcError) {
        console.error('[useTeamMatch] create:', rpcError);
        throw rpcError;
      }

      const result = rpcData as {
        success: boolean;
        error?: string;
        tournament?: TeamMatchTournament;
        count?: number;
        quota?: number;
      };

      if (!result.success) {
        console.error('[useTeamMatch] create:', result);
        if (result.error === 'LIMIT_REACHED') {
          const limitErr = new Error('LIMIT_REACHED');
          (limitErr as Error & { code?: string }).code = 'LIMIT_REACHED';
          throw limitErr;
        }
        if (result.error === 'AUTH_REQUIRED') {
          throw new Error('Not authenticated');
        }
        throw new Error(result.error || 'Unknown error');
      }

      const tournament = result.tournament as TeamMatchTournament;

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

      return tournament;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-match-tournaments'] });
      toast({
        title: 'Thành công',
        description: 'Đã tạo giải đấu đồng đội mới',
      });
    },
    onError: (error: Error) => {
      // W3.2 — quota-aware toast. The mutation throws Error with
      // .code='LIMIT_REACHED' when the user has hit their per-account cap.
      const code = (error as Error & { code?: string }).code;
      if (code === 'LIMIT_REACHED' || error.message === 'LIMIT_REACHED') {
        toast({
          title: 'Đã đạt giới hạn',
          description: 'Mỗi tài khoản chỉ được tạo tối đa 3 giải. Liên hệ tapickleballvn@gmail.com để mở rộng.',
          variant: 'destructive',
        });
        return;
      }
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
