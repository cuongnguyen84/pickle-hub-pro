// ============================================================================
// renderVenuesList + renderVenueDetail — Court finder ("Tìm sân") prerender.
// ----------------------------------------------------------------------------
// Cloudflare Pages bot-prerender for /san and /san/:slug. Mirrors the
// renderClubList / renderClub pattern: service-role Supabase read, build
// ItemList (list) / SportsActivityLocation (detail) JSON-LD, hand off to
// buildHtml. Each URL has its own self-referencing canonical (EN -> /san/...,
// VI -> /vi/san/...) plus reciprocal hreflang en/vi/x-default, matching the
// pairs emitted by sitemap-venues.xml. This is the site-wide reciprocal-
// hreflang direction (see /rankings); the en/vi routes are treated as
// distinct localized canonicals, not one page flagged for multiple languages.
// ============================================================================

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, buildTitle, breadcrumb, type Lang } from "../utils";
import { fitLead, fitSegments, pickMetaDescription, upperFirst } from "../seo-helpers";
import { render404 } from "./index";

const LIST_LIMIT = 100;

interface VenueListRow {
  slug: string;
  name: string;
  name_vi: string | null;
  district: string | null;
  city: string | null;
  num_courts: number | null;
  is_indoor: boolean | null;
  is_verified: boolean | null;
}

interface VenueDetailRow {
  id: string;
  slug: string;
  name: string;
  name_vi: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  num_courts: number | null;
  surface_type: string | null;
  is_indoor: boolean | null;
  phone: string | null;
  website: string | null;
  amenities: string[] | null;
  hours_json: unknown;
  cover_image_url: string | null;
  review_count: number | null;
  review_avg: number | null;
}

// Guard-0: a venue with no location AND no facts is a pure UGC stub (created via
// /san/them with just a name). 691×2 such near-empty pages dilute the /san
// cluster ("mass low-value templated inventory"). Flag them so the detail page
// carries <meta robots noindex> and the sitemap drops them. Deliberately
// conservative — an address OR coordinates alone keeps a venue indexed; tighten
// the bar when S2 enrichment (price/reviews/photos) lands.
// ponytail: single source of truth — renderVenueDetail AND sitemap-venues.xml.ts
// both import this so the two never drift on the definition of "thin".
export function isThinVenue(v: {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  num_courts: number | null;
  phone: string | null;
}): boolean {
  const hasAddress = !!(v.address && v.address.trim());
  const hasGeo = v.latitude != null && v.longitude != null;
  const hasCourts = !!(v.num_courts && v.num_courts > 0);
  const hasPhone = !!(v.phone && v.phone.trim());
  return !hasAddress && !hasGeo && !hasCourts && !hasPhone;
}

function displayName(v: { name: string; name_vi: string | null }, lang: Lang): string {
  if (lang === "vi" && v.name_vi && v.name_vi.trim().length > 0) return v.name_vi;
  return v.name;
}

function locationLine(v: { district: string | null; city: string | null }): string {
  return [v.district, v.city].filter((p) => p && p.trim().length > 0).join(", ");
}

function fullAddress(v: VenueDetailRow): string {
  const parts: string[] = [];
  for (const raw of [v.address, v.district, v.city, v.country]) {
    const t = raw ? String(raw).trim() : "";
    if (!t) continue;
    if (parts.some((x) => x.toLowerCase().includes(t.toLowerCase()))) continue;
    parts.push(t);
  }
  return parts.join(", ");
}

// hours_json has no enforced shape (community-contributed). Render the two
// shapes seen in prod — {"mon":"6:00-22:00",...} object or ["6:00-22:00 hằng
// ngày"] array — and silently skip anything else.
// ponytail: defensive flattening, add a real schema if the venue form ever gets one.
const DAY_LABEL: Record<string, { vi: string; en: string }> = {
  mon: { vi: "Thứ 2", en: "Mon" },
  tue: { vi: "Thứ 3", en: "Tue" },
  wed: { vi: "Thứ 4", en: "Wed" },
  thu: { vi: "Thứ 5", en: "Thu" },
  fri: { vi: "Thứ 6", en: "Fri" },
  sat: { vi: "Thứ 7", en: "Sat" },
  sun: { vi: "Chủ nhật", en: "Sun" },
};

/** schema.org day URIs, keyed by the same 3-letter prefix DAY_LABEL uses. */
const DAY_SCHEMA: Record<string, string> = {
  mon: "https://schema.org/Monday",
  tue: "https://schema.org/Tuesday",
  wed: "https://schema.org/Wednesday",
  thu: "https://schema.org/Thursday",
  fri: "https://schema.org/Friday",
  sat: "https://schema.org/Saturday",
  sun: "https://schema.org/Sunday",
};

/** "6:00-22:00" / "06h00 - 22h00" / "6h-22h" → ["06:00", "22:00"]. */
function parseHourRange(raw: string): [string, string] | null {
  const m = raw.match(
    /(\d{1,2})\s*(?:[:h.]\s*(\d{2}))?\s*(?:-|–|—|to|đến)\s*(\d{1,2})\s*(?:[:h.]\s*(\d{2}))?/i,
  );
  if (!m) return null;
  const [oh, om, ch, cm] = [Number(m[1]), Number(m[2] ?? 0), Number(m[3]), Number(m[4] ?? 0)];
  if (oh > 23 || ch > 24 || om > 59 || cm > 59) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return [`${pad(oh)}:${pad(om)}`, `${pad(ch === 24 ? 23 : ch)}:${ch === 24 ? "59" : pad(cm)}`];
}

/**
 * openingHoursSpecification from the OBJECT form of hours_json only.
 *
 * The array/free-text forms ("6h-22h hằng ngày") carry no per-day breakdown, and
 * schema.org requires dayOfWeek + opens + closes — deriving those from prose
 * would be a guess. Those venues keep the human-readable body line and emit no
 * hours schema, which is valid.
 *
 * Note (2026-08-19): hours_json is 0% populated across all 691 VN rows today,
 * so this returns [] in production. It is wired now so the schema lights up the
 * moment the venue form starts collecting hours, rather than being forgotten.
 */
