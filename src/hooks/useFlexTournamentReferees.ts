import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import {
  fetchRefereesWithProfiles,
  addRefereeByEmailHelper,
  removeRefereeHelper,
} from '@/lib/referee-helpers';

export interface FlexReferee {
  id: string;
  tournament_id: string;
  user_id: string;
  created_at: string;
  email?: string;
  display_name?: string;
}

/**
 * Manage referees for a Flex tournament. Mirrors the public API of
 * useDoublesEliminationReferees so the calling page can swap them
 * one-for-one. The Flex view derives `isCreator`/`isAdmin` itself
 * (it already does for the visibility toggle), so this hook stays
 * intentionally thin — no userRole state.
 */
export function useFlexTournamentReferees(tournamentId: string | undefined) {
  const { user } = useAuth();
  const [referees, setReferees] = useState<FlexReferee[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReferees = useCallback(async () => {
    if (!tournamentId) return;

    setLoading(true);
    try {
      const list = await fetchRefereesWithProfiles(
        'flex_tournament_referees',
        'tournament_id',
        tournamentId
      );
      setReferees(list as unknown as FlexReferee[]);
    } catch (error) {
      console.error('[useFlexTournamentReferees] fetchReferees:', error);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  const addRefereeByEmail = useCallback(
    async (email: string): Promise<boolean> => {
      if (!tournamentId || !user) return false;

      const result = await addRefereeByEmailHelper(
        'flex_tournament_referees',
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
        console.error('[useFlexTournamentReferees] addRefereeByEmail:', result.error);
        toast.error('Không thể thêm trọng tài');
      }
      return false;
    },
    [tournamentId, user, fetchReferees]
  );

  const removeReferee = useCallback(
    async (refereeId: string): Promise<boolean> => {
      if (!tournamentId || !user) return false;

      const result = await removeRefereeHelper('flex_tournament_referees', refereeId);
      if (result.ok) {
        toast.success('Đã gỡ trọng tài');
        await fetchReferees();
        return true;
      }

      console.error('[useFlexTournamentReferees] removeReferee:', result.error);
      toast.error('Không thể gỡ trọng tài');
      return false;
    },
    [tournamentId, user, fetchReferees]
  );

  useEffect(() => {
    fetchReferees();
  }, [fetchReferees]);

  return {
    referees,
    loading,
    addRefereeByEmail,
    removeReferee,
    refreshReferees: fetchReferees,
  };
}
