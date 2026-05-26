// ============================================================================
// useSocialEventMatches / useLogSocialEventMatch / useLinkEventDuprId
// ----------------------------------------------------------------------------
// Wraps RPCs added in migration 20260526120100_social_event_dupr_link_and_match_log:
//
//   - list_social_event_matches       (public read)
//   - log_social_event_match          (organizer or registered player insert)
//   - link_event_dupr_id_by_token     (guest path)
//   - link_event_dupr_id_authed       (authenticated path)
//
// `useMarkMatchSubmittedToDupr` / `useMarkMatchReadyForDupr` được tái sử dụng
// từ `useClubMatches.ts` vì 2 RPC đó (sau migration 20260526120100) đã chấp
// nhận match có `social_event_id` thay vì chỉ club_id. Caller chỉ cần truyền
// `clubId` undefined và queryClient invalidation key dùng eventId qua hook
// `useInvalidateSocialEventMatches`.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SocialEventMatchFormat = "singles" | "doubles" | "mixed";

export interface SocialEventMatchPlayer {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  dupr_id: string | null;
  position: number;
}

export interface SocialEventMatchRow {
  id: string;
  slug: string;
  played_at: string;
  format: SocialEventMatchFormat;
  team_a_score: number[];
  team_b_score: number[];
  winning_team: "a" | "b" | null;
  ready_for_dupr: boolean;
  submitted_to_dupr: boolean;
  dupr_match_id: string | null;
  notes: string | null;
  recorded_by: string;
  team_a_players: SocialEventMatchPlayer[];
  team_b_players: SocialEventMatchPlayer[];
}

export interface LogSocialEventMatchInput {
  format: SocialEventMatchFormat;
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
 * Fetch matches logged trong context của một social event. Public-readable
 * (RPC SECURITY DEFINER + anon EXECUTE grant). Roster mỗi team kèm display_name
 * + dupr_id ưu tiên từ event_registrations.
 */
export function useSocialEventMatches(
  eventId: string | undefined,
  limit = 50,
) {
  const { data: matches = [], isLoading, refetch } = useQuery<SocialEventMatchRow[]>({
    queryKey: ["social-event-matches", eventId, limit],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase.rpc("list_social_event_matches", {
        p_event_id: eventId,
        p_limit: limit,
      });
      if (error) return [];
      return (data ?? []) as SocialEventMatchRow[];
    },
    enabled: Boolean(eventId),
    staleTime: 30_000,
  });

  return { matches, isLoading, refetch };
}

/**
 * Mutation: atomic insert match + participants trong social event. Caller
 * phải là organizer hoặc một registered player có mặt trong team A/B.
 * Returns new match UUID.
 */
export function useLogSocialEventMatch(eventId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<string, MutationError, LogSocialEventMatchInput>({
    mutationFn: async (input) => {
      if (!eventId) throw new Error("missing_event_id");
      const { data, error } = await supabase.rpc("log_social_event_match", {
        p_event_id: eventId,
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
      void queryClient.invalidateQueries({
        queryKey: ["social-event-matches", eventId],
      });
    },
  });
}

export interface LinkEventDuprIdResult {
  registration_id: string;
  event_id: string;
  dupr_id: string | null;
}

/**
 * Mutation: liên kết DUPR id cho registration.
 *  - Authenticated path: gọi link_event_dupr_id_authed (auth.uid()).
 *  - Guest path (magic_token): gọi link_event_dupr_id_by_token.
 * Truyền `magicToken` để chọn guest path; nếu không có, fallback authed.
 */
export function useLinkEventDuprId(eventId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<
    LinkEventDuprIdResult,
    MutationError,
    { duprId: string | null; magicToken?: string | null }
  >({
    mutationFn: async ({ duprId, magicToken }) => {
      if (magicToken) {
        const { data, error } = await supabase.rpc(
          "link_event_dupr_id_by_token",
          { p_magic_token: magicToken, p_dupr_id: duprId },
        );
        if (error) throw toMutationError(error);
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (!row) throw { code: "no_row", message: "no_row" } as MutationError;
        return row as LinkEventDuprIdResult;
      }
      if (!eventId) {
        throw { code: "missing_event_id", message: "missing_event_id" } as MutationError;
      }
      const { data, error } = await supabase.rpc(
        "link_event_dupr_id_authed",
        { p_event_id: eventId, p_dupr_id: duprId },
      );
      if (error) throw toMutationError(error);
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!row) throw { code: "no_row", message: "no_row" } as MutationError;
      return row as LinkEventDuprIdResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["social-event-registrations", eventId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["my-event-registration-dupr", eventId],
      });
    },
  });
}

/**
 * Đọc DUPR id hiện tại của registration. Hai cách:
 *  - Có magicToken (guest) → query qua get_registration_by_token để lấy
 *    registration_id, rồi SELECT event_registrations.dupr_id.
 *  - Authed user → SELECT trực tiếp event_registrations WHERE profile_id=auth.uid().
 *
 * RLS cho SELECT event_registrations cho phép owner (profile_id = auth.uid())
 * đọc. Guest path không thể SELECT trực tiếp nên dùng RPC dedicated.
 */
export function useMyEventDuprId(opts: {
  eventId: string | undefined;
  magicToken: string | null | undefined;
  authedProfileId: string | null | undefined;
}) {
  const { eventId, magicToken, authedProfileId } = opts;

  return useQuery<{ registration_id: string | null; dupr_id: string | null }>({
    queryKey: ["my-event-registration-dupr", eventId, magicToken ?? authedProfileId],
    queryFn: async () => {
      if (!eventId) return { registration_id: null, dupr_id: null };

      if (magicToken) {
        // Guest path — đọc dupr_id qua RPC get_my_event_dupr_by_token để
        // không cần RLS access. Nếu RPC chưa tồn tại, fallback null.
        const { data, error } = await supabase.rpc(
          "get_my_event_dupr_by_token",
          { p_magic_token: magicToken },
        );
        if (error) return { registration_id: null, dupr_id: null };
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (!row) return { registration_id: null, dupr_id: null };
        return {
          registration_id: (row as { registration_id?: string }).registration_id ?? null,
          dupr_id: (row as { dupr_id?: string | null }).dupr_id ?? null,
        };
      }

      if (!authedProfileId) return { registration_id: null, dupr_id: null };

      const { data, error } = await supabase
        .from("event_registrations")
        .select("id, dupr_id")
        .eq("event_id", eventId)
        .eq("profile_id", authedProfileId)
        .neq("status", "cancelled")
        .maybeSingle();
      if (error || !data) return { registration_id: null, dupr_id: null };
      return {
        registration_id: (data as { id: string }).id,
        dupr_id: (data as { dupr_id: string | null }).dupr_id ?? null,
      };
    },
    enabled: Boolean(eventId) && Boolean(magicToken || authedProfileId),
    staleTime: 30_000,
  });
}
