import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildEnBlogItems, type FeedTimelineItem } from "./useFeedTimeline";

/**
 * Blog overlay for /feed (Cuong directive, 2026-11-24).
 *
 * Blog items also flow through the get_feed_timeline RPC, but that
 * timeline paginates by score: pro results and matches score far
 * above a fresh blog post, so page 1 fills with results and a blog
 * published this morning only surfaces after several Load more
 * rounds. News, embeds, highlights and happenings never had this
 * problem because they merge as client overlays - blogs now do the
 * same: the 30 newest posts of the current UI language load directly
 * and compete in the shared recency sort (and the seen partition)
 * like every other type. No blog-specific ordering rules.
 *
 * Items carry the SAME cursor_id as their timeline counterparts
 * (en-blog:<slug> for the static EN metadata, the vi_blog_posts UUID
 * for VI) so Feed.tsx dedupes the overlay copy against any RPC page
 * that later reaches the same post, and seen-tracking stays unified.
 */
const WINDOW_DAYS = 30;
const LIMIT = 30;

export function useFeedBlogs(language: "en" | "vi") {
  return useQuery({
    queryKey: ["feed", "blogs", language] as const,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FeedTimelineItem[]> => {
      if (language === "en") {
        return buildEnBlogItems()
          .sort(
            (a, b) =>
              Date.parse(b.published_at) - Date.parse(a.published_at),
          )
          .slice(0, LIMIT);
      }
      const since = new Date(
        Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await supabase
        .from("vi_blog_posts")
        .select(
          "id, slug, title, excerpt, cover_image_url, category, published_at",
        )
        .eq("status", "published")
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        // published_at is nullable in the schema; a published post
        // without one cannot be ranked by recency, so skip it.
        if (!row.published_at) return [];
        return [
          {
            type: "blog" as const,
            cursor_id: row.id,
            id: row.id,
            slug: row.slug,
            title: row.title,
            excerpt: row.excerpt,
            cover_image_url: row.cover_image_url,
            category: row.category,
            published_at: row.published_at,
            ranked_at: row.published_at,
            // Overlays never advance the RPC cursor; score is unused
            // by the recency ordering.
            score: 0,
            lang: "vi" as const,
          },
        ];
      });
    },
  });
}
