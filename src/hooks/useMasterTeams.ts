import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface MasterTeam {
  id: string;
  captain_user_id: string;
  team_name: string;
  created_at: string;
  updated_at: string;
}

export interface MasterTeamRosterMember {
  id: string;
  master_team_id: string;
  player_name: string;
  gender: 'male' | 'female';
  skill_level: number | null;
  user_id: string | null;
  is_captain: boolean;
  created_at: string;
}

export interface CreateMasterTeamInput {
  team_name: string;
  captain_name: string;
  captain_gender: 'male' | 'female';
  captain_skill_level?: number;
}

// Hook for fetching user's master teams
export function useMasterTeams() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['master-teams', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('master_teams')
        .select('*')
        .eq('captain_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MasterTeam[];
    },
    enabled: !!user,
  });
}

// Hook for fetching a master team with roster
export function useMasterTeamWithRoster(masterTeamId: string | undefined) {
  const teamQuery = useQuery({
    queryKey: ['master-team', masterTeamId],
    queryFn: async () => {
      if (!masterTeamId) return null;

      const { data, error } = await supabase
        .from('master_teams')
        .select('*')
        .eq('id', masterTeamId)
        .single();

      if (error) throw error;
      return data as MasterTeam;
    },
    enabled: !!masterTeamId,
  });

  const rosterQuery = useQuery({
    queryKey: ['master-team-roster', masterTeamId],
    queryFn: async () => {
      if (!masterTeamId) return [];

      const { data, error } = await supabase
        .from('master_team_roster')
        .select('*')
        .eq('master_team_id', masterTeamId)
        .order('is_captain', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as MasterTeamRosterMember[];
    },
    enabled: !!masterTeamId,
  });

  return {
    team: teamQuery.data,
    roster: rosterQuery.data || [],
    isLoading: teamQuery.isLoading || rosterQuery.isLoading,
  };
}

// Hook for master team management operations
export function useMasterTeamManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create master team mutation
  const createMasterTeamMutation = useMutation({
    mutationFn: async (input: CreateMasterTeamInput) => {
      if (!user) throw new Error('Not authenticated');

      // Create master team
      const { data: team, error: teamError } = await supabase
        .from('master_teams')
        .insert({
          team_name: input.team_name,
          captain_user_id: user.id,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add captain as first roster member
      const { error: rosterError } = await supabase
        .from('master_team_roster')
        .insert({
          master_team_id: team.id,
          player_name: input.captain_name,
          gender: input.captain_gender,
          skill_level: input.captain_skill_level || null,
          user_id: user.id,
          is_captain: true,
        });

      if (rosterError) throw rosterError;

      return team as MasterTeam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-teams'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update master team roster from tournament roster
  const syncMasterTeamRosterMutation = useMutation({
    mutationFn: async ({
      masterTeamId,
      roster,
    }: {
      masterTeamId: string;
      roster: Array<{
        player_name: string;
        gender: 'male' | 'female';
        skill_level?: number | null;
        user_id?: string | null;
        is_captain: boolean;
      }>;
    }) => {
      // Delete existing roster
      await supabase.from('master_team_roster').delete().eq('master_team_id', masterTeamId);

      // Insert new roster
      const { error } = await supabase.from('master_team_roster').insert(
        roster.map((member) => ({
          master_team_id: masterTeamId,
          player_name: member.player_name,
          gender: member.gender,
          skill_level: member.skill_level || null,
          user_id: member.user_id || null,
          is_captain: member.is_captain,
        }))
      );

      if (error) throw error;
    },
    onSuccess: (_, { masterTeamId }) => {
      queryClient.invalidateQueries({ queryKey: ['master-team-roster', masterTeamId] });
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
    createMasterTeam: createMasterTeamMutation.mutateAsync,
    isCreatingMasterTeam: createMasterTeamMutation.isPending,
    syncMasterTeamRoster: syncMasterTeamRosterMutation.mutateAsync,
    isSyncingRoster: syncMasterTeamRosterMutation.isPending,
  };
}
