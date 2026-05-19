import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBlogPostViewCount(lang: "en" | "vi" | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: ["blog-view-count", lang, slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_blog_post_view_count", {
        p_lang: lang!,
        p_slug: slug!,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    enabled: !!lang && !!slug,
    staleTime: 60_000,
  });
}
