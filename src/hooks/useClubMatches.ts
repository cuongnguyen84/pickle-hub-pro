// ============================================================================
// useClubMatches / useLogClubMatch / useMarkMatchReadyForDupr
// ----------------------------------------------------------------------------
// Wraps the RPCs added in migration 20260525120000_club_match_log.sql:
//   - list_club_matches             (public read)
//   - log_club_match                (organizer-only insert)
//   - mark_match_ready_for_dupr     (organizer-only toggle)
//
// Player picker pulls from useClubMembers (active rows only) so this hook
// intentionally does NOT fetch members itself — caller wires them in.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MatchFormat = "singles" | "doubles" | "mixed";

export type ClubPlayerRole = "creator" | "manager" | "member";

export interface ClubEligiblePlayer {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  dupr_id: string | null;
  role: ClubPlayerRole;
}

export interface ClubMatchPlayer {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  dupr_id: string | null;
  position: number;
}

export interface ClubMatchRow {
  id: string;
  slug: string;
  played_at: string;
  format: MatchFormat;
  team_a_score: number[];
  team_b_score: number[];
  winning_team: "a" | "b" | null;
  ready_for_dupr: boolean;
  submitted_to_dupr: boolean;
  dupr_match_id: string | null;
  notes: string | null;
  team_a_players: ClubMatchPlayer[];
  team_b_players: ClubMatchPlayer[];
}

export interface LogClubMatchInput {
  format: MatchFormat;
  playedAt: string; // ISO 8601
  teamAScore: number[];
  teamBScore: number[];
  teamAPlayers: string[];
  teamBPlayers: string[];
  notes?: string;
  courtNumber?: string;
  scoringFormat?: "11_rally" | "11_traditional" | "15_rally" | "21_rally";
}

export interface MutationError {
  code: string;
  message: string;
}

function toMutationError(error: unknown): MutationError {
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message?: unknown }).message ?? "").trim();
    return { code: msg, message: msg };
  }
  return { code: "unknown", message: "Unknown error" };
}

/**
 * Fetch the union of creator + managers + active members for a CLB.
 * Used by the log-match player picker so any organizer / member can be
 * tagged in a match. Public-readable (RPC is SECURITY DEFINER + anon grant).
 */
export function useClubEligiblePlayers(clubId: string | undefined) {
  const { data: players = [], isLoading, refetch } = useQuery<ClubEligiblePlayer[]>({
    queryKey: ["club-eligible-players", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.rpc("list_club_eligible_players", {
        p_club_id: clubId,
      });
      if (error) return [];
      return (data ?? []) as ClubEligiblePlayer[];
    },
    enabled: Boolean(clubId),
    staleTime: 30_000,
  });

  return { players, isLoading, refetch };
}

/**
 * Fetch matches logged against a CLB plus per-team player rosters.
 * Public-readable (RPC is SECURITY DEFINER with anon EXECUTE grant).
 */
export function useClubMatches(clubId: string | undefined, limit = 50) {
  const { data: matches = [], isLoading, refetch } = useQuery<ClubMatchRow[]>({
    queryKey: ["club-matches", clubId, limit],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.rpc("list_club_matches", {
        p_club_id: clubId,
        p_limit: limit,
      });
      if (error) return [];
      return (data ?? []) as ClubMatchRow[];
    },
    enabled: Boolean(clubId),
    staleTime: 30_000,
  });

  return { matches, isLoading, refetch };
}

/**
 * Organizer-only mutation: atomic insert of a match + participants.
 * Returns the new match UUID.
 */
export function useLogClubMatch(clubId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<string, MutationError, LogClubMatchInput>({
    mutationFn: async (input) => {
      if (!clubId) throw new Error("missing_club_id");
      const { data, error } = await supabase.rpc("log_club_match", {
        p_club_id: clubId,
        p_format: input.format,
        p_played_at: input.playedAt,
        p_team_a_score: input.teamAScore,
        p_team_b_score: input.teamBScore,
        p_team_a_players: input.teamAPlayers,
        p_team_b_players: input.teamBPlayers,
        p_notes: input.notes ?? null,
        p_court_number: input.courtNumber ?? null,
        p_scoring_format: input.scoringFormat ?? "11_rally",
      });
      if (error) throw toMutationError(error);
      return String(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["club-matches", clubId] });
    },
  });
}

/**
 * Organizer-only mutation: flip ready_for_dupr on/off. Refuses if the
 * match has already been submitted to DUPR (server-side check).
 */
export function useMarkMatchReadyForDupr(clubId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<
    boolean,
    MutationError,
    { matchId: string; ready: boolean }
  >({
    mutationFn: async ({ matchId, ready }) => {
      const { data, error } = await supabase.rpc("mark_match_ready_for_dupr", {
        p_match_id: matchId,
        p_ready: ready,
      });
      if (error) throw toMutationError(error);
      return Boolean(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["club-matches", clubId] });
    },
  });
}
