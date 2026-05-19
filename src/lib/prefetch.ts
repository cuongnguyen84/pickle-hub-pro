/**
 * Early data prefetch – starts Supabase queries at module-evaluation time
 * (before React mounts) so the data is already in-flight when components render.
 * This cuts the waterfall: HTML → JS+CSS → [Supabase query] → image
 * down to:           HTML → JS+CSS+[Supabase query in parallel] → image
 */
import { supabase } from "@/integrations/supabase/client";
import { QueryClient } from "@tanstack/react-query";

/**
 * Inject a <link rel="preload"> for the LCP image so the browser
 * can discover it before React renders the component.
 */
function preloadLcpImage(url: string) {
  if (!url || typeof document === "undefined") return;
  // Avoid duplicates
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  link.setAttribute("fetchpriority", "high");
  document.head.appendChild(link);
}

export function prefetchHomeData(queryClient: QueryClient) {
  // Prefetch live livestreams – and preload the first thumbnail as likely LCP element
  queryClient.prefetchQuery({
    queryKey: ["livestreams", "live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_livestreams")
        .select(`*, organization:organizations(*)`)
        .eq("status", "live")
        .order("scheduled_start_at", { ascending: true });
      if (error) throw error;
      // Preload the first livestream thumbnail as it's the likely LCP image
      if (data && data.length > 0 && data[0].thumbnail_url) {
        preloadLcpImage(data[0].thumbnail_url);
      }
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
