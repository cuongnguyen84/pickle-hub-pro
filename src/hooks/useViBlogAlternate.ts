import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Given an English blog post slug, returns the matching Vietnamese slug
 * (from vi_blog_posts.alternate_en_slug), or null if no VI version exists.
 */
export function useViBlogAlternate(enSlug: string | undefined) {
  return useQuery({
    queryKey: ["vi-blog-alternate", enSlug],
    queryFn: async (): Promise<string | null> => {
      if (!enSlug) return null;

      const session = (await supabase.auth.getSession()).data.session;
      const authHeader = session?.access_token
        ? `Bearer ${session.access_token}`
        : `Bearer ${SUPABASE_KEY}`;

      const url =
        `${SUPABASE_URL}/rest/v1/vi_blog_posts` +
        `?alternate_en_slug=eq.${encodeURIComponent(enSlug)}` +
        `&status=eq.published` +
        `&select=slug` +
        `&limit=1`;

      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: authHeader,
        },
      });

      if (!res.ok) return null;

      const data = await res.json();
      return (data as { slug: string }[])[0]?.slug ?? null;
    },
    enabled: !!enSlug,
    staleTime: 10 * 60 * 1000,
  });
}
