/**
 * /sitemap-blog.xml
 *
 * Vietnamese blog posts (vi_blog_posts.status = 'published') with
 * bidirectional hreflang against any EN counterpart referenced via
 * alternate_en_slug.
 */

import { createSupabaseClient } from "./_lib/supabase";
import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  buildUrlEntry,
  fetchAllRows,
  toLastmod,
  today,
  wrapUrlset,
} from "./_lib/sitemap-helpers";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CANONICAL_HOST: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    // CAP-01 (2026-08-25) — paged. PostgREST caps every response at 1000 rows
    // silently: `.limit(5000)` returns 1000 rows, HTTP 200, error = null. This
    // is the segment where that would hurt most — blog posts are the highest
    // intent pages on the site and the ONLY thing that carries VI ↔ EN
    // hreflang, so a truncated page would break reciprocity for every post
    // below the cut, not merely de-list it. 66 URLs today. `slug` is the
    // unique tie breaker.
    const viPosts = await fetchAllRows<{
      slug: string;
      updated_at: string | null;
      alternate_en_slug: string | null;
    }>((from, to) =>
      supabase
        .from("vi_blog_posts")
        .select("slug, updated_at, alternate_en_slug")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .order("slug", { ascending: true })
        .range(from, to),
    );

    const entries = viPosts.map((post) => {
      const lastmod = toLastmod(post.updated_at, TODAY);
      const hreflang = post.alternate_en_slug
        ? [
            { lang: "en", href: `${siteUrl}/blog/${post.alternate_en_slug}` },
            { lang: "vi", href: `${siteUrl}/vi/blog/${post.slug}` },
            { lang: "x-default", href: `${siteUrl}/blog/${post.alternate_en_slug}` },
          ]
        : [
            { lang: "vi", href: `${siteUrl}/vi/blog/${post.slug}` },
            { lang: "x-default", href: `${siteUrl}/vi/blog/${post.slug}` },
          ];
      return buildUrlEntry({
        loc: `${siteUrl}/vi/blog/${post.slug}`,
        lastmod,
        changefreq: "monthly",
        priority: "0.8",
        hreflang,
      });
    });

    return new Response(wrapUrlset(entries), { status: 200, headers: SITEMAP_CACHE_HEADERS });
  } catch (err) {
    console.error("sitemap-blog: fatal:", err);
    return new Response(wrapUrlset([]), { status: 503, headers: SITEMAP_CACHE_HEADERS });
  }
};
