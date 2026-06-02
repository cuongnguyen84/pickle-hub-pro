// ============================================================================
// useResolvableDisputes / useResolveMatchDispute
// ----------------------------------------------------------------------------
// Wraps the RPCs from migration 20260602020000_match_dispute_resolution.sql.
//
// A disputed match (verification_status='disputed') can be resolved by a
// platform admin OR the organizer/manager of the match's club:
//   - "accept" keeps the logged score and verifies it.
//   - "edit"   overrides the score, then verifies it.
// After the RPC succeeds we push the (now verified) match to DUPR via the
// existing dupr-match-submit edge function — the resolver is admin/organizer
// so its role gate passes. The DUPR push is best-effort and never blocks the
// resolution.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MatchFormat } from "@/hooks/useClubMatches";

export interface DisputePlayer {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  dupr_id: string | null;
  position: number;
}

export interface DisputeReason {
  player_id: string;
  name: string | null;
  team: "a" | "b";
  reason: string | null;
}

export interface ResolvableDispute {
  id: string;
  slug: string;
  club_id: string | null;
  club_slug: string | null;
  club_name: string | null;
  played_at: string;
  format: MatchFormat;
  team_a_score: number[];
  team_b_score: number[];
  winning_team: "a" | "b" | null;
  recorded_by: string;
  recorded_by_name: string | null;
  dispute_reasons: DisputeReason[];
  team_a_players: DisputePlayer[];
  team_b_players: DisputePlayer[];
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
 * Disputed matches the signed-in user may resolve. Admin → all; club
 * organizer/manager → their club's disputes. Empty for everyone else.
 */
export function useResolvableDisputes() {
  const { data = [], isLoading, refetch } = useQuery<ResolvableDispute[]>({
    queryKey: ["resolvable-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_resolvable_disputes");
      if (error) return [];
      // Cast via unknown: types.ts predates this RPC so its inferred return
      // type doesn't overlap with ResolvableDispute[].
      return (data ?? []) as unknown as ResolvableDispute[];
    },
    staleTime: 15_000,
  });
  return { disputes: data, isLoading, refetch };
}

export interface ResolveDisputeInput {
  dispute: ResolvableDispute;
  action: "accept" | "edit";
  /** Final scores — required when action='edit'. */
  teamAScore?: number[];
  teamBScore?: number[];
}

export interface ResolveDisputeResult {
  matchId: string;
  dupr: {
    ok: boolean;
    matchCode?: string;
    skipped?: boolean;
    reason?: string;
  };
}

/** Best-effort DUPR submit of a freshly-verified match (mirrors SubmitDuprDialog). */
async function submitToDupr(
  dispute: ResolvableDispute,
  aScores: number[],
  bScores: number[],
): Promise<ResolveDisputeResult["dupr"]> {
  const allPlayers = [...dispute.team_a_players, ...dispute.team_b_players];
  if (
    allPlayers.length === 0 ||
    allPlayers.some((p) => !p.dupr_id) ||
    aScores.length < 1 ||
    aScores.length !== bScores.length
  ) {
    return { ok: false, skipped: true, reason: "preflight" };
  }
  const totalGames = aScores.length;
  const buildTeam = (players: DisputePlayer[], scores: number[]) => {
    const out: Record<string, unknown> = { player1: players[0]?.dupr_id };
    if (players.length > 1) out.player2 = players[1]?.dupr_id;
    for (let i = 0; i < totalGames; i++) out[`game${i + 1}`] = scores[i];
    return out;
  };
  try {
    const { data, error } = await supabase.functions.invoke<{
      match_code?: string;
      error?: string;
      message?: string;
    }>("dupr-match-submit", {
      body: {
        action: "create",
        internal_source: dispute.club_id ? "club_match" : "match",
        internal_match_id: dispute.id,
        match_date: dispute.played_at.slice(0, 10),
        location: dispute.club_id ? "ThePickleHub CLB" : "ThePickleHub",
        format: dispute.format === "singles" ? "SINGLES" : "DOUBLES",
        match_type: "SIDEOUT",
        event: dispute.club_id ? "ThePickleHub CLB match" : "ThePickleHub match",
        bracket: "",
        team_a: buildTeam(dispute.team_a_players, aScores),
        team_b: buildTeam(dispute.team_b_players, bScores),
      },
    });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      let detail = error.message ?? "submit_failed";
      if (ctx) {
        try {
          const b = await ctx.clone().json();
          detail = b.error ?? b.message ?? b.code ?? detail;
        } catch {
          /* keep default */
        }
      }
      return { ok: false, reason: detail };
    }
    if (!data?.match_code) {
      return { ok: false, reason: data?.error ?? data?.message ?? "no_match_code" };
    }
    return { ok: true, matchCode: data.match_code };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "submit_failed" };
  }
}

/**
 * Resolve a disputed match (accept or edit), then best-effort push to DUPR.
 */
export function useResolveMatchDispute() {
  const queryClient = useQueryClient();

  return useMutation<ResolveDisputeResult, MutationError, ResolveDisputeInput>({
    mutationFn: async (input) => {
      const isEdit = input.action === "edit";
      const aScores = isEdit ? input.teamAScore ?? [] : input.dispute.team_a_score;
      const bScores = isEdit ? input.teamBScore ?? [] : input.dispute.team_b_score;

      if (isEdit) {
        if (
          aScores.length < 1 ||
          aScores.length !== bScores.length ||
          [...aScores, ...bScores].some((s) => !Number.isFinite(s) || s < 0)
        ) {
          throw { code: "invalid_scores", message: "Tỉ số không hợp lệ" } as MutationError;
        }
      }

      const { error } = await supabase.rpc("resolve_match_dispute", {
        p_match_id: input.dispute.id,
        p_action: input.action,
        p_team_a_score: isEdit ? aScores : null,
        p_team_b_score: isEdit ? bScores : null,
      });
      if (error) throw toMutationError(error);

      const dupr = await submitToDupr(input.dispute, aScores, bScores);
      return { matchId: input.dispute.id, dupr };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resolvable-disputes"] });
      void queryClient.invalidateQueries({ queryKey: ["club-matches"] });
      void queryClient.invalidateQueries({ queryKey: ["my-pending-confirmations"] });
    },
  });
}
