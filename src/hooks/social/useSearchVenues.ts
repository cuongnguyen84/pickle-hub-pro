import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "./useDebounce";
import { escapePostgrestSearch } from "@/lib/escapePostgrestSearch";
import type { Venue } from "./types";

/** Debounced (300ms) ILIKE search across name + name_vi + city. */
export function useSearchVenues(query: string) {
  const debounced = useDebounce(query.trim(), 300);
  const q = useQuery<Venue[]>({
    queryKey: ["search-venues", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const like = `%${escapePostgrestSearch(debounced)}%`;
      const { data, error } = await supabase
        .from("venues")
        .select(
          "id,slug,name,name_vi,city,district,address,latitude,longitude,num_courts,surface_type,is_indoor,is_verified",
        )
        .or(`name.ilike.${like},name_vi.ilike.${like},city.ilike.${like}`)
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Venue[];
    },
  });
  return { venues: q.data, isLoading: q.isLoading };
}
