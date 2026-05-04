import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "./useDebounce";
import type { PlayerProfile } from "./types";

/**
 * Debounced (300ms) search profiles by username, display_name, or phone.
 * Excludes ghost profiles to avoid recommending placeholder accounts.
 */
export function useSearchPlayers(query: string) {
  const debounced = useDebounce(query.trim(), 300);
  const q = useQuery<PlayerProfile[]>({
    queryKey: ["search-players", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const like = `%${debounced}%`;
      // Try OR of username/display_name. Phone is a separate exact-ish match
      // (PostgREST OR with ILIKE works; phone equality below for VN format).
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,dupr_doubles,is_ghost,city,phone")
        .or(`username.ilike.${like},display_name.ilike.${like},phone.eq.${debounced}`)
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
