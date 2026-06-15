// ============================================================================
// match-invite-redeem — redeem a match invite token to confirm a proposal
// ----------------------------------------------------------------------------
// The opponent (now signed in, possibly a brand-new account) opens the share
// link /match/confirm/:code and clicks "Xác nhận". This function:
//
//   1. Validates the invite token (pending + not expired).
//   2. Anti-self-confirm: the caller may not be the proposal creator and may
//      not already be a player on the proposal.
//   3. Swaps the ghost placeholder slot in match_proposals.team_{side}_player_ids
//      for the caller's real user id.
//   4. Records the caller's verification (verified_at = now) on their side.
//      The match_proposals trigger then flips status pending_verify → verified
//      (the creator auto-verified at creation time).
//   5. Marks the invitation accepted.
//
// A "dispute" path lets the opponent flag a wrong score instead of confirming.
//
// verify_jwt = false in config.toml; JWT verified internally via getAuthUser.
// ============================================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";

type Action = "confirm" | "dispute";

interface InvitationRow {
  id: string;
  proposal_id: string;
  ghost_profile_id: string | null;
  side: "A" | "B";
  status: string;
  expires_at: string;
  invited_by: string;
}

interface ProposalRow {
  id: string;
  created_by: string;
  status: string;
  team_a_player_ids: string[];
  team_b_player_ids: string[];
}

function err(error: string, status: number, code?: string, details?: unknown) {
  return jsonResponse(
    { error, ...(code ? { code } : {}), ...(details ? { details } : {}) },
    status,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return err("method_not_allowed", 405, "method_not_allowed");

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const user = await getAuthUser(req, supabaseAuth);
  if (!user) return err("unauthorized", 401, "unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: { code?: string; action?: Action; reason?: string };
  try {
    body = await req.json();
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const code = String(body.code ?? "").trim();
  if (!code) return err("missing_code", 400, "missing_code");
  const action: Action = body.action === "dispute" ? "dispute" : "confirm";

  // ─── 1. Load + validate the invitation ──────────────────────────────────
  const { data: inv } = await supabase
    .from("match_proposal_invitations")
    .select("id, proposal_id, ghost_profile_id, side, status, expires_at, invited_by")
    .eq("invite_code", code)
    .maybeSingle<InvitationRow>();

  if (!inv) return err("invite_not_found", 404, "invite_not_found");

  if (inv.status !== "pending") {
    return err("invite_already_used", 409, "invite_already_used", { status: inv.status });
  }

  if (new Date(inv.expires_at).getTime() <= Date.now()) {
    await supabase
      .from("match_proposal_invitations")
      .update({ status: "expired" })
      .eq("id", inv.id)
      .eq("status", "pending");
    return err("invite_expired", 410, "invite_expired");
  }

  // ─── 2. Load proposal + anti-self-confirm guards ────────────────────────
  const { data: proposal } = await supabase
    .from("match_proposals")
    .select("id, created_by, status, team_a_player_ids, team_b_player_ids")
    .eq("id", inv.proposal_id)
    .maybeSingle<ProposalRow>();

  if (!proposal) return err("proposal_not_found", 404, "proposal_not_found");

  if (proposal.created_by === user.id) {
    return err("cannot_confirm_own_match", 403, "cannot_confirm_own_match");
  }

  const alreadyPlayer =
    proposal.team_a_player_ids.includes(user.id) ||
    proposal.team_b_player_ids.includes(user.id);
  if (alreadyPlayer) {
    return err("already_a_player", 409, "already_a_player");
  }

  if (!["pending_verify", "verified", "disputed"].includes(proposal.status)) {
    return err("proposal_locked", 409, "proposal_locked", { status: proposal.status });
  }

  // ─── 3. Swap the ghost slot for the caller's real user id ───────────────
  const column = inv.side === "A" ? "team_a_player_ids" : "team_b_player_ids";
  const currentArr = inv.side === "A" ? proposal.team_a_player_ids : proposal.team_b_player_ids;
  const ghostId = inv.ghost_profile_id;

  // The slot to fill: the ghost placeholder if still present, otherwise the
  // first array element that is not a real registered player we can detect.
  // We only swap when the ghost id is actually in the array (idempotency).
  if (!ghostId || !currentArr.includes(ghostId)) {
    return err("slot_unavailable", 409, "slot_unavailable");
  }
  const newArr = currentArr.map((id) => (id === ghostId ? user.id : id));

  const { error: swapError } = await supabase
    .from("match_proposals")
    .update({ [column]: newArr })
    .eq("id", proposal.id);
  if (swapError) return err("swap_failed", 500, "swap_failed", swapError.message);

  // ─── 4. Record verify / dispute → trigger recomputes proposal status ────
  const now = new Date().toISOString();
  const verifRow =
    action === "confirm"
      ? {
          proposal_id: proposal.id,
          player_user_id: user.id,
          side: inv.side,
          verified_at: now,
          disputed_at: null,
          dispute_reason: null,
        }
      : {
          proposal_id: proposal.id,
          player_user_id: user.id,
          side: inv.side,
          verified_at: null,
          disputed_at: now,
          dispute_reason: String(body.reason ?? "").slice(0, 500) || null,
        };

  const { error: verifError } = await supabase
    .from("match_proposal_verifications")
    .upsert(verifRow, { onConflict: "proposal_id,player_user_id" });
  if (verifError) return err("verify_failed", 500, "verify_failed", verifError.message);

  // ─── 5. Mark the invitation accepted ────────────────────────────────────
  await supabase
    .from("match_proposal_invitations")
    .update({ status: "accepted", invited_user_id: user.id, used_at: now })
    .eq("id", inv.id);

  // Re-read the proposal status (trigger may have flipped it).
  const { data: updated } = await supabase
    .from("match_proposals")
    .select("status")
    .eq("id", proposal.id)
    .maybeSingle<{ status: string }>();

  // Notify the proposal creator that their opponent acted.
  await supabase.from("social_notifications").insert({
    user_id: proposal.created_by,
    type: action === "confirm" ? "match_confirmed" : "match_disputed",
    title:
      action === "confirm"
        ? "Đối thủ đã xác nhận trận đấu"
        : "Đối thủ báo sai tỉ số",
    body:
      action === "confirm"
        ? "Trận đấu đã được xác nhận. Anh có thể gửi lên DUPR khi cả hai đã kết nối."
        : "Hãy kiểm tra lại tỉ số trận đấu.",
    link_url: `/match?tab=history&just=${proposal.id}`,
    payload: {
      proposal_id: proposal.id,
      title_en: action === "confirm" ? "Your opponent confirmed the match" : "Your opponent flagged the score",
    },
  });

  return jsonResponse({
    ok: true,
    action,
    proposal_id: proposal.id,
    status: updated?.status ?? proposal.status,
  });
});
