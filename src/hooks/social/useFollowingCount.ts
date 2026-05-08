import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Count of profiles the viewer follows. Used by the /feed page to decide
 * which tab to land the user on initially (0 follows → Trending, >0 →
 * Following — see resolveDefaultTab in feed-tab-logic.ts).
 *
 * Cheaper than calling get_player_stats() since we don't need win-rate /
 * streak / followers; just the integer.
 */
export function useFollowingCount(viewerId: string | undefined) {
  return useQuery({
    queryKey: ["following-count", viewerId ?? null],
    enabled: !!viewerId,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!viewerId) return 0;
      const { count, error } = await supabase
        .from("social_follows")
        .select("followed_id", { count: "exact", head: true })
        .eq("follower_id", viewerId);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
