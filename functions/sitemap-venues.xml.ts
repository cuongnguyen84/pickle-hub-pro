/**
 * /sitemap-venues.xml — Phase 3B.3 NEW.
 *
 * All venues. Like /sitemap-players.xml, the /san/{slug} detail page lands
 * in Sprint 5 — URLs are emitted early so the indexing pipeline is warm
 * by then.
 */

import { createSupabaseClient } from "./_lib/supabase";
import { isThinVenue } from "./_lib/render/venues";
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  type VenueSitemapRow = {
    slug: string;
    updated_at: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    num_courts: number | null;
    phone: string | null;
  };

  try {
    const supabase = createSupabaseClient(context.env);
    // Guard-0: select the same content fields renderVenueDetail uses to judge
    // "thin" so a near-empty UGC stub is dropped here too (its detail page is
    // noindex). Keeping a noindex'd URL in the sitemap is a SEOnaut warning
    // ("noindex in sitemap") and wastes crawl budget.
    //
    // Paged, not `.limit(5000)`: PostgREST caps every response at 1000 rows and
    // does it silently — status 200, error null, exactly 1000 rows back. That is
    // how sitemap-news served 500 of 709 articles for months (#644). venues sat
    // at 896 rows on 2026-08-25 and has been growing ~100/month since the Google
    // Places enrichment run, so this table crosses the cap within weeks; at that
    // point the oldest courts would drop out of the sitemap with nothing in the
    // logs to say so. `slug` is the tie breaker — venues.updated_at is bulk-set
    // by the enrichment scripts, so same-timestamp rows are the norm here and
    // would otherwise shuffle between pages and get lost.
    const venues = await fetchAllRows<VenueSitemapRow>((from, to) =>
      supabase
        .from("venues")
        .select("slug, updated_at, address, latitude, longitude, num_courts, phone")
        .order("updated_at", { ascending: false })
        .order("slug", { ascending: true })
        .range(from, to),
    );

    const entries = (venues || [])
      .filter(
        (v: VenueSitemapRow) => v.slug && URL_SAFE_SLUG_RE.test(v.slug) && !isThinVenue(v),
      )
      .flatMap((v: VenueSitemapRow) => {
        const lastmod = toLastmod(v.updated_at, TODAY);
        const enLoc = `${siteUrl}/san/${v.slug}`;
        const viLoc = `${siteUrl}/vi/san/${v.slug}`;
        const hreflang = [
          { lang: "en", href: enLoc },
          { lang: "vi", href: viLoc },
          { lang: "x-default", href: enLoc },
        ];
        return [
          buildUrlEntry({ loc: enLoc, lastmod, changefreq: "monthly", priority: "0.5", hreflang }),
          buildUrlEntry({ loc: viLoc, lastmod, changefreq: "monthly", priority: "0.5", hreflang }),
        ];
      });

    // City hub pages (/san/khu-vuc/:city) — landing pages per city.
    const CITY_SLUGS: string[] = [
      "singapore",
      "tp-hcm",
      "ha-noi",
      "da-nang",
      "bac-ninh",
      "ha-long",
      "vinh",
      "nam-dinh",
      "thanh-hoa",
      "binh-duong",
      "can-tho",
      "pleiku",
      "vung-tau",
      "bac-giang",
      "bao-loc",
      "cao-bang",
      "lang-son",
      "buon-ma-thuot",
      "dong-hoi",
      "ha-tinh",
      "hai-duong",
      "hai-phong",
      "nha-trang",
      "quy-nhon",
      "tay-ninh",
      "vinh-yen",
      "bien-hoa",
      "cao-lanh",
      "da-lat",
      "hue",
      "lao-cai",
      "long-xuyen",
      "ninh-binh",
      "phan-rang",
      "quang-ngai",
      "son-la",
      "thai-nguyen",
      "tuy-hoa",
      "ca-mau",
      "dien-bien-phu",
      "dong-ha",
      "phu-quoc",
      "rach-gia",
      "viet-tri",
      "vinh-long",
      "ben-tre",
      "chau-doc",
      "dong-xoai",
      "ha-giang",
      "hoi-an",
      "my-hao",
      "phan-thiet",
      "sam-son",
      "thai-binh",
      "tra-vinh",
      "tuyen-quang",
      "uong-bi",
      "yen-bai",
      "cam-pha",
      "hoa-binh",
      "hung-ha",
      "moc-chau",
      "my-tho",
      "phu-ly",
      "sa-dec",
      "soc-trang",
      "van-giang",
      "van-lam",
      "chau-hung",
      "chi-linh",
      "gia-nghia",
      "kon-tum",
      "mai-chau",
      "phu-yen",
      "phuc-yen",
      "quynh-phu",
      "sa-pa",
      "tam-ky",
      "tan-an",
      "thanh-son",
      "tran-yen",
      "vi-xuyen",
      "vinh-chau",
      "yen-my",
    ];
    const cityEntries = CITY_SLUGS.flatMap((sl) => {
      const enLoc = `${siteUrl}/san/khu-vuc/${sl}`;
      const viLoc = `${siteUrl}/vi/san/khu-vuc/${sl}`;
      const hreflang = [
        { lang: "en", href: enLoc },
        { lang: "vi", href: viLoc },
        { lang: "x-default", href: enLoc },
      ];
      return [
        buildUrlEntry({ loc: enLoc, lastmod: TODAY, changefreq: "weekly", priority: "0.6", hreflang }),
        buildUrlEntry({ loc: viLoc, lastmod: TODAY, changefreq: "weekly", priority: "0.6", hreflang }),
      ];
    });

    return new Response(wrapUrlset([...entries, ...cityEntries]), { status: 200, headers: SITEMAP_CACHE_HEADERS });
  } catch (err) {
    console.error("sitemap-venues: fatal:", err);
    return new Response(wrapUrlset([]), { status: 503, headers: SITEMAP_CACHE_HEADERS });
  }
};
