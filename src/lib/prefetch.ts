/**
 * Early data prefetch – starts Supabase queries at module-evaluation time
 * (before React mounts) so the data is already in-flight when components render.
 * This cuts the waterfall: HTML → JS+CSS → [Supabase query] → image
 * down to:           HTML → JS+CSS+[Supabase query in parallel] → image
 */
import { supabase } from "@/integrations/supabase/client";
import { QueryClient } from "@tanstack/react-query";

export function prefetchHomeData(queryClient: QueryClient) {
  // Prefetch live livestreams
  queryClient.prefetchQuery({
    queryKey: ["livestreams", "live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_livestreams")
        .select(`*, organization:organizations(*)`)
        .eq("status", "live")
        .order("scheduled_start_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  // Prefetch scheduled livestreams
  queryClient.prefetchQuery({
    queryKey: ["livestreams", "scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_livestreams")
        .select(`*, organization:organizations(*)`)
        .eq("status", "scheduled")
        .order("scheduled_start_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  // Prefetch videos
  queryClient.prefetchQuery({
    queryKey: ["videos", { limit: 8 }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select(`*, organization:organizations(*)`)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}
