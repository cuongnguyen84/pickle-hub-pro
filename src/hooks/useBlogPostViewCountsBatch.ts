import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PostPair {
  lang: "en" | "vi";
  slug: string;
}

type ViewCountMap = Record<string, number>;

function pairKey(lang: string, slug: string): string {
  return `${lang}:${slug}`;
}

export function useBlogPostViewCountsBatch(pairs: PostPair[]): ViewCountMap {
  const { data } = useQuery({
    queryKey: ["blog-view-counts-batch", pairs.map((p) => pairKey(p.lang, p.slug)).sort()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_blog_post_view_counts_batch", {
        p_pairs: pairs,
      });
      if (error) throw error;

      const map: ViewCountMap = {};
      if (Array.isArray(data)) {
        for (const row of data as { lang: string; slug: string; view_count: number }[]) {
          map[pairKey(row.lang, row.slug)] = row.view_count ?? 0;
        }
      }
      return map;
    },
    enabled: pairs.length > 0,
    staleTime: 5 * 60_000,
  });

  return data ?? {};
}

export { pairKey };
