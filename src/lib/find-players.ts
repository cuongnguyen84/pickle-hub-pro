// ============================================================================
// Find players ("Tìm bạn chơi") — shared types + helpers.
// Backing: public.profiles (+ looking_for_game opt-in), play_requests,
// conversations/messages. Auth-gated, noindex (private utility, not SEO).
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The new find-players tables (play_requests, conversations, messages),
 *  the profiles.looking_for_game columns and the RPCs are not in the
 *  generated Database types yet — use an untyped client view and cast
 *  results at the call site. Regenerate types.ts to remove this later. */
export const sbFindPlayers: SupabaseClient = supabase as unknown as SupabaseClient;

export type Language = "vi" | "en";

export interface PlayerListItem {
  id: string;
  username: string | null;
  profile_slug: string | null;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  dupr_doubles: number | null;
  dupr_singles: number | null;
  self_rating: number | null;
  skill_level: string | null;
  favorite_venue_id: string | null;
  looking_for_game: boolean | null;
  looking_for_game_note: string | null;
}

export const PLAYER_LIST_COLUMNS =
  "id, username, profile_slug, display_name, avatar_url, city, bio, dupr_doubles, dupr_singles, self_rating, skill_level, favorite_venue_id, looking_for_game, looking_for_game_note";

export interface PlayRequestAuthor {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile_slug: string | null;
}
export interface PlayRequest {
  id: string;
  author_id: string;
  city: string | null;
  district: string | null;
  venue_id: string | null;
  skill_min: number | null;
  skill_max: number | null;
  play_at: string | null;
  note: string;
  status: string;
  created_at: string;
  author?: PlayRequestAuthor | null;
  venue?: { slug: string; name: string } | null;
}

export interface Conversation {
  conversation_id: string;
  other_id: string;
  other_username: string | null;
  other_name: string | null;
  other_avatar: string | null;
  last_body: string | null;
  last_at: string;
  unread_count: number;
}
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export function playerName(p: { display_name: string | null; username: string | null }): string {
  return (p.display_name && p.display_name.trim()) || p.username || "Người chơi";
}
export function playerProfileSlug(p: { profile_slug: string | null; username: string | null }): string | null {
  return p.profile_slug || p.username || null;
}
export function playerInitial(name: string): string {
  return (name.trim()[0] || "?").toUpperCase();
}

/** Best available skill label: DUPR doubles > self rating > skill_level text. */
export function ratingLabel(
  p: { dupr_doubles: number | null; self_rating: number | null; skill_level: string | null },
  language: Language,
): string | null {
  if (p.dupr_doubles != null) return `DUPR ${p.dupr_doubles.toFixed(2)}`;
  if (p.self_rating != null) return `${language === "vi" ? "Trình" : "Self"} ${p.self_rating.toFixed(1)}`;
  if (p.skill_level) return p.skill_level;
  return null;
}
