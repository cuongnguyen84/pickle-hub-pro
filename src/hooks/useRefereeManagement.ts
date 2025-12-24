import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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
      const { data } = await supabase
        .from('quick_table_referees')
        .select('id')
        .eq('table_id', tableId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      isReferee = !!data;
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
      const { data, error } = await supabase
        .from('quick_table_referees')
        .select('*')
        .eq('table_id', tableId);

      if (error) throw error;

      // Fetch user profiles for display names
      const refereeList: Referee[] = [];
      for (const ref of data || []) {
        // Try to get profile info
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, display_name')
          .eq('id', ref.user_id)
          .maybeSingle();

        refereeList.push({
          ...ref,
          email: profile?.email,
          display_name: profile?.display_name,
        });
      }

      setReferees(refereeList);
    } catch (error) {
      console.error('Error fetching referees:', error);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  // Add referee by email
  const addRefereeByEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!tableId || !user) return false;

    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        toast.error('Không tìm thấy người dùng với email này');
        return false;
      }

      // Check if already a referee
      const { data: existing } = await supabase
        .from('quick_table_referees')
        .select('id')
        .eq('table_id', tableId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existing) {
        toast.error('Người này đã là trọng tài');
        return false;
      }

      // Add referee
      const { error: insertError } = await supabase
        .from('quick_table_referees')
        .insert({
          table_id: tableId,
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
  }, [tableId, user, fetchReferees]);

  // Remove referee
  const removeReferee = useCallback(async (refereeId: string): Promise<boolean> => {
    if (!tableId || !user) return false;

    try {
      const { error } = await supabase
        .from('quick_table_referees')
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
