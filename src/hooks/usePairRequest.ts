import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { tStandalone } from '@/lib/i18n-standalone';

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
      toast.error(tStandalone('toast.common.authRequired'));
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
        const codeKey = result.error
          ? `toast.pairRequest.create.codes.${result.error}`
          : '';
        const looked = codeKey ? tStandalone(codeKey) : '';
        const message = looked && looked !== codeKey
          ? looked
          : tStandalone('toast.common.unknownError');
        toast.error(message);
        return { success: false, error: result.error };
      }

      toast.success(tStandalone('toast.pairRequest.create.success'));
      return { success: true };
    } catch (error) {
      console.error('Error creating pair request:', error);
      toast.error(tStandalone('toast.pairRequest.create.error'));
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
      toast.error(tStandalone('toast.common.authRequired'));
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
        const codeKey = result.error
          ? `toast.pairRequest.respond.codes.${result.error}`
          : '';
        const looked = codeKey ? tStandalone(codeKey) : '';
        const message = looked && looked !== codeKey
          ? looked
          : tStandalone('toast.common.unknownError');
        toast.error(message);
        return { success: false, error: result.error };
      }

      if (accept) {
        toast.success(tStandalone('toast.pairRequest.respond.acceptSuccess'));
      } else {
        toast.success(tStandalone('toast.pairRequest.respond.rejectSuccess'));
      }
      return { success: true, teamId: result.team_id };
    } catch (error) {
      console.error('Error responding to pair request:', error);
      toast.error(tStandalone('toast.pairRequest.respond.error'));
      return { success: false, error: 'UNKNOWN_ERROR' };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Cancel own pair request
  const cancelPairRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!user) {
      toast.error(tStandalone('toast.common.authRequired'));
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
        toast.error(tStandalone('toast.pairRequest.cancel.error'));
        return false;
      }

      toast.success(tStandalone('toast.pairRequest.cancel.success'));
      return true;
    } catch (error) {
      console.error('Error canceling pair request:', error);
      toast.error(tStandalone('toast.pairRequest.cancel.error'));
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
