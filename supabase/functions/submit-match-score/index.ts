// ============================================================================
// submit-match-score — Social Events PR47 edge function
// ----------------------------------------------------------------------------
// POST {
//   match_id: uuid,
//   team_a_score: int,
//   team_b_score: int,
//   organizer_override?: boolean,
//   // one of:
//   registration_id?: uuid,
//   magic_token?: uuid
// }
//
// Two paths:
//
//   (1) organizer_override=true. Verifies the bearer JWT internally
//       (ES256/HS256 workaround — verify_jwt=false at the gateway), checks
//       the user is either the event organizer or has the admin role, then
//       UPDATEs the match unilaterally (status=completed, both confirm flags
//       true, winning_team derived from scores).
//
//   (2) Player path (magic_token + registration_id). Verifies the
//       registration row matches the token AND the registration's profile_id
//       is one of the four players on the match. Then sets the appropriate
//       team's confirmed_by_team_X flag. If both confirm flags become true,
//       transitions status to 'completed' and writes winning_team.
//
// Why verify_jwt=false: the player path is callable by guests (no
// auth.users row); the organizer path uses the bearer-token workaround
// already in place project-wide. The function picks the path from
// `organizer_override` so both flows share a single deploy.
//
// verify_jwt=false (see supabase/config.toml).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SCORE = 99;

interface Body {
  match_id?: unknown;
  team_a_score?: unknown;
  team_b_score?: unknown;
  organizer_override?: unknown;
  registration_id?: unknown;
  magic_token?: unknown;
}

function err(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "submit-match-score", ...payload }));
}

