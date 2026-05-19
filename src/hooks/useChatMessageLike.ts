import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LikeData {
  count: number;
  liked: boolean;
}

/**
 * Hook to manage likes for all chat messages in a livestream.
 * Uses a single subscription + in-memory cache for performance.
 */
export function useChatMessageLikes(livestreamId: string) {
  const { user } = useAuth();
  const [likesMap, setLikesMap] = useState<Record<string, LikeData>>({});
  const messageIdsRef = useRef<Set<string>>(new Set());
  // Track message IDs with pending optimistic updates to avoid double-counting from realtime
  const pendingOptimisticRef = useRef<Set<string>>(new Set());

  // Load likes for a batch of message IDs
  const loadLikes = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    const { data: allLikes } = await supabase
      .from("chat_message_likes")
      .select("message_id, user_id")
      .in("message_id", messageIds);

    if (!allLikes) return;

    const newMap: Record<string, LikeData> = {};
    for (const msgId of messageIds) {
      const msgLikes = allLikes.filter(l => l.message_id === msgId);
      newMap[msgId] = {
        count: msgLikes.length,
        liked: user ? msgLikes.some(l => l.user_id === user.id) : false,
      };
    }

    setLikesMap(prev => ({ ...prev, ...newMap }));
  }, [user]);

  // Register message IDs and load their likes
  const registerMessages = useCallback((messageIds: string[]) => {
    const newIds = messageIds.filter(id => !messageIdsRef.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach(id => messageIdsRef.current.add(id));
    loadLikes(newIds);
  }, [loadLikes]);

  // Realtime subscription for like changes
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`chat_likes:${livestreamId}:${Date.now()}_${Math.random().toString(36).slice(2,7)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_message_likes" },
          (payload) => {
            const row = payload.new as { message_id: string; user_id: string };
            if (!row.message_id) return;

            // Skip if this is our own optimistic update (already applied)
            if (user?.id === row.user_id && pendingOptimisticRef.current.has(row.message_id)) {
              pendingOptimisticRef.current.delete(row.message_id);
              return;
            }

            // Update count for any tracked message
            if (messageIdsRef.current.has(row.message_id)) {
              setLikesMap(prev => {
                const current = prev[row.message_id] ?? { count: 0, liked: false };
                return {
                  ...prev,
                  [row.message_id]: {
                    count: current.count + 1,
                    liked: current.liked || (user?.id === row.user_id),
                  },
                };
              });
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "chat_message_likes" },
          (payload) => {
            const row = payload.old as { message_id: string; user_id: string };
            if (!row.message_id) return;

            // Skip if this is our own optimistic update
            if (user?.id === row.user_id && pendingOptimisticRef.current.has(row.message_id)) {
              pendingOptimisticRef.current.delete(row.message_id);
              return;
            }

            if (messageIdsRef.current.has(row.message_id)) {
              setLikesMap(prev => {
                const current = prev[row.message_id] ?? { count: 0, liked: false };
                return {
                  ...prev,
                  [row.message_id]: {
                    count: Math.max(0, current.count - 1),
                    liked: (user?.id === row.user_id) ? false : current.liked,
                  },
                };
              });
            }
          }
        )
        .subscribe((status) => {
          console.log("[ChatLikes] Realtime channel status:", status);
        });
    } catch (err) {
      console.warn("[ChatLikes] Realtime setup failed:", err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [livestreamId, user?.id]);

  // Toggle like for a message
  const toggleLike = useCallback(async (messageId: string) => {
    if (!user) return;

    const current = likesMap[messageId];
    const isLiked = current?.liked ?? false;

    // Mark as pending optimistic to skip realtime echo
    pendingOptimisticRef.current.add(messageId);

    // Optimistic update
    setLikesMap(prev => ({
      ...prev,
      [messageId]: {
        count: (prev[messageId]?.count ?? 0) + (isLiked ? -1 : 1),
        liked: !isLiked,
      },
    }));

    try {
      if (isLiked) {
        await supabase
          .from("chat_message_likes")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("chat_message_likes")
          .insert({ message_id: messageId, user_id: user.id });
      }
    } catch {
      // Revert on error
      pendingOptimisticRef.current.delete(messageId);
      setLikesMap(prev => ({
        ...prev,
        [messageId]: {
          count: (prev[messageId]?.count ?? 0) + (isLiked ? 1 : -1),
          liked: isLiked,
        },
      }));
    }
  }, [user, likesMap]);

  const getLikeData = useCallback((messageId: string): LikeData => {
    return likesMap[messageId] ?? { count: 0, liked: false };
  }, [likesMap]);

  return { registerMessages, toggleLike, getLikeData };
}
