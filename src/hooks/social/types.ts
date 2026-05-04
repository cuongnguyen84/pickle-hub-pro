// Shared types for Bet #1 wizard hooks
export interface Venue {
  id: string;
  slug: string;
  name: string;
  name_vi: string | null;
  city: string;
  district: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  num_courts: number | null;
  surface_type: string | null;
  is_indoor: boolean | null;
  is_verified: boolean | null;
}

export interface PlayerProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  dupr_doubles: number | null;
  is_ghost: boolean | null;
  city: string | null;
}

export interface MatchCreateInput {
  format: "singles" | "doubles" | "mixed";
  match_type: "rec" | "open_play" | "tournament" | "league" | "practice";
  venue_id: string | null;
  venue_name_override: string | null;
  played_at: string;
  team_a_score: number[];
  team_b_score: number[];
  scoring_format: "11_rally" | "11_traditional" | "15_rally" | "21_rally";
  participants: Array<{ player_id: string; team: "a" | "b"; position: number }>;
  notes: string | null;
  device_meta: { capacitor_platform: string; device_fp: string } | null;
  tournament_id?: string | null;
}

export interface MatchCreateResponse {
  match: {
    id: string;
    slug: string;
    verification_status: string;
  };
  notifications_sent: number;
  url: string;
}
