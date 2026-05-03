/**
 * Domain types for Match + MatchParticipant.
 *
 * Source of truth: supabase/migrations/20260503131017_bet1_social_layer.sql
 * (sections 3.3 + 3.4). DB row shapes live in src/integrations/supabase/types.ts
 * (auto-generated); these domain types add stricter union narrowing for the
 * fields PostgREST returns as plain TEXT (CHECK-constrained but typed wide).
 */

export type MatchFormat = "singles" | "doubles" | "mixed";

export type MatchType = "rec" | "open_play" | "tournament" | "league" | "practice";

export type ScoringFormat = "11_rally" | "11_traditional" | "15_rally" | "21_rally";

export type VerificationStatus =
  | "pending"
  | "verified"
  | "disputed"
  | "rejected"
  | "expired";

export type Team = "a" | "b";

/** Optional fraud-detection meta captured at match creation. */
export interface MatchCreatedMeta {
  ip?: string;
  ua?: string;
  device_fp?: string;
  capacitor_platform?: "ios" | "android" | "web";
}

export interface Match {
  id: string;
  slug: string;
  format: MatchFormat;
  match_type: MatchType;
  venue_id: string | null;
  venue_name_override: string | null;
  court_number: string | null;
  tournament_id: string | null;
  tournament_round: string | null;
  played_at: string;
  duration_minutes: number | null;
  team_a_score: number[];
  team_b_score: number[];
  winning_team: Team | null;
  scoring_format: ScoringFormat;
  verification_status: VerificationStatus;
  verified_at: string | null;
  submitted_to_dupr: boolean;
  dupr_match_id: string | null;
  dupr_submitted_at: string | null;
  notes: string | null;
  weather: string | null;
  is_public: boolean;
  recorded_by: string;
  created_meta: MatchCreatedMeta | null;
  created_at: string;
  updated_at: string;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  player_id: string;
  team: Team;
  position: number | null;
  dupr_rating_before: number | null;
  dupr_rating_after: number | null;
  confirmed: boolean;
  confirmed_at: string | null;
  disputed: boolean;
  dispute_reason: string | null;
  performance_self_rating: 1 | 2 | 3 | 4 | 5 | null;
  created_at: string;
}

/** Match as returned by API for list/detail views — joined with participants. */
export interface MatchWithParticipants extends Match {
  participants: MatchParticipant[];
}
