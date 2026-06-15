// ============================================================================
// useMatchInvite — read/redeem a match invite-to-confirm token (Phase A)
// ----------------------------------------------------------------------------
// The public /match/confirm/:code page uses these to (a) preview the match
// behind an invite token without auth (get_match_invite RPC, SECURITY DEFINER)
// and (b) redeem it once the opponent is signed in (match-invite-redeem edge
// function, which swaps the ghost slot + records their verification).
// ============================================================================
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvitePlayerLite {
  display_name: string | null;
  avatar_url: string | null;
}

export interface InvitePreview {
  found: boolean;
  invite_code?: string;
  /** invitation_status: pending | accepted | rejected | expired | cancelled */
  status?: string;
  expired?: boolean;
  side?: "A" | "B";
  proposal_id?: string;
  /** match_proposal_status: pending_verify | verified | disputed | ... */
  match_status?: string;
  format?: "SINGLES" | "DOUBLES";
  match_date?: string;
  location?: string | null;
  team_a_scores?: number[];
  team_b_scores?: number[];
  inviter?: InvitePlayerLite | null;
  slot_name?: string | null;
  team_a?: InvitePlayerLite[];
  team_b?: InvitePlayerLite[];
}

export interface RedeemResult {
  ok: boolean;
  action: "confirm" | "dispute";
  proposal_id: string;
  status: string;
}

/** Preview a match invite by its share-link token. No auth required. */
export function useInvitePreview(code: string | undefined) {
  return useQuery({
    queryKey: ["match-invite", code],
    enabled: !!code,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<InvitePreview> => {
      const { data, error } = await supabase.rpc("get_match_invite", {
        p_code: code as string,
      });
      if (error) throw error;
      return (data ?? { found: false }) as unknown as InvitePreview;
    },
  });
}

/** Redeem (confirm or dispute) a match invite. Requires the caller to be signed in. */
export function useRedeemInvite() {
  return useMutation({
    mutationFn: async (vars: {
      code: string;
      action: "confirm" | "dispute";
      reason?: string;
    }): Promise<RedeemResult> => {
      const { data, error } = await supabase.functions.invoke("match-invite-redeem", {
        body: vars,
      });
      if (error) throw error;
      return data as RedeemResult;
    },
  });
}
