// ============================================================================
// match-create — Sprint 2 full implementation
// ----------------------------------------------------------------------------
// Inserts a pending match + participants + notifies opponent team to confirm.
// Server enforces score validity, rate limits, slug uniqueness, and stamps
// fraud-detection meta (ip / ua / device) on the match row.
//
// Verification flow continues in match-confirm (opponent-team rule).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getAuthUser, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  validateScores,
  type ScoringFormat,
} from "../_shared/score-validation.ts";
import { buildMatchSlug } from "../_shared/slug.ts";

type Format = "singles" | "doubles" | "mixed";
type MatchType = "rec" | "open_play" | "tournament" | "league" | "practice";
type Team = "a" | "b";

interface ParticipantInput {
  player_id: string;
  team: Team;
  position?: number | null;
}

interface DeviceMeta {
  capacitor_platform?: "ios" | "android" | "web";
  device_fp?: string;
}

interface CreateBody {
  format: Format;
  match_type: MatchType;
  venue_id?: string | null;
  venue_name_override?: string | null;
  court_number?: string | null;
  tournament_id?: string | null;
  tournament_round?: string | null;
  played_at: string;
  duration_minutes?: number | null;
  team_a_score: number[];
  team_b_score: number[];
  scoring_format?: ScoringFormat;
  participants: ParticipantInput[];
  notes?: string | null;
  weather?: string | null;
  device_meta?: DeviceMeta;
}

