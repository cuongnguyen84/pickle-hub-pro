import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { SkillRatingSystem } from './useRegistration';

export type TeamStatus = 
  | 'draft' 
  | 'pending_partner' 
  | 'partner_pending' 
  | 'partner_confirmed' 
  | 'pending_approval' 
  | 'approved' 
  | 'rejected' 
  | 'removed';

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface Team {
  id: string;
  table_id: string;
  player1_user_id: string;
  player1_display_name: string;
  player1_team: string | null;
  player1_skill_level: number | null;
  player1_rating_system: SkillRatingSystem;
  player1_profile_link: string | null;
  player2_user_id: string | null;
  player2_display_name: string | null;
  player2_team: string | null;
  player2_skill_level: number | null;
  player2_rating_system: SkillRatingSystem;
  player2_profile_link: string | null;
  team_status: TeamStatus;
  btc_approved: boolean;
  btc_approved_at: string | null;
  btc_notes: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  player1_email?: string;
  player2_email?: string;
}

export interface PartnerInvitation {
  id: string;
  team_id: string;
  table_id: string;
  invite_code: string;
  invited_by_user_id: string;
  invited_user_id: string | null;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  used_at: string | null;
}

export interface TeamFormData {
  display_name: string;
  team?: string;
  rating_system: SkillRatingSystem;
  skill_level?: number;
  profile_link?: string;
}

