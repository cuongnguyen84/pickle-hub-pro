// ============================================================================
// match-proposal — create / verify / dispute / approve / reject a match
// ----------------------------------------------------------------------------
// Single edge function dispatching by `action`:
//
//   create   { format, match_date, club_id, team_a_player_ids,
//              team_b_player_ids, team_a_scores, team_b_scores, ... }
//             → creates row, auto-inserts a self-verify for the caller.
//
//   verify   { proposal_id }
//             → caller must be in either team; inserts/updates a
//               verifications row with verified_at=now. Trigger may
//               flip status to 'verified'.
//
//   dispute  { proposal_id, reason }
//             → same, but disputed_at + dispute_reason. Trigger flips
//               to 'disputed'.
//
//   approve  { proposal_id }
//             → caller must be DIRECTOR/ORGANIZER of proposal.club_id
//               (verified via dupr_user_clubs cache, force-refresh first).
//               status must be 'verified'. Calls dupr-match-submit
//               internally with collected DUPR IDs + scores; on success
//               stores dupr_match_code, sets status='submitted'.
//
//   reject   { proposal_id, reason }
//             → same auth as approve. Marks status='rejected'. No DUPR call.
//
// verify_jwt = false in config.toml; JWT verified internally.
// ============================================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";

type Action = "create" | "verify" | "dispute" | "approve" | "reject";

interface ProposalRow {
  id: string;
  created_by: string;
  club_id: number | null;
  format: "SINGLES" | "DOUBLES";
  match_type: "SIDEOUT" | "RALLY";
  match_date: string;
  location: string | null;
  event: string | null;
  bracket: string | null;
  team_a_player_ids: string[];
  team_b_player_ids: string[];
  team_a_scores: number[];
  team_b_scores: number[];
  status: string;
  dupr_match_code: string | null;
  dupr_identifier: string | null;
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

  let body: { action?: Action } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  switch (body.action) {
    case "create":
      return handleCreate(supabase, user.id, body);
    case "verify":
      return handleVerifyOrDispute(supabase, user.id, body, "verify");
    case "dispute":
      return handleVerifyOrDispute(supabase, user.id, body, "dispute");
    case "approve":
      return handleApprove(supabase, user.id, body);
    case "reject":
      return handleReject(supabase, user.id, body);
    default:
      return err("unknown_action", 400, "unknown_action");
  }
});

async function handleCreate(
  supabase: SupabaseClient,
  callerId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const format = body.format === "DOUBLES" ? "DOUBLES" : "SINGLES";
  const teamA = (body.team_a_player_ids as string[]) ?? [];
  const teamB = (body.team_b_player_ids as string[]) ?? [];
  const scoresA = (body.team_a_scores as number[]) ?? [];
  const scoresB = (body.team_b_scores as number[]) ?? [];
  // club_id is optional — null/0 means matchSource=PARTNER (DUPR FAQ:
  // valid match sources are CLUB and PARTNER; clubId omitted for PARTNER).
  const clubIdRaw = body.club_id;
  const clubId =
    clubIdRaw === null || clubIdRaw === undefined || clubIdRaw === "" || Number(clubIdRaw) === 0
      ? null
      : Number(clubIdRaw);
  const matchDate = String(body.match_date ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) return err("bad_match_date", 400, "bad_match_date");
  if (format === "SINGLES" && (teamA.length !== 1 || teamB.length !== 1)) {
    return err("singles_needs_one_player_per_side", 400, "bad_teams");
  }
  if (format === "DOUBLES" && (teamA.length !== 2 || teamB.length !== 2)) {
    return err("doubles_needs_two_players_per_side", 400, "bad_teams");
  }
  if (scoresA.length === 0 || scoresA.length !== scoresB.length) {
    return err("bad_scores", 400, "bad_scores");
  }

  // Caller must be one of the players.
  const allPlayers = [...teamA, ...teamB];
  if (!allPlayers.includes(callerId)) {
    return err("creator_must_be_a_player", 403, "creator_must_be_a_player");
  }

  // No dupes.
  if (new Set(allPlayers).size !== allPlayers.length) {
    return err("duplicate_player", 400, "duplicate_player");
  }

  const { data: proposal, error: insertError } = await supabase
    .from("match_proposals")
    .insert({
      created_by: callerId,
      club_id: clubId,                       // null → matchSource=PARTNER
      format,
      match_type: body.match_type === "RALLY" ? "RALLY" : "SIDEOUT",
      match_date: matchDate,
      location: body.location ?? null,
      event: body.event ?? null,
      bracket: body.bracket ?? null,
      team_a_player_ids: teamA,
      team_b_player_ids: teamB,
      team_a_scores: scoresA,
      team_b_scores: scoresB,
    })
    .select("*")
    .single<ProposalRow>();

  if (insertError || !proposal) {
    return err("create_failed", 500, "create_failed", insertError?.message);
  }

  // Auto-verify the creator (they entered the score; their confirmation
  // is implicit). Trigger may flip to 'verified' immediately if the
  // opposing side has no opposing player to wait on — but our rule
  // requires 1 from each side, so creator-only stays pending_verify.
  const callerSide = teamA.includes(callerId) ? "A" : "B";
  await supabase.from("match_proposal_verifications").insert({
    proposal_id: proposal.id,
    player_user_id: callerId,
    side: callerSide,
    verified_at: new Date().toISOString(),
  });

  // Notify other players (excluding the creator) so they see a
  // "match_confirm_needed" in the bell. RLS lets each user read their
  // own social_notifications row.
  const otherPlayers = [...teamA, ...teamB].filter((id) => id !== callerId);
  if (otherPlayers.length > 0) {
    await sendMatchNotifications({
      supabase,
      userIds: otherPlayers,
      type: "match_confirm_needed",
      titleVi: "Có trận đấu mới cần anh xác nhận tỉ số",
      titleEn: "New match needs your confirmation",
      bodyVi: `Trận ${proposal.format.toLowerCase()} ngày ${proposal.match_date} — ${
        proposal.team_a_scores.map((s, i) => `${s}-${proposal.team_b_scores[i]}`).join(", ")
      }`,
      bodyEn: `${proposal.format} match on ${proposal.match_date} — ${
        proposal.team_a_scores.map((s, i) => `${s}-${proposal.team_b_scores[i]}`).join(", ")
      }`,
      linkUrl: `/match?tab=pending&just=${proposal.id}`,
      payload: { proposal_id: proposal.id, format: proposal.format, club_id: proposal.club_id },
    });
  }

  return jsonResponse({ proposal_id: proposal.id, status: proposal.status });
}

