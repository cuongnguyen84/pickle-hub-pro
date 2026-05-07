import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PlayerMatchHistoryRow =
  Database["public"]["Functions"]["get_player_match_history"]["Returns"][number];

const PAGE_SIZE = 20;

/**
 * Paginated wrapper around get_player_match_history. Each call returns up
 * to PAGE_SIZE rows; getNextPageParam advances the offset until the RPC
 * returns a partial page (signaling no more rows).
 */
export function usePlayerMatchHistory(playerId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["player-match-history", playerId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!playerId) return [] as PlayerMatchHistoryRow[];
      const { data, error } = await supabase.rpc("get_player_match_history", {
        p_player_id: playerId,
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return (data ?? []) as PlayerMatchHistoryRow[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: !!playerId,
    staleTime: 60_000,
  });
}
