import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NewsItem } from "./useNewsItems";

export function useFeaturedNews(limit: number = 3) {
  return useQuery({
    queryKey: ["featured-news", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_items")
        .select("id, title, summary, source, source_url, published_at, created_at")
        .eq("status", "published")
        .eq("show_on_home", true)
        .order("published_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as NewsItem[];
    },
  });
}
