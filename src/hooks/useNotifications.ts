import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Notification {
  id: string;
  user_id: string;
  type: "livestream_scheduled" | "livestream_live";
  entity_type: "organization" | "tournament";
  entity_id: string;
  related_id: string | null;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

// Fetch user notifications
export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!userId,
  });
}

// Get unread count
export function useUnreadNotificationCount(userId?: string) {
  return useQuery({
    queryKey: ["notifications-unread-count", userId],
    queryFn: async () => {
      if (!userId) return 0;

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
  });
}

// Realtime subscription for notifications
export function useNotificationRealtime(userId?: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    console.log("[Notifications] Setting up realtime for user:", userId);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[Notifications] New notification received:", payload.new);
          const newNotification = payload.new as Notification;

          // Update notifications list
          queryClient.setQueryData<Notification[]>(
            ["notifications", userId],
            (old) => {
              if (!old) return [newNotification];
              // Avoid duplicates
              if (old.some((n) => n.id === newNotification.id)) return old;
              return [newNotification, ...old];
            }
          );

          // Update unread count
          queryClient.setQueryData<number>(
            ["notifications-unread-count", userId],
            (old) => (old ?? 0) + 1
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[Notifications] Notification updated:", payload.new);
          const updated = payload.new as Notification;

          queryClient.setQueryData<Notification[]>(
            ["notifications", userId],
            (old) => old?.map((n) => (n.id === updated.id ? updated : n)) ?? []
          );

          // Recalculate unread count
          queryClient.invalidateQueries({
            queryKey: ["notifications-unread-count", userId],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[Notifications] Notification deleted:", payload.old);
          const deleted = payload.old as Notification;

          queryClient.setQueryData<Notification[]>(
            ["notifications", userId],
            (old) => old?.filter((n) => n.id !== deleted.id) ?? []
          );

          // Recalculate unread count
          queryClient.invalidateQueries({
            queryKey: ["notifications-unread-count", userId],
          });
        }
      )
      .subscribe((status) => {
        console.log("[Notifications] Channel status:", status);
      });

    channelRef.current = channel;

    return () => {
      console.log("[Notifications] Cleaning up realtime channel");
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, queryClient]);
}

// Mark notification as read
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, userId }: { notificationId: string; userId: string }) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", variables.userId] });
    },
  });
}

// Mark all notifications as read
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", userId] });
    },
  });
}

// Delete notification
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, userId }: { notificationId: string; userId: string }) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", variables.userId] });
    },
  });
}
