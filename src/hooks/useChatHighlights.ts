import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HighlightType = "vip" | "sponsor" | "special_guest";

export interface ChatHighlight {
  id: string;
  livestream_id: string;
  user_id: string;
  highlight_type: HighlightType;
  created_by: string;
  created_at: string;
}

export const HIGHLIGHT_PRESETS: Record<HighlightType, {
  label: string;
  labelVi: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  vip: {
    label: "VIP",
    labelVi: "VIP",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    icon: "⭐",
  },
  sponsor: {
    label: "Sponsor",
    labelVi: "Nhà tài trợ",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    icon: "💎",
  },
  special_guest: {
    label: "Special Guest",
    labelVi: "Khách mời",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    icon: "🌟",
  },
};

interface UseChatHighlightsResult {
  highlights: Map<string, ChatHighlight>;
  highlightUser: (userId: string, type: HighlightType) => Promise<boolean>;
  removeHighlight: (userId: string) => Promise<boolean>;
  getHighlight: (userId: string) => ChatHighlight | undefined;
}

export const useChatHighlights = (livestreamId: string): UseChatHighlightsResult => {
  const [highlights, setHighlights] = useState<Map<string, ChatHighlight>>(new Map());

  // Load initial highlights
  useEffect(() => {
    if (!livestreamId) return;

    const load = async () => {
      const { data } = await supabase
        .from("chat_highlighted_users")
        .select("*")
        .eq("livestream_id", livestreamId);

      if (data) {
        const map = new Map<string, ChatHighlight>();
        data.forEach((h: any) => map.set(h.user_id, h as ChatHighlight));
        setHighlights(map);
      }
    };

    load();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`chat_highlights:${livestreamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_highlighted_users",
          filter: `livestream_id=eq.${livestreamId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const h = payload.new as ChatHighlight;
            setHighlights((prev) => new Map(prev).set(h.user_id, h));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { user_id?: string };
            if (old.user_id) {
              setHighlights((prev) => {
                const next = new Map(prev);
                next.delete(old.user_id!);
                return next;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [livestreamId]);

  const highlightUser = useCallback(
    async (userId: string, type: HighlightType): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[ChatHighlights] No authenticated user');
        return false;
      }

      console.log('[ChatHighlights] Highlighting user:', userId, 'type:', type, 'livestream:', livestreamId);
      
      const { error } = await supabase.from("chat_highlighted_users").upsert(
        {
          livestream_id: livestreamId,
          user_id: userId,
          highlight_type: type,
          created_by: user.id,
        },
        { onConflict: "livestream_id,user_id" }
      );

      if (error) {
        console.error('[ChatHighlights] Error highlighting user:', error);
      }
      return !error;
    },
    [livestreamId]
  );

  const removeHighlight = useCallback(
    async (userId: string): Promise<boolean> => {
      const { error } = await supabase
        .from("chat_highlighted_users")
        .delete()
        .eq("livestream_id", livestreamId)
        .eq("user_id", userId);

      return !error;
    },
    [livestreamId]
  );

  const getHighlight = useCallback(
    (userId: string) => highlights.get(userId),
    [highlights]
  );

  return { highlights, highlightUser, removeHighlight, getHighlight };
};
