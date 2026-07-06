import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "./useDebounce";
import type { PlayerProfile } from "./types";

/**
 * Debounced (300ms) search profiles by username, display_name, or phone.
 * Excludes ghost profiles to avoid recommending placeholder accounts.
 *
 * Bug fix (PR #6): PostgREST `.or()` silently returned 0 rows when the
 * query was non-numeric because `phone.eq.<text>` was being parsed as a
 * type-mismatch condition that failed the entire OR. Now we only include
 * the phone branch when the query actually looks like a VN phone number.
 */
export function useSearchPlayers(query: string) {
  const debounced = useDebounce(query.trim(), 300);
  const q = useQuery<PlayerProfile[]>({
    queryKey: ["search-players", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      // SECURITY: search runs through the search_players RPC (SECURITY DEFINER)
      // instead of a direct table query. The PII column lockdown revokes `phone`
      // from the authenticated role, so a client-side `phone.eq` filter would
      // fail; the RPC matches phone INTERNALLY (exact match only) and never
      // returns it. See migration 20260706120000_profiles_pii_column_lockdown.
      const { data, error } = await supabase.rpc("search_players", {
        p_query: debounced,
        p_limit: 10,
      });
      if (error) throw error;
      return ((data ?? []) as Array<PlayerProfile & { is_ghost?: boolean | null }>)
        .filter((p) => !p.is_ghost)
        .map((p) => ({
          id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          dupr_doubles: p.dupr_doubles,
          is_ghost: p.is_ghost,
          city: p.city,
        }));
    },
  });
  return { players: q.data, isLoading: q.isLoading };
}
