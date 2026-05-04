/**
 * /sitemap-players.xml — Phase 3B.3 NEW.
 *
 * Non-ghost VN profiles with a non-empty username. The /nguoi-choi/{username}
 * detail page lands in Sprint 3 — emitting URLs early lets Google warm up
 * its indexing pipeline; the SPA's catch-all 404 is the correct signal in
 * the meantime, and Search Console's "Discovered – not currently indexed"
 * status is harmless until the page exists.
 *
 * profiles has no updated_at column, so we sort by created_at and use it
 * as lastmod. Pages will refresh once Sprint 3 adds the column or the
 * indexing schedule kicks in (Google revisits anyway).
 */

import { createSupabaseClient } from "./_lib/supabase";
import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  URL_SAFE_USERNAME_RE,
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
    const { data: players, error } = await supabase
      .from("profiles")
      .select("username, created_at")
      .eq("is_ghost", false)
      .eq("country", "VN")
      .not("username", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-players: query error:", error);
    }

    const entries = (players || [])
      .filter((p: any) => p.username && URL_SAFE_USERNAME_RE.test(p.username))
      .map((p: any) => {
        const lastmod = toLastmod(p.created_at, TODAY);
        return buildUrlEntry({
          loc: `${siteUrl}/nguoi-choi/${p.username}`,
          lastmod,
          changefreq: "weekly",
          priority: "0.6",
        });
      });

    return new Response(wrapUrlset(entries), { status: 200, headers: SITEMAP_CACHE_HEADERS });
  } catch (err) {
    console.error("sitemap-players: fatal:", err);
    return new Response(wrapUrlset([]), { status: 503, headers: SITEMAP_CACHE_HEADERS });
  }
};