export function useTeamRegistration() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Get all teams for a table (for BTC)
  const getTableTeams = useCallback(async (tableId: string): Promise<Team[]> => {
    try {
      const { data, error } = await supabase
        .from('quick_table_teams')
        .select('*')
        .eq('table_id', tableId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Team[];
    } catch (error) {
      console.error('Error fetching teams:', error);
      return [];
    }
  }, []);

  // Get user's team for a table
  const getUserTeam = useCallback(async (tableId: string): Promise<Team | null> => {
    if (!user) return null;

    try {
      // Check if user is player1 or player2 in any team
      const { data, error } = await supabase
        .from('quick_table_teams')
        .select('*')
        .eq('table_id', tableId)
        .or(`player1_user_id.eq.${user.id},player2_user_id.eq.${user.id}`)
        .maybeSingle();

      if (error) throw error;
      return data as Team | null;
    } catch (error) {
      console.error('Error fetching user team:', error);
      return null;
    }
  }, [user]);

  // Create a new team (VDV1 registers)
  const createTeam = useCallback(async (
    tableId: string,
    formData: TeamFormData
  ): Promise<Team | null> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để đăng ký');
      return null;
    }

    setLoading(true);
    try {
      // Check if user already has a team in this table (as player1 or player2)
      const { data: existingTeam } = await supabase
        .from('quick_table_teams')
        .select('id')
        .eq('table_id', tableId)
        .or(`player1_user_id.eq.${user.id},player2_user_id.eq.${user.id}`)
        .maybeSingle();

      if (existingTeam) {
        toast.error('Bạn đã đăng ký tham gia giải này rồi');
        return null;
      }

      const { data, error } = await supabase
        .from('quick_table_teams')
        .insert({
          table_id: tableId,
          player1_user_id: user.id,
          player1_display_name: formData.display_name.trim(),
          player1_team: formData.team?.trim() || null,
          player1_skill_level: formData.skill_level || null,
          player1_rating_system: formData.rating_system,
          player1_profile_link: formData.profile_link?.trim() || null,
          team_status: 'draft',
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

      toast.success('Đăng ký thành công! Bạn có thể mời partner ngay bây giờ.');
      return data as Team;
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error('Không thể đăng ký, vui lòng thử lại');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Get invitations for a team
  const getTeamInvitations = useCallback(async (teamId: string): Promise<PartnerInvitation[]> => {
    try {
      const { data, error } = await supabase
        .from('quick_table_partner_invitations')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PartnerInvitation[];
    } catch (error) {
      console.error('Error fetching invitations:', error);
      return [];
    }
  }, []);

  // Create invitation (max 3 active)
  const createInvitation = useCallback(async (teamId: string, tableId: string): Promise<PartnerInvitation | null> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return null;
    }

    setLoading(true);
    try {
      // Check active invitation count using RPC
      const { data: countResult } = await supabase
        .rpc('get_active_invitation_count', { _team_id: teamId });
      
      const activeCount = countResult || 0;
      if (activeCount >= 3) {
        toast.error('Bạn đã gửi tối đa 3 lời mời. Vui lòng hủy bớt để tạo mới.');
        return null;
      }

      const { data, error } = await supabase
        .from('quick_table_partner_invitations')
        .insert({
          team_id: teamId,
          table_id: tableId,
          invited_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Đã tạo link mời partner');
      return data as PartnerInvitation;
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast.error('Không thể tạo lời mời');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Cancel invitation
  const cancelInvitation = useCallback(async (invitationId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quick_table_partner_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;
      toast.success('Đã hủy lời mời');
      return true;
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast.error('Không thể hủy lời mời');
      return false;
    }
  }, []);

  // Accept invitation (partner joins team)
  const acceptInvitation = useCallback(async (
    inviteCode: string,
    formData: TeamFormData
  ): Promise<{ success: boolean; teamId?: string; error?: string }> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return { success: false, error: 'AUTH_REQUIRED' };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('accept_partner_invitation', {
        _invitation_code: inviteCode,
        _user_id: user.id,
        _display_name: formData.display_name.trim(),
        _team: formData.team?.trim() || null,
        _skill_level: formData.skill_level || null,
        _rating_system: formData.rating_system,
        _profile_link: formData.profile_link?.trim() || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; team_id?: string; error?: string };
      
      if (!result.success) {
        const errorMessages: Record<string, string> = {
          INVITATION_NOT_FOUND: 'Link mời không tồn tại',
          INVITATION_ALREADY_USED: 'Link mời đã được sử dụng',
          INVITATION_EXPIRED: 'Link mời đã hết hạn',
          TEAM_NOT_FOUND: 'Đội không tồn tại',
          TEAM_ALREADY_COMPLETE: 'Đội đã đủ 2 người',
          TABLE_LOCKED: 'Giải đấu đã diễn ra',
          CANNOT_JOIN_OWN_TEAM: 'Bạn không thể tham gia đội của chính mình',
        };
        toast.error(errorMessages[result.error || ''] || 'Có lỗi xảy ra');
        return { success: false, error: result.error };
      }

      toast.success('Đã tham gia đội thành công!');
      return { success: true, teamId: result.team_id };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast.error('Không thể tham gia đội');
      return { success: false, error: 'UNKNOWN_ERROR' };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Remove partner from team (by VDV1)
  const removePartner = useCallback(async (teamId: string): Promise<boolean> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return false;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('remove_partner_from_team', {
        _team_id: teamId,
        _user_id: user.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        const errorMessages: Record<string, string> = {
          TEAM_NOT_FOUND: 'Đội không tồn tại',
          PERMISSION_DENIED: 'Bạn không có quyền thực hiện thao tác này',
          TABLE_LOCKED: 'Giải đấu đã diễn ra',
        };
        toast.error(errorMessages[result.error || ''] || 'Có lỗi xảy ra');
        return false;
      }

      toast.success('Đã xóa partner khỏi đội');
      return true;
    } catch (error) {
      console.error('Error removing partner:', error);
      toast.error('Không thể xóa partner');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // BTC: Approve/Reject/Remove team
  const btcManageTeam = useCallback(async (
    teamId: string,
    action: 'approve' | 'reject' | 'remove',
    notes?: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('btc_manage_team', {
        _team_id: teamId,
        _action: action,
        _notes: notes || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        const errorMessages: Record<string, string> = {
          TEAM_NOT_FOUND: 'Đội không tồn tại',
          PERMISSION_DENIED: 'Bạn không có quyền thực hiện thao tác này',
          INVALID_ACTION: 'Thao tác không hợp lệ',
        };
        toast.error(errorMessages[result.error || ''] || 'Có lỗi xảy ra');
        return false;
      }

      const messages = {
        approve: 'Đã duyệt đội',
        reject: 'Đã từ chối đội',
        remove: 'Đã loại đội khỏi giải',
      };
      toast.success(messages[action]);
      return true;
    } catch (error) {
      console.error('Error managing team:', error);
      toast.error('Không thể thực hiện thao tác');
      return false;
    }
  }, []);

  // Get invitation by code (for partner landing page)
  const getInvitationByCode = useCallback(async (inviteCode: string): Promise<{
    invitation: PartnerInvitation | null;
    team: Team | null;
    tableName: string | null;
  }> => {
    try {
      // Get invitation
      const { data: invitation, error: invError } = await supabase
        .from('quick_table_partner_invitations')
        .select('*')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (invError || !invitation) {
        return { invitation: null, team: null, tableName: null };
      }

      // Get team
      const { data: team, error: teamError } = await supabase
        .from('quick_table_teams')
        .select('*')
        .eq('id', invitation.team_id)
        .maybeSingle();

      if (teamError || !team) {
        return { invitation: invitation as PartnerInvitation, team: null, tableName: null };
      }

      // Get table name
      const { data: table } = await supabase
        .from('quick_tables')
        .select('name')
        .eq('id', team.table_id)
        .maybeSingle();

      return {
        invitation: invitation as PartnerInvitation,
        team: team as Team,
        tableName: table?.name || null,
      };
    } catch (error) {
      console.error('Error fetching invitation:', error);
      return { invitation: null, team: null, tableName: null };
    }
  }, []);

  return {
    loading,
    getTableTeams,
    getUserTeam,
    createTeam,
    getTeamInvitations,
    createInvitation,
    cancelInvitation,
    acceptInvitation,
    removePartner,
    btcManageTeam,
    getInvitationByCode,
  };
}