function buildOpeningHours(hoursJson: unknown): Record<string, unknown>[] {
  if (!hoursJson || typeof hoursJson !== "object" || Array.isArray(hoursJson)) return [];
  const out: Record<string, unknown>[] = [];
  for (const [day, val] of Object.entries(hoursJson as Record<string, unknown>)) {
    if (typeof val !== "string" || !val.trim()) continue;
    const dayUri = DAY_SCHEMA[day.slice(0, 3).toLowerCase()];
    if (!dayUri) continue;
    const range = parseHourRange(val);
    if (!range) continue;
    out.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: dayUri,
      opens: range[0],
      closes: range[1],
    });
  }
  return out;
}

function hoursLines(hoursJson: unknown, lang: Lang): string[] {
  if (!hoursJson) return [];
  if (Array.isArray(hoursJson)) {
    return hoursJson.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (typeof hoursJson === "object") {
    return Object.entries(hoursJson as Record<string, unknown>)
      .filter(([, val]) => typeof val === "string" && (val as string).trim().length > 0)
      .map(([day, val]) => {
        const label = DAY_LABEL[day.slice(0, 3).toLowerCase()];
        return label ? `${label[lang]}: ${val}` : `${day}: ${val}`;
      });
  }
  if (typeof hoursJson === "string" && hoursJson.trim().length > 0) return [hoursJson];
  return [];
}

// ── /san — list ────────────────────────────────────────────────────────────
export async function renderVenuesList(
  supabase: SupabaseClient,
  siteUrl: string,
  lang: Lang,
): Promise<Response> {
  const enUrl = `${siteUrl}/san`;
  const viUrl = `${siteUrl}/vi/san`;
  const canonical = lang === "vi" ? viUrl : enUrl;
  // Internal links must stay inside the reader's language cluster. Hardcoding
  // /san/ meant every VI page (844 URLs in sitemap-venues) linked back to the
  // EN cluster and received ZERO internal inlinks of its own — Googlebot
  // entering /vi/san/* had no path to any other VI page (panel 02/08).
  const sanBase = lang === "vi" ? viUrl : enUrl;

  let rows: VenueListRow[] = [];
  try {
    const { data, error } = await supabase
      .from("venues")
      .select("slug, name, name_vi, district, city, num_courts, is_indoor, is_verified")
      .eq("country", "VN")
      .order("is_verified", { ascending: false })
      .order("num_courts", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) {
      console.error("renderVenuesList: query error", error);
    } else {
      rows = (data ?? []) as VenueListRow[];
    }
  } catch (err) {
    console.error("renderVenuesList: fatal", err);
  }

  const titleVi = "Tìm sân Pickleball Việt Nam | ThePickleHub";
  const titleEn = "Find Pickleball Courts in Vietnam | ThePickleHub";
  const descVi =
    rows.length > 0
      ? `${rows.length} sân pickleball tại Hà Nội, TP.HCM, Đà Nẵng và nhiều tỉnh thành — địa chỉ, số sân, trong nhà/ngoài trời và chỉ đường trên ThePickleHub.`
      : "Tìm sân pickleball gần bạn trên ThePickleHub — địa chỉ, số sân, giờ mở cửa và chỉ đường. Cộng đồng cùng đóng góp.";
  const descEn =
    rows.length > 0
      ? `${rows.length} pickleball courts across Hanoi, Ho Chi Minh City and beyond — address, court count, indoor/outdoor and directions on ThePickleHub.`
      : "Find pickleball courts near you on ThePickleHub — address, court count, hours and directions. Crowd-sourced by the community.";

  const title = lang === "vi" ? titleVi : titleEn;
  const description = lang === "vi" ? descVi : descEn;

  const itemsHtml = rows
    .map((v) => {
      const nm = displayName(v, lang);
      const loc = locationLine(v);
      const locText = loc ? ` — ${escapeHtml(loc)}` : "";
      return `<li><a href="${sanBase}/${escapeHtml(v.slug)}">${escapeHtml(nm)}</a>${locText}</li>`;
    })
    .join("");

  const itemListJsonLd =
    rows.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: title,
          numberOfItems: rows.length,
          itemListElement: rows.map((v, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${siteUrl}/san/${v.slug}`,
            item: {
              "@type": "SportsActivityLocation",
              name: displayName(v, lang),
              url: `${siteUrl}/san/${v.slug}`,
              ...(locationLine(v)
                ? {
                    address: {
                      "@type": "PostalAddress",
                      addressLocality: v.city ?? undefined,
                      addressCountry: "VN",
                    },
                  }
                : {}),
            },
          })),
        }
      : undefined;

  const headingMore = lang === "vi" ? "Khám phá thêm" : "Discover more";
  const moreLinks = [
    `<li><a href="${siteUrl}/clubs">${lang === "vi" ? "Câu lạc bộ" : "Clubs"}</a></li>`,
    `<li><a href="${siteUrl}/social">${lang === "vi" ? "Sự kiện cộng đồng" : "Community events"}</a></li>`,
    `<li><a href="${siteUrl}/tournaments">${lang === "vi" ? "Giải đấu" : "Tournaments"}</a></li>`,
    `<li><a href="${lang === "vi" ? `${siteUrl}/vi/blog` : `${siteUrl}/blog`}">${lang === "vi" ? "Blog & mẹo chơi" : "Blog & tips"}</a></li>`,
    `<li><a href="${lang === "vi" ? `${siteUrl}/vi/news` : `${siteUrl}/news`}">${lang === "vi" ? "Tin tức pickleball" : "Pickleball news"}</a></li>`,
  ].join("");

  const emptyMsg = lang === "vi" ? "Chưa có sân nào." : "No courts yet.";

  const cityHeading = lang === "vi" ? "Sân pickleball theo tỉnh/thành" : "Pickleball courts by city";
  const cityLinks = Object.entries(VENUE_CITY_NAME)
    .map(([sl, nm]) => `<li><a href="${sanBase}/khu-vuc/${sl}">${escapeHtml(nm)}</a></li>`)
    .join("");

  const breadcrumbHtml =
    lang === "vi"
      ? `<nav aria-label="breadcrumb"><ol><li><a href="${siteUrl}/vi">Trang chủ</a></li> &gt; <li>Tìm sân</li></ol></nav>`
      : `<nav aria-label="breadcrumb"><ol><li><a href="${siteUrl}/">Home</a></li> &gt; <li>Courts</li></ol></nav>`;

  const hubH1 = lang === "vi" ? "Tìm sân Pickleball Việt Nam" : "Find pickleball courts in Vietnam";
  const bodyContent = `${breadcrumbHtml}
<h1>${escapeHtml(hubH1)}</h1>
<section>
<h2>${escapeHtml(lang === "vi" ? "Sân pickleball nổi bật" : "Featured courts")}</h2>
${rows.length > 0 ? `<ul>${itemsHtml}</ul>` : `<p>${escapeHtml(emptyMsg)}</p>`}
</section>
<nav><h2>${escapeHtml(cityHeading)}</h2><ul>${cityLinks}</ul></nav>
<nav><h2>${escapeHtml(headingMore)}</h2><ul>${moreLinks}</ul></nav>`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: canonical,
      siteUrl,
      lang,
      type: "website",
      jsonLd: itemListJsonLd,
      bodyContent,
      alternates: [
        { hreflang: "en", href: enUrl },
        { hreflang: "vi", href: viUrl },
        { hreflang: "x-default", href: enUrl },
      ],
      omitAutoHeader: true,
    }),
  );
}

// SEO wiring (2026-08-11, docs/seo-topical-authority-plan.md §6) — deep-link
// venue + city-hub pages to the evergreen local guides most relevant to a
// court-finder's intent (cost, court size, rules, how-to), instead of only the
// blog index. Raises topical relevance from the /san cluster (the traffic
// engine) into the editorial cluster. Slugs are verified live 200 on both
// tracks (EN from BLOG_POST_META, VI from vi_blog_posts) — keep them in sync if
// a guide is renamed/301'd, or the link becomes a redirect hop.
const VENUE_GUIDE_SLUGS: Record<Lang, { slug: string; label: string }[]> = {
  vi: [
    { slug: "chi-phi-choi-pickleball-viet-nam-2026", label: "Chi phí chơi pickleball ở Việt Nam" },
    { slug: "kich-thuoc-san-pickleball-tieu-chuan", label: "Kích thước sân pickleball tiêu chuẩn" },
    { slug: "luat-pickleball-co-ban", label: "Luật pickleball cơ bản" },
    { slug: "cach-choi-pickleball-cho-nguoi-moi", label: "Cách chơi pickleball cho người mới" },
  ],
  en: [
    { slug: "pickleball-cost-vietnam-2026", label: "How much pickleball costs in Vietnam" },
    { slug: "pickleball-court-dimensions-setup-guide", label: "Pickleball court dimensions & setup" },
    { slug: "pickleball-rules-complete-guide", label: "Complete pickleball rules" },
    { slug: "how-to-play-pickleball", label: "How to play pickleball" },
  ],
};

function venueGuideLinksHtml(siteUrl: string, lang: Lang): string {
  const base = lang === "vi" ? `${siteUrl}/vi/blog` : `${siteUrl}/blog`;
  return VENUE_GUIDE_SLUGS[lang]
    .map((g) => `<li><a href="${base}/${escapeHtml(g.slug)}">${escapeHtml(g.label)}</a></li>`)
    .join("");
}

// ── /san/:slug — detail ─────────────────────────────────────────────────────
export async function renderVenueDetail(
  supabase: SupabaseClient,
  slug: string,
  siteUrl: string,
  lang: Lang = "vi",
): Promise<Response> {
  const VENUE_BASE_COLS =
    "id, slug, name, name_vi, address, district, city, country, latitude, longitude, num_courts, surface_type, is_indoor, phone, website, amenities, hours_json, cover_image_url";
  const VENUE_REVIEW_COLS = ", review_count, review_avg";
  let { data, error } = await supabase
    .from("venues")
    .select(VENUE_BASE_COLS + VENUE_REVIEW_COLS)
    .eq("slug", slug)
    .maybeSingle();

  // Deploy-safe: if this ships before the venue_reviews migration is applied,
  // review_count/review_avg don't exist and the select errors. Retry without
  // them so venue pages never 404 on ordering — the aggregateRating + reviews
  // section just stay hidden until the migration + first reviews land.
  if (error) {
    ({ data, error } = await supabase
      .from("venues")
      .select(VENUE_BASE_COLS)
      .eq("slug", slug)
      .maybeSingle());
  }

  if (error) {
    console.error("renderVenueDetail: lookup error", { slug, error });
  }
  if (!data) return render404(`/san/${slug}`, siteUrl);

  const v = data as unknown as VenueDetailRow;

  // Published reviews for this venue (SSR-visible text + Review schema). Separate
  // query so a missing venue_reviews table (pre-migration) is a caught no-op, not
  // a venue-page failure. Newest 5 for the body; aggregate comes from v.review_*.
  let reviews: { rating: number; body: string | null; created_at: string }[] = [];
  if (v.review_count && v.review_count > 0) {
    try {
      const { data: rv } = await supabase
        .from("venue_reviews")
        .select("rating, body, created_at")
        .eq("venue_id", v.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(5);
      reviews = (rv ?? []) as { rating: number; body: string | null; created_at: string }[];
    } catch {
      // non-fatal — aggregateRating still renders from the venue columns
    }
  }
  const enUrl = `${siteUrl}/san/${v.slug}`;
  const viUrl = `${siteUrl}/vi/san/${v.slug}`;
  const url = lang === "vi" ? viUrl : enUrl;
  const sanBase = lang === "vi" ? `${siteUrl}/vi/san` : `${siteUrl}/san`;
  const name = displayName(v, lang);
  const addr = fullAddress(v);

  const courtsVi = v.num_courts && v.num_courts > 0 ? `${v.num_courts} sân` : "";
  const courtsEn =
    v.num_courts && v.num_courts > 0 ? `${v.num_courts} court${v.num_courts > 1 ? "s" : ""}` : "";
  const indoorVi = v.is_indoor == null ? "" : v.is_indoor ? "trong nhà" : "ngoài trời";
  const indoorEn = v.is_indoor == null ? "" : v.is_indoor ? "indoor" : "outdoor";

  // CTR: 95% of venue names already embed "Pickleball" (309/691 literally start
  // with "Sân Pickleball"), so the old "<name> | Sân Pickleball · ThePickleHub"
  // suffix produced a redundant double keyword. Instead: keep the name as-is when
  // it already carries the keyword, append the city for local intent when it
  // isn't already in the name, then a single brand. buildTitle handles the >60
  // truncation (drops brand, adds ellipsis).
  const cityName = v.city ? v.city.trim() : "";
  const nameHasKw = /pickleball/i.test(name);
  const cityInName = cityName ? name.toLowerCase().includes(cityName.toLowerCase()) : false;
  const kwName = nameHasKw
    ? name
    : lang === "vi"
      ? `Sân Pickleball ${name}`
      : `${name} Pickleball Court`;
  const cityTail = cityName && !cityInName ? ` – ${cityName}` : "";
  const brand = " | ThePickleHub";
  // buildTitle budgets in BYTES (60) and is the only place allowed to decide
  // whether the brand suffix fits. The old `.length <= 60` pre-check here
  // counted CHARS and shipped titles like "…Nguyễn Chánh – Hà Nội |…" — a
  // 53-char/61-byte title passed the char gate, then truncateForSeo cut it
  // mid-brand (bug #468 recurring through a caller that bypassed the fix).
  const title = buildTitle(kwName + cityTail, brand);

  // CTR: lead the description with the concrete, search-intent facts (name,
  // city, court count, indoor/outdoor) then a clear next step. Address is
  // dropped from the snippet (often long → mid-word truncation at 160) and
  // surfaced in the body instead; the city keyword carries the local intent.
  // CTR: venue-name queries are navigational — the searcher wants to book a
  // court. Surfacing the booking phone number in the snippet is the single
  // most actionable fact we hold that Maps/Facebook results often bury.
  //
  // 2026-08-18 (CTR-01): the previous template was a single fixed string whose
  // generic tail ("Địa chỉ, bản đồ, chỉ đường & các sân pickleball ở <city>
  // trên ThePickleHub.") alone costs ~95 UTF-8 bytes, so 592 of the 760 venue
  // rows (78%) blew the 160-byte meta budget and pickMetaDescription ellipsised
  // them mid-word — production was shipping snippets ending "…ở Hà…" and
  // "…các sân pickl…". A live sample of 30 /vi/san/ pages found 16 truncated.
  // /vi/san/ carries 68% of all site impressions at avg position 7.6 but only
  // 1.41% CTR, versus 6.98% for /vi/blog/ at the same position band.
  //
  // Fix: assemble the snippet from priority-ordered segments and append each
  // one only if it still fits the budget. Highest-value facts go first, the
  // generic tail last, so a long venue name degrades by losing boilerplate
  // instead of getting its city keyword sliced off. Nothing is ever truncated.
  // Same de-dup as the title: skip the "Sân pickleball" / "pickleball court"
  // label when the name already carries the keyword, so the snippet doesn't read
  // "Sân pickleball Sân Pickleball FLC Sầm Sơn".
  const leadVi = nameHasKw ? name : `Sân pickleball ${name}`;
  const leadEn = nameHasKw ? name : `${name} pickleball court`;
  const factsVi = [courtsVi, indoorVi].filter(Boolean).join(", ");
  const factsEn = [courtsEn, indoorEn].filter(Boolean).join(", ");
  const descVariants =
    lang === "vi"
      ? {
          core: fitLead(leadVi, cityName ? ` tại ${cityName}.` : "."),
          segments: [
            factsVi ? ` ${upperFirst(factsVi)}.` : "",
            v.phone ? ` Đặt sân: ${v.phone}.` : "",
            " Địa chỉ, bản đồ & chỉ đường.",
            ` Sân pickleball ${cityName ? `ở ${cityName} ` : "gần bạn "}trên ThePickleHub.`,
          ],
        }
      : {
          core: fitLead(leadEn, cityName ? ` in ${cityName}.` : "."),
          segments: [
            factsEn ? ` ${upperFirst(factsEn)}.` : "",
            v.phone ? ` Booking: ${v.phone}.` : "",
            " Address, map & directions.",
            ` More pickleball courts ${cityName ? `in ${cityName} ` : ""}on ThePickleHub.`,
          ],
        };
  const description = pickMetaDescription(
    null,
    fitSegments(descVariants.core, descVariants.segments),
  );

  // Structured facts for amenityFeature. Names are English schema keys with a
  // localized `name` so the value is readable in both clusters; `value` carries
  // the machine-readable payload (boolean for a flag, number for a count).
  const amenityFeatures: Record<string, unknown>[] = [];
  if (v.is_indoor != null) {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: lang === "vi" ? (v.is_indoor ? "Sân trong nhà" : "Sân ngoài trời") : v.is_indoor ? "Indoor courts" : "Outdoor courts",
      value: true,
    });
  }
  if (v.num_courts != null && v.num_courts > 0) {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: lang === "vi" ? "Số sân pickleball" : "Number of pickleball courts",
      value: v.num_courts,
    });
  }
  if (v.surface_type) {
    amenityFeatures.push({
      "@type": "LocationFeatureSpecification",
      name: lang === "vi" ? "Mặt sân" : "Court surface",
      value: v.surface_type,
    });
  }
  for (const a of v.amenities ?? []) {
    if (typeof a === "string" && a.trim()) {
      amenityFeatures.push({ "@type": "LocationFeatureSpecification", name: a.trim(), value: true });
    }
  }

  // openingHoursSpecification — only from the object form of hours_json, where
  // day and range are separable. The free-text/array forms stay body-only:
  // schema.org needs dayOfWeek + opens/closes, and inventing those from a
  // string like "6h-22h hằng ngày" would be a guess, not data.
  const openingHours = buildOpeningHours(v.hours_json);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name,
    url,
    sport: "Pickleball",
    ...(addr
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: v.address ?? undefined,
            addressLocality: v.city ?? undefined,
            addressRegion: v.district ?? undefined,
            addressCountry: v.country ?? "VN",
          },
        }
      : {}),
    ...(v.latitude != null && v.longitude != null
      ? { geo: { "@type": "GeoCoordinates", latitude: v.latitude, longitude: v.longitude } }
      : {}),
    ...(v.phone ? { telephone: v.phone } : {}),
    ...(v.website ? { sameAs: [v.website] } : {}),
    ...(v.cover_image_url ? { image: v.cover_image_url } : {}),
    ...(v.latitude != null && v.longitude != null
      ? { hasMap: `https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}` }
      : {}),
    // amenityFeature — SEO-GUARD-01 (2026-08-19). Venue JSON-LD carried only
    // name/address/geo/phone, so two courts in the same district were nearly
    // identical to a parser even though we hold court count and indoor/outdoor
    // for them. Both are already rendered in the visible body above, so this
    // adds no claim the page does not show.
    //
    // Coverage check before writing this (691 VN rows, 2026-08-19):
    //   is_indoor 100% · num_courts 39% · surface_type 1%
    //   amenities 0% · hours_json 0% · website 0% · cover_image_url 0%
    // The last four are empty columns today — the `hours`/`amenities` branches
    // below emit nothing until they are backfilled, which is why the meta
    // description was NOT rebuilt around them (see commit 88520b58).
    ...(amenityFeatures.length ? { amenityFeature: amenityFeatures } : {}),
    ...(openingHours.length ? { openingHoursSpecification: openingHours } : {}),
    // aggregateRating from OUR own users' reviews (venue = third-party entity,
    // legitimate like TripAdvisor/Yelp — unlike republishing Google's rating).
    // Backed by the visible review section rendered in the body below.
    ...(v.review_count && v.review_count > 0 && v.review_avg != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: v.review_avg,
            reviewCount: v.review_count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  const homeLabel = lang === "vi" ? "Trang chủ" : "Home";
  const homeHref = lang === "vi" ? `${siteUrl}/vi` : siteUrl;
  const courtsLabel = lang === "vi" ? "Tìm sân" : "Courts";
  const citySlug = v.city ? CITY_SLUG_BY_NAME[v.city] : undefined;
  const bcCrumbs: { label: string; href?: string }[] = [
    { label: homeLabel, href: homeHref },
    { label: courtsLabel, href: sanBase },
  ];
  if (citySlug && v.city) {
    bcCrumbs.push({ label: v.city, href: `${sanBase}/khu-vuc/${citySlug}` });
  }
  bcCrumbs.push({ label: name });
  const bc = breadcrumb(bcCrumbs);

  const lbl =
    lang === "vi"
      ? { addr: "Địa chỉ", courts: "Số sân", type: "Loại sân", surface: "Mặt sân", phone: "Điện thoại", hours: "Giờ mở cửa", amenities: "Tiện ích", map: "Xem bản đồ", directions: "Chỉ đường" }
      : { addr: "Address", courts: "Courts", type: "Type", surface: "Surface", phone: "Phone", hours: "Opening hours", amenities: "Amenities", map: "View map", directions: "Directions" };

  const parts: string[] = [bc, `<h1>${escapeHtml(name)}</h1>`];
  if (v.cover_image_url)
    parts.push(`<img src="${escapeHtml(v.cover_image_url)}" alt="${escapeHtml(name)}" width="1200" height="630"/>`);
  if (addr) parts.push(`<p><strong>${lbl.addr}:</strong> ${escapeHtml(addr)}</p>`);
  if (v.latitude != null && v.longitude != null) {
    const q = `${v.latitude},${v.longitude}`;
    parts.push(
      `<p><a href="https://www.google.com/maps/search/?api=1&amp;query=${q}" rel="nofollow noopener">${lbl.map}</a> · ` +
        `<a href="https://www.google.com/maps/dir/?api=1&amp;destination=${q}" rel="nofollow noopener">${lbl.directions}</a></p>`,
    );
  }
  if (v.num_courts && v.num_courts > 0)
    parts.push(`<p><strong>${lbl.courts}:</strong> ${v.num_courts}</p>`);
  if (v.is_indoor != null)
    parts.push(`<p><strong>${lbl.type}:</strong> ${escapeHtml(lang === "vi" ? indoorVi : indoorEn)}</p>`);
  if (v.surface_type)
    parts.push(`<p><strong>${lbl.surface}:</strong> ${escapeHtml(v.surface_type)}</p>`);
  const hours = hoursLines(v.hours_json, lang);
  if (hours.length > 0)
    parts.push(
      `<p><strong>${lbl.hours}:</strong></p><ul>${hours.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>`,
    );
  if (v.amenities && v.amenities.length > 0)
    parts.push(
      `<p><strong>${lbl.amenities}:</strong> ${v.amenities.map((a) => escapeHtml(a)).join(" · ")}</p>`,
    );
  if (v.phone) parts.push(`<p><strong>${lbl.phone}:</strong> ${escapeHtml(v.phone)}</p>`);
  if (v.website)
    parts.push(`<p><a href="${escapeHtml(v.website)}" rel="nofollow noopener">Website</a></p>`);

  // Community reviews — first-hand content (the SEO moat) + the visible backing
  // for the aggregateRating emitted above. Anonymous in SSR (names shown in the
  // SPA); rating + body + date is what a bot cites.
  if (reviews.length > 0) {
    const revHeading = lang === "vi" ? "Đánh giá từ cộng đồng" : "Community reviews";
    const avgLine =
      v.review_avg != null
        ? `<p><strong>★ ${v.review_avg}</strong> · ${v.review_count} ${lang === "vi" ? "đánh giá" : "reviews"}</p>`
        : "";
    const revItems = reviews
      .map((r) => {
        const clamped = Math.max(1, Math.min(5, r.rating));
        const stars = "★".repeat(clamped) + "☆".repeat(5 - clamped);
        const date = (r.created_at || "").slice(0, 10);
        const body = r.body ? `<p>${escapeHtml(r.body)}</p>` : "";
        return `<li><span aria-label="${clamped}/5">${stars}</span>${date ? ` <time datetime="${date}">${date}</time>` : ""}${body}</li>`;
      })
      .join("");
    parts.push(`<section><h2>${escapeHtml(revHeading)}</h2>${avgLine}<ul>${revItems}</ul></section>`);
  }

  // Unique intro (after H1) + internal links to other courts in the same
  // city — reduces thin content and interlinks the directory.
  const typeWord =
    v.is_indoor == null ? "" : lang === "vi" ? (v.is_indoor ? "trong nhà" : "ngoài trời") : v.is_indoor ? "indoor" : "outdoor";
  const courtsWord =
    v.num_courts && v.num_courts > 0
      ? lang === "vi"
        ? `${v.num_courts} sân`
        : `${v.num_courts} court${v.num_courts > 1 ? "s" : ""}`
      : "";
  const intro =
    lang === "vi"
      ? `${name} là sân pickleball${typeWord ? ` ${typeWord}` : ""}${addr ? ` tại ${addr}` : ""}${courtsWord ? ` với ${courtsWord}` : ""}${v.surface_type ? `, mặt sân ${v.surface_type}` : ""}. Xem địa chỉ, bản đồ, chỉ đường và các sân pickleball khác${v.city ? ` tại ${v.city}` : ""} bên dưới.`
      : `${name} is a pickleball court${addr ? ` at ${addr}` : ""}${courtsWord ? ` with ${courtsWord}` : ""}${typeWord ? ` (${typeWord})` : ""}${v.surface_type ? `, ${v.surface_type} surface` : ""}. See the address, map, directions and other pickleball courts${v.city ? ` in ${v.city}` : ""} below.`;
  parts.splice(2, 0, `<p>${escapeHtml(intro)}</p>`);

  if (v.city) {
    try {
      const { data: nb } = await supabase
        .from("venues")
        .select("slug, name, name_vi, district")
        .eq("city", v.city)
        .neq("slug", v.slug)
        .order("is_verified", { ascending: false })
        .order("num_courts", { ascending: false })
        .limit(8);
      const nearby = (nb ?? []) as { slug: string; name: string; name_vi: string | null; district: string | null }[];
      if (nearby.length > 0) {
        const heading = lang === "vi" ? `Sân pickleball khác tại ${v.city}` : `Other pickleball courts in ${v.city}`;
        const items = nearby
          .map((n) => `<li><a href="${sanBase}/${escapeHtml(n.slug)}">${escapeHtml(displayName(n, lang))}</a>${n.district ? ` — ${escapeHtml(n.district)}` : ""}</li>`)
          .join("");
        parts.push(`<h2>${escapeHtml(heading)}</h2><ul>${items}</ul>`);
      }
    } catch {
      // non-fatal
    }
    if (citySlug) {
      const allLabel = lang === "vi" ? `Xem tất cả sân pickleball tại ${v.city}` : `See all pickleball courts in ${v.city}`;
      parts.push(`<p><a href="${sanBase}/khu-vuc/${citySlug}">${escapeHtml(allLabel)} →</a></p>`);
    }
  }

  // Distribute crawl + authority from high-impression venue pages into the
  // editorial surfaces (blog/news), and give visitors a next step beyond the
  // directory. Blog/news have localized /vi routes, so link the matching lang.
  const blogHref = lang === "vi" ? `${siteUrl}/vi/blog` : `${siteUrl}/blog`;
  const newsHref = lang === "vi" ? `${siteUrl}/vi/news` : `${siteUrl}/news`;
  const tipsHeading = lang === "vi" ? "Mẹo chơi & tin tức" : "Tips & news";
  // Deep-link the four evergreen local guides first (topical relevance venue →
  // editorial), then the blog/news indexes for discovery.
  parts.push(
    `<nav><h2>${escapeHtml(tipsHeading)}</h2><ul>` +
      venueGuideLinksHtml(siteUrl, lang) +
      `<li><a href="${blogHref}">${escapeHtml(lang === "vi" ? "Blog & hướng dẫn pickleball" : "Pickleball blog & guides")}</a></li>` +
      `<li><a href="${newsHref}">${escapeHtml(lang === "vi" ? "Tin tức pickleball mới nhất" : "Latest pickleball news")}</a></li>` +
      `</ul></nav>`,
  );

  return htmlResponse(
    buildHtml({
      title,
      description,
      url,
      siteUrl,
      jsonLd,
      ...(v.cover_image_url ? { image: v.cover_image_url } : {}),
      bodyContent: parts.join("\n"),
      lang,
      alternates: [
        { hreflang: "en", href: enUrl },
        { hreflang: "vi", href: viUrl },
        { hreflang: "x-default", href: enUrl },
      ],
      omitAutoHeader: true,
      // Guard-0: near-empty UGC stubs carry noindex,follow so they don't dilute
      // the /san cluster but still pass link equity. sitemap-venues drops them too.
      ...(isThinVenue(v) ? { extraMeta: '<meta name="robots" content="noindex, follow"/>' } : {}),
    }),
  );
}


  // City hubs are where someone searching "sân pickleball đà nẵng" lands, and
  // in 2026 two of these cities are hosting the biggest events of the year.
  // Point that visitor at the tournament article for their own city.
  //
  // `until` is the day AFTER the event ends, and the entry stops rendering by
  // itself past that date. A hardcoded event link outliving its event is the
  // predictable failure here — nobody comes back to delete it, and the hub is
  // left advertising something that already happened. Expiry is two lines;
  // remembering is not.
  // The VI article is a different slug, not a /vi prefix on the EN one — both
  // are spelled out so the link lands in one hop instead of leaning on the
  // /vi/blog/<EN-slug> redirect.
const CITY_EVENT_LINK: Record<
    string,
    { until: string; viText: string; enText: string; viSlug: string; enSlug: string }
  > = {
    "da-nang": {
      until: "2026-09-07",
      viText: "Heineken Pickleball World Cup 2026 tại Đà Nẵng (30/8 – 6/9) — lịch, địa điểm và cách xem",
      enText: "Heineken Pickleball World Cup 2026 in Da Nang (Aug 30 – Sep 6) — schedule, venues and how to watch",
      viSlug: "cam-nang-xem-pickleball-world-cup-2026-da-nang",
      enSlug: "pickleball-world-cup-2026-da-nang-how-to-watch",
    },
    "tp-hcm": {
      until: "2026-08-10",
      viText: "HCMC Open 2026 (6–9/8) — chặng PPA Tour Asia 500 tại TP.HCM: vé, lịch và cách xem",
      enText: "HCMC Open 2026 (Aug 6–9) — the PPA Tour Asia 500 stop in Ho Chi Minh City: tickets, schedule and how to watch",
      viSlug: "hcmc-open-2026",
      enSlug: "hcmc-open-2026-preview",
    },
  };

/** Time-boxed editorial link for a city hub. Empty once the event is over. */
export function cityEventLink(
  citySlug: string,
  lang: Lang,
  siteUrl: string,
  today: string = new Date().toISOString().slice(0, 10),
): string {
  const ev = CITY_EVENT_LINK[citySlug];
  if (!ev || today > ev.until) return "";
  const href = lang === "vi" ? `${siteUrl}/vi/blog/${ev.viSlug}` : `${siteUrl}/blog/${ev.enSlug}`;
  return `<p><a href="${href}">${escapeHtml(lang === "vi" ? ev.viText : ev.enText)}</a></p>`;
}

// ── /san/khu-vuc/:city — per-city hub ───────────────────────────────────────
const VENUE_CITY_NAME: Record<string, string> = {
  "singapore": "Singapore",
  "tp-hcm": "TP.HCM",
  "ha-noi": "Hà Nội",
  "da-nang": "Đà Nẵng",
  "bac-ninh": "Bắc Ninh",
  "ha-long": "Hạ Long",
  "vinh": "Vinh",
  "nam-dinh": "Nam Định",
  "thanh-hoa": "Thanh Hóa",
  "binh-duong": "Bình Dương",
  "can-tho": "Cần Thơ",
  "pleiku": "Pleiku",
  "vung-tau": "Vũng Tàu",
  "bac-giang": "Bắc Giang",
  "bao-loc": "Bảo Lộc",
  "cao-bang": "Cao Bằng",
  "lang-son": "Lạng Sơn",
  "buon-ma-thuot": "Buôn Ma Thuột",
  "dong-hoi": "Đồng Hới",
  "ha-tinh": "Hà Tĩnh",
  "hai-duong": "Hải Dương",
  "hai-phong": "Hải Phòng",
  "nha-trang": "Nha Trang",
  "quy-nhon": "Quy Nhơn",
  "tay-ninh": "Tây Ninh",
  "vinh-yen": "Vĩnh Yên",
  "bien-hoa": "Biên Hòa",
  "cao-lanh": "Cao Lãnh",
  "da-lat": "Đà Lạt",
  "hue": "Huế",
  "lao-cai": "Lào Cai",
  "long-xuyen": "Long Xuyên",
  "ninh-binh": "Ninh Bình",
  "phan-rang": "Phan Rang",
  "quang-ngai": "Quảng Ngãi",
  "son-la": "Sơn La",
  "thai-nguyen": "Thái Nguyên",
  "tuy-hoa": "Tuy Hòa",
  "ca-mau": "Cà Mau",
  "dien-bien-phu": "Điện Biên Phủ",
  "dong-ha": "Đông Hà",
  "phu-quoc": "Phú Quốc",
  "rach-gia": "Rạch Giá",
  "viet-tri": "Việt Trì",
  "vinh-long": "Vĩnh Long",
  "ben-tre": "Bến Tre",
  "chau-doc": "Châu Đốc",
  "dong-xoai": "Đồng Xoài",
  "ha-giang": "Hà Giang",
  "hoi-an": "Hội An",
  "my-hao": "Mỹ Hào",
  "phan-thiet": "Phan Thiết",
  "sam-son": "Sầm Sơn",
  "thai-binh": "Thái Bình",
  "tra-vinh": "Trà Vinh",
  "tuyen-quang": "Tuyên Quang",
  "uong-bi": "Uông Bí",
  "yen-bai": "Yên Bái",
  "cam-pha": "Cẩm Phả",
  "hoa-binh": "Hòa Bình",
  "hung-ha": "Hưng Hà",
  "moc-chau": "Mộc Châu",
  "my-tho": "Mỹ Tho",
  "phu-ly": "Phủ Lý",
  "sa-dec": "Sa Đéc",
  "soc-trang": "Sóc Trăng",
  "van-giang": "Văn Giang",
  "van-lam": "Văn Lâm",
  "chau-hung": "Châu Hưng",
  "chi-linh": "Chí Linh",
  "gia-nghia": "Gia Nghĩa",
  "kon-tum": "Kon Tum",
  "mai-chau": "Mai Châu",
  "phu-yen": "Phù Yên",
  "phuc-yen": "Phúc Yên",
  "quynh-phu": "Quỳnh Phụ",
  "sa-pa": "Sa Pa",
  "tam-ky": "Tam Kỳ",
  "tan-an": "Tân An",
  "thanh-son": "Thanh Sơn",
  "tran-yen": "Trấn Yên",
  "vi-xuyen": "Vị Xuyên",
  "vinh-chau": "Vĩnh Châu",
  "yen-my": "Yên Mỹ",
};

const CITY_SLUG_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(VENUE_CITY_NAME).map(([sl, nm]) => [nm, sl]),
);

// City -> country for international hubs. The `venues.country` column has
// always existed, so a non-VN city hub only needs a slug->country entry here.
// Default VN keeps every existing hub's copy + schema byte-for-byte unchanged.
// S1 pilot: Singapore (SEA is where a court directory has no entrenched
// competitor, unlike the US Pickleheads/Places2Play wall).
const CITY_COUNTRY: Record<string, { code: string; en: string; vi: string }> = {
  singapore: { code: "SG", en: "Singapore", vi: "Singapore" },
};
function cityCountry(citySlug: string): { code: string; en: string; vi: string } {
  return CITY_COUNTRY[citySlug] ?? { code: "VN", en: "Vietnam", vi: "Việt Nam" };
}

export async function renderVenuesCity(
  supabase: SupabaseClient,
  citySlug: string,
  siteUrl: string,
  lang: Lang,
): Promise<Response> {
  const cityName = VENUE_CITY_NAME[citySlug];
  if (!cityName) return render404(`/san/khu-vuc/${citySlug}`, siteUrl);
  const cc = cityCountry(citySlug);
  // City-states (Singapore) would read "Singapore, Singapore" — dedupe.
  const localeEn = cityName === cc.en ? cityName : `${cityName}, ${cc.en}`;
  const enUrl = `${siteUrl}/san/khu-vuc/${citySlug}`;
  const viUrl = `${siteUrl}/vi/san/khu-vuc/${citySlug}`;
  const canonical = lang === "vi" ? viUrl : enUrl;
  const sanBase = lang === "vi" ? `${siteUrl}/vi/san` : `${siteUrl}/san`;

  let rows: VenueListRow[] = [];
  try {
    const { data, error } = await supabase
      .from("venues")
      .select("slug, name, name_vi, district, city, num_courts, is_indoor, is_verified")
      .eq("city", cityName)
      .order("is_verified", { ascending: false })
      .order("num_courts", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(300);
    if (error) console.error("renderVenuesCity: query error", error);
    else rows = (data ?? []) as VenueListRow[];
  } catch (err) {
    console.error("renderVenuesCity: fatal", err);
  }

  const n = rows.length;
  const title =
    lang === "vi"
      ? `Sân Pickleball ${cityName} — ${n} sân | ThePickleHub`
      : `Pickleball Courts in ${cityName} (${n}) | ThePickleHub`;
  const description =
    lang === "vi"
      ? `${n} sân pickleball tại ${cityName} — địa chỉ, số sân, bản đồ và chỉ đường. Cộng đồng cùng đóng góp trên ThePickleHub.`
      : `${n} pickleball courts in ${localeEn} — address, court count, map and directions on ThePickleHub.`;

  const itemsHtml = rows
    .map((v) => {
      const nm = displayName(v, lang);
      const facts = [
        v.district?.trim() || "",
        v.num_courts && v.num_courts > 0 ? (lang === "vi" ? `${v.num_courts} sân` : `${v.num_courts} courts`) : "",
        v.is_indoor == null ? "" : lang === "vi" ? (v.is_indoor ? "trong nhà" : "ngoài trời") : v.is_indoor ? "indoor" : "outdoor",
      ].filter(Boolean);
      return `<li><a href="${sanBase}/${escapeHtml(v.slug)}">${escapeHtml(nm)}</a>${facts.length ? ` — ${escapeHtml(facts.join(" · "))}` : ""}</li>`;
    })
    .join("");

  const itemListJsonLd =
    n > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: title,
          numberOfItems: n,
          itemListElement: rows.map((v, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${siteUrl}/san/${v.slug}`,
            item: {
              "@type": "SportsActivityLocation",
              name: displayName(v, lang),
              url: `${siteUrl}/san/${v.slug}`,
              address: {
                "@type": "PostalAddress",
                addressLocality: v.city ?? cityName,
                addressCountry: cc.code,
              },
            },
          })),
        }
      : undefined;

  const homeLabel = lang === "vi" ? "Trang chủ" : "Home";
  const homeHref = lang === "vi" ? `${siteUrl}/vi` : siteUrl;
  const courtsLabel = lang === "vi" ? "Tìm sân" : "Courts";
  const bc = breadcrumb([
    { label: homeLabel, href: homeHref },
    { label: courtsLabel, href: sanBase },
    { label: cityName },
  ]);
  const h1 = lang === "vi" ? `Sân Pickleball ${cityName}` : `Pickleball courts in ${cityName}`;
  const emptyMsg = lang === "vi" ? `Chưa có sân nào tại ${cityName}.` : `No courts in ${cityName} yet.`;
  const allLabel = lang === "vi" ? "Tất cả sân pickleball" : "All pickleball courts";

  // Thin-content enrichment (anti soft-404): small cities (1-2 venues)
  // rendered ~4.5KB hubs Google flagged as soft 404 (e.g.
  // /san/khu-vuc/phuc-yen). Add a localized intro + crawlable internal
  // nav to other city hubs + discover-more links so every hub carries
  // real content and outbound links regardless of venue count.
  const totalCourts = rows.reduce((s, v) => s + (v.num_courts ?? 0), 0);
  const totalCourtsVi = totalCourts > 0 ? ` với tổng cộng ${totalCourts} sân đấu` : "";
  const totalCourtsEn = totalCourts > 0 ? ` totalling ${totalCourts} playing courts` : "";
  const introHtml =
    lang === "vi"
      ? `<p>Khám phá ${n > 0 ? `${n} ` : ""}sân pickleball tại ${escapeHtml(cityName)}${totalCourtsVi} do cộng đồng ThePickleHub đóng góp — kèm địa chỉ, số sân, sân trong nhà/ngoài trời và chỉ đường. Danh sách được cập nhật liên tục khi có sân mới.</p>`
      : `<p>Discover ${n > 0 ? `${n} ` : ""}community-contributed pickleball courts in ${escapeHtml(localeEn)}${totalCourtsEn} — address, court count, indoor/outdoor and directions. The list grows as new courts are added.</p>`;

  const FEATURED_CITY_SLUGS = [
    "tp-hcm", "ha-noi", "da-nang", "hai-phong", "can-tho", "nha-trang",
    "da-lat", "vung-tau", "hue", "bac-ninh", "quy-nhon", "buon-ma-thuot",
    "pleiku", "nam-dinh", "thanh-hoa", "bien-hoa",
  ];
  const otherCitiesHtml = FEATURED_CITY_SLUGS
    .filter((sl) => sl !== citySlug && VENUE_CITY_NAME[sl])
    .slice(0, 12)
    .map((sl) => {
      const href = lang === "vi" ? `${siteUrl}/vi/san/khu-vuc/${sl}` : `${siteUrl}/san/khu-vuc/${sl}`;
      return `<li><a href="${href}">${escapeHtml(VENUE_CITY_NAME[sl])}</a></li>`;
    })
    .join("");
  const otherCitiesHeading =
    lang === "vi" ? "Sân pickleball ở tỉnh thành khác" : "Pickleball courts in other cities";

  const eventHtml = cityEventLink(citySlug, lang, siteUrl);

  // Evergreen counterpart to the time-boxed cityEventLink: deep-link the local
  // guides a "sân pickleball <city>" searcher also wants (cost, court size,
  // rules, how-to). Permanent editorial wiring that survives past any event.
  const guidesHeading = lang === "vi" ? "Hướng dẫn chơi pickleball" : "Pickleball guides";
  const guidesHtml = `<nav><h2>${escapeHtml(guidesHeading)}</h2><ul>${venueGuideLinksHtml(siteUrl, lang)}</ul></nav>`;

  const moreHeading = lang === "vi" ? "Khám phá thêm" : "Discover more";
  const moreLinks = [
    `<li><a href="${sanBase}">${escapeHtml(allLabel)}</a></li>`,
    `<li><a href="${siteUrl}/clubs">${lang === "vi" ? "Câu lạc bộ" : "Clubs"}</a></li>`,
    `<li><a href="${siteUrl}/social">${lang === "vi" ? "Sự kiện cộng đồng" : "Community events"}</a></li>`,
    `<li><a href="${lang === "vi" ? `${siteUrl}/vi/blog` : `${siteUrl}/blog`}">${lang === "vi" ? "Blog & mẹo chơi" : "Blog & tips"}</a></li>`,
    `<li><a href="${lang === "vi" ? `${siteUrl}/vi/news` : `${siteUrl}/news`}">${lang === "vi" ? "Tin tức pickleball" : "Pickleball news"}</a></li>`,
  ].join("");

  const bodyContent =
    `${bc}<h1>${escapeHtml(h1)}</h1>` +
    introHtml +
    eventHtml +
    (n > 0 ? `<ul>${itemsHtml}</ul>` : `<p>${escapeHtml(emptyMsg)}</p>`) +
    guidesHtml +
    `<nav><h2>${escapeHtml(otherCitiesHeading)}</h2><ul>${otherCitiesHtml}</ul></nav>` +
    `<nav><h2>${escapeHtml(moreHeading)}</h2><ul>${moreLinks}</ul></nav>`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: canonical,
      siteUrl,
      lang,
      type: "website",
      jsonLd: itemListJsonLd,
      bodyContent,
      alternates: [
        { hreflang: "en", href: enUrl },
        { hreflang: "vi", href: viUrl },
        { hreflang: "x-default", href: enUrl },
      ],
      omitAutoHeader: true,
    }),
  );
}
