// ============================================================================
// useNotifications — Sprint 2 Phase 3B.2
// ----------------------------------------------------------------------------
// social_notifications table (Sprint 1 Option A) — distinct from the legacy
// `notifications` table covered by src/hooks/useNotifications.ts.
//
// Provides:
//   useSocialNotifications()   list top 10 + realtime INSERT subscription
//   useSocialUnreadCount()     quick count for the bell badge
//   useMarkSocialAsRead()      mutation for tap-to-read
//   useMarkAllSocialAsRead()   mutation for mark-all
// ============================================================================

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SocialNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

const LIST_LIMIT = 10;

export function useSocialNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();

  const q = useQuery<SocialNotification[]>({
    queryKey: ["social-notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_notifications")
        .select("id, user_id, type, title, body, link_url, payload, is_read, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (error) throw error;
      return (data ?? []) as SocialNotification[];
    },
  });

  // ─── Realtime: live INSERT events for THIS user ──────────────────────
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`social_notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "social_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as SocialNotification;
          // Insert at top of cache + bump unread count
          qc.setQueryData<SocialNotification[]>(
            ["social-notifications", userId],
            (prev) => {
              const list = prev ?? [];
              if (list.find((n) => n.id === row.id)) return list;
              return [row, ...list].slice(0, LIST_LIMIT);
            },
          );
          qc.invalidateQueries({ queryKey: ["social-notifications-unread", userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return q;
}

export function useSocialUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery<number>({
    queryKey: ["social-notifications-unread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("social_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkSocialAsRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("social_notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-notifications", userId] });
      qc.invalidateQueries({ queryKey: ["social-notifications-unread", userId] });
    },
  });
}

export function useMarkAllSocialAsRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("not_authenticated");
      const { error } = await supabase
        .from("social_notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-notifications", userId] });
      qc.invalidateQueries({ queryKey: ["social-notifications-unread", userId] });
    },
  });
}
