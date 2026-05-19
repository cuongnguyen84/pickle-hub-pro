import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { tStandalone } from '@/lib/i18n-standalone';
import {
  fetchRefereesWithProfiles,
  addRefereeByEmailHelper,
  removeRefereeHelper,
} from '@/lib/referee-helpers';

export interface Referee {
  id: string;
  tournament_id: string;
  user_id: string;
  created_at: string;
  email?: string;
  display_name?: string;
}

export function useDoublesEliminationReferees(tournamentId: string | undefined) {
  const { user } = useAuth();
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch referees list
  const fetchReferees = useCallback(async () => {
    if (!tournamentId) return;

    setLoading(true);
    try {
      const list = await fetchRefereesWithProfiles(
        'doubles_elimination_referees',
        'tournament_id',
        tournamentId
      );
      setReferees(list as unknown as Referee[]);
    } catch (error) {
      console.error('[useDoublesEliminationReferees] fetchReferees:', error);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // Add referee by email
  const addRefereeByEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!tournamentId || !user) return false;

    const result = await addRefereeByEmailHelper(
      'doubles_elimination_referees',
      'tournament_id',
      tournamentId,
      email
    );

    if (result.ok) {
      toast.success(tStandalone('toast.referee.add.success', { name: result.displayName || email }));
      await fetchReferees();
      return true;
    }

    if (result.reason === 'not-found') {
      toast.error(tStandalone('toast.referee.add.notFound'));
    } else if (result.reason === 'already-exists') {
      toast.error(tStandalone('toast.referee.add.duplicate'));
    } else {
      console.error('[useDoublesEliminationReferees] addRefereeByEmail:', result.error);
      toast.error(tStandalone('toast.referee.add.error'));
    }
    return false;
  }, [tournamentId, user, fetchReferees]);

  // Remove referee
  const removeReferee = useCallback(async (refereeId: string): Promise<boolean> => {
    if (!tournamentId || !user) return false;

    const result = await removeRefereeHelper('doubles_elimination_referees', refereeId);
    if (result.ok) {
      toast.success(tStandalone('toast.referee.remove.success'));
      await fetchReferees();
      return true;
    }

    console.error('[useDoublesEliminationReferees] removeReferee:', result.error);
    toast.error(tStandalone('toast.referee.remove.error'));
    return false;
  }, [tournamentId, user, fetchReferees]);

  // Fetch on mount
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
