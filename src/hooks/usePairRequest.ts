import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface PairRequest {
  id: string;
  table_id: string;
  from_team_id: string;
  to_team_id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  responded_at: string | null;
  // Joined data
  from_team?: {
    player1_display_name: string;
    player1_team: string | null;
  };
  to_team?: {
    player1_display_name: string;
    player1_team: string | null;
  };
}

export function usePairRequest() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Get pending requests where current user is the target (VDV1)
  const getIncomingRequests = useCallback(async (tableId: string): Promise<PairRequest[]> => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('quick_table_pair_requests')
        .select(`
          *,
          from_team:quick_table_teams!quick_table_pair_requests_from_team_id_fkey(player1_display_name, player1_team)
        `)
        .eq('table_id', tableId)
        .eq('to_user_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      return (data || []) as unknown as PairRequest[];
    } catch (error) {
      console.error('Error fetching incoming requests:', error);
      return [];
    }
  }, [user]);

  // Get pending requests sent by current user
  const getOutgoingRequests = useCallback(async (tableId: string): Promise<PairRequest[]> => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('quick_table_pair_requests')
        .select(`
          *,
          to_team:quick_table_teams!quick_table_pair_requests_to_team_id_fkey(player1_display_name, player1_team)
        `)
        .eq('table_id', tableId)
        .eq('from_user_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      return (data || []) as unknown as PairRequest[];
    } catch (error) {
      console.error('Error fetching outgoing requests:', error);
      return [];
    }
  }, [user]);

  // Create a pair request
  const createPairRequest = useCallback(async (
    tableId: string,
    toTeamId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return { success: false, error: 'AUTH_REQUIRED' };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_pair_request', {
        _table_id: tableId,
        _to_team_id: toTeamId,
      });

      if (error) throw error;

      const result = data as { success: boolean; request_id?: string; error?: string };
      
      if (!result.success) {
        const errorMessages: Record<string, string> = {
          AUTH_REQUIRED: 'Vui lòng đăng nhập',
          TABLE_NOT_FOUND: 'Giải không tồn tại',
          TABLE_LOCKED: 'Giải đấu đã diễn ra',
          NO_TEAM: 'Bạn chưa đăng ký tham gia giải',
          TEAM_REJECTED: 'Bạn đã bị từ chối tham gia giải',
          ALREADY_HAS_PARTNER: 'Bạn đã có partner',
          TARGET_TEAM_NOT_FOUND: 'Người chơi không tồn tại',
          TARGET_TEAM_REJECTED: 'Người chơi đã bị từ chối',
          TARGET_HAS_PARTNER: 'Người chơi đã có partner',
          SAME_TEAM: 'Không thể ghép đôi với chính mình',
          REQUEST_ALREADY_SENT: 'Bạn đã gửi yêu cầu ghép đôi này rồi',
          REQUEST_PENDING_FROM_TARGET: 'Người này đang chờ bạn xác nhận ghép đôi',
        };
        toast.error(errorMessages[result.error || ''] || 'Có lỗi xảy ra');
        return { success: false, error: result.error };
      }

      toast.success('Đã gửi yêu cầu ghép đôi. Đang chờ xác nhận.');
      return { success: true };
    } catch (error) {
      console.error('Error creating pair request:', error);
      toast.error('Không thể gửi yêu cầu ghép đôi');
      return { success: false, error: 'UNKNOWN_ERROR' };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Respond to a pair request (accept or reject)
  const respondToPairRequest = useCallback(async (
    requestId: string,
    accept: boolean
  ): Promise<{ success: boolean; teamId?: string; error?: string }> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return { success: false, error: 'AUTH_REQUIRED' };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('respond_pair_request', {
        _request_id: requestId,
        _accept: accept,
      });

      if (error) throw error;

      const result = data as { success: boolean; team_id?: string; error?: string };
      
      if (!result.success) {
        const errorMessages: Record<string, string> = {
          AUTH_REQUIRED: 'Vui lòng đăng nhập',
          REQUEST_NOT_FOUND: 'Yêu cầu không tồn tại',
          NOT_TARGET_USER: 'Bạn không có quyền xử lý yêu cầu này',
          REQUEST_NOT_PENDING: 'Yêu cầu đã được xử lý',
          TABLE_LOCKED: 'Giải đấu đã diễn ra',
          FROM_TEAM_ALREADY_PAIRED: 'Người gửi yêu cầu đã có partner',
          TO_TEAM_ALREADY_PAIRED: 'Bạn đã có partner',
        };
        toast.error(errorMessages[result.error || ''] || 'Có lỗi xảy ra');
        return { success: false, error: result.error };
      }

      if (accept) {
        toast.success('Đã ghép đôi thành công!');
      } else {
        toast.success('Đã từ chối yêu cầu ghép đôi');
      }
      return { success: true, teamId: result.team_id };
    } catch (error) {
      console.error('Error responding to pair request:', error);
      toast.error('Không thể xử lý yêu cầu');
      return { success: false, error: 'UNKNOWN_ERROR' };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Cancel own pair request
  const cancelPairRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return false;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('cancel_pair_request', {
        _request_id: requestId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        toast.error('Không thể hủy yêu cầu');
        return false;
      }

      toast.success('Đã hủy yêu cầu ghép đôi');
      return true;
    } catch (error) {
      console.error('Error canceling pair request:', error);
      toast.error('Không thể hủy yêu cầu');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    loading,
    getIncomingRequests,
    getOutgoingRequests,
    createPairRequest,
    respondToPairRequest,
    cancelPairRequest,
  };
}
