import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch the most recent published news_items for the current viewer's
 * language, shaped so they can be merged into the /feed Trending timeline.
 *
 * Why this hook lives next to useFeedTimeline:
 *   - News items aren't in `get_feed_timeline` RPC (that RPC unions
 *     matches + vi_blog_posts + videos). Rather than touch the RPC, we
 *     pull news client-side and merge by `score` DESC — mirroring the
 *     existing `buildEnBlogItems` pattern used for static EN blog posts.
 *   - News rows have language tags; we filter by viewer language so EN
 *     readers see EN news, VI readers see VI translations.
 *
 * Scoring mirrors useFeedTimeline's Phase 1 formula for non-engagement
 * items: recency_decay + type_bonus. We use a slightly lower type_bonus
 * for news (0.6 vs blog's 1.0) so editorial blog posts still float above
 * generic aggregated news inside the same recency band.
 */

const WINDOW_DAYS = 30;
const HALF_LIFE_HOURS = 48;
// 1.2 (>1.0 blog) — news is fresher/higher cardinality, and Anh asked us
// to push news visibility on /feed. With pro_tour_boost dominating match
// scores, even 1.2 still ranks news below today's pro tour finals but at
// least floats it above older matches and gives news a foothold in the
// top 20 slots without touching the SQL function.
const NEWS_TYPE_BONUS = 1.2;

export interface FeedNewsItem {
  type: "news";
  cursor_id: string;
  id: string;
  slug: string;
  title: string;
  summary: string;
  image_url: string | null;
  source: string | null;
  language: "en" | "vi";
  published_at: string;
  score: number;
  ai_translated: boolean;
}

interface NewsRow {
  id: string;
  title: string;
  summary: string;
  source: string | null;
  source_url: string;
  image_url: string | null;
  language: "en" | "vi";
  slug: string | null;
  published_at: string;
  ai_translated: boolean;
}

export function useFeedNews(language: "en" | "vi") {
  return useQuery({
    queryKey: ["feed", "news", language],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FeedNewsItem[]> => {
      const windowStart = new Date(
        Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data, error } = await supabase
        .from("news_items")
        .select(
          "id, title, summary, source, source_url, image_url, language, slug, published_at, ai_translated"
        )
        .eq("status", "published")
        .eq("language", language)
        .gte("published_at", windowStart)
        .not("slug", "is", null)
        .order("published_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const now = Date.now();
      return ((data as NewsRow[]) ?? [])
        .filter((row) => row.slug != null)
        .map((row): FeedNewsItem => {
          const ts = Date.parse(row.published_at);
          const ageHours = Math.max(0, (now - ts) / (1000 * 60 * 60));
          const recencyDecay = Math.exp(-ageHours / HALF_LIFE_HOURS);
          const score = recencyDecay + NEWS_TYPE_BONUS;
          return {
            type: "news",
            cursor_id: `news:${row.id}`,
            id: row.id,
            slug: row.slug!,
            title: row.title,
            summary: row.summary,
            image_url: row.image_url,
            source: row.source,
            language: row.language,
            published_at: row.published_at,
            score,
            ai_translated: row.ai_translated,
          };
        });
    },
  });
}
