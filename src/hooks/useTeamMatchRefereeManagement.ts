import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TeamMatchReferee {
  id: string;
  tournament_id: string;
  user_id: string;
  created_at: string;
  email?: string;
  display_name?: string;
}

export interface TeamMatchUserRole {
  isCreator: boolean;
  isReferee: boolean;
  canEditScores: boolean;
  canManageTournament: boolean;
}

export function useTeamMatchRefereeManagement(
  tournamentId: string | undefined, 
  creatorUserId: string | null | undefined
) {
  const { user } = useAuth();
  const [referees, setReferees] = useState<TeamMatchReferee[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<TeamMatchUserRole>({
    isCreator: false,
    isReferee: false,
    canEditScores: false,
    canManageTournament: false,
  });

  // Determine user role
  const checkUserRole = useCallback(async () => {
    if (!user || !tournamentId) {
      setUserRole({
        isCreator: false,
        isReferee: false,
        canEditScores: false,
        canManageTournament: false,
      });
      return;
    }

    const isCreator = creatorUserId === user.id;

    // Check if user is a referee
    let isReferee = false;
    if (!isCreator) {
      const { data } = await supabase
        .from('team_match_referees')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      isReferee = !!data;
    }

    setUserRole({
      isCreator,
      isReferee,
      canEditScores: isCreator || isReferee,
      canManageTournament: isCreator,
    });
  }, [user, tournamentId, creatorUserId]);

  // Fetch referees list
  const fetchReferees = useCallback(async () => {
    if (!tournamentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_match_referees')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (error) throw error;

      // Fetch user profiles for display names via public_profiles view
      const userIds = (data || []).map(r => r.user_id);
      const { data: profilesData } = userIds.length > 0
        ? await supabase.from('public_profiles').select('id, display_name').in('id', userIds)
        : { data: [] };

      const profileMap = new Map((profilesData || []).map(p => [p.id, p]));

      const refereeList: TeamMatchReferee[] = (data || []).map(ref => ({
        ...ref,
        display_name: profileMap.get(ref.user_id)?.display_name || undefined,
      }));

      setReferees(refereeList);
    } catch (error) {
      console.error('Error fetching referees:', error);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // Add referee by email
  const addRefereeByEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!tournamentId || !user) return false;

    try {
      // Find user by email using secure RPC
      const { data: profiles, error: profileError } = await supabase
        .rpc('lookup_user_by_email', { lookup_email: email.toLowerCase().trim() });

      if (profileError) throw profileError;
      const profile = profiles?.[0];
      if (!profile) {
        toast.error('Không tìm thấy người dùng với email này');
        return false;
      }

      // Check if already a referee
      const { data: existing } = await supabase
        .from('team_match_referees')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existing) {
        toast.error('Người này đã là trọng tài');
        return false;
      }

      // Add referee
      const { error: insertError } = await supabase
        .from('team_match_referees')
        .insert({
          tournament_id: tournamentId,
          user_id: profile.id,
        });

      if (insertError) throw insertError;

      toast.success(`Đã thêm trọng tài: ${profile.display_name || profile.email}`);
      await fetchReferees();
      return true;
    } catch (error) {
      console.error('Error adding referee:', error);
      toast.error('Không thể thêm trọng tài');
      return false;
    }
  }, [tournamentId, user, fetchReferees]);

  // Remove referee
  const removeReferee = useCallback(async (refereeId: string): Promise<boolean> => {
    if (!tournamentId || !user) return false;

    try {
      const { error } = await supabase
        .from('team_match_referees')
        .delete()
        .eq('id', refereeId);

      if (error) throw error;

      toast.success('Đã gỡ trọng tài');
      await fetchReferees();
      return true;
    } catch (error) {
      console.error('Error removing referee:', error);
      toast.error('Không thể gỡ trọng tài');
      return false;
    }
  }, [tournamentId, user, fetchReferees]);

  // Initialize
  useEffect(() => {
    checkUserRole();
  }, [checkUserRole]);

  // Fetch referees if user is creator
  useEffect(() => {
    if (userRole.isCreator) {
      fetchReferees();
    }
  }, [userRole.isCreator, fetchReferees]);

  return {
    referees,
    loading,
    userRole,
    addRefereeByEmail,
    removeReferee,
    refreshReferees: fetchReferees,
    refreshUserRole: checkUserRole,
  };
}
