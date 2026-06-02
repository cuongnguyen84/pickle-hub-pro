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
//
// ----------------------------------------------------------------------------
// 2026-06-02 — UNIFY the two confirmation state machines + auto-submit DUPR
// ----------------------------------------------------------------------------
// The `matches` table carries TWO parallel confirmation fields:
//   - verification_status   (pending → verified)        — THIS function
//   - confirmation_status   (pending_opponent_confirm → confirmed)
//                                                       — confirm_club_match RPC
// A CLB match logged by a regular member sets BOTH. Previously, confirming
// through this (social) surface only advanced verification_status, leaving
// the CLB list — which reads confirmation_status via list_club_matches —
// stuck on "Chờ đối thủ xác nhận" forever. We now flip BOTH here so every
// confirmation surface agrees.
//
// Per product decision (2026-06-02): when an opponent confirms, the match
// is auto-submitted to DUPR for ALL users (not just admins/organizers).
// dupr-match-submit carries a matching "confirmed-participant" bypass. The
// submit is best-effort — a failure never fails the confirm itself; the row
// is left ready_for_dupr=true so an admin can retry.
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
  confirmation_status: string | null;
  played_at: string;
  venue_name_override: string | null;
  club_id: string | null;
  team_a_score: number[] | null;
  team_b_score: number[] | null;
  submitted_to_dupr: boolean | null;
  dupr_match_id: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function err(error: string, status: number, code?: string, details?: unknown) {
  return jsonResponse(
    { error, ...(code ? { code } : {}), ...(details ? { details } : {}) },
    status,
  );
}

// ─── DUPR auto-submit (best-effort) ─────────────────────────────────────────
// Build the DUPR create payload from the matches row + participants and push
// it through the dupr-match-submit edge function, forwarding the confirming
// user's bearer so the "confirmed-participant" bypass authorizes them.
//
// Never throws. Returns a small status object that we surface in the confirm
// response so the client can toast accordingly. Silently skips (attempted
// false) when the match is already on DUPR, scores are malformed, or a
// player has no DUPR ID — in those cases ready_for_dupr stays true for a
// later admin submit.
interface DuprAutoSubmitResult {
  attempted: boolean;
  ok?: boolean;
  match_code?: string;
  reason?: string;
}

interface DuprParticipant {
  team: "a" | "b";
  position: number | null;
  dupr_id: string | null;
}

