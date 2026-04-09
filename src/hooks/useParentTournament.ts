import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { sanitizeString } from '@/lib/validation';

export interface ParentTournament {
  id: string;
  creator_user_id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  event_date: string | null;
  location: string | null;
  share_id: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export function useParentTournament() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createParent = useCallback(async (data: {
    name: string;
    description?: string;
    event_date?: string;
    location?: string;
  }): Promise<ParentTournament | null> => {
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return null;
    }
    setLoading(true);
    try {
      const safeName = sanitizeString(data.name, 100);
      if (!safeName) {
        toast.error('Tên giải không được để trống');
        return null;
      }
      const { data: result, error } = await supabase
        .from('parent_tournaments')
        .insert({
          creator_user_id: user.id,
          name: safeName,
          description: data.description ? sanitizeString(data.description, 500) : null,
          event_date: data.event_date || null,
          location: data.location ? sanitizeString(data.location, 200) : null,
        })
        .select()
        .single();

      if (error) throw error;
      return result as ParentTournament;
    } catch {
      toast.error('Không thể tạo giải tổng');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getUserParentTournaments = useCallback(async (): Promise<ParentTournament[]> => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('parent_tournaments')
        .select('*')
        .eq('creator_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ParentTournament[];
    } catch {
      return [];
    }
  }, [user]);

  const getParentByShareId = useCallback(async (shareId: string): Promise<ParentTournament | null> => {
    try {
      const { data, error } = await supabase
        .from('parent_tournaments')
        .select('*')
        .eq('share_id', shareId)
        .maybeSingle();

      if (error) throw error;
      return data as ParentTournament | null;
    } catch {
      return null;
    }
  }, []);

  const getSubEventCount = useCallback(async (parentId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('quick_tables')
        .select('id', { count: 'exact', head: true })
        .eq('parent_tournament_id', parentId);

      if (error) throw error;
      return count || 0;
    } catch {
      return 0;
    }
  }, []);

  const deleteParent = useCallback(async (parentId: string): Promise<boolean> => {
    try {
      const count = await getSubEventCount(parentId);
      if (count > 0) {
        toast.error('Bạn phải xoá tất cả nội dung con trước khi xoá giải tổng');
        return false;
      }
      const { error } = await supabase
        .from('parent_tournaments')
        .delete()
        .eq('id', parentId);

      if (error) throw error;
      toast.success('Đã xoá giải tổng');
      return true;
    } catch {
      toast.error('Không thể xoá giải tổng');
      return false;
    }
  }, [getSubEventCount]);

  const isOwner = useCallback((parent: ParentTournament): boolean => {
    return !!user && parent.creator_user_id === user.id;
  }, [user]);

  return {
    loading,
    createParent,
    getUserParentTournaments,
    getParentByShareId,
    getSubEventCount,
    deleteParent,
    isOwner,
  };
}
