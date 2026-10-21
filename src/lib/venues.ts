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
  price_min_vnd: number | null;
  price_max_vnd: number | null;
  /** See VENUE_SOURCE_CONTRACT below — 'default' is not a fact about this venue. */
  price_source: VenueSourceTag;
  hours_source: VenueSourceTag;
}

/**
 * VENUE_SOURCE_CONTRACT (PRICE-01, 2026-08-24)
 *
 * `price_source`/`hours_source` record where a figure came from:
 *
 *   'partner' | 'manual' — a real figure for THIS venue.
 *   'default'            — the blanket 80.000–200.000 đ / 06:00–24:00 sitting
 *                          on 753 of 896 rows. Identical across all of them,
 *                          therefore not a fact about any one of them.
 *
 * The bot renderer (functions/_lib/render/venues.ts) already keeps 'default'
 * out of <title>, the meta description and JSON-LD. The same rule has to hold
 * here: a visitor reading "06:00–24:00" on a venue page has no way to know we
 * never checked, and a court that actually shuts at 21:00 has been
 * misrepresented to someone standing outside it.
 */
export type VenueSourceTag = "partner" | "manual" | "default" | null;

export function isVerifiedVenueSource(source: VenueSourceTag): boolean {
  return source === "partner" || source === "manual";
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
  country: string | null;
  num_courts: number | null;
  surface_type: string | null;
  is_indoor: boolean | null;
  cover_image_url: string | null;
  is_verified: boolean | null;
}

export const VENUE_LIST_COLUMNS =
  "id, slug, name, name_vi, address, district, city, country, num_courts, surface_type, is_indoor, cover_image_url, is_verified";

export const VENUE_DETAIL_COLUMNS =
  "id, slug, name, name_vi, address, district, city, country, latitude, longitude, num_courts, surface_type, is_indoor, phone, website, hours_json, amenities, cover_image_url, is_verified, created_by, created_at, updated_at, price_min_vnd, price_max_vnd, price_source, hours_source";

/** 100000 → "100.000đ". Matches longPrice() in the bot renderer. */
export function formatVnd(vnd: number): string {
  return `${Math.round(vnd).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;
}

export function venuePriceRange(
  min: number | null,
  max: number | null,
): string | null {
  if (min == null || max == null) return null;
  return min === max ? formatVnd(min) : `${formatVnd(min)}–${formatVnd(max)}`;
}

/**
 * The import writes the same range on all seven days, so the per-day table
 * renders seven identical rows — which is what production showed before this
 * change. Collapse a uniform week to a single line.
 */
export function uniformWeekHours(
  hoursJson: Record<string, string> | null,
): string | null {
  if (!hoursJson) return null;
  const vals = Object.values(hoursJson).filter((v) => typeof v === "string" && v.trim());
  if (vals.length < 7) return null;
  const first = vals[0].trim();
  return vals.every((v) => v.trim() === first) ? first : null;
}

/** "06:00-24:00" reads better as words than as a clock range. */
export function formatHoursRange(range: string, language: "vi" | "en"): string {
  const flat = range.replace(/\s/g, "");
  if (flat === "00:00-24:00" || flat === "0:00-24:00") {
    return language === "vi" ? "Mở cả ngày" : "Open 24 hours";
  }
  return range;
}

/** Country display label for the /san country tabs. VN-first directory; the
 *  SEA pilot adds SG. Unknown codes fall back to the raw code. */
export function venueCountryLabel(code: string | null, language: Language): string {
  const cc = (code ?? "VN").toUpperCase();
  const labels: Record<string, { vi: string; en: string }> = {
    VN: { vi: "Việt Nam", en: "Vietnam" },
    SG: { vi: "Singapore", en: "Singapore" },
    MY: { vi: "Malaysia", en: "Malaysia" },
    TH: { vi: "Thái Lan", en: "Thailand" },
    BN: { vi: "Brunei", en: "Brunei" },
    PH: { vi: "Philippines", en: "Philippines" },
    ID: { vi: "Indonesia", en: "Indonesia" },
    JP: { vi: "Nhật Bản", en: "Japan" },
    KR: { vi: "Hàn Quốc", en: "South Korea" },
    TW: { vi: "Đài Loan", en: "Taiwan" },
    HK: { vi: "Hồng Kông", en: "Hong Kong" },
    CN: { vi: "Trung Quốc", en: "China" },
    KH: { vi: "Campuchia", en: "Cambodia" },
    LA: { vi: "Lào", en: "Laos" },
    MM: { vi: "Myanmar", en: "Myanmar" },
  };
  return labels[cc]?.[language] ?? cc;
}

/** Order country codes VN-first (95% of the audience), then alphabetical. */
export function sortCountryCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    if (a === "VN") return -1;
    if (b === "VN") return 1;
    return a.localeCompare(b);
  });
}

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
  const parts: string[] = [];
  for (const raw of [v.address, v.district, v.city, v.country]) {
    const t = raw ? raw.trim() : "";
    if (!t) continue;
    const lower = t.toLowerCase();
    // Skip a part already contained in an earlier one (e.g. address ends
    // with the district -> avoid "Quận 1, Quận 1").
    if (parts.some((x) => x.toLowerCase().includes(lower))) continue;
    parts.push(t);
  }
  return parts.join(", ");
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

/**
 * Which parts of the "Price & opening hours" block actually have something to
 * say. Extracted from VenueDetail.tsx as a pure function on purpose.
 *
 * The 2026-08-25 site audit found the section gated on the raw values
 * (`priceText || weekHours || hours.length`) while every row inside it also
 * required a *verified* source. On a 'default'-source venue that combination
 * rendered the heading, an empty `rounded-md border` div — a stray 2px
 * hairline — and then the disclaimer. 684 of 896 courts were in that state,
 * because price_source/hours_source is 'default' on every row the Google
 * Places import could not confirm.
 *
 * The gating was untested: the PRICE-01 tests all exercise the helpers below,
 * and nothing rendered the component, so a condition that contradicted its own
 * children passed review twice. Keeping the decision here means it can be
 * asserted without mounting the page.
 */
export interface VenuePriceHoursVisibility {
  /** The verified price row. */
  priceRow: boolean;
  /** The uniform-week line, or null when there is no verified uniform week. */
  weekHoursRow: string | null;
  /** The per-day rows. Verified sources only — see below. */
  dayRows: boolean;
  /** The bordered container. False means: render no box at all. */
  box: boolean;
  /** "No confirmed rate for this court yet…" */
  disclaimer: boolean;
  /** The whole section, heading included. */
  section: boolean;
}

export function venuePriceHoursVisibility(input: {
  priceText: string | null;
  priceVerified: boolean;
  weekHours: string | null;
  hoursVerified: boolean;
  dayRowCount: number;
}): VenuePriceHoursVisibility {
  const priceRow = Boolean(input.priceText) && input.priceVerified;
  const weekHoursRow = input.hoursVerified ? input.weekHours : null;
  // hoursVerified gates the per-day list too. #666 fixed the uniform-week line
  // and left this one reading hours_json directly, so a non-uniform week on a
  // 'default' source would still print unlabelled times — the exact claim that
  // commit says it stopped making. Not reachable with today's import data; one
  // hand-edited row away from being.
  const dayRows = input.hoursVerified && input.dayRowCount > 0;
  const box = priceRow || weekHoursRow != null || dayRows;
  const disclaimer = Boolean(input.priceText) && !input.priceVerified;
  return { priceRow, weekHoursRow, dayRows, box, disclaimer, section: box || disclaimer };
}
