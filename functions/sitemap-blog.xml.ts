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
    const { data: viPosts, error } = await supabase
      .from("vi_blog_posts")
      .select("slug, updated_at, alternate_en_slug")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-blog: query error:", error);
    }

    const entries = (viPosts || []).map((post: any) => {
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
