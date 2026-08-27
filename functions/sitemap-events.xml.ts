/**
 * /sitemap-events.xml
 *
 * Public social events + club landing pages. Only published+public events
 * are emitted; cancelled / completed events stay reachable but drop out
 * of the sitemap once start_at < now - 30 days to keep the file size
 * bounded.
 *
 * Hreflang: as of 2026-05-20, /social/{slug} now ships split EN/VI
 * canonicals (/social/{slug} EN, /vi/social/{slug} VI) so the
 * hreflang block here mirrors that split. /clb/{slug} is single-canonical
 * and therefore carries NO hreflang at all — see the club block below.
 */

import { createSupabaseClient } from "./_lib/supabase";
import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  URL_SAFE_SLUG_RE,
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

interface EventRow {
  slug: string;
  updated_at: string | null;
  start_at: string;
}

interface ClubRow {
  slug: string;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
}

const STALE_CUTOFF_DAYS = 30;

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();
  const cutoffIso = new Date(
    Date.now() - STALE_CUTOFF_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const supabase = createSupabaseClient(context.env);
    // CAP-01 (2026-08-25) — both queries paged. PostgREST caps every response
    // at 1000 rows silently: `.limit(5000)` returns 1000 rows with HTTP 200 and
    // error = null, which is how sitemap-news lost 209 article URLs (#644).
    // Neither table is near the cap today (27 events, 9 of 12 clubs left
    // after the archived filter below), but social
    // events are user-generated and grow without anyone watching this file.
    // `slug` is the unique tie breaker on both — `start_at` and `created_at`
    // repeat, and repeated sort keys make rows jump between pages.
    const [events, clubs] = await Promise.all([
      fetchAllRows<EventRow>((from, to) =>
        supabase
          .from("social_events")
          .select("slug, updated_at, start_at")
          .eq("status", "published")
          .eq("visibility", "public")
          .gte("start_at", cutoffIso)
          .order("start_at", { ascending: false })
          .order("slug", { ascending: true })
          .range(from, to),
      ),
      fetchAllRows<ClubRow>((from, to) =>
        supabase
          .from("clubs")
          .select("slug, created_at, updated_at, archived_at")
          // ─── 2026-08-27 site audit — archived clubs were being recommended
          // to Google. EditClub.tsx archives a club by stamping archived_at;
          // the `club_listing` view (what /clubs and renderClubList read)
          // filters those rows out, so the site itself showed 9 clubs while
          // this file handed Google 12. The three extras were /clb/kim-lien,
          // /clb/175-dinh-cong and /clb/test — the last one a QA fixture
          // named "test", described "test", published under the brand.
          //
          // A sitemap is a recommendation, not an index directive: dropping
          // these withdraws the recommendation while the pages stay reachable
          // and keep their in-app "đã lưu trữ" banner (ClubLanding.tsx:182).
          // Deliberately NOT paired with a noindex — same reasoning as the
          // profile substance gate in sitemap-players.xml.ts. A club that is
          // un-archived re-enters this sitemap by itself.
          //
          // Filtered DB-side on purpose: the PostgREST row cap applies to the
          // QUERY, not to the filtered result, so archived rows must never
          // occupy a page slot that an eligible club needs.
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .order("slug", { ascending: true })
          .range(from, to),
      ),
    ]);

    const eventEntries = events
      .filter((e) => e.slug && URL_SAFE_SLUG_RE.test(e.slug))
      .flatMap((e) => {
        const enLoc = `${siteUrl}/social/${e.slug}`;
        const viLoc = `${siteUrl}/vi/social/${e.slug}`;
        const lastmod = toLastmod(e.updated_at, TODAY);
        const hreflang = [
          { lang: "en", href: enLoc },
          { lang: "vi", href: viLoc },
          { lang: "x-default", href: enLoc },
        ];
        return [
          buildUrlEntry({
            loc: enLoc,
            lastmod,
            changefreq: "daily",
            priority: "0.8",
            hreflang,
          }),
          buildUrlEntry({
            loc: viLoc,
            lastmod,
            changefreq: "daily",
            priority: "0.8",
            hreflang,
          }),
        ];
      });

    const clubEntries = clubs
      .filter((c) => c.slug && URL_SAFE_SLUG_RE.test(c.slug))
      .map((c) => {
        const loc = `${siteUrl}/clb/${c.slug}`;
        return buildUrlEntry({
          loc,
          // updated_at first: created_at as lastmod tells Google a club edited
          // last week has not changed since the day it was created, which is a
          // genuinely invalid signal and the exact class the 2026-08-25
          // sitemap-hygiene tests exist to hold. The events branch above has
          // always preferred updated_at; the club branch never did.
          //
          // The ?? is defensive, not load-bearing: clubs.updated_at is NOT NULL
          // and trg_clubs_touch_updated_at keeps it current. createSupabaseClient
          // returns an ungenericized SupabaseClient, so nothing here is checked
          // against the schema at compile time — a column that silently stops
          // being selected arrives as undefined, not as a type error.
          lastmod: toLastmod(c.updated_at ?? c.created_at, TODAY),
          changefreq: "weekly",
          priority: "0.6",
          // ─── NO hreflang, deliberately. /clb/{slug} is single-canonical:
          // there is no /vi/clb/* canonical (the path renders the same URL and
          // self-references), and renderClub emits no <link rel="alternate">
          // at all. This file was still emitting en + vi + x-default ALL
          // pointing at that one URL — a genuinely invalid signal under
          // Google's spec, which requires a different URL per language, and
          // the source of Ahrefs' "no return-tag" plus "referenced for more
          // than one language" pair (the regression batches 6 and 9 fixed on
          // 2026-05-28, and the annotation sitemap-players.xml.ts stripped on
          // 2026-08-19 — its test comment already claimed /clubs had been
          // cleaned, which was not true of this file).
          //
          // The repo-wide contract lives in singleCanonicalHreflang()
          // (functions/_lib/utils.ts), which returns "" for exactly this case.
        });
      });

    return new Response(wrapUrlset([...eventEntries, ...clubEntries]), {
      status: 200,
      headers: SITEMAP_CACHE_HEADERS,
    });
  } catch (err) {
    console.error("sitemap-events: fatal:", err);
    return new Response(wrapUrlset([]), {
      status: 503,
      headers: SITEMAP_CACHE_HEADERS,
    });
  }
};
