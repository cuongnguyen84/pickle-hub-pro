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

/** EN slug → VI slug for each of `enSlugs` that has a published VI twin.
 *  One request; used by the tournament cluster row on ViBlogPost. */
export function useViBlogTwins(enSlugs: string[]) {
  return useQuery({
    queryKey: ["vi-blog-twins", enSlugs],
    queryFn: async (): Promise<Record<string, string>> => {
      const list = enSlugs.map(encodeURIComponent).join(",");
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/vi_blog_posts?alternate_en_slug=in.(${list})&status=eq.published&select=slug,alternate_en_slug`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
      );
      if (!res.ok) return {};
      const rows = (await res.json()) as { slug: string; alternate_en_slug: string }[];
      return Object.fromEntries(rows.map((r) => [r.alternate_en_slug, r.slug]));
    },
    enabled: enSlugs.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}
