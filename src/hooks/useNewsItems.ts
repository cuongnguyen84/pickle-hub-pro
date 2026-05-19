import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  source_url: string;
  published_at: string;
  created_at: string;
};

export function useNewsItems(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["news-items", options],
    queryFn: async () => {
      let query = supabase
        .from("news_items")
        .select("id, title, summary, source, source_url, published_at, created_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as NewsItem[];
    },
  });
}
