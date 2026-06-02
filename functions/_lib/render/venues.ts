// ============================================================================
// renderVenuesList + renderVenueDetail — Court finder ("Tìm sân") prerender.
// ----------------------------------------------------------------------------
// Cloudflare Pages bot-prerender for /san and /san/:slug. Mirrors the
// renderClubList / renderClub pattern: service-role Supabase read, build
// ItemList (list) / SportsActivityLocation (detail) JSON-LD, hand off to
// buildHtml. Single canonical per URL (the SPA toggles UI language), so
// hreflang is omitted to avoid the "one page for multiple languages" signal
// Ahrefs flags — same decision as renderClubList / renderClub.
// ============================================================================

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, buildTitle, breadcrumb, type Lang } from "../utils";
import { pickMetaDescription } from "../seo-helpers";
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

// ── /san — list ────────────────────────────────────────────────────────────
export async function renderVenuesList(
  supabase: SupabaseClient,
  siteUrl: string,
  lang: Lang,
): Promise<Response> {
  const enUrl = `${siteUrl}/san`;
  const viUrl = `${siteUrl}/vi/san`;
  const canonical = lang === "vi" ? viUrl : enUrl;

  let rows: VenueListRow[] = [];
  try {
    const { data, error } = await supabase
      .from("venues")
      .select("slug, name, name_vi, district, city, num_courts, is_indoor, is_verified")
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
      return `<li><a href="${siteUrl}/san/${escapeHtml(v.slug)}">${escapeHtml(nm)}</a>${locText}</li>`;
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
  ].join("");

  const emptyMsg = lang === "vi" ? "Chưa có sân nào." : "No courts yet.";

  const cityHeading = lang === "vi" ? "Sân pickleball theo tỉnh/thành" : "Pickleball courts by city";
  const cityLinks = Object.entries(VENUE_CITY_NAME)
    .map(([sl, nm]) => `<li><a href="${siteUrl}/san/khu-vuc/${sl}">${escapeHtml(nm)}</a></li>`)
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

// ── /san/:slug — detail ─────────────────────────────────────────────────────
export async function renderVenueDetail(
  supabase: SupabaseClient,
  slug: string,
  siteUrl: string,
  lang: Lang = "vi",
): Promise<Response> {
  const { data, error } = await supabase
    .from("venues")
    .select(
      "slug, name, name_vi, address, district, city, country, latitude, longitude, num_courts, surface_type, is_indoor, phone, website",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("renderVenueDetail: lookup error", { slug, error });
  }
  if (!data) return render404(`/san/${slug}`, siteUrl);

  const v = data as unknown as VenueDetailRow;
  const enUrl = `${siteUrl}/san/${v.slug}`;
  const viUrl = `${siteUrl}/vi/san/${v.slug}`;
  const url = lang === "vi" ? viUrl : enUrl;
  const name = displayName(v, lang);
  const addr = fullAddress(v);

  const courtsVi = v.num_courts && v.num_courts > 0 ? `${v.num_courts} sân` : "";
  const courtsEn =
    v.num_courts && v.num_courts > 0 ? `${v.num_courts} court${v.num_courts > 1 ? "s" : ""}` : "";
  const indoorVi = v.is_indoor == null ? "" : v.is_indoor ? "trong nhà" : "ngoài trời";
  const indoorEn = v.is_indoor == null ? "" : v.is_indoor ? "indoor" : "outdoor";

  const title = buildTitle(name, lang === "vi" ? " | Sân Pickleball · ThePickleHub" : " | Pickleball Court · ThePickleHub");
  const fallbackDescVi =
    `Sân pickleball ${name}${addr ? ` tại ${addr}` : ""}` +
    `${courtsVi ? ` — ${courtsVi}` : ""}${indoorVi ? `, ${indoorVi}` : ""}.` +
    " Xem địa chỉ, giờ mở cửa và chỉ đường trên ThePickleHub.";
  const fallbackDescEn =
    `${name} pickleball court${addr ? ` at ${addr}` : ""}` +
    `${courtsEn ? ` — ${courtsEn}` : ""}${indoorEn ? `, ${indoorEn}` : ""}.` +
    " Address, hours and directions on ThePickleHub.";
  const description = pickMetaDescription(null, lang === "vi" ? fallbackDescVi : fallbackDescEn);

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
  };

  const homeLabel = lang === "vi" ? "Trang chủ" : "Home";
  const homeHref = lang === "vi" ? `${siteUrl}/vi` : siteUrl;
  const courtsLabel = lang === "vi" ? "Tìm sân" : "Courts";
  const citySlug = v.city ? CITY_SLUG_BY_NAME[v.city] : undefined;
  const bcCrumbs: { label: string; href?: string }[] = [
    { label: homeLabel, href: homeHref },
    { label: courtsLabel, href: `${siteUrl}/san` },
  ];
  if (citySlug && v.city) {
    bcCrumbs.push({ label: v.city, href: `${siteUrl}/san/khu-vuc/${citySlug}` });
  }
  bcCrumbs.push({ label: name });
  const bc = breadcrumb(bcCrumbs);

  const lbl =
    lang === "vi"
      ? { addr: "Địa chỉ", courts: "Số sân", type: "Loại sân", surface: "Mặt sân", phone: "Điện thoại" }
      : { addr: "Address", courts: "Courts", type: "Type", surface: "Surface", phone: "Phone" };

  const parts: string[] = [bc, `<h1>${escapeHtml(name)}</h1>`];
  if (addr) parts.push(`<p><strong>${lbl.addr}:</strong> ${escapeHtml(addr)}</p>`);
  if (v.num_courts && v.num_courts > 0)
    parts.push(`<p><strong>${lbl.courts}:</strong> ${v.num_courts}</p>`);
  if (v.is_indoor != null)
    parts.push(`<p><strong>${lbl.type}:</strong> ${escapeHtml(lang === "vi" ? indoorVi : indoorEn)}</p>`);
  if (v.surface_type)
    parts.push(`<p><strong>${lbl.surface}:</strong> ${escapeHtml(v.surface_type)}</p>`);
  if (v.phone) parts.push(`<p><strong>${lbl.phone}:</strong> ${escapeHtml(v.phone)}</p>`);
  if (v.website)
    parts.push(`<p><a href="${escapeHtml(v.website)}" rel="nofollow noopener">Website</a></p>`);

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
          .map((n) => `<li><a href="${siteUrl}/san/${escapeHtml(n.slug)}">${escapeHtml(displayName(n, lang))}</a>${n.district ? ` — ${escapeHtml(n.district)}` : ""}</li>`)
          .join("");
        parts.push(`<h2>${escapeHtml(heading)}</h2><ul>${items}</ul>`);
      }
    } catch {
      // non-fatal
    }
    if (citySlug) {
      const allLabel = lang === "vi" ? `Xem tất cả sân pickleball tại ${v.city}` : `See all pickleball courts in ${v.city}`;
      parts.push(`<p><a href="${siteUrl}/san/khu-vuc/${citySlug}">${escapeHtml(allLabel)} →</a></p>`);
    }
  }

  return htmlResponse(
    buildHtml({
      title,
      description,
      url,
      siteUrl,
      jsonLd,
      bodyContent: parts.join("\n"),
      lang,
      alternates: [
        { hreflang: "en", href: enUrl },
        { hreflang: "vi", href: viUrl },
        { hreflang: "x-default", href: enUrl },
      ],
      omitAutoHeader: true,
    }),
  );
}


