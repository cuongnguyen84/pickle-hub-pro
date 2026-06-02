// ============================================================================
// Venues (court finder / "Tìm sân") — shared types + helpers.
// ----------------------------------------------------------------------------
// Backing table `public.venues` (RLS: public read, authenticated insert with
// created_by = auth.uid(), creator update). Used by:
//   - src/pages/VenuesList.tsx        (/san)
//   - src/pages/VenueDetail.tsx       (/san/:slug)
//   - src/pages/VenueSubmit.tsx       (/san/them)
//   - src/components/venues/VenueCard.tsx
// SSR mirror lives in functions/_lib/render/venues.ts.
// ============================================================================

export type Language = "vi" | "en";

/** Full venue row (detail page). */
export interface Venue {
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
  hours_json: Record<string, string> | null;
  amenities: string[] | null;
  cover_image_url: string | null;
  is_verified: boolean | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Lightweight row for the /san grid. */
export interface VenueListItem {
  id: string;
  slug: string;
  name: string;
  name_vi: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  num_courts: number | null;
  surface_type: string | null;
  is_indoor: boolean | null;
  cover_image_url: string | null;
  is_verified: boolean | null;
}

export const VENUE_LIST_COLUMNS =
  "id, slug, name, name_vi, address, district, city, num_courts, surface_type, is_indoor, cover_image_url, is_verified";

export const VENUE_DETAIL_COLUMNS =
  "id, slug, name, name_vi, address, district, city, country, latitude, longitude, num_courts, surface_type, is_indoor, phone, website, hours_json, amenities, cover_image_url, is_verified, created_by, created_at, updated_at";

/** Prefer the Vietnamese name for VI viewers, fall back to the base name. */
export function venueDisplayName(
  v: Pick<VenueListItem, "name" | "name_vi">,
  language: Language,
): string {
  if (language === "vi" && v.name_vi && v.name_vi.trim().length > 0) {
    return v.name_vi;
  }
  return v.name;
}

/** "District, City" — skips empty parts. */
export function venueLocationLine(
  v: Pick<VenueListItem, "district" | "city" | "address">,
): string {
  const parts = [v.district, v.city].filter(
    (p): p is string => Boolean(p && p.trim().length > 0),
  );
  if (parts.length > 0) return parts.join(", ");
  return v.address ?? "";
}

/** Full address string for geocoding / Google Maps query fallback. */
export function venueFullAddress(
  v: Pick<Venue, "address" | "district" | "city" | "country">,
): string {
  return [v.address, v.district, v.city, v.country]
    .filter((p): p is string => Boolean(p && p.trim().length > 0))
    .join(", ");
}

/**
 * Google Maps directions URL. Prefers exact coordinates; falls back to a
 * text address search so a freshly-submitted (ungeocoded) venue still gets
 * a working "Chỉ đường" button.
 */
export function venueDirectionsUrl(v: Venue): string {
  if (v.latitude != null && v.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${v.latitude},${v.longitude}`;
  }
  const q = encodeURIComponent(venueFullAddress(v) || v.name);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * OpenStreetMap embed URL (no API key required). Returns null when the
 * venue has no coordinates so callers can hide the map.
 */
export function venueOsmEmbedUrl(v: Venue): string | null {
  if (v.latitude == null || v.longitude == null) return null;
  const lat = v.latitude;
  const lon = v.longitude;
  const d = 0.006; // ~600m bbox
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}

const SURFACE_LABELS: Record<string, { vi: string; en: string }> = {
  acrylic: { vi: "Sơn Acrylic", en: "Acrylic" },
  hard: { vi: "Sân cứng", en: "Hard court" },
  asphalt: { vi: "Nhựa đường", en: "Asphalt" },
  concrete: { vi: "Bê tông", en: "Concrete" },
  wood: { vi: "Sàn gỗ", en: "Wood" },
  synthetic: { vi: "Thảm nhựa tổng hợp", en: "Synthetic" },
  other: { vi: "Khác", en: "Other" },
};

export const SURFACE_OPTIONS = Object.keys(SURFACE_LABELS);

export function surfaceLabel(value: string | null, language: Language): string {
  if (!value) return "";
  const entry = SURFACE_LABELS[value.toLowerCase()];
  if (!entry) return value;
  return language === "vi" ? entry.vi : entry.en;
}

export function courtsLabel(
  n: number | null | undefined,
  language: Language,
): string {
  const count = n ?? 0;
  if (count <= 0) return language === "vi" ? "Chưa rõ số sân" : "Courts: n/a";
  return language === "vi"
    ? `${count} sân`
    : `${count} court${count > 1 ? "s" : ""}`;
}

export function indoorLabel(
  isIndoor: boolean | null | undefined,
  language: Language,
): string {
  if (isIndoor == null) return "";
  if (isIndoor) return language === "vi" ? "Trong nhà" : "Indoor";
  return language === "vi" ? "Ngoài trời" : "Outdoor";
}

/** Strip Vietnamese diacritics → URL-safe slug. Mirrors CreateClub.slugify. */
function slugifyBase(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Venue slug = "<name>-<city>" (matches the existing seed rows like
 * "tang-bat-ho-ha-noi"). City suffix is skipped when the name slug already
 * ends with it so we don't double up.
 */
export function slugifyVenue(name: string, city: string): string {
  const base = slugifyBase(name);
  const citySlug = slugifyBase(city);
  if (!citySlug || base.endsWith(citySlug)) return base.slice(0, 80);
  return `${base}-${citySlug}`.slice(0, 80);
}


// ── City directory (court-finder hubs /san/khu-vuc/:city) ───────────────────
export interface VenueCity {
  slug: string;
  name: string;
}
/** Cities with ≥1 venue, ordered by court count desc. Used by the /san hub
 *  links and the /san/khu-vuc/:city landing pages. Regenerate from
 *  public.venues when the directory grows. */
export const VENUE_CITIES: VenueCity[] = [
  { slug: "tp-hcm", name: "TP.HCM" },
  { slug: "ha-noi", name: "Hà Nội" },
  { slug: "da-nang", name: "Đà Nẵng" },
  { slug: "bac-ninh", name: "Bắc Ninh" },
  { slug: "ha-long", name: "Hạ Long" },
  { slug: "vinh", name: "Vinh" },
  { slug: "nam-dinh", name: "Nam Định" },
  { slug: "thanh-hoa", name: "Thanh Hóa" },
  { slug: "binh-duong", name: "Bình Dương" },
  { slug: "can-tho", name: "Cần Thơ" },
  { slug: "pleiku", name: "Pleiku" },
  { slug: "vung-tau", name: "Vũng Tàu" },
  { slug: "bac-giang", name: "Bắc Giang" },
  { slug: "bao-loc", name: "Bảo Lộc" },
  { slug: "cao-bang", name: "Cao Bằng" },
  { slug: "lang-son", name: "Lạng Sơn" },
  { slug: "buon-ma-thuot", name: "Buôn Ma Thuột" },
  { slug: "dong-hoi", name: "Đồng Hới" },
  { slug: "ha-tinh", name: "Hà Tĩnh" },
  { slug: "hai-duong", name: "Hải Dương" },
  { slug: "hai-phong", name: "Hải Phòng" },
  { slug: "nha-trang", name: "Nha Trang" },
  { slug: "quy-nhon", name: "Quy Nhơn" },
  { slug: "tay-ninh", name: "Tây Ninh" },
  { slug: "vinh-yen", name: "Vĩnh Yên" },
  { slug: "bien-hoa", name: "Biên Hòa" },
  { slug: "cao-lanh", name: "Cao Lãnh" },
  { slug: "da-lat", name: "Đà Lạt" },
  { slug: "hue", name: "Huế" },
  { slug: "lao-cai", name: "Lào Cai" },
  { slug: "long-xuyen", name: "Long Xuyên" },
  { slug: "ninh-binh", name: "Ninh Bình" },
  { slug: "phan-rang", name: "Phan Rang" },
  { slug: "quang-ngai", name: "Quảng Ngãi" },
  { slug: "son-la", name: "Sơn La" },
  { slug: "thai-nguyen", name: "Thái Nguyên" },
  { slug: "tuy-hoa", name: "Tuy Hòa" },
  { slug: "ca-mau", name: "Cà Mau" },
  { slug: "dien-bien-phu", name: "Điện Biên Phủ" },
  { slug: "dong-ha", name: "Đông Hà" },
  { slug: "phu-quoc", name: "Phú Quốc" },
  { slug: "rach-gia", name: "Rạch Giá" },
  { slug: "viet-tri", name: "Việt Trì" },
  { slug: "vinh-long", name: "Vĩnh Long" },
  { slug: "ben-tre", name: "Bến Tre" },
  { slug: "chau-doc", name: "Châu Đốc" },
  { slug: "dong-xoai", name: "Đồng Xoài" },
  { slug: "ha-giang", name: "Hà Giang" },
  { slug: "hoi-an", name: "Hội An" },
  { slug: "my-hao", name: "Mỹ Hào" },
  { slug: "phan-thiet", name: "Phan Thiết" },
  { slug: "sam-son", name: "Sầm Sơn" },
  { slug: "thai-binh", name: "Thái Bình" },
  { slug: "tra-vinh", name: "Trà Vinh" },
  { slug: "tuyen-quang", name: "Tuyên Quang" },
  { slug: "uong-bi", name: "Uông Bí" },
  { slug: "yen-bai", name: "Yên Bái" },
  { slug: "cam-pha", name: "Cẩm Phả" },
  { slug: "hoa-binh", name: "Hòa Bình" },
  { slug: "hung-ha", name: "Hưng Hà" },
  { slug: "moc-chau", name: "Mộc Châu" },
  { slug: "my-tho", name: "Mỹ Tho" },
  { slug: "phu-ly", name: "Phủ Lý" },
  { slug: "sa-dec", name: "Sa Đéc" },
  { slug: "soc-trang", name: "Sóc Trăng" },
  { slug: "van-giang", name: "Văn Giang" },
  { slug: "van-lam", name: "Văn Lâm" },
  { slug: "chau-hung", name: "Châu Hưng" },
  { slug: "chi-linh", name: "Chí Linh" },
  { slug: "gia-nghia", name: "Gia Nghĩa" },
  { slug: "kon-tum", name: "Kon Tum" },
  { slug: "mai-chau", name: "Mai Châu" },
  { slug: "phu-yen", name: "Phù Yên" },
  { slug: "phuc-yen", name: "Phúc Yên" },
  { slug: "quynh-phu", name: "Quỳnh Phụ" },
  { slug: "sa-pa", name: "Sa Pa" },
  { slug: "tam-ky", name: "Tam Kỳ" },
  { slug: "tan-an", name: "Tân An" },
  { slug: "thanh-son", name: "Thanh Sơn" },
  { slug: "tran-yen", name: "Trấn Yên" },
  { slug: "vi-xuyen", name: "Vị Xuyên" },
  { slug: "vinh-chau", name: "Vĩnh Châu" },
  { slug: "yen-my", name: "Yên Mỹ" },
];
const VENUE_CITY_NAME_BY_SLUG: Record<string, string> = Object.fromEntries(
  VENUE_CITIES.map((c) => [c.slug, c.name]),
);
/** Resolve a /san/khu-vuc/:city slug back to its display city name. */
export function cityNameFromSlug(slug: string): string | null {
  return VENUE_CITY_NAME_BY_SLUG[slug] ?? null;
}
const VENUE_CITY_SLUG_BY_NAME: Record<string, string> = Object.fromEntries(
  VENUE_CITIES.map((c) => [c.name, c.slug]),
);
/** Resolve a display city name to its /san/khu-vuc/:city slug. */
export function citySlugFromName(name: string | null | undefined): string | null {
  return name ? VENUE_CITY_SLUG_BY_NAME[name] ?? null : null;
}