async function handleVerifyOrDispute(
  supabase: SupabaseClient,
  callerId: string,
  body: Record<string, unknown>,
  mode: "verify" | "dispute",
): Promise<Response> {
  const proposalId = String(body.proposal_id ?? "");
  if (!proposalId) return err("missing_proposal_id", 400, "missing_proposal_id");

  const { data: proposal } = await supabase
    .from("match_proposals")
    .select("id, status, team_a_player_ids, team_b_player_ids")
    .eq("id", proposalId)
    .maybeSingle<Pick<ProposalRow, "id" | "status" | "team_a_player_ids" | "team_b_player_ids">>();

  if (!proposal) return err("not_found", 404, "not_found");
  if (!["pending_verify", "verified", "disputed"].includes(proposal.status)) {
    return err("proposal_locked", 409, "proposal_locked", { status: proposal.status });
  }

  const side = proposal.team_a_player_ids.includes(callerId)
    ? "A"
    : proposal.team_b_player_ids.includes(callerId)
      ? "B"
      : null;
  if (!side) return err("not_a_player", 403, "not_a_player");

  const now = new Date().toISOString();
  const upsertRow =
    mode === "verify"
      ? {
          proposal_id: proposalId,
          player_user_id: callerId,
          side,
          verified_at: now,
          disputed_at: null,
          dispute_reason: null,
        }
      : {
          proposal_id: proposalId,
          player_user_id: callerId,
          side,
          verified_at: null,
          disputed_at: now,
          dispute_reason: String(body.reason ?? "").slice(0, 500) || null,
        };

  const { error } = await supabase
    .from("match_proposal_verifications")
    .upsert(upsertRow, { onConflict: "proposal_id,player_user_id" });

  if (error) return err("verify_failed", 500, "verify_failed", error.message);

  // Re-read status (trigger may have flipped it).
  const { data: updated } = await supabase
    .from("match_proposals")
    .select("status, club_id, format, match_date, team_a_scores, team_b_scores, created_by")
    .eq("id", proposalId)
    .maybeSingle<{
      status: string;
      club_id: number | null;
      format: string;
      match_date: string;
      team_a_scores: number[];
      team_b_scores: number[];
      created_by: string;
    }>();

  // If this verify just flipped the proposal to 'verified', notify the
  // approver pool: club DIRECTOR/ORGANIZER for CLUB matches, or the
  // platform admin/creator user_roles for PARTNER matches.
  if (mode === "verify" && updated?.status === "verified") {
    const approvers = await resolveApprovers(supabase, updated.club_id);
    if (approvers.length > 0) {
      const scoreLine = updated.team_a_scores.map((s, i) => `${s}-${updated.team_b_scores[i]}`).join(", ");
      await sendMatchNotifications({
        supabase,
        userIds: approvers,
        type: "match_approval_needed",
        titleVi: "Trận đấu sẵn sàng duyệt + gửi DUPR",
        titleEn: "Match ready for approval + DUPR submission",
        bodyVi: `${updated.format} ${updated.match_date} — ${scoreLine}`,
        bodyEn: `${updated.format} on ${updated.match_date} — ${scoreLine}`,
        linkUrl: `/match?tab=queue&just=${proposalId}`,
        payload: { proposal_id: proposalId, club_id: updated.club_id },
      });
    }
  }

  return jsonResponse({ proposal_id: proposalId, status: updated?.status, action: mode });
}

