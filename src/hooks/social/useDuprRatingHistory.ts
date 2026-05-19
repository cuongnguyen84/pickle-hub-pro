import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DuprHistoryRow =
  Database["public"]["Tables"]["dupr_rating_history"]["Row"];

/**
 * Fetch the last `windowDays` of dupr_rating_history snapshots for a
 * profile, sorted ASC by recorded_at so Recharts can plot left → right
 * without a client-side reverse.
 *
 * dupr_rating_history is public-read (RLS from Phase 1) so this query
 * works for both the profile owner and anonymous visitors.
 */
export function useDuprRatingHistory(
  profileId: string | undefined,
  windowDays = 30,
) {
  return useQuery({
    queryKey: ["dupr-rating-history", profileId, windowDays],
    queryFn: async () => {
      if (!profileId) return [] as DuprHistoryRow[];
      const cutoff = new Date(
        Date.now() - windowDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await supabase
        .from("dupr_rating_history")
        .select("*")
        .eq("profile_id", profileId)
        .gte("recorded_at", cutoff)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DuprHistoryRow[];
    },
    enabled: !!profileId,
    staleTime: 5 * 60_000,
  });
}
