import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import {
  fetchRefereesWithProfiles,
  addRefereeByEmailHelper,
  removeRefereeHelper,
  isExistingReferee,
} from '@/lib/referee-helpers';

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
      isReferee = await isExistingReferee(
        'team_match_referees',
        'tournament_id',
        tournamentId,
        user.id
      );
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
      const list = await fetchRefereesWithProfiles(
        'team_match_referees',
        'tournament_id',
        tournamentId
      );
      setReferees(list as unknown as TeamMatchReferee[]);
    } catch (error) {
      console.error('[useTeamMatchRefereeManagement] fetchReferees:', error);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // Add referee by email
  const addRefereeByEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!tournamentId || !user) return false;

    const result = await addRefereeByEmailHelper(
      'team_match_referees',
      'tournament_id',
      tournamentId,
      email
    );

    if (result.ok) {
      toast.success(`Đã thêm trọng tài: ${result.displayName || email}`);
      await fetchReferees();
      return true;
    }

    if (result.reason === 'not-found') {
      toast.error('Không tìm thấy người dùng với email này');
    } else if (result.reason === 'already-exists') {
      toast.error('Người này đã là trọng tài');
    } else {
      console.error('[useTeamMatchRefereeManagement] addRefereeByEmail:', result.error);
      toast.error('Không thể thêm trọng tài');
    }
    return false;
  }, [tournamentId, user, fetchReferees]);

  // Remove referee
  const removeReferee = useCallback(async (refereeId: string): Promise<boolean> => {
    if (!tournamentId || !user) return false;

    const result = await removeRefereeHelper('team_match_referees', refereeId);
    if (result.ok) {
      toast.success('Đã gỡ trọng tài');
      await fetchReferees();
      return true;
    }

    console.error('[useTeamMatchRefereeManagement] removeReferee:', result.error);
    toast.error('Không thể gỡ trọng tài');
    return false;
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
