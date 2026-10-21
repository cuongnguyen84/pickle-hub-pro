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
import { PROFILE_BIO_MIN_LENGTH } from "./_lib/seo-helpers";
import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  URL_SAFE_USERNAME_RE,
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

interface ProfileRow {
  username: string | null;
  created_at: string | null;
  bio: string | null;
  dupr_id: string | null;
  dupr_doubles: number | null;
  dupr_singles: number | null;
}

/**
 * Substance gate — 2026-08-23 site audit.
 *
 * Every URL this sitemap emitted was indexable and 52–70 words long, because
 * renderProfile (functions/_lib/render/profile.ts) can only print what the row
 * holds: breadcrumb + "<name> @<username>" + skill level + two nav links. With
 * no DUPR rating and no bio there is nothing else, so 29 of the 40 URLs were
 * the same boilerplate with one name swapped in — including the QA accounts
 * ("test DUPR 2", "test DUPR 3", "admindupr", "theta", "cmtheta2"), which were
 * being handed to Google under the brand.
 *
 * A sitemap means "these are the pages I consider important". Thin near-
 * duplicates in it spend crawl budget and teach Google that /nguoi-choi/* is a
 * low-value pattern — a bill the real profiles pay later. The repo doc already
 * stated the intended contract ("players: DUPR-linked public profiles only",
 * CLAUDE.md, Sitemaps section); the query never implemented it.
 *
 * Deliberately NOT paired with a noindex on the excluded pages. Dropping a URL
 * from the sitemap withdraws a recommendation; noindex would actively remove a
 * real member's profile from search for their own name — and those pages stay
 * internally linked from ClubCard, CommentRow and TheLineLayout, so they remain
 * reachable. Excluded profiles re-enter this sitemap by themselves the moment
 * they link DUPR or write a bio.
 *
 * The bio threshold is PROFILE_BIO_MIN_LENGTH, imported rather than repeated:
 * it is the same number pickProfileMetaDescription() uses to decide a bio is
 * worth showing as the meta description instead of the generic city/DUPR
 * fallback. Sharing the constant is the point — two independent 30s would
 * drift, which is the class of bug this whole change is fixing.
 *
 * dupr_id alone (linked, but no rating synced yet) keeps a profile, even though
 * renderProfile prints only the ratings. A link that has not synced yet is a
 * pending page, not an empty one; profiles.dupr_last_error is where a link that
 * never syncs shows up, and pruning those is sync's job, not the sitemap's.
 */
export function hasIndexableSubstance(p: {
  bio: string | null;
  dupr_id: string | null;
  dupr_doubles: number | null;
  dupr_singles: number | null;
}): boolean {
  if (p.dupr_id) return true;
  if (p.dupr_doubles != null || p.dupr_singles != null) return true;
  return (p.bio ?? "").trim().length >= PROFILE_BIO_MIN_LENGTH;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    // CAP-01 (2026-08-25) — paged. PostgREST silently caps every response at
    // 1000 rows, so `.limit(5000)` returns 1000 rows with HTTP 200 and
    // error = null (the bug that cost sitemap-news 209 URLs, #644). `profiles`
    // is ~1669 rows today and only the opt-in public subset survives the
    // filters, so the emitted list is small — but the CAP applies to the QUERY,
    // not the filtered result, so a truncated page would drop eligible players
    // before this code ever sees them. `username` is the unique tie breaker.
    const players = await fetchAllRows<ProfileRow>((from, to) =>
      supabase
        .from("profiles")
        // bio + dupr_* feed hasIndexableSubstance(); they are not rendered here.
        .select("username, created_at, bio, dupr_id, dupr_doubles, dupr_singles")
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
        .order("username", { ascending: true })
        .range(from, to),
    );

    const entries = players
      .filter(
        (p: ProfileRow): p is ProfileRow & { username: string } =>
          Boolean(p.username) && URL_SAFE_USERNAME_RE.test(p.username as string),
      )
      // See hasIndexableSubstance() above — keeps stub and QA profiles out.
      .filter((p) => hasIndexableSubstance(p))
      .map((p) => {
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