const FORMATS: ReadonlySet<Format> = new Set(["singles", "doubles", "mixed"]);
const MATCH_TYPES: ReadonlySet<MatchType> = new Set([
  "rec",
  "open_play",
  "tournament",
  "league",
  "practice",
]);
const SCORING_FORMATS: ReadonlySet<ScoringFormat> = new Set([
  "11_rally",
  "11_traditional",
  "15_rally",
  "21_rally",
]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function err(error: string, status: number, code?: string, details?: unknown) {
  return jsonResponse(
    { error, ...(code ? { code } : {}), ...(details ? { details } : {}) },
    status,
  );
}

interface ValidatedInput {
  format: Format;
  match_type: MatchType;
  scoringFormat: ScoringFormat;
  participants: ParticipantInput[];
  playedAt: Date;
}

function validateBody(b: Partial<CreateBody>):
  | { ok: true; value: ValidatedInput }
  | { ok: false; reason: string; code: string } {
  if (!b.format || !FORMATS.has(b.format)) {
    return {
      ok: false,
      reason: "format must be singles | doubles | mixed",
      code: "invalid_format",
    };
  }
  if (!b.match_type || !MATCH_TYPES.has(b.match_type)) {
    return {
      ok: false,
      reason: "match_type invalid",
      code: "invalid_match_type",
    };
  }
  const scoringFormat: ScoringFormat = b.scoring_format ?? "11_rally";
  if (!SCORING_FORMATS.has(scoringFormat)) {
    return {
      ok: false,
      reason: "scoring_format invalid",
      code: "invalid_scoring_format",
    };
  }
  if (!b.played_at || typeof b.played_at !== "string") {
    return {
      ok: false,
      reason: "played_at required (ISO timestamp)",
      code: "missing_played_at",
    };
  }
  const playedAt = new Date(b.played_at);
  if (Number.isNaN(playedAt.getTime())) {
    return {
      ok: false,
      reason: "played_at not a valid ISO timestamp",
      code: "invalid_played_at",
    };
  }
  const now = Date.now();
  if (playedAt.getTime() > now + 60_000) {
    return {
      ok: false,
      reason: "played_at cannot be in the future",
      code: "played_at_future",
    };
  }
  if (playedAt.getTime() < now - 24 * 60 * 60 * 1000) {
    return {
      ok: false,
      reason: "played_at cannot be more than 24 hours ago",
      code: "played_at_too_old",
    };
  }

  if (!Array.isArray(b.participants)) {
    return {
      ok: false,
      reason: "participants array required",
      code: "missing_participants",
    };
  }
  const expectedCount = b.format === "singles" ? 2 : 4;
  if (b.participants.length !== expectedCount) {
    return {
      ok: false,
      reason: `${b.format} requires exactly ${expectedCount} participants`,
      code: "participants_count_mismatch",
    };
  }
  for (const p of b.participants) {
    if (!p || typeof p.player_id !== "string" || !UUID_RE.test(p.player_id)) {
      return {
        ok: false,
        reason: "participant.player_id must be UUID",
        code: "invalid_player_id",
      };
    }
    if (p.team !== "a" && p.team !== "b") {
      return {
        ok: false,
        reason: "participant.team must be 'a' or 'b'",
        code: "invalid_team",
      };
    }
  }
  // Each team has correct number of players + unique positions
  const teamA = b.participants.filter((p) => p.team === "a");
  const teamB = b.participants.filter((p) => p.team === "b");
  const perTeam = b.format === "singles" ? 1 : 2;
  if (teamA.length !== perTeam || teamB.length !== perTeam) {
    return {
      ok: false,
      reason: `each team needs ${perTeam} player(s)`,
      code: "team_count_mismatch",
    };
  }
  // No duplicate player_id across roster
  const ids = new Set<string>();
  for (const p of b.participants) {
    if (ids.has(p.player_id)) {
      return {
        ok: false,
        reason: "duplicate player_id in participants",
        code: "duplicate_player",
      };
    }
    ids.add(p.player_id);
  }
  // Position uniqueness within each team (when provided)
  const positions = (
    arr: ParticipantInput[],
  ): { ok: boolean; reason?: string } => {
    const seen = new Set<number>();
    for (const p of arr) {
      if (p.position == null) continue;
      if (seen.has(p.position)) {
        return { ok: false, reason: "duplicate position within team" };
      }
      seen.add(p.position);
    }
    return { ok: true };
  };
  const pa = positions(teamA);
  if (!pa.ok) {
    return { ok: false, reason: pa.reason!, code: "duplicate_position" };
  }
  const pb = positions(teamB);
  if (!pb.ok) {
    return { ok: false, reason: pb.reason!, code: "duplicate_position" };
  }

  if (
    !Array.isArray(b.team_a_score) ||
    !Array.isArray(b.team_b_score) ||
    b.team_a_score.length === 0
  ) {
    return {
      ok: false,
      reason: "team_a_score and team_b_score required arrays",
      code: "missing_scores",
    };
  }

  // Optional UUID checks
  if (b.venue_id && !UUID_RE.test(b.venue_id)) {
    return {
      ok: false,
      reason: "venue_id must be UUID",
      code: "invalid_venue_id",
    };
  }
  if (b.tournament_id && !UUID_RE.test(b.tournament_id)) {
    return {
      ok: false,
      reason: "tournament_id must be UUID",
      code: "invalid_tournament_id",
    };
  }

  return {
    ok: true,
    value: {
      format: b.format,
      match_type: b.match_type,
      scoringFormat,
      participants: b.participants,
      playedAt,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const user = await getAuthUser(req, supabaseAuth);
  if (!user) return err("unauthorized", 401);

  // service_role for inserts (RLS would otherwise block cross-user notifications)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const v = validateBody(body);
  if (!v.ok) return err(v.reason, 400, v.code);
  const { format, match_type, scoringFormat, participants, playedAt } = v.value;

  // ─── Score validation ────────────────────────────────────────────────────
  const scoreResult = validateScores(
    body.team_a_score,
    body.team_b_score,
    scoringFormat,
  );
  if (!scoreResult.valid) {
    return err(scoreResult.reason, 400, "invalid_score");
  }
  const winningTeam: Team = scoreResult.winner;

  // ─── Verify all player_ids exist + collect usernames for slug ───────────
  const playerIds = participants.map((p) => p.player_id);
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, username, display_name, is_ghost")
    .in("id", playerIds);
  if (profErr) {
    console.error(
      JSON.stringify({
        function: "match-create",
        user_id: user.id,
        error: profErr.message,
        context: { step: "fetch_profiles" },
      }),
    );
    return err("profiles_fetch_failed", 500);
  }
  const profileMap = new Map<
    string,
    { id: string; username: string | null; display_name: string | null; is_ghost: boolean | null }
  >(
    (profiles ?? []).map((p) => {
      const row = p as {
        id: string;
        username: string | null;
        display_name: string | null;
        is_ghost: boolean | null;
      };
      return [row.id, row];
    }),
  );
  for (const id of playerIds) {
    if (!profileMap.has(id)) {
      return err(`player_id ${id} not found`, 404, "player_not_found");
    }
  }

  // ─── Verify venue_id / tournament_id exist if provided ───────────────────
  if (body.venue_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("id")
      .eq("id", body.venue_id)
      .maybeSingle();
    if (!venue) return err("venue not found", 404, "venue_not_found");
  }
  if (body.tournament_id) {
    const { data: tour } = await supabase
      .from("tournaments")
      .select("id")
      .eq("id", body.tournament_id)
      .maybeSingle();
    if (!tour) {
      return err("tournament not found", 404, "tournament_not_found");
    }
  }

  // ─── Rate limit: 5/24h, 20/7d (recorded_by) ─────────────────────────────
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { count: dayCount, error: rl1 } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("recorded_by", user.id)
    .gte("created_at", dayAgo);
  if (rl1) return err("rate_limit_check_failed", 500);
  if ((dayCount ?? 0) >= 5) {
    return err("Daily limit reached (5/day)", 429, "rate_limit_daily");
  }
  const { count: weekCount, error: rl2 } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("recorded_by", user.id)
    .gte("created_at", weekAgo);
  if (rl2) return err("rate_limit_check_failed", 500);
  if ((weekCount ?? 0) >= 20) {
    return err("Weekly limit reached (20/week)", 429, "rate_limit_weekly");
  }

  // ─── Slug generation: username-of-first-A vs username-of-first-B ────────
  const firstA =
    participants.find((p) => p.team === "a" && (p.position ?? 1) === 1) ??
    participants.find((p) => p.team === "a")!;
  const firstB =
    participants.find((p) => p.team === "b" && (p.position ?? 1) === 1) ??
    participants.find((p) => p.team === "b")!;
  const aProfile = profileMap.get(firstA.player_id)!;
  const bProfile = profileMap.get(firstB.player_id)!;
  const aLabel =
    aProfile.username || aProfile.display_name || aProfile.id.slice(0, 8);
  const bLabel =
    bProfile.username || bProfile.display_name || bProfile.id.slice(0, 8);

  let slug = "";
  let collisionCount = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = buildMatchSlug(aLabel, bLabel, playedAt);
    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!existing) {
      slug = candidate;
      break;
    }
    collisionCount++;
  }
  if (!slug) {
    console.error(
      JSON.stringify({
        function: "match-create",
        user_id: user.id,
        error: "slug_collision",
        context: { aLabel, bLabel, attempts: 5 },
      }),
    );
    return err(
      "slug collision could not be resolved",
      409,
      "slug_collision_unresolved",
    );
  }

  // ─── Build created_meta (fraud detection) ───────────────────────────────
  const createdMeta = {
    ip:
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for") ||
      null,
    ua: req.headers.get("user-agent") || null,
    device_fp: body.device_meta?.device_fp ?? null,
    capacitor_platform: body.device_meta?.capacitor_platform ?? null,
  };

  // ─── Insert match ───────────────────────────────────────────────────────
  const { data: matchRow, error: insertErr } = await supabase
    .from("matches")
    .insert({
      slug,
      format,
      match_type,
      venue_id: body.venue_id ?? null,
      venue_name_override: body.venue_name_override ?? null,
      court_number: body.court_number ?? null,
      tournament_id: body.tournament_id ?? null,
      tournament_round: body.tournament_round ?? null,
      played_at: playedAt.toISOString(),
      duration_minutes: body.duration_minutes ?? null,
      team_a_score: body.team_a_score,
      team_b_score: body.team_b_score,
      winning_team: winningTeam,
      scoring_format: scoringFormat,
      verification_status: "pending",
      is_public: true,
      recorded_by: user.id,
      notes: body.notes ?? null,
      weather: body.weather ?? null,
      created_meta: createdMeta,
    })
    .select(
      "id, slug, format, venue_id, played_at, team_a_score, team_b_score, winning_team, verification_status, recorded_by",
    )
    .single();

  if (insertErr || !matchRow) {
    console.error(
      JSON.stringify({
        function: "match-create",
        user_id: user.id,
        error: insertErr?.message ?? "no_row",
        context: { step: "insert_match", slug },
      }),
    );
    return err("match_insert_failed", 500);
  }

  const match = matchRow as {
    id: string;
    slug: string;
    format: string;
    venue_id: string | null;
    played_at: string;
    team_a_score: number[];
    team_b_score: number[];
    winning_team: Team;
    verification_status: string;
    recorded_by: string;
  };

  // ─── Insert participants ────────────────────────────────────────────────
  const partRows = participants.map((p) => ({
    match_id: match.id,
    player_id: p.player_id,
    team: p.team,
    position: p.position ?? null,
    confirmed: p.player_id === user.id,
    confirmed_at: p.player_id === user.id ? new Date().toISOString() : null,
  }));
  const { data: insertedParts, error: partErr } = await supabase
    .from("match_participants")
    .insert(partRows)
    .select();
  if (partErr) {
    console.error(
      JSON.stringify({
        function: "match-create",
        user_id: user.id,
        error: partErr.message,
        context: { step: "insert_participants", match_id: match.id },
      }),
    );
    // Match exists but participants failed — still report 500, ops can clean up
    return err("participants_insert_failed", 500);
  }

  // ─── Determine creator team and notify opponents ────────────────────────
  const creatorParticipant = participants.find(
    (p) => p.player_id === user.id,
  );
  const creatorTeam = creatorParticipant?.team ?? null;
  const opponentTeam: Team | null =
    creatorTeam === "a" ? "b" : creatorTeam === "b" ? "a" : null;

  const targets = opponentTeam
    ? participants.filter((p) => p.team === opponentTeam)
    : participants.filter((p) => p.player_id !== user.id);

  const realTargets = targets.filter((t) => {
    const prof = profileMap.get(t.player_id);
    return prof && !prof.is_ghost;
  });

  let notificationsSent = 0;
  if (realTargets.length > 0) {
    const dateStr = playedAt.toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const venueLabel = body.venue_name_override ?? "";
    const recorderProfile = profileMap.get(user.id);
    const recorderName =
      recorderProfile?.display_name ||
      recorderProfile?.username ||
      "Một người chơi";
    const { error: notifErr } = await supabase
      .from("social_notifications")
      .insert(
        realTargets.map((t) => ({
          user_id: t.player_id,
          type: "match_confirm_needed",
          title: `${recorderName} vừa log trận với bạn — xác nhận?`,
          body: `Trận ${format} ${venueLabel} ${dateStr}`.trim(),
          link_url: `/tran-dau/${match.slug}`,
          payload: { match_id: match.id, match_slug: match.slug },
          is_read: false,
        })),
      );
    if (!notifErr) notificationsSent = realTargets.length;
    else {
      console.error(
        JSON.stringify({
          function: "match-create",
          user_id: user.id,
          error: notifErr.message,
          context: { step: "insert_notifications", match_id: match.id },
        }),
      );
      // Non-fatal: match is created, user can re-trigger later
    }
  }

  return jsonResponse(
    {
      match,
      participants: insertedParts ?? [],
      notifications_sent: notificationsSent,
      url: `/tran-dau/${match.slug}`,
      slug_collision_count: collisionCount,
    },
    201,
  );
});
