import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the news_items row matching (slug, language).
 *
 * The Phase 1 migration enforces UNIQUE (language, slug), so this is a
 * .maybeSingle() lookup. Returns `null` when no row matches (404 path).
 */
export type NewsItemDetail = {
  id: string;
  title: string;
  summary: string;
  source: string | null;
  source_id: string | null;
  source_url: string;
  image_url: string | null;
  language: "en" | "vi";
  slug: string;
  category: string | null;
  importance: number;
  published_at: string;
  ai_translated: boolean;
  parent_news_id: string | null;
};

export function useNewsItemBySlug(slug: string | undefined, language: "en" | "vi") {
  return useQuery({
    queryKey: ["news-item-by-slug", language, slug],
    enabled: !!slug,
    queryFn: async (): Promise<NewsItemDetail | null> => {
      const { data, error } = await supabase
        .from("news_items")
        .select(
          "id, title, summary, source, source_id, source_url, image_url, language, slug, category, importance, published_at, ai_translated, parent_news_id"
        )
        .eq("language", language)
        .eq("slug", slug!)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data as NewsItemDetail | null;
    },
  });
}

/**
 * Given an EN row id, find the VI sibling slug (or vice versa).
 *
 * Used for hreflang tags on the article page: EN page needs the VI slug
 * to emit `<link rel="alternate" hreflang="vi" ...>`. We look up by
 * parent_news_id (EN→VI) or by id == parent_news_id (VI→EN).
 */
export function useNewsItemSibling(
  currentId: string | undefined,
  currentLanguage: "en" | "vi",
  parentNewsId: string | null | undefined
) {
  return useQuery({
    queryKey: ["news-item-sibling", currentLanguage, currentId, parentNewsId],
    enabled: !!currentId,
    queryFn: async (): Promise<string | null> => {
      if (currentLanguage === "en") {
        // I am the EN row → find VI child
        const { data, error } = await supabase
          .from("news_items")
          .select("slug")
          .eq("parent_news_id", currentId!)
          .eq("language", "vi")
          .eq("status", "published")
          .maybeSingle();
        if (error) throw error;
        return data?.slug ?? null;
      }
      // I am the VI row → find EN parent
      if (!parentNewsId) return null;
      const { data, error } = await supabase
        .from("news_items")
        .select("slug")
        .eq("id", parentNewsId)
        .eq("language", "en")
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data?.slug ?? null;
    },
  });
}
