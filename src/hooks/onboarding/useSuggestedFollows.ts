import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuggestedFollow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  dupr_doubles: number | null;
  reason: "played_together" | "same_city" | "verified_pro" | string;
}

/**
 * Wraps the get_suggested_follows RPC (defined in Sprint 3 Phase 1).
 *
 * Returns up to 10 suggestions ordered by reason priority
 * (played_together > same_city > verified_pro), excluding the viewer's
 * existing follows + ghost profiles. Cached 5 minutes — suggestions don't
 * change quickly during a single onboarding session.
 */
export function useSuggestedFollows(viewerId: string | undefined) {
  return useQuery({
    queryKey: ["suggested-follows", viewerId],
    queryFn: async () => {
      if (!viewerId) return [] as SuggestedFollow[];
      const { data, error } = await supabase.rpc("get_suggested_follows", {
        p_viewer_id: viewerId,
        p_limit: 10,
      });
      if (error) throw error;
      return (data ?? []) as SuggestedFollow[];
    },
    enabled: !!viewerId,
    staleTime: 5 * 60_000,
  });
}
