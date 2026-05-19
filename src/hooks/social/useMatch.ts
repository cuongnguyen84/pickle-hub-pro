// ============================================================================
// useMatch — Sprint 2 Phase 3B.1
// ----------------------------------------------------------------------------
// Fetch a match by slug with venue + recorder profile + participants.
// Public: any visitor can read (matches.is_public = true policy).
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type VerificationStatus =
  | "pending"
  | "verified"
  | "disputed"
  | "rejected"
  | "expired";

export interface MatchParticipant {
  player_id: string;
  team: "a" | "b";
  position: number | null;
  confirmed: boolean;
  disputed: boolean;
  dispute_reason: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  dupr_doubles: number | null;
  is_ghost: boolean | null;
}

export interface MatchDetail {
  id: string;
  slug: string;
  format: "singles" | "doubles" | "mixed";
  match_type: string;
  played_at: string;
  duration_minutes: number | null;
  team_a_score: number[];
  team_b_score: number[];
  winning_team: "a" | "b";
  scoring_format: string;
  verification_status: VerificationStatus;
  verified_at: string | null;
  notes: string | null;
  is_public: boolean;
  recorded_by: string;
  created_at: string;
  // Joined
  venue_id: string | null;
  venue_slug: string | null;
  venue_name: string | null;
  venue_city: string | null;
  recorder_username: string | null;
  recorder_display_name: string | null;
  participants: MatchParticipant[];
}

const FUNCTIONS_URL_CONFIRM = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-confirm`;

export function useMatch(slug: string | undefined) {
  return useQuery<MatchDetail | null>({
    queryKey: ["match", slug],
    enabled: !!slug,
    queryFn: async () => {
      if (!slug) return null;
      // Match base + venue + recorder
      const { data: matchRow, error: mErr } = await supabase
        .from("matches")
        .select(
          `id, slug, format, match_type, played_at, duration_minutes,
           team_a_score, team_b_score, winning_team, scoring_format,
           verification_status, verified_at, notes, is_public, recorded_by, created_at,
           venue_id,
           venues:venue_id ( slug, name, city ),
           recorder:profiles!matches_recorded_by_fkey ( username, display_name )`,
        )
        .eq("slug", slug)
        .eq("is_public", true)
        .maybeSingle();
      if (mErr) throw mErr;
      if (!matchRow) return null;
      const match = matchRow as Record<string, unknown>;
      const venue = match.venues as { slug: string; name: string; city: string } | null;
      const recorder = match.recorder as { username: string | null; display_name: string | null } | null;

      // Participants + their profile basics
      const { data: parts } = await supabase
        .from("match_participants")
        .select(
          `player_id, team, position, confirmed, disputed, dispute_reason,
           profile:profiles!match_participants_player_id_fkey ( username, display_name, avatar_url, dupr_doubles, is_ghost )`,
        )
        .eq("match_id", match.id as string)
        .order("team", { ascending: true })
        .order("position", { ascending: true });

      const participants: MatchParticipant[] = (parts ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const p = (r.profile ?? {}) as {
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          dupr_doubles?: number | null;
          is_ghost?: boolean | null;
        };
        return {
          player_id: r.player_id as string,
          team: r.team as "a" | "b",
          position: (r.position as number) ?? null,
          confirmed: Boolean(r.confirmed),
          disputed: Boolean(r.disputed),
          dispute_reason: (r.dispute_reason as string) ?? null,
          username: p.username ?? null,
          display_name: p.display_name ?? null,
          avatar_url: p.avatar_url ?? null,
          dupr_doubles: p.dupr_doubles ?? null,
          is_ghost: p.is_ghost ?? null,
        };
      });

      return {
        id: match.id as string,
        slug: match.slug as string,
        format: match.format as MatchDetail["format"],
        match_type: match.match_type as string,
        played_at: match.played_at as string,
        duration_minutes: (match.duration_minutes as number) ?? null,
        team_a_score: match.team_a_score as number[],
        team_b_score: match.team_b_score as number[],
        winning_team: match.winning_team as "a" | "b",
        scoring_format: match.scoring_format as string,
        verification_status: match.verification_status as VerificationStatus,
        verified_at: (match.verified_at as string) ?? null,
        notes: (match.notes as string) ?? null,
        is_public: Boolean(match.is_public),
        recorded_by: match.recorded_by as string,
        created_at: match.created_at as string,
        venue_id: (match.venue_id as string) ?? null,
        venue_slug: venue?.slug ?? null,
        venue_name: venue?.name ?? null,
        venue_city: venue?.city ?? null,
        recorder_username: recorder?.username ?? null,
        recorder_display_name: recorder?.display_name ?? null,
        participants,
      };
    },
  });
}

interface ConfirmInput { match_id: string; }
interface DisputeInput { match_id: string; dispute_reason: string; }

async function callConfirmAction(body: { match_id: string; action: "confirm" | "dispute"; dispute_reason?: string }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Bạn cần đăng nhập");
  const r = await fetch(FUNCTIONS_URL_CONFIRM, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
  }
  return data;
}

export function useMatchConfirm(slug: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmInput) =>
      callConfirmAction({ match_id: input.match_id, action: "confirm" }),
    onSuccess: () => {
      toast({ title: "Đã xác nhận trận đấu" });
      if (slug) qc.invalidateQueries({ queryKey: ["match", slug] });
    },
    onError: (err) => {
      toast({
        title: "Không xác nhận được",
        description: err instanceof Error ? err.message : "Lỗi không xác định",
        variant: "destructive",
      });
    },
  });
}

export function useMatchDispute(slug: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DisputeInput) =>
      callConfirmAction({ match_id: input.match_id, action: "dispute", dispute_reason: input.dispute_reason }),
    onSuccess: () => {
      toast({ title: "Đã gửi yêu cầu tranh chấp", description: "Recorder sẽ nhận thông báo." });
      if (slug) qc.invalidateQueries({ queryKey: ["match", slug] });
    },
    onError: (err) => {
      toast({
        title: "Không gửi được dispute",
        description: err instanceof Error ? err.message : "Lỗi không xác định",
        variant: "destructive",
      });
    },
  });
}
