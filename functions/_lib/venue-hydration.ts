import type { SupabaseClient } from "./supabase";

const VENUE_DETAIL_COLUMNS =
  "id, slug, name, name_vi, address, district, city, country, latitude, longitude, num_courts, surface_type, is_indoor, phone, website, hours_json, amenities, cover_image_url, is_verified, created_by, created_at, updated_at";

export const VENUE_DATA_ELEMENT_ID = "__TPH_VENUE_DATA__";

/** JSON safe inside a raw-text script element, including hostile venue names. */
export function serializeVenuePayload(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function injectVenuePayload(html: string, slug: string, venue: unknown): string {
  const json = serializeVenuePayload({ slug, venue });
  const node = `<script id="${VENUE_DATA_ELEMENT_ID}" type="application/json">${json}</script>`;
  return html.includes("</body>") ? html.replace("</body>", `${node}</body>`) : `${html}${node}`;
}

export async function fetchVenueHydrationData(
  supabase: SupabaseClient,
  slug: string,
): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("venues")
    .select(VENUE_DETAIL_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
