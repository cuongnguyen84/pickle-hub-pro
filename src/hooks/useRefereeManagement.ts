import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { tStandalone } from '@/lib/i18n-standalone';
import {
  fetchRefereesWithProfiles,
  addRefereeByEmailHelper,
  removeRefereeHelper,
  isExistingReferee,
} from '@/lib/referee-helpers';

export interface Referee {
  id: string;
  table_id: string;
  user_id: string;
  created_at: string;
  email?: string;
  display_name?: string;
}

export interface UserRole {
  isCreator: boolean;
  isReferee: boolean;
  canEditScores: boolean;
  canManageTable: boolean; // Full access: edit players, groups, settings
}

export function useRefereeManagement(tableId: string | undefined, creatorUserId: string | null | undefined) {
  const { user } = useAuth();
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>({
    isCreator: false,
    isReferee: false,
    canEditScores: false,
    canManageTable: false,
  });

  // Determine user role based on user_id
  const checkUserRole = useCallback(async () => {
    if (!user || !tableId) {
      setUserRole({
        isCreator: false,
        isReferee: false,
        canEditScores: false,
        canManageTable: false,
      });
      return;
    }

    const isCreator = creatorUserId === user.id;

    // Check if user is a referee
    let isReferee = false;
    if (!isCreator) {
      isReferee = await isExistingReferee('quick_table_referees', 'table_id', tableId, user.id);
    }

    setUserRole({
      isCreator,
      isReferee,
      canEditScores: isCreator || isReferee,
      canManageTable: isCreator,
    });
  }, [user, tableId, creatorUserId]);

  // Fetch referees list (only for creator)
  const fetchReferees = useCallback(async () => {
    if (!tableId) return;

    setLoading(true);
    try {
      const list = await fetchRefereesWithProfiles('quick_table_referees', 'table_id', tableId);
      setReferees(list as unknown as Referee[]);
    } catch (error) {
      console.error('[useRefereeManagement] fetchReferees:', error);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  // Add referee by email
  const addRefereeByEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!tableId || !user) return false;

    const result = await addRefereeByEmailHelper('quick_table_referees', 'table_id', tableId, email);

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
      console.error('[useRefereeManagement] addRefereeByEmail:', result.error);
      toast.error(tStandalone('toast.referee.add.error'));
    }
    return false;
  }, [tableId, user, fetchReferees]);

  // Remove referee
  const removeReferee = useCallback(async (refereeId: string): Promise<boolean> => {
    if (!tableId || !user) return false;

    const result = await removeRefereeHelper('quick_table_referees', refereeId);
    if (result.ok) {
      toast.success(tStandalone('toast.referee.remove.success'));
      await fetchReferees();
      return true;
    }

    console.error('[useRefereeManagement] removeReferee:', result.error);
    toast.error(tStandalone('toast.referee.remove.error'));
    return false;
  }, [tableId, user, fetchReferees]);

// Initialize on mount
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

// Separate hook to get tables where user is a referee
export interface RefereeTable {
  id: string;
  share_id: string;
  name: string;
  status: string;
  format: string;
  player_count: number;
  created_at: string;
}

export function useRefereeTables() {
  const { user } = useAuth();
  const [tables, setTables] = useState<RefereeTable[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRefereeTables = useCallback(async () => {
    if (!user) {
      setTables([]);
      return;
    }

    setLoading(true);
    try {
      // Get all table IDs where user is a referee
      const { data: refereeEntries, error: refError } = await supabase
        .from('quick_table_referees')
        .select('table_id')
        .eq('user_id', user.id);

      if (refError) throw refError;

      if (!refereeEntries || refereeEntries.length === 0) {
        setTables([]);
        setLoading(false);
        return;
      }

      const tableIds = refereeEntries.map((r) => r.table_id);

      // Fetch table details
      const { data: tablesData, error: tablesError } = await supabase
        .from('quick_tables')
        .select('id, share_id, name, status, format, player_count, created_at')
        .in('id', tableIds)
        .order('created_at', { ascending: false });

      if (tablesError) throw tablesError;

      setTables(tablesData || []);
    } catch (error) {
      console.error('[useRefereeTables] fetchRefereeTables:', error);
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRefereeTables();
  }, [fetchRefereeTables]);

  return {
    tables,
    loading,
    refresh: fetchRefereeTables,
  };
}
