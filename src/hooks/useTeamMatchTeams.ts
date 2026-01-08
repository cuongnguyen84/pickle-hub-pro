import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TeamMatchTeam {
  id: string;
  tournament_id: string;
  team_name: string;
  captain_user_id: string | null;
  invite_code: string | null;
  seed: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMatchRosterMember {
  id: string;
  team_id: string;
  player_name: string;
  gender: 'male' | 'female';
  skill_level: number | null;
  user_id: string | null;
  is_captain: boolean;
  status: string;
  created_at: string;
}

export interface CreateTeamInput {
  tournament_id: string;
  team_name: string;
  captain_name: string;
  captain_gender: 'male' | 'female';
  captain_skill_level?: number;
}

export interface AddRosterMemberInput {
  team_id: string;
  player_name: string;
  gender: 'male' | 'female';
  skill_level?: number;
  user_id?: string;
}

// Hook for fetching teams of a tournament
export function useTeamMatchTeams(tournamentId: string | undefined) {
  return useQuery({
    queryKey: ['team-match-teams', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return [];
      
      const { data, error } = await supabase
        .from('team_match_teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as TeamMatchTeam[];
    },
    enabled: !!tournamentId,
  });
}

// Hook for fetching a single team with roster
export function useTeamMatchTeam(teamId: string | undefined) {
  const teamQuery = useQuery({
    queryKey: ['team-match-team', teamId],
    queryFn: async () => {
      if (!teamId) return null;
      
      const { data, error } = await supabase
        .from('team_match_teams')
        .select('*')
        .eq('id', teamId)
        .single();
      
      if (error) throw error;
      return data as TeamMatchTeam;
    },
    enabled: !!teamId,
  });

  const rosterQuery = useQuery({
    queryKey: ['team-match-roster', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      
      const { data, error } = await supabase
        .from('team_match_roster')
        .select('*')
        .eq('team_id', teamId)
        .order('is_captain', { ascending: false })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as TeamMatchRosterMember[];
    },
    enabled: !!teamId,
  });

  return {
    team: teamQuery.data,
    roster: rosterQuery.data || [],
    isLoading: teamQuery.isLoading || rosterQuery.isLoading,
  };
}

// Hook for team management operations
export function useTeamMatchTeamManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (input: CreateTeamInput) => {
      if (!user) throw new Error('Not authenticated');

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('team_match_teams')
        .insert({
          tournament_id: input.tournament_id,
          team_name: input.team_name,
          captain_user_id: user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add captain as first roster member
      const { error: rosterError } = await supabase
        .from('team_match_roster')
        .insert({
          team_id: team.id,
          player_name: input.captain_name,
          gender: input.captain_gender,
          skill_level: input.captain_skill_level || null,
          user_id: user.id,
          is_captain: true,
          status: 'approved', // Captain is auto-approved
        });

      if (rosterError) throw rosterError;

      return team as TeamMatchTeam;
    },
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', team.tournament_id] });
      // Also invalidate user team query so UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['team-match-user-team', team.tournament_id] });
      toast({
        title: 'Thành công',
        description: 'Đã tạo đội mới',
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

  // Add roster member mutation
  const addRosterMemberMutation = useMutation({
    mutationFn: async (input: AddRosterMemberInput) => {
      const { data, error } = await supabase
        .from('team_match_roster')
        .insert({
          team_id: input.team_id,
          player_name: input.player_name,
          gender: input.gender,
          skill_level: input.skill_level || null,
          user_id: input.user_id || null,
          is_captain: false,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data as TeamMatchRosterMember;
    },
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-roster', member.team_id] });
      toast({
        title: 'Thành công',
        description: 'Đã thêm thành viên',
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

  // Remove roster member mutation
  const removeRosterMemberMutation = useMutation({
    mutationFn: async ({ memberId, teamId }: { memberId: string; teamId: string }) => {
      const { error } = await supabase
        .from('team_match_roster')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      return { memberId, teamId };
    },
    onSuccess: ({ teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-roster', teamId] });
      toast({
        title: 'Đã xóa',
        description: 'Đã xóa thành viên khỏi đội',
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

  // Update team status (for BTC approval)
  const updateTeamStatusMutation = useMutation({
    mutationFn: async ({ teamId, status, tournamentId }: { teamId: string; status: string; tournamentId: string }) => {
      const { error } = await supabase
        .from('team_match_teams')
        .update({ status })
        .eq('id', teamId);

      if (error) throw error;
      return { teamId, status, tournamentId };
    },
    onSuccess: ({ tournamentId, status }) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournamentId] });
      toast({
        title: status === 'approved' ? 'Đã duyệt' : 'Đã từ chối',
        description: status === 'approved' ? 'Đội đã được duyệt tham gia' : 'Đội đã bị từ chối',
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

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async ({ teamId, tournamentId }: { teamId: string; tournamentId: string }) => {
      const { error } = await supabase
        .from('team_match_teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;
      return { teamId, tournamentId };
    },
    onSuccess: ({ tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournamentId] });
      toast({
        title: 'Đã xóa',
        description: 'Đã xóa đội',
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
    createTeam: createTeamMutation.mutateAsync,
    isCreatingTeam: createTeamMutation.isPending,
    addRosterMember: addRosterMemberMutation.mutateAsync,
    isAddingMember: addRosterMemberMutation.isPending,
    removeRosterMember: removeRosterMemberMutation.mutateAsync,
    isRemovingMember: removeRosterMemberMutation.isPending,
    updateTeamStatus: updateTeamStatusMutation.mutateAsync,
    isUpdatingStatus: updateTeamStatusMutation.isPending,
    deleteTeam: deleteTeamMutation.mutateAsync,
    isDeletingTeam: deleteTeamMutation.isPending,
  };
}

// Hook to find user's team in a tournament
export function useUserTeam(tournamentId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['team-match-user-team', tournamentId, user?.id],
    queryFn: async () => {
      if (!tournamentId || !user) return null;
      
      const { data, error } = await supabase
        .from('team_match_teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('captain_user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as TeamMatchTeam | null;
    },
    enabled: !!tournamentId && !!user,
  });
}

// Hook to find team by invite code
export function useTeamByInviteCode(inviteCode: string | undefined) {
  return useQuery({
    queryKey: ['team-match-team-invite', inviteCode],
    queryFn: async () => {
      if (!inviteCode) return null;
      
      const { data, error } = await supabase
        .from('team_match_teams')
        .select('*, team_match_tournaments(*)')
        .eq('invite_code', inviteCode)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!inviteCode,
  });
}
