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
  // Phase 1 + 4 additions — surfaced in the list so the card can link to
  // /news/:slug, render the OG image as a tiny thumb, and the page can
  // filter EN vs VI without fetching everything.
  slug: string | null;
  image_url: string | null;
  language: "en" | "vi";
  ai_translated: boolean;
};

export function useNewsItems(options?: { limit?: number; language?: "en" | "vi" }) {
  return useQuery({
    queryKey: ["news-items", options],
    queryFn: async () => {
      let query = supabase
        .from("news_items")
        .select(
          "id, title, summary, source, source_url, published_at, created_at, slug, image_url, language, ai_translated"
        )
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (options?.language) {
        query = query.eq("language", options.language);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as NewsItem[];
    },
  });
}
