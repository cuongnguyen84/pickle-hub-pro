// ============================================================================
// useVietnamRankings — React Query wrapper for dupr_leaderboard_vietnam RPC
// ----------------------------------------------------------------------------
// Sprint A6 / A8 (2026-05-27) — powers the "Vietnam" scope on /rankings.
//
// The RPC handles whitelist + ordering. This hook only translates the React
// param shape into an RPC call and exposes a typed row. 5-minute staleTime
// matches the cache horizon — rankings refresh on a slower cadence than the
// per-user rating updates that drive `useDuprConnection`.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VietnamRankingFormat = "singles" | "doubles";

export interface VietnamRankingRow {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  dupr_rating: number;
  dupr_synced_at: string | null;
}

export interface UseVietnamRankingsOptions {
  format: VietnamRankingFormat;
  /** Page size. RPC clamps to [1, 500]. Default 100. */
  limit?: number;
  /** Disable the query (useful for SSR-only contexts). */
  enabled?: boolean;
}

export function useVietnamRankings({
  format,
  limit = 100,
  enabled = true,
}: UseVietnamRankingsOptions) {
  return useQuery<VietnamRankingRow[]>({
    queryKey: ["rankings-vietnam", format, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dupr_leaderboard_vietnam", {
        p_format: format,
        p_limit: limit,
      });
      if (error) throw error;
      // Supabase RPC returns `BIGINT` columns as JS `number` (PostgREST
      // stringifies on overflow risk; with rank LIMIT 500 we're safe).
      return (data ?? []) as VietnamRankingRow[];
    },
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
