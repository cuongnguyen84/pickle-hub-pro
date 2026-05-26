// ============================================================================
// useDuprUserSearch — debounced opponent search across DUPR + internal DB
// ----------------------------------------------------------------------------
// Wraps the `dupr-user-search` edge function with React Query + 350ms
// debounce. Skips when query.trim() < 2 chars.
// ============================================================================

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SearchSource = "dupr" | "internal" | "both";

export interface DuprSearchHit {
  source: SearchSource;
  dupr_id: string | null;
  full_name: string;
  singles_rating: number | null;
  doubles_rating: number | null;
  user_id: string | null;
  email: string | null;
  username: string | null;
}

interface SearchResp {
  hits: DuprSearchHit[];
  dupr_total: number;
  internal_total: number;
}

export function useDuprUserSearch(
  query: string,
  options?: { excludeUserIds?: string[]; limit?: number; debounceMs?: number },
) {
  const debounceMs = options?.debounceMs ?? 350;
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  return useQuery<SearchResp>({
    queryKey: ["dupr-user-search", debounced, options?.excludeUserIds, options?.limit],
    enabled: debounced.trim().length >= 2,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<SearchResp>(
        "dupr-user-search",
        {
          body: {
            query: debounced.trim(),
            limit: options?.limit ?? 10,
            exclude_user_ids: options?.excludeUserIds ?? [],
          },
        },
      );
      if (error) throw error;
      return data ?? { hits: [], dupr_total: 0, internal_total: 0 };
    },
  });
}
