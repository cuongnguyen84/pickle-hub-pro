import { supabase } from "@/integrations/supabase/client";
import { type Venue, VENUE_DETAIL_COLUMNS } from "@/lib/venues";

export const venueDetailQueryKey = (slug: string | undefined) => ["venue", slug] as const;

interface VenueInitialPayload {
  slug: string;
  venue: Venue;
}

export function readVenueInitialData(slug: string | undefined): Venue | undefined {
  if (!slug || typeof document === "undefined") return undefined;
  const node = document.getElementById("__TPH_VENUE_DATA__");
  if (!node?.textContent) return undefined;
  try {
    const payload = JSON.parse(node.textContent) as VenueInitialPayload;
    return payload.slug === slug && payload.venue?.slug === slug ? payload.venue : undefined;
  } catch {
    return undefined;
  }
}

/** Shared by VenueDetail and VenueCard intent-prefetching. */
export async function fetchVenueDetail(slug: string | undefined): Promise<Venue | null> {
  if (!slug) return null;
  const { data, error } = await supabase
    .from("venues")
    .select(VENUE_DETAIL_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("VenueDetail: fetch error", error);
    return null;
  }
  return (data as Venue | null) ?? null;
}
