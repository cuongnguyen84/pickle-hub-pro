import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PlayerProfile } from "./types";

/** Last 20 unique players the user has shared a match with. */
export function useRecentPartners(): { partners: PlayerProfile[] | undefined; isLoading: boolean } {
  const { user } = useAuth();
  const userId = user?.id;

  const q = useQuery<PlayerProfile[]>({
    queryKey: ["recent-partners", userId],
    enabled: !!userId,
    queryFn: async () => {
      // Match IDs where user is a participant
      const { data: own } = await supabase
        .from("match_participants")
        .select("match_id")
        .eq("player_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      const matchIds = Array.from(new Set((own ?? []).map((r) => r.match_id as string)));
      if (matchIds.length === 0) return [];

      // Other players in those matches
      const { data: others } = await supabase
        .from("match_participants")
        .select("player_id")
        .in("match_id", matchIds)
        .neq("player_id", userId!);

      const seen = new Set<string>();
      const ids: string[] = [];
      for (const r of others ?? []) {
        const pid = (r as { player_id: string }).player_id;
        if (!seen.has(pid)) {
          seen.add(pid);
          ids.push(pid);
          if (ids.length >= 20) break;
        }
      }
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,dupr_doubles,is_ghost,city")
        .in("id", ids);
      return (profiles ?? []) as PlayerProfile[];
    },
  });
  return { partners: q.data, isLoading: q.isLoading };
}
