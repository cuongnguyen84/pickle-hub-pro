import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VenueSearchResult {
  id: string;
  name: string;
  name_vi: string | null;
  city: string | null;
  district: string | null;
}

/**
 * Typeahead search over the venues table for the onboarding venue picker.
 *
 * - Empty query returns no results (we don't want to dump the global venue
 *   list before the user types).
 * - Short queries (<2 chars) also bail to keep DB load down.
 * - ILIKE on both name + name_vi covers Vietnamese and English entries.
 * - Limit 10 — picker shows a short list, user can refine.
 */
export function useVenueSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["venue-search", trimmed],
    queryFn: async () => {
      if (trimmed.length < 2) return [] as VenueSearchResult[];
      const pattern = `%${trimmed}%`;
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, name_vi, city, district")
        .or(`name.ilike.${pattern},name_vi.ilike.${pattern}`)
        .order("name", { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as VenueSearchResult[];
    },
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
  });
}
