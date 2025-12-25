import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';
export type SkillRatingSystem = 'DUPR' | 'other' | 'none';

export interface Registration {
  id: string;
  table_id: string;
  user_id: string;
  display_name: string;
  team: string | null;
  rating_system: SkillRatingSystem;
  skill_level: number | null;
  skill_description: string | null;
  skill_system_name: string | null;
  profile_link: string | null;
  status: RegistrationStatus;
  btc_override_skill: number | null;
  btc_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationFormData {
  display_name: string;
  team?: string;
  rating_system: SkillRatingSystem;
  skill_level?: number;
  skill_description?: string;
  skill_system_name?: string;
  profile_link?: string;
}

export function useRegistration() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Get all registrations for a table (for BTC/creator)
  const getTableRegistrations = useCallback(async (tableId: string): Promise<Registration[]> => {
    try {
      const { data, error } = await supabase
        .from('quick_table_registrations')
        .select('*')
        .eq('table_id', tableId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as Registration[];
    } catch (error) {
      console.error('Error fetching registrations:', error);
      return [];
    }
  }, []);

  // Get user's registration for a table
  const getUserRegistration = useCallback(async (tableId: string): Promise<Registration | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('quick_table_registrations')
        .select('*')
        .eq('table_id', tableId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as Registration | null;
    } catch (error) {
      console.error('Error fetching user registration:', error);
      return null;
    }
  }, [user]);

  // Submit registration
  const submitRegistration = useCallback(async (
    tableId: string,
    formData: RegistrationFormData
  ): Promise<Registration | null> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để đăng ký');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quick_table_registrations')
        .insert({
          table_id: tableId,
          user_id: user.id,
          display_name: formData.display_name.trim(),
          team: formData.team?.trim() || null,
          rating_system: formData.rating_system,
          skill_level: formData.skill_level || null,
          skill_description: formData.skill_description?.trim() || null,
          skill_system_name: formData.skill_system_name?.trim() || null,
          profile_link: formData.profile_link?.trim() || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Bạn đã đăng ký tham gia giải này rồi');
        } else {
          throw error;
        }
        return null;
      }

      toast.success('Đăng ký thành công! Vui lòng chờ BTC duyệt.');
      return data as unknown as Registration;
    } catch (error) {
      console.error('Error submitting registration:', error);
      toast.error('Không thể đăng ký, vui lòng thử lại');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update registration (for pending registrations by user)
  const updateRegistration = useCallback(async (
    registrationId: string,
    formData: Partial<RegistrationFormData>
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('quick_table_registrations')
        .update({
          display_name: formData.display_name?.trim(),
          team: formData.team?.trim() || null,
          rating_system: formData.rating_system,
          skill_level: formData.skill_level || null,
          skill_description: formData.skill_description?.trim() || null,
          skill_system_name: formData.skill_system_name?.trim() || null,
          profile_link: formData.profile_link?.trim() || null,
        })
        .eq('id', registrationId);

      if (error) throw error;

      toast.success('Đã cập nhật đăng ký');
      return true;
    } catch (error) {
      console.error('Error updating registration:', error);
      toast.error('Không thể cập nhật, vui lòng thử lại');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cancel registration (by user)
  const cancelRegistration = useCallback(async (registrationId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('quick_table_registrations')
        .delete()
        .eq('id', registrationId);

      if (error) throw error;

      toast.success('Đã hủy đăng ký');
      return true;
    } catch (error) {
      console.error('Error canceling registration:', error);
      toast.error('Không thể hủy đăng ký');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Approve registration (by BTC)
  const approveRegistration = useCallback(async (registrationId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quick_table_registrations')
        .update({ status: 'approved' })
        .eq('id', registrationId);

      if (error) throw error;

      toast.success('Đã duyệt đăng ký');
      return true;
    } catch (error) {
      console.error('Error approving registration:', error);
      toast.error('Không thể duyệt đăng ký');
      return false;
    }
  }, []);

  // Reject registration (by BTC)
  const rejectRegistration = useCallback(async (registrationId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quick_table_registrations')
        .update({ status: 'rejected' })
        .eq('id', registrationId);

      if (error) throw error;

      toast.success('Đã từ chối đăng ký');
      return true;
    } catch (error) {
      console.error('Error rejecting registration:', error);
      toast.error('Không thể từ chối đăng ký');
      return false;
    }
  }, []);

  // Bulk approve registrations
  const bulkApprove = useCallback(async (registrationIds: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quick_table_registrations')
        .update({ status: 'approved' })
        .in('id', registrationIds);

      if (error) throw error;

      toast.success(`Đã duyệt ${registrationIds.length} đăng ký`);
      return true;
    } catch (error) {
      console.error('Error bulk approving:', error);
      toast.error('Không thể duyệt hàng loạt');
      return false;
    }
  }, []);

  // Update BTC notes/override (by BTC)
  const updateBTCOverride = useCallback(async (
    registrationId: string,
    overrideSkill: number | null,
    notes: string | null
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quick_table_registrations')
        .update({
          btc_override_skill: overrideSkill,
          btc_notes: notes,
        })
        .eq('id', registrationId);

      if (error) throw error;

      toast.success('Đã cập nhật thông tin');
      return true;
    } catch (error) {
      console.error('Error updating BTC override:', error);
      toast.error('Không thể cập nhật');
      return false;
    }
  }, []);

  // Get approved registrations count
  const getApprovedCount = useCallback(async (tableId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('quick_table_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('table_id', tableId)
        .eq('status', 'approved');

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting approved count:', error);
      return 0;
    }
  }, []);

  // Get pending registrations count
  const getPendingCount = useCallback(async (tableId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('quick_table_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('table_id', tableId)
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting pending count:', error);
      return 0;
    }
  }, []);

  return {
    loading,
    getTableRegistrations,
    getUserRegistration,
    submitRegistration,
    updateRegistration,
    cancelRegistration,
    approveRegistration,
    rejectRegistration,
    bulkApprove,
    updateBTCOverride,
    getApprovedCount,
    getPendingCount,
  };
}
