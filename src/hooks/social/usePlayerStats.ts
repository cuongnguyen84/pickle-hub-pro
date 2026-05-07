import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PlayerStatsRow = Database["public"]["Functions"]["get_player_stats"]["Returns"][number];

/**
 * Wraps the get_player_stats RPC (Phase 1).
 *
 * Returns the aggregate stats row (or null when the username doesn't map
 * to a profile — the function still returns 1 row with profile_id=null,
 * which we surface as null up the stack so the caller can branch on it).
 */
export function usePlayerStats(username: string | undefined) {
  return useQuery({
    queryKey: ["player-stats", username],
    queryFn: async () => {
      if (!username) return null;
      const { data, error } = await supabase.rpc("get_player_stats", {
        p_username: username,
      });
      if (error) throw error;
      const row = data?.[0];
      if (!row || !row.profile_id) return null;
      return row as PlayerStatsRow;
    },
    enabled: !!username,
    staleTime: 60_000,
  });
}