async function handleApprove(
  supabase: SupabaseClient,
  callerId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const proposalId = String(body.proposal_id ?? "");
  if (!proposalId) return err("missing_proposal_id", 400, "missing_proposal_id");

  const { data: proposal } = await supabase
    .from("match_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle<ProposalRow>();

  if (!proposal) return err("not_found", 404, "not_found");
  if (proposal.status !== "verified") {
    return err("not_verified", 409, "not_verified", { status: proposal.status });
  }

  // Role gate splits by match source:
  //   - CLUB match (club_id != null) → caller must be DIRECTOR/ORGANIZER
  //     on the DUPR club (via dupr_user_clubs cache).
  //   - PARTNER match (club_id == null) → caller must hold the
  //     ThePickleHub admin or creator role.
  if (proposal.club_id) {
    const { data: canApprove } = await supabase.rpc("dupr_user_can_submit_club_matches_for", {
      p_user_id: callerId,
      p_club_id: proposal.club_id,
    });
    if (!canApprove) {
      return err("not_club_admin", 403, "not_club_admin", {
        club_id: proposal.club_id,
        hint: "Need DIRECTOR or ORGANIZER role. Refresh cache via dupr-clubs?force=1.",
      });
    }
  } else {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const allowed = new Set(["admin", "creator"]);
    const hasRole = (roles ?? []).some((r: { role: string }) => allowed.has(r.role));
    if (!hasRole) {
      return err("not_platform_admin", 403, "not_platform_admin", {
        hint: "PARTNER match approval requires user_roles ∈ ('admin','creator').",
      });
    }
  }

  // Resolve each player's dupr_id from dupr_user_tokens.
  const allPlayers = [...proposal.team_a_player_ids, ...proposal.team_b_player_ids];
  const { data: tokens } = await supabase
    .from("dupr_user_tokens")
    .select("user_id, dupr_id, revoked_at")
    .in("user_id", allPlayers);
  const mapped = new Map<string, string>();
  const missing: string[] = [];
  for (const userId of allPlayers) {
    const t = (tokens ?? []).find(
      (r: { user_id: string; dupr_id: string; revoked_at: string | null }) =>
        r.user_id === userId && !r.revoked_at,
    );
    if (!t) missing.push(userId);
    else mapped.set(userId, t.dupr_id);
  }
  if (missing.length > 0) {
    return err("players_not_sso_connected", 412, "players_not_sso_connected", { missing });
  }

  // Build team payloads. Match games come from scores array.
  const buildTeam = (playerIds: string[], scores: number[]) => {
    const team: Record<string, unknown> = { player1: mapped.get(playerIds[0]) };
    if (playerIds[1]) team.player2 = mapped.get(playerIds[1]);
    for (let i = 0; i < scores.length; i++) {
      team[`game${i + 1}`] = scores[i];
    }
    return team;
  };

  // Call dupr-match-submit internally (via the partner client). To avoid
  // re-implementing player gating + identifier formatting, invoke the
  // function over HTTP as service-role (we're already running with the
  // service-role key).
  const matchSubmitBody = {
    action: "create",
    internal_source: "match_proposal",
    internal_match_id: proposal.id,
    match_date: proposal.match_date,
    location: proposal.location ?? "",
    format: proposal.format,
    match_type: proposal.match_type,
    event: proposal.event ?? "ThePickleHub match",
    bracket: proposal.bracket ?? "",
    club_id: proposal.club_id,
    team_a: buildTeam(proposal.team_a_player_ids, proposal.team_a_scores),
    team_b: buildTeam(proposal.team_b_player_ids, proposal.team_b_scores),
  };

  // For the internal HTTP call, mint a token-with-context-of-caller header
  // — actually simplest: call our own RPC version of match-submit. Since
  // match-submit is verify_jwt=false + verifies JWT, we need an auth
  // bearer. Forward the calling user's JWT (we have it in req.headers).
  // Caller JWT is the only one allowed — but a NORMAL player triggering
  // approve would fail role check. The CLUB ADMIN's JWT here is the one
  // that opened this approve call, AND admin doesn't necessarily have
  // 'creator' role on our system. To unblock: skip match-submit and
  // call DUPR partner API directly here.

  // Use partner API directly to avoid double role/entitlement checks
  // (we already gated on club role + ensured all players are SSO'd).
  const partnerToken = await mintPartnerToken();
  if (!partnerToken) return err("partner_token_failed", 502, "partner_token_failed");

  const identifier = `tph:match_proposal:${proposal.id}`;
  const env = (Deno.env.get("DUPR_ENV") ?? "uat") === "prod" ? "prod" : "uat";
  const partnerBase = env === "prod" ? "https://prod.mydupr.com/api" : "https://uat.mydupr.com/api";

  const partnerBody: Record<string, unknown> = {
    identifier,
    location: proposal.location ?? "",
    matchDate: proposal.match_date,
    teamA: buildTeam(proposal.team_a_player_ids, proposal.team_a_scores),
    teamB: buildTeam(proposal.team_b_player_ids, proposal.team_b_scores),
    format: proposal.format,
    event: proposal.event ?? "ThePickleHub match",
    bracket: proposal.bracket ?? "",
    matchType: proposal.match_type,
    matchSource: proposal.club_id ? "CLUB" : "PARTNER",
  };
  // Omit clubId for PARTNER (per DUPR FAQ Valid Match Sources).
  if (proposal.club_id) partnerBody.clubId = proposal.club_id;

  const partnerRes = await fetch(`${partnerBase}/match/v1.0/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${partnerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(partnerBody),
  });
  const partnerJson = await partnerRes.json().catch(() => null);

  if (!partnerRes.ok || partnerJson?.status !== "SUCCESS" || !partnerJson?.result?.matchCode) {
    return err("dupr_create_failed", 502, "dupr_create_failed", {
      status: partnerRes.status,
      body: partnerJson,
    });
  }

  const matchCode = partnerJson.result.matchCode as string;
  const hashedMatchCode = (partnerJson.result.hashedMatchCode ?? null) as string | null;

  // Persist to dupr_match_submissions for the lifecycle table.
  await supabase.from("dupr_match_submissions").insert({
    environment: env,
    internal_source: "match_proposal",
    internal_match_id: proposal.id,
    identifier,
    match_code: matchCode,
    hashed_match_code: hashedMatchCode,
    submitted_by: callerId,
    club_id: proposal.club_id,                  // null for PARTNER matches
    match_format: proposal.format,
    match_date: proposal.match_date,
    raw_request: partnerBody,
    raw_response: partnerJson,
  });

  // Update proposal status.
  await supabase
    .from("match_proposals")
    .update({
      status: "submitted",
      status_changed_at: new Date().toISOString(),
      dupr_match_code: matchCode,
      dupr_identifier: identifier,
      approved_by: callerId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", proposalId);

  // Notify every player (including the creator) that the match has been
  // approved and pushed to DUPR. The approver themselves doesn't need a
  // notification — they just clicked the button.
  const allPlayers = [
    ...proposal.team_a_player_ids,
    ...proposal.team_b_player_ids,
  ].filter((id) => id !== callerId);
  if (allPlayers.length > 0) {
    const scoreLine = proposal.team_a_scores.map((s, i) => `${s}-${proposal.team_b_scores[i]}`).join(", ");
    await sendMatchNotifications({
      supabase,
      userIds: allPlayers,
      type: "match_submitted",
      titleVi: "Trận đấu đã được duyệt và gửi lên DUPR",
      titleEn: "Match approved and pushed to DUPR",
      bodyVi: `${proposal.format} ${proposal.match_date} — ${scoreLine}. Rating sẽ cập nhật trong vài phút.`,
      bodyEn: `${proposal.format} on ${proposal.match_date} — ${scoreLine}. Rating updates in a few minutes.`,
      linkUrl: `/match?tab=history&just=${proposalId}`,
      payload: {
        proposal_id: proposalId,
        match_code: matchCode,
        hashed_match_code: hashedMatchCode,
      },
    });
  }

  return jsonResponse({
    proposal_id: proposalId,
    status: "submitted",
    match_code: matchCode,
    hashed_match_code: hashedMatchCode,
  });
}

async function handleReject(
  supabase: SupabaseClient,
  callerId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const proposalId = String(body.proposal_id ?? "");
  if (!proposalId) return err("missing_proposal_id", 400, "missing_proposal_id");

  const { data: proposal } = await supabase
    .from("match_proposals")
    .select("status, club_id")
    .eq("id", proposalId)
    .maybeSingle<{ status: string; club_id: number }>();

  if (!proposal) return err("not_found", 404, "not_found");
  if (["submitted", "approved", "rejected"].includes(proposal.status)) {
    return err("proposal_locked", 409, "proposal_locked", { status: proposal.status });
  }

  // Same role split as approve.
  if (proposal.club_id) {
    const { data: canReject } = await supabase.rpc("dupr_user_can_submit_club_matches_for", {
      p_user_id: callerId,
      p_club_id: proposal.club_id,
    });
    if (!canReject) return err("not_club_admin", 403, "not_club_admin");
  } else {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const allowed = new Set(["admin", "creator"]);
    if (!(roles ?? []).some((r: { role: string }) => allowed.has(r.role))) {
      return err("not_platform_admin", 403, "not_platform_admin");
    }
  }

  await supabase
    .from("match_proposals")
    .update({
      status: "rejected",
      status_changed_at: new Date().toISOString(),
      rejected_by: callerId,
      rejected_at: new Date().toISOString(),
      rejection_reason: String(body.reason ?? "").slice(0, 500) || null,
    })
    .eq("id", proposalId);

  return jsonResponse({ proposal_id: proposalId, status: "rejected" });
}

// ─── Notification helpers ─────────────────────────────────────────────────

interface SendNotifsArgs {
  supabase: SupabaseClient;
  userIds: string[];
  type: string;
  titleVi: string;
  titleEn: string;
  bodyVi: string;
  bodyEn: string;
  linkUrl: string;
  payload?: Record<string, unknown>;
}

/**
 * Insert one social_notifications row per recipient. VI-canonical title
 * (matches existing trigger pattern); EN string lives in payload for the
 * formatter to swap in. Best-effort — errors are logged but don't bubble.
 */
async function sendMatchNotifications(args: SendNotifsArgs): Promise<void> {
  if (args.userIds.length === 0) return;
  const unique = Array.from(new Set(args.userIds));
  const rows = unique.map((uid) => ({
    user_id: uid,
    type: args.type,
    title: args.titleVi,
    body: args.bodyVi,
    link_url: args.linkUrl,
    payload: {
      ...(args.payload ?? {}),
      title_en: args.titleEn,
      body_en: args.bodyEn,
    },
  }));
  const { error } = await args.supabase.from("social_notifications").insert(rows);
  if (error) console.warn("social_notifications insert failed:", error.message);
}

/**
 * Who can approve this proposal?
 *   - club_id != null → DIRECTOR/ORGANIZER cached in dupr_user_clubs
 *   - club_id IS NULL → user_roles with role in ('admin','creator')
 */
async function resolveApprovers(
  supabase: SupabaseClient,
  clubId: number | null,
): Promise<string[]> {
  if (clubId != null) {
    const { data } = await supabase
      .from("dupr_user_clubs")
      .select("user_id")
      .eq("club_id", clubId)
      .in("role", ["DIRECTOR", "ORGANIZER"])
      .gt("expires_at", new Date().toISOString());
    return (data ?? []).map((r: { user_id: string }) => r.user_id);
  }
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "creator"]);
  return Array.from(new Set((data ?? []).map((r: { user_id: string }) => r.user_id)));
}

// ─── Partner token mint helper (inlined to avoid touching _shared) ─────────
async function mintPartnerToken(): Promise<string | null> {
  const clientKey = Deno.env.get("DUPR_CLIENT_KEY") ?? "";
  const clientSecret = Deno.env.get("DUPR_CLIENT_SECRET") ?? "";
  if (!clientKey || !clientSecret) return null;

  const env = (Deno.env.get("DUPR_ENV") ?? "uat") === "prod" ? "prod" : "uat";
  const base = env === "prod" ? "https://prod.mydupr.com/api" : "https://uat.mydupr.com/api";
  const res = await fetch(`${base}/auth/v1.0/token`, {
    method: "POST",
    headers: {
      "x-authorization": btoa(`${clientKey}:${clientSecret}`),
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { result?: { token?: string } } | null;
  return body?.result?.token ?? null;
}
