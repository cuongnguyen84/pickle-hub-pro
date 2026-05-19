import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useHomepageStats() {
  return useQuery({
    queryKey: ["homepage-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_homepage_stats");
      if (error) throw error;
      return data?.[0] ?? { total_users: 0, total_tournaments: 0 };
    },
    staleTime: 5 * 60_000, // 5 min
  });
}
