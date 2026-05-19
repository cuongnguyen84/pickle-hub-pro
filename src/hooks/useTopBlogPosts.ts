import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TopBlogPostRow {
  lang: "en" | "vi";
  slug: string;
  total_views: number;
  unique_viewers: number;
}

export function useTopBlogPosts(days: number, limit = 10) {
  return useQuery<TopBlogPostRow[]>({
    queryKey: ["admin", "top-blog-posts", days, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_blog_posts", {
        p_days: days,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as TopBlogPostRow[];
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
