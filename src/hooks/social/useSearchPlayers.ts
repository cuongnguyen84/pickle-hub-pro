import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "./useDebounce";
import type { PlayerProfile } from "./types";

const VN_PHONE_RE = /^(\+84|0)\d{6,9}$/;

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
      const like = `%${debounced}%`;
      const orParts = [
        `username.ilike.${like}`,
        `display_name.ilike.${like}`,
      ];
      if (VN_PHONE_RE.test(debounced)) {
        orParts.push(`phone.eq.${debounced}`);
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,dupr_doubles,is_ghost,city,phone")
        .or(orParts.join(","))
        .eq("is_ghost", false)
        .limit(10);
      if (error) throw error;
      return ((data ?? []) as Array<PlayerProfile & { phone?: string | null }>).map((p) => ({
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
