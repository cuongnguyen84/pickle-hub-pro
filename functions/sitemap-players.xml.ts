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
      .not("onboarding_completed_at", "is", null)
      // Sprint A4 (2026-05-27) — only opt-in public profiles. Renamed
      // renderPlayer (functions/_lib/render/index.ts:1325) now filters
      // is_public_profile = true → sitemap must match or risk emitting
      // 404 URLs again. Until users opt-out themselves, this matches the
      // 24 profiles backfilled true by migration 20260528030000.
      .eq("is_public_profile", true)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-players: query error:", error);
    }

    const entries = (players || [])
      .filter((p: { username: string | null }) => p.username && URL_SAFE_USERNAME_RE.test(p.username))
      .map((p: { username: string; created_at: string | null }) => {
        const lastmod = toLastmod(p.created_at, TODAY);
        const profileUrl = `${siteUrl}/nguoi-choi/${p.username}`;
        // Sprint 4 Phase 4D: profile URL is single-canonical (no /vi/nguoi-choi/*
        // mirror in src/App.tsx; the path itself is Vietnamese-friendly) and the
        // React app switches language via its own toggle on the same route.
        //
        // 2026-08-19 — hreflang REMOVED. It previously emitted vi + en +
        // x-default all pointing at this one URL, hoping to signal "bilingual
        // rather than English-only". Google's spec requires different URLs for
        // different languages; same-URL annotations are invalid and dropped, so
        // the tag bought nothing. This repo already reached that conclusion
        // twice — the 2026-05-18 Ahrefs Site Audit fix stripped exactly this
        // pattern from /social and /clubs, and renderSocialList/renderClubList
        // still carry the comment calling it "a genuinely invalid signal".
        // The sitemap was the last place it survived, and it contradicted the
        // pages, which emit no hreflang at all.
        //
        // Emitting nothing is the honest state for a single-canonical route.
        // Giving players a real bilingual pair would mean splitting the
        // canonical the way /clubs (a1233f4c) and /social did — a separate
        // change with its own renderer work, not a sitemap tweak.
        return buildUrlEntry({
          loc: profileUrl,
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