// ── /san/khu-vuc/:city — per-city hub ───────────────────────────────────────
const VENUE_CITY_NAME: Record<string, string> = {
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

export async function renderVenuesCity(
  supabase: SupabaseClient,
  citySlug: string,
  siteUrl: string,
  lang: Lang,
): Promise<Response> {
  const cityName = VENUE_CITY_NAME[citySlug];
  if (!cityName) return render404(`/san/khu-vuc/${citySlug}`, siteUrl);
  const enUrl = `${siteUrl}/san/khu-vuc/${citySlug}`;
  const viUrl = `${siteUrl}/vi/san/khu-vuc/${citySlug}`;
  const canonical = lang === "vi" ? viUrl : enUrl;

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
      : `${n} pickleball courts in ${cityName}, Vietnam — address, court count, map and directions on ThePickleHub.`;

  const itemsHtml = rows
    .map((v) => {
      const nm = displayName(v, lang);
      const loc = locationLine(v);
      return `<li><a href="${siteUrl}/san/${escapeHtml(v.slug)}">${escapeHtml(nm)}</a>${loc ? ` — ${escapeHtml(loc)}` : ""}</li>`;
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
                addressCountry: "VN",
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
    { label: courtsLabel, href: `${siteUrl}/san` },
    { label: cityName },
  ]);
  const h1 = lang === "vi" ? `Sân Pickleball ${cityName}` : `Pickleball courts in ${cityName}`;
  const emptyMsg = lang === "vi" ? `Chưa có sân nào tại ${cityName}.` : `No courts in ${cityName} yet.`;
  const allLabel = lang === "vi" ? "Tất cả sân pickleball" : "All pickleball courts";

  const bodyContent =
    `${bc}<h1>${escapeHtml(h1)}</h1>` +
    (n > 0 ? `<ul>${itemsHtml}</ul>` : `<p>${escapeHtml(emptyMsg)}</p>`) +
    `<p><a href="${siteUrl}/san">${escapeHtml(allLabel)}</a></p>`;

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
