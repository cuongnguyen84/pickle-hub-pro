import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatLeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  message_count: number;
  rank: number;
}

interface UseChatLeaderboardResult {
  leaderboard: ChatLeaderboardEntry[];
  getChatterRank: (userId: string) => number | null;
  isLoading: boolean;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useChatLeaderboard(livestreamId: string): UseChatLeaderboardResult {
  const [leaderboard, setLeaderboard] = useState<ChatLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchLeaderboard = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_chat_leaderboard", {
      _livestream_id: livestreamId,
      _limit: 10,
    });

    if (!mountedRef.current) return;

    if (!error && data) {
      setLeaderboard(
        (data as any[]).map((d) => ({
          user_id: d.user_id,
          display_name: d.display_name,
          avatar_url: d.avatar_url,
          message_count: Number(d.message_count),
          rank: Number(d.rank),
        }))
      );
    }
    setIsLoading(false);
  }, [livestreamId]);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    fetchLeaderboard();

    const interval = setInterval(fetchLeaderboard, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchLeaderboard]);

  // Top 3 lookup map for O(1) access
  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    leaderboard.forEach((entry) => {
      if (entry.rank <= 3) {
        map.set(entry.user_id, entry.rank);
      }
    });
    return map;
  }, [leaderboard]);

  const getChatterRank = useCallback(
    (userId: string): number | null => rankMap.get(userId) ?? null,
    [rankMap]
  );

  return { leaderboard, getChatterRank, isLoading };
}
