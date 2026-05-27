// ============================================================================
// usePlayersNearRating — React Query wrapper for dupr_players_near_rating
// ----------------------------------------------------------------------------
// Sprint A11 / A12 (2026-05-27).
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlayerNearRatingRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  dupr_doubles: number;
  dupr_singles: number | null;
  dupr_synced_at: string | null;
  rating_diff: number;
}

export interface UsePlayersNearRatingOptions {
  targetRating: number | null | undefined;
  window?: number;
  excludeUserId?: string | null;
  limit?: number;
  enabled?: boolean;
}

export function usePlayersNearRating({
  targetRating,
  window = 0.3,
  excludeUserId = null,
  limit = 10,
  enabled = true,
}: UsePlayersNearRatingOptions) {
  return useQuery<PlayerNearRatingRow[]>({
    queryKey: ["players-near-rating", targetRating, window, excludeUserId, limit],
    queryFn: async () => {
      if (targetRating == null) return [];
      const { data, error } = await supabase.rpc("dupr_players_near_rating", {
        p_target_rating: targetRating,
        p_window: window,
        p_exclude_user_id: excludeUserId,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as PlayerNearRatingRow[];
    },
    enabled: enabled && targetRating != null,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
