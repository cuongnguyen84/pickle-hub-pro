// ============================================================================
// match-confirm — Sprint 2 verification flow
// ----------------------------------------------------------------------------
// Bet #1 spec rule: a pending match becomes 'verified' ONLY when ≥1 OPPONENT
// TEAM participant confirms — not just any non-creator. Teammate-only
// confirmation must NOT verify (regression test from Sprint 1 seed match
// a2222222-0005).
//
// Edge case: if recorded_by is NOT in participants (recorder logged on
// someone's behalf), there is no "creator team" → any non-recorder
// participant confirmation is sufficient.
//
// Disputes flag the match for moderation and notify the recorder.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getAuthUser, corsHeaders, jsonResponse } from "../_shared/auth.ts";

interface ConfirmBody {
  match_id?: string;
  action?: "confirm" | "dispute";
  dispute_reason?: string;
}

interface Participant {
  player_id: string;
  team: "a" | "b";
  position: number | null;
  confirmed: boolean;
  disputed: boolean;
}

interface MatchRow {
  id: string;
  slug: string;
  format: string;
  recorded_by: string;
  verification_status: string;
  played_at: string;
  venue_name_override: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function err(error: string, status: number, code?: string, details?: unknown) {
  return jsonResponse(
    { error, ...(code ? { code } : {}), ...(details ? { details } : {}) },
    status,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const user = await getAuthUser(req, supabaseAuth);
  if (!user) return err("unauthorized", 401);

  // service_role for cross-user UPDATE / notifications INSERT
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: ConfirmBody;
  try {
    body = (await req.json()) as ConfirmBody;
  } catch {
    return err("invalid_json", 400);
  }

  if (!body.match_id || !UUID_RE.test(body.match_id)) {
    return err("match_id must be a valid UUID", 400, "invalid_match_id");
  }
  if (body.action !== "confirm" && body.action !== "dispute") {
    return err("action must be 'confirm' or 'dispute'", 400, "invalid_action");
  }
  if (body.action === "dispute") {
    if (
      !body.dispute_reason ||
      typeof body.dispute_reason !== "string" ||
      body.dispute_reason.trim().length === 0
    ) {
      return err(
        "dispute_reason required when action='dispute'",
        400,
        "missing_dispute_reason",
      );
    }
    if (body.dispute_reason.length > 500) {
      return err(
        "dispute_reason max 500 chars",
        400,
        "dispute_reason_too_long",
      );
    }
  }

  // ─── Fetch match + participants ─────────────────────────────────────────
  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select(
      "id, slug, format, recorded_by, verification_status, played_at, venue_name_override",
    )
    .eq("id", body.match_id)
    .maybeSingle<MatchRow>();

  if (matchErr) {
    console.error(
      JSON.stringify({
        function: "match-confirm",
        user_id: user.id,
        error: matchErr.message,
        context: { match_id: body.match_id, step: "fetch_match" },
      }),
    );
    return err("match_fetch_failed", 500);
  }
  if (!match) return err("match not found", 404, "match_not_found");

  if (match.verification_status !== "pending") {
    return err(
      `Match already ${match.verification_status}, cannot ${body.action}`,
      409,
      "invalid_state",
      { current_status: match.verification_status },
    );
  }

  const { data: participants, error: pErr } = await supabase
    .from("match_participants")
    .select("player_id, team, position, confirmed, disputed")
    .eq("match_id", match.id);

  if (pErr) {
    console.error(
      JSON.stringify({
        function: "match-confirm",
        user_id: user.id,
        error: pErr.message,
        context: { match_id: body.match_id, step: "fetch_participants" },
      }),
    );
    return err("participants_fetch_failed", 500);
  }
  const allParticipants = (participants ?? []) as Participant[];

  const userParticipant = allParticipants.find(
    (p) => p.player_id === user.id,
  );
  if (!userParticipant) {
    return err("Not a participant", 403, "not_participant");
  }

  // ─── DISPUTE branch ─────────────────────────────────────────────────────
  if (body.action === "dispute") {
    const { error: updErr } = await supabase
      .from("match_participants")
      .update({
        disputed: true,
        dispute_reason: body.dispute_reason,
      })
      .eq("match_id", match.id)
      .eq("player_id", user.id);
    if (updErr) {
      console.error(
        JSON.stringify({
          function: "match-confirm",
          user_id: user.id,
          error: updErr.message,
          context: { match_id: match.id, step: "dispute_update_participant" },
        }),
      );
      return err("dispute_update_failed", 500);
    }

    const { error: matchUpdErr } = await supabase
      .from("matches")
      .update({
        verification_status: "disputed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);
    if (matchUpdErr) {
      console.error(
        JSON.stringify({
          function: "match-confirm",
          user_id: user.id,
          error: matchUpdErr.message,
          context: { match_id: match.id, step: "dispute_update_match" },
        }),
      );
      return err("dispute_match_update_failed", 500);
    }

    // Notify recorder (skip if recorder is the disputer themselves)
    if (match.recorded_by !== user.id) {
      const { data: recorderProfile } = await supabase
        .from("profiles")
        .select("is_ghost")
        .eq("id", match.recorded_by)
        .maybeSingle<{ is_ghost: boolean | null }>();
      if (!recorderProfile?.is_ghost) {
        const { data: disputerProfile } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", user.id)
          .maybeSingle<{ username: string | null; display_name: string | null }>();
        const disputerName =
          disputerProfile?.display_name ||
          disputerProfile?.username ||
          "Một người chơi";
        await supabase.from("social_notifications").insert({
          user_id: match.recorded_by,
          type: "match_disputed",
          title: `${disputerName} đang dispute trận của bạn`,
          body: body.dispute_reason ?? "",
          link_url: `/tran-dau/${match.slug}`,
          payload: {
            match_id: match.id,
            match_slug: match.slug,
            dispute_reason: body.dispute_reason,
          },
          is_read: false,
        });
      }
    }

    return jsonResponse({
      match_id: match.id,
      verification_status: "disputed",
      user_disputed: true,
      dispute_reason: body.dispute_reason,
    });
  }

  // ─── CONFIRM branch ─────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("match_participants")
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    })
    .eq("match_id", match.id)
    .eq("player_id", user.id);
  if (updateErr) {
    console.error(
      JSON.stringify({
        function: "match-confirm",
        user_id: user.id,
        error: updateErr.message,
        context: { match_id: match.id, step: "confirm_update" },
      }),
    );
    return err("confirm_update_failed", 500);
  }

  // ─── CRITICAL: opponent-team rule ───────────────────────────────────────
  // Re-fetch participants to get the just-updated confirmed flag.
  const { data: refreshed, error: refreshErr } = await supabase
    .from("match_participants")
    .select("player_id, team, position, confirmed, disputed")
    .eq("match_id", match.id);
  if (refreshErr) {
    return err("participants_refetch_failed", 500);
  }
  const updated = (refreshed ?? []) as Participant[];

  const creatorParticipant = updated.find(
    (p) => p.player_id === match.recorded_by,
  );
  const creatorTeam = creatorParticipant?.team ?? null;
  const opponentTeam =
    creatorTeam === "a" ? "b" : creatorTeam === "b" ? "a" : null;

  const creatorTeamConfirmed = creatorTeam
    ? updated.filter((p) => p.team === creatorTeam && p.confirmed).length
    : 0;

  // If recorder NOT in participants, "opponent" = any non-recorder participant.
  const opponentTeamConfirmed = opponentTeam
    ? updated.filter((p) => p.team === opponentTeam && p.confirmed).length
    : updated.filter(
        (p) => p.player_id !== match.recorded_by && p.confirmed,
      ).length;

  let newStatus: "pending" | "verified" = "pending";

  if (opponentTeamConfirmed >= 1) {
    newStatus = "verified";
    const { error: matchUpdErr } = await supabase
      .from("matches")
      .update({
        verification_status: "verified",
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);
    if (matchUpdErr) {
      console.error(
        JSON.stringify({
          function: "match-confirm",
          user_id: user.id,
          error: matchUpdErr.message,
          context: { match_id: match.id, step: "verify_match_update" },
        }),
      );
      // Don't fail the request — confirmation succeeded, status update can retry
    } else {
      // Notify all OTHER participants that match is now verified
      const targets = updated.filter((p) => p.player_id !== user.id);
      if (targets.length > 0) {
        const targetIds = targets.map((t) => t.player_id);
        const { data: targetProfiles } = await supabase
          .from("profiles")
          .select("id, is_ghost")
          .in("id", targetIds);
        const realIds = (targetProfiles ?? [])
          .filter((p) => !(p as { is_ghost: boolean | null }).is_ghost)
          .map((p) => (p as { id: string }).id);

        if (realIds.length > 0) {
          const dateStr = new Date(match.played_at).toLocaleDateString(
            "vi-VN",
            { timeZone: "Asia/Ho_Chi_Minh" },
          );
          const venueLabel = match.venue_name_override ?? "";
          await supabase.from("social_notifications").insert(
            realIds.map((id) => ({
              user_id: id,
              type: "match_verified",
              title: "Trận của bạn đã được xác nhận",
              body: `Trận ${match.format} ${venueLabel} ${dateStr} đã verified`,
              link_url: `/tran-dau/${match.slug}`,
              payload: { match_id: match.id, match_slug: match.slug },
              is_read: false,
            })),
          );
        }
      }
    }
  }

  return jsonResponse({
    match_id: match.id,
    verification_status: newStatus,
    user_confirmed: true,
    creator_team_confirmed_count: creatorTeamConfirmed,
    opponent_team_confirmed_count: opponentTeamConfirmed,
  });
});