function deriveWinningTeam(a: number, b: number): "a" | "b" | null {
  if (a === b) return null;
  return a > b ? "a" : "b";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const matchId = typeof body.match_id === "string" ? body.match_id : "";
  if (!UUID_RE.test(matchId)) {
    return err("invalid_match_id", 400, "invalid_match_id");
  }

  const scoreA = Number(body.team_a_score);
  const scoreB = Number(body.team_b_score);
  if (
    !Number.isFinite(scoreA) ||
    !Number.isFinite(scoreB) ||
    !Number.isInteger(scoreA) ||
    !Number.isInteger(scoreB) ||
    scoreA < 0 ||
    scoreB < 0 ||
    scoreA > MAX_SCORE ||
    scoreB > MAX_SCORE
  ) {
    return err("invalid_score", 400, "invalid_score");
  }

  const organizerOverride = body.organizer_override === true;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── Fetch match row ────────────────────────────────────────────────────
  const { data: match, error: matchErr } = await supabase
    .from("social_event_matches")
    .select(
      `id, event_id, status,
       team_a_player1_id, team_a_player2_id,
       team_b_player1_id, team_b_player2_id,
       confirmed_by_team_a, confirmed_by_team_b`,
    )
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr) {
    logEvent({ error: matchErr.message, step: "fetch_match" });
    return err("match_lookup_failed", 500, "match_lookup_failed");
  }
  if (!match) return err("match_not_found", 404, "match_not_found");
  if (match.status === "completed") {
    return err("match_already_completed", 409, "match_already_completed");
  }

  const eventId = match.event_id as string;

  // ─── Path A: organizer override ─────────────────────────────────────────
  if (organizerOverride) {
    // Verify the bearer token via the Auth API (ES256-aware), then check
    // either ownership of the event or the admin role.
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const user = await getAuthUser(req, authClient);
    if (!user) return err("unauthorized", 401, "unauthorized");

    // Check organizer
    const { data: event } = await supabase
      .from("social_events")
      .select("created_by")
      .eq("id", eventId)
      .maybeSingle();
    const isOrganizer = event?.created_by === user.id;

    let isAdmin = false;
    if (!isOrganizer) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      isAdmin = Boolean(roleRow);
    }

    if (!isOrganizer && !isAdmin) {
      return err("forbidden", 403, "forbidden");
    }

    const winning = deriveWinningTeam(scoreA, scoreB);
    const { error: updErr } = await supabase
      .from("social_event_matches")
      .update({
        team_a_score: scoreA,
        team_b_score: scoreB,
        status: "completed",
        confirmed_by_team_a: true,
        confirmed_by_team_b: true,
        winning_team: winning,
      })
      .eq("id", matchId);
    if (updErr) {
      logEvent({ error: updErr.message, step: "organizer_update" });
      return err("update_failed", 500, "update_failed");
    }
    logEvent({
      step: "organizer_completed",
      match_id: matchId,
      event_id: eventId,
      user_id: user.id,
    });
    return jsonResponse({ ok: true, status: "completed", winning_team: winning });
  }

  // ─── Path B: player path via magic_token + registration_id ─────────────
  const registrationId =
    typeof body.registration_id === "string" ? body.registration_id : "";
  const magicToken = typeof body.magic_token === "string" ? body.magic_token : "";
  if (!UUID_RE.test(registrationId)) {
    return err("invalid_registration_id", 400, "invalid_registration_id");
  }
  if (!UUID_RE.test(magicToken)) {
    return err("invalid_magic_token", 400, "invalid_magic_token");
  }

  const { data: reg, error: regErr } = await supabase
    .from("event_registrations")
    .select("id, event_id, profile_id, magic_token, status")
    .eq("id", registrationId)
    .maybeSingle();
  if (regErr) {
    logEvent({ error: regErr.message, step: "fetch_registration" });
    return err("registration_lookup_failed", 500, "registration_lookup_failed");
  }
  if (!reg) return err("registration_not_found", 404, "registration_not_found");
  if (reg.event_id !== eventId) {
    return err("registration_event_mismatch", 403, "registration_event_mismatch");
  }
  if (reg.magic_token !== magicToken) {
    return err("magic_token_mismatch", 401, "magic_token_mismatch");
  }
  if (reg.status === "cancelled") {
    return err("registration_cancelled", 403, "registration_cancelled");
  }

  const profileId = reg.profile_id as string | null;
  if (!profileId) {
    return err("registration_has_no_profile", 403, "registration_has_no_profile");
  }

  // Which team is the player on?
  const onA =
    match.team_a_player1_id === profileId || match.team_a_player2_id === profileId;
  const onB =
    match.team_b_player1_id === profileId || match.team_b_player2_id === profileId;
  if (!onA && !onB) {
    return err("not_in_match", 403, "not_in_match");
  }
  const team: "a" | "b" = onA ? "a" : "b";

  // First write the score + flip the confirm flag for this team. If both
  // flags are now true (the OTHER team already confirmed before us), move
  // status → completed and set winning_team.
  const otherConfirmed =
    team === "a"
      ? Boolean(match.confirmed_by_team_b)
      : Boolean(match.confirmed_by_team_a);
  const willBeCompleted = otherConfirmed;
  const winning = willBeCompleted ? deriveWinningTeam(scoreA, scoreB) : null;
  const patch: Record<string, unknown> = {
    team_a_score: scoreA,
    team_b_score: scoreB,
    [team === "a" ? "confirmed_by_team_a" : "confirmed_by_team_b"]: true,
    status: willBeCompleted ? "completed" : "in_progress",
  };
  if (willBeCompleted) patch.winning_team = winning;

  const { error: updErr } = await supabase
    .from("social_event_matches")
    .update(patch)
    .eq("id", matchId);
  if (updErr) {
    logEvent({ error: updErr.message, step: "player_update" });
    return err("update_failed", 500, "update_failed");
  }
  logEvent({
    step: willBeCompleted ? "player_completed" : "player_confirmed",
    match_id: matchId,
    event_id: eventId,
    team,
    registration_id: registrationId,
  });
  return jsonResponse({
    ok: true,
    status: willBeCompleted ? "completed" : "in_progress",
    winning_team: winning,
    team_confirmed: team,
  });
});
