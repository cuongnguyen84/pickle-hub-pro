/**
 * /sitemap-venues.xml — Phase 3B.3 NEW.
 *
 * All venues. Like /sitemap-players.xml, the /san/{slug} detail page lands
 * in Sprint 5 — URLs are emitted early so the indexing pipeline is warm
 * by then.
 */

import { createSupabaseClient } from "./_lib/supabase";
import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  URL_SAFE_SLUG_RE,
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
    const { data: venues, error } = await supabase
      .from("venues")
      .select("slug, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-venues: query error:", error);
    }

    const entries = (venues || [])
      .filter((v: { slug: string; updated_at: string | null }) => v.slug && URL_SAFE_SLUG_RE.test(v.slug))
      .flatMap((v: { slug: string; updated_at: string | null }) => {
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