async function autoSubmitToDupr(
  supabase: ReturnType<typeof createClient>,
  authHeader: string | null,
  match: MatchRow,
): Promise<DuprAutoSubmitResult> {
  try {
    if (!authHeader) return { attempted: false, reason: "no_auth_header" };
    if (match.submitted_to_dupr || match.dupr_match_id) {
      return { attempted: false, reason: "already_submitted" };
    }

    const aScores = match.team_a_score ?? [];
    const bScores = match.team_b_score ?? [];
    if (
      aScores.length < 1 ||
      aScores.length > 5 ||
      aScores.length !== bScores.length
    ) {
      return { attempted: false, reason: "invalid_scores" };
    }

    // Participants + each player's DUPR id, ordered for stable player1/player2.
    const { data: rows, error: pErr } = await supabase
      .from("match_participants")
      .select(
        "team, position, profile:profiles!match_participants_player_id_fkey ( dupr_id )",
      )
      .eq("match_id", match.id)
      .order("team", { ascending: true })
      .order("position", { ascending: true });
    if (pErr) return { attempted: false, reason: "participants_fetch_failed" };

    const parts: DuprParticipant[] = (rows ?? []).map((r) => {
      const rec = r as Record<string, unknown>;
      const profile = (rec.profile ?? {}) as { dupr_id?: string | null };
      return {
        team: rec.team as "a" | "b",
        position: (rec.position as number) ?? null,
        dupr_id: profile.dupr_id ?? null,
      };
    });

    const teamA = parts
      .filter((p) => p.team === "a")
      .sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
    const teamB = parts
      .filter((p) => p.team === "b")
      .sort((x, y) => (x.position ?? 0) - (y.position ?? 0));

    if (teamA.length === 0 || teamB.length === 0) {
      return { attempted: false, reason: "missing_team" };
    }
    if ([...teamA, ...teamB].some((p) => !p.dupr_id)) {
      // A player has not connected DUPR — leave ready_for_dupr=true so an
      // admin can submit later once everyone connects.
      return { attempted: false, reason: "players_missing_dupr_id" };
    }

    const buildTeam = (players: DuprParticipant[], scores: number[]) => {
      const out: Record<string, unknown> = { player1: players[0].dupr_id };
      if (players.length > 1) out.player2 = players[1].dupr_id;
      scores.forEach((s, i) => {
        out[`game${i + 1}`] = s;
      });
      return out;
    };

    // Club-logged matches mirror submitted_to_dupr back onto the row when
    // source === "club_match"; pure social matches use "match".
    const source = match.club_id ? "club_match" : "match";
    const fmt = match.format === "singles" ? "SINGLES" : "DOUBLES";

    const payload = {
      action: "create",
      internal_source: source,
      internal_match_id: match.id,
      match_date: String(match.played_at).slice(0, 10),
      location: match.club_id ? "ThePickleHub CLB" : "ThePickleHub",
      format: fmt,
      match_type: "SIDEOUT",
      event: match.club_id ? "ThePickleHub CLB match" : "ThePickleHub match",
      bracket: "",
      team_a: buildTeam(teamA, aScores),
      team_b: buildTeam(teamB, bScores),
    };

    const url = `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/dupr-match-submit`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify(payload),
    });
    const respBody = (await res.json().catch(() => ({}))) as {
      match_code?: string;
      error?: string;
      code?: string;
    };
    if (!res.ok) {
      return {
        attempted: true,
        ok: false,
        reason: respBody.error ?? respBody.code ?? `dupr_http_${res.status}`,
      };
    }
    return { attempted: true, ok: true, match_code: respBody.match_code };
  } catch (e) {
    return {
      attempted: true,
      ok: false,
      reason: e instanceof Error ? e.message : "dupr_submit_threw",
    };
  }
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
      "id, slug, format, recorded_by, verification_status, confirmation_status, played_at, venue_name_override, club_id, team_a_score, team_b_score, submitted_to_dupr, dupr_match_id",
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
        confirmation_status: "disputed",
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
  let duprSubmit: DuprAutoSubmitResult = {
    attempted: false,
    reason: "not_verified",
  };

  if (opponentTeamConfirmed >= 1) {
    newStatus = "verified";
    const nowIso = new Date().toISOString();

    // Build the matches patch. ALWAYS advance verification_status. For CLB
    // member-logged rows (confirmation_status='pending_opponent_confirm'),
    // ALSO advance the CLB confirmation machine + flip ready_for_dupr so the
    // CLB list / pending queue agree and the row is shippable to DUPR.
    const matchPatch: Record<string, unknown> = {
      verification_status: "verified",
      verified_at: nowIso,
      updated_at: nowIso,
    };
    if (match.confirmation_status === "pending_opponent_confirm") {
      matchPatch.confirmation_status = "confirmed";
      matchPatch.confirmed_by = user.id;
      matchPatch.confirmed_at = nowIso;
      matchPatch.ready_for_dupr = true;
    }

    const { error: matchUpdErr } = await supabase
      .from("matches")
      .update(matchPatch)
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
      // ─── Auto-submit to DUPR (best-effort, per 2026-06-02 decision) ─────
      // Runs AFTER the row reads verification_status='verified' so the
      // dupr-match-submit "confirmed-participant" bypass authorizes the
      // confirming opponent. Failures are non-fatal.
      duprSubmit = await autoSubmitToDupr(
        supabase,
        req.headers.get("Authorization"),
        match,
      );
      if (duprSubmit.attempted && !duprSubmit.ok) {
        console.warn(
          JSON.stringify({
            function: "match-confirm",
            match_id: match.id,
            step: "auto_submit_dupr",
            reason: duprSubmit.reason,
          }),
        );
      }

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
    dupr_submit: duprSubmit,
  });
});
