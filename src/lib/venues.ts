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
