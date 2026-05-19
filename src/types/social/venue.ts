/**
 * Domain type for Venue.
 * Source: supabase/migrations/20260503131017_bet1_social_layer.sql section 3.2.
 */

export interface VenueHours {
  /** Per-day open/close in 24h "HH:MM"; closed if missing. */
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
  sunday?: { open: string; close: string } | null;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  name_vi: string | null;
  address: string | null;
  district: string | null;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  num_courts: number | null;
  surface_type: string | null;
  is_indoor: boolean;
  phone: string | null;
  website: string | null;
  hours_json: VenueHours | null;
  amenities: string[] | null;
  cover_image_url: string | null;
  is_verified: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
