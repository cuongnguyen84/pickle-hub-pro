import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { SkillRatingSystem } from './useRegistration';
import { sanitizeString, sanitizeProfileLink } from '@/lib/validation';
import { tStandalone } from '@/lib/i18n-standalone';

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
      // Check if user is player1 or player2 in any ACTIVE team (not removed)
      // First check if user is player2 (partner) in a team - this takes priority
      const { data: asPlayer2 } = await supabase
        .from('quick_table_teams')
        .select('*')
        .eq('table_id', tableId)
        .eq('player2_user_id', user.id)
        .not('team_status', 'in', '(removed,rejected)')
        .maybeSingle();

      if (asPlayer2) {
        return asPlayer2 as Team;
      }

      // Then check if user is player1 (owner) in a non-removed team
      const { data: asPlayer1 } = await supabase
        .from('quick_table_teams')
        .select('*')
        .eq('table_id', tableId)
        .eq('player1_user_id', user.id)
        .not('team_status', 'in', '(removed,rejected)')
        .maybeSingle();

      if (asPlayer1) {
        return asPlayer1 as Team;
      }

      return null;
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
      toast.error(tStandalone('toast.teamRegistration.createTeam.authRequired'));
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
        toast.error(tStandalone('toast.teamRegistration.createTeam.duplicate'));
        return null;
      }

      const safeDisplayName = sanitizeString(formData.display_name, 100);
      if (!safeDisplayName) {
        toast.error(tStandalone('toast.teamRegistration.createTeam.displayNameRequired'));
        return null;
      }

      const { data, error } = await supabase
        .from('quick_table_teams')
        .insert({
          table_id: tableId,
          player1_user_id: user.id,
          player1_display_name: safeDisplayName,
          player1_team: formData.team ? sanitizeString(formData.team, 100) : null,
          player1_skill_level: formData.skill_level || null,
          player1_rating_system: formData.rating_system,
          player1_profile_link: sanitizeProfileLink(formData.profile_link),
          team_status: 'draft',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error(tStandalone('toast.teamRegistration.createTeam.duplicate'));
        } else {
          throw error;
        }
        return null;
      }

      toast.success(tStandalone('toast.teamRegistration.createTeam.success'));
      return data as Team;
    } catch (error) {
      // Sprint B fix (2026-05-27) — surface the actual DB / RLS / check
      // failure to the user instead of the generic "Failed to register".
      // Most common causes flagged today: invalid enum value (eg lowercase
      // 'dupr' vs uppercase 'DUPR' in skill_rating_system), missing
      // is_doubles flag mismatch, or RLS rejection on quick_table_teams.
      console.error('Error creating team:', error);
      const err = error as { code?: string; message?: string; details?: string; hint?: string };
      const friendly =
        err?.code === '22P02'
          ? 'Giá trị rating system không hợp lệ. Vui lòng tải lại trang và thử lại.'
          : err?.code === '23514'
            ? 'Dữ liệu vi phạm ràng buộc của bảng đấu. Kiểm tra DUPR rating + tên hiển thị.'
            : err?.code === '42501'
              ? 'Bạn không có quyền đăng ký giải này (RLS). Liên hệ BTC.'
              : err?.message || tStandalone('toast.teamRegistration.createTeam.error');
      toast.error(`${tStandalone('toast.teamRegistration.createTeam.error')}: ${friendly}`);
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
      toast.error(tStandalone('toast.common.authRequired'));
      return null;
    }

    setLoading(true);
    try {
      // Check active invitation count using RPC
      const { data: countResult } = await supabase
        .rpc('get_active_invitation_count', { _team_id: teamId });

      const activeCount = countResult || 0;
      if (activeCount >= 3) {
        toast.error(tStandalone('toast.teamRegistration.createInvitation.maxReached'));
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

      toast.success(tStandalone('toast.teamRegistration.createInvitation.success'));
      return data as PartnerInvitation;
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast.error(tStandalone('toast.teamRegistration.createInvitation.error'));
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
      toast.success(tStandalone('toast.teamRegistration.cancelInvitation.success'));
      return true;
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast.error(tStandalone('toast.teamRegistration.cancelInvitation.error'));
      return false;
    }
  }, []);

  // Accept invitation (partner joins team)
  const acceptInvitation = useCallback(async (
    inviteCode: string,
    formData: TeamFormData
  ): Promise<{ success: boolean; teamId?: string; error?: string }> => {
    if (!user) {
      toast.error(tStandalone('toast.common.authRequired'));
      return { success: false, error: 'AUTH_REQUIRED' };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('accept_partner_invitation', {
        _invitation_code: inviteCode,
        _user_id: user.id,
        _display_name: sanitizeString(formData.display_name, 100),
        _team: formData.team ? sanitizeString(formData.team, 100) : null,
        _skill_level: formData.skill_level || null,
        _rating_system: formData.rating_system,
        _profile_link: sanitizeProfileLink(formData.profile_link),
      });

      if (error) throw error;

      const result = data as { success: boolean; team_id?: string; error?: string };

      if (!result.success) {
        const codeKey = result.error
          ? `toast.teamRegistration.acceptInvitation.codes.${result.error}`
          : '';
        const looked = codeKey ? tStandalone(codeKey) : '';
        // tStandalone returns the key itself when the lookup misses
        const message = looked && looked !== codeKey
          ? looked
          : tStandalone('toast.common.unknownError');
        toast.error(message);
        return { success: false, error: result.error };
      }

      toast.success(tStandalone('toast.teamRegistration.acceptInvitation.success'));
      return { success: true, teamId: result.team_id };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast.error(tStandalone('toast.teamRegistration.acceptInvitation.error'));
      return { success: false, error: 'UNKNOWN_ERROR' };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Remove partner from team (by VDV1)
  const removePartner = useCallback(async (teamId: string): Promise<boolean> => {
    if (!user) {
      toast.error(tStandalone('toast.common.authRequired'));
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
        const codeKey = result.error
          ? `toast.teamRegistration.removePartner.codes.${result.error}`
          : '';
        const looked = codeKey ? tStandalone(codeKey) : '';
        const message = looked && looked !== codeKey
          ? looked
          : tStandalone('toast.common.unknownError');
        toast.error(message);
        return false;
      }

      toast.success(tStandalone('toast.teamRegistration.removePartner.success'));
      return true;
    } catch (error) {
      console.error('Error removing partner:', error);
      toast.error(tStandalone('toast.teamRegistration.removePartner.error'));
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
        const codeKey = result.error
          ? `toast.teamRegistration.btcManage.codes.${result.error}`
          : '';
        const looked = codeKey ? tStandalone(codeKey) : '';
        const message = looked && looked !== codeKey
          ? looked
          : tStandalone('toast.common.unknownError');
        toast.error(message);
        return false;
      }

      const successKey: Record<typeof action, string> = {
        approve: 'toast.teamRegistration.btcManage.approved',
        reject: 'toast.teamRegistration.btcManage.rejected',
        remove: 'toast.teamRegistration.btcManage.removed',
      };
      toast.success(tStandalone(successKey[action]));
      return true;
    } catch (error) {
      console.error('Error managing team:', error);
      toast.error(tStandalone('toast.teamRegistration.btcManage.error'));
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
