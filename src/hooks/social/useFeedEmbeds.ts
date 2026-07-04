import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch active admin-curated Instagram embeds (feed_embeds table) shaped
 * for the /feed Trending merge — same client-side pattern as useFeedNews.
 *
 * Lazy v1: rows are pasted by admin at /admin/embeds (url + optional
 * caption/author/thumbnail). Card out-links to Instagram; nothing is
 * re-hosted. Scoring mirrors useFeedNews (recency decay + type bonus).
 */

const WINDOW_DAYS = 30;
const HALF_LIFE_HOURS = 48;
// Slightly above news (1.2): curated video reels are the highest-engagement
// content type; there are few of them, so they should surface reliably.
const EMBED_TYPE_BONUS = 1.3;

export interface FeedEmbedItem {
  type: "embed";
  cursor_id: string;
  id: string;
  url: string;
  caption: string | null;
  author_name: string | null;
  thumbnail_url: string | null;
  published_at: string;
  score: number;
}

export function useFeedEmbeds() {
  return useQuery({
    queryKey: ["feed", "embeds"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FeedEmbedItem[]> => {
      const windowStart = new Date(
        Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data, error } = await supabase
        .from("feed_embeds")
        .select("id, url, caption, author_name, thumbnail_url, published_at")
        .eq("is_active", true)
        .gte("published_at", windowStart)
        .order("published_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const now = Date.now();
      return (data ?? []).map((row): FeedEmbedItem => {
        const ageHours = Math.max(
          0,
          (now - Date.parse(row.published_at)) / (1000 * 60 * 60)
        );
        const score = Math.exp(-ageHours / HALF_LIFE_HOURS) + EMBED_TYPE_BONUS;
        return {
          type: "embed",
          cursor_id: `embed:${row.id}`,
          id: row.id,
          url: row.url,
          caption: row.caption,
          author_name: row.author_name,
          thumbnail_url: row.thumbnail_url,
          published_at: row.published_at,
          score,
        };
      });
    },
  });
}
