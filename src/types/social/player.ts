/**
 * Domain types for Player (= profile + social fields added in Sprint 1).
 *
 * `profiles` table is shared with the rest of the app; the columns added
 * by 20260503131017_bet1_social_layer.sql are typed here to give Bet #1
 * code a narrower view than the auto-generated DB row.
 */

export type DominantHand = "left" | "right" | "ambi";
export type PreferredLanguage = "vi" | "en";

export interface Player {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  country: string;
  dominant_hand: DominantHand | null;
  preferred_paddle: string | null;
  dupr_id: string | null;
  dupr_singles: number | null;
  dupr_doubles: number | null;
  dupr_synced_at: string | null;
  self_rating: number | null;
  is_pro: boolean;
  is_verified: boolean;
  is_ghost: boolean;
  phone: string | null;
  preferred_language: PreferredLanguage;
}

/** Snapshot of a player's DUPR rating on a given match. */
export interface DUPRRating {
  singles: number | null;
  doubles: number | null;
  synced_at: string | null;
}

/**
 * Last-N matches form indicator. Used by FormIndicator.tsx to render the
 * W/L sparkline on player profiles. Order: most-recent → oldest.
 */
export interface FormIndicator {
  results: ("W" | "L")[];
  win_rate: number;
  matches_count: number;
}
