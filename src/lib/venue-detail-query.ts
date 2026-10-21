import { supabase } from "@/integrations/supabase/client";
import { type Venue, VENUE_DETAIL_COLUMNS } from "@/lib/venues";

export const venueDetailQueryKey = (slug: string | undefined) => ["venue", slug] as const;

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
