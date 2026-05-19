import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Venue } from "./types";

/**
 * User's 3 most recent distinct venues (from match history).
 * Falls back to verified venues if user has no match history yet.
 */
export function useRecentVenues(): { venues: Venue[] | undefined; isLoading: boolean } {
  const { user } = useAuth();
  const userId = user?.id;

  const q = useQuery<Venue[]>({
    queryKey: ["recent-venues", userId],
    enabled: !!userId,
    queryFn: async () => {
      // Pull recent distinct venue_ids from user's matches (recorded or participated)
      const { data: matchVenues } = await supabase
        .from("matches")
        .select("venue_id, created_at")
        .not("venue_id", "is", null)
        .or(`recorded_by.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(20);

      const seen = new Set<string>();
      const uniqueIds: string[] = [];
      for (const m of matchVenues ?? []) {
        const vid = (m as { venue_id: string | null }).venue_id;
        if (vid && !seen.has(vid)) {
          seen.add(vid);
          uniqueIds.push(vid);
          if (uniqueIds.length >= 3) break;
        }
      }
      if (uniqueIds.length === 0) {
        // Fallback: top verified venues
        const { data } = await supabase
          .from("venues")
          .select(
            "id,slug,name,name_vi,city,district,address,latitude,longitude,num_courts,surface_type,is_indoor,is_verified",
          )
          .eq("is_verified", true)
          .limit(3);
        return (data ?? []) as Venue[];
      }
      const { data } = await supabase
        .from("venues")
        .select(
          "id,slug,name,name_vi,city,district,address,latitude,longitude,num_courts,surface_type,is_indoor,is_verified",
        )
        .in("id", uniqueIds);
      return (data ?? []) as Venue[];
    },
  });

  return { venues: q.data, isLoading: q.isLoading };
}
