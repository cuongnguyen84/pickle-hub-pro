// ============================================================================
// dupr-match-submit — create / update / delete a match on DUPR
// ----------------------------------------------------------------------------
// Single endpoint dispatching by `action`:
//   - POST   {action:"create", ...payload}  → /match/v1.0/create
//   - POST   {action:"update", ...payload}  → /match/v1.0/update
//   - POST   {action:"delete", internal_source, internal_match_id} → /match/v1.0/delete
//
// Gating rules (per DUPR spec):
//   - Only `admin` or `creator` user_roles may submit. Normal users
//     forbidden (matches DUPR's "tournament directors, admins only" rule).
//   - Every player in the match must have BASIC_L1 entitlement on
//     `tournaments` (verified via dupr_user_has_entitlement helper).
//   - If matchSource=CLUB, clubId required + caller must be
//     DIRECTOR/ORGANIZER of that club (PR5 will tighten this with the
//     dupr_user_clubs cache; for now we trust the caller-provided clubId
//     when role check is satisfied).
//
// Per-match identifier convention: `tph:<source>:<internal_id>`. Stored
// in dupr_match_submissions so we can map back to matchCode for
// lifecycle ops.
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { partnerFetch, getDuprEnv } from "../_shared/dupr-client.ts";

type Action = "create" | "update" | "delete";

interface TeamPayload {
  /** DUPR ID (6-char alphanumeric) of player 1 — required. */
  player1: string;
  /** DUPR ID of player 2 — required when format=DOUBLES. */
  player2?: string;
  game1: number;
  game2?: number;
  game3?: number;
  game4?: number;
  game5?: number;
}

interface CreatePayload {
  action: "create";
  internal_source: string;
  internal_match_id: string;
  match_date: string; // yyyy-MM-dd
  location?: string;
  format: "SINGLES" | "DOUBLES";
  match_type?: "SIDEOUT" | "RALLY";
  event?: string;
  bracket?: string;
  club_id?: number;
  team_a: TeamPayload;
  team_b: TeamPayload;
}

interface UpdatePayload {
  action: "update";
  internal_source: string;
  internal_match_id: string;
  match_date?: string;
  location?: string;
  format?: "SINGLES" | "DOUBLES";
  match_type?: "SIDEOUT" | "RALLY";
  event?: string;
  bracket?: string;
  team_a?: TeamPayload;
  team_b?: TeamPayload;
}

interface DeletePayload {
  action: "delete";
  internal_source: string;
  internal_match_id: string;
}

type Payload = CreatePayload | UpdatePayload | DeletePayload;

interface DuprCreateResponse {
  status?: string;
  result?: {
    identifier?: string;
    matchCode?: string;
    hashedMatchCode?: string;
  };
}

function err(error: string, status: number, code?: string, details?: unknown) {
  return jsonResponse(
    { error, ...(code ? { code } : {}), ...(details ? { details } : {}) },
    status,
  );
}

function buildIdentifier(source: string, id: string): string {
  return `tph:${source}:${id}`;
}

function collectDuprIds(p: CreatePayload | UpdatePayload): string[] {
  const ids: string[] = [];
  for (const team of [p.team_a, p.team_b]) {
    if (!team) continue;
    if (team.player1) ids.push(team.player1);
    if (team.player2) ids.push(team.player2);
  }
  return ids.filter(Boolean);
}

function buildTeam(team: TeamPayload) {
  const out: Record<string, unknown> = { player1: team.player1 };
  if (team.player2) out.player2 = team.player2;
  out.game1 = team.game1;
  if (team.game2 !== undefined) out.game2 = team.game2;
  if (team.game3 !== undefined) out.game3 = team.game3;
  if (team.game4 !== undefined) out.game4 = team.game4;
  if (team.game5 !== undefined) out.game5 = team.game5;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  // ─── 1. Auth ───────────────────────────────────────────────────────────
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

  // ─── 2. Role gate — admin or creator only ──────────────────────────────
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const allowedRoles = new Set(["admin", "creator"]);
  const hasAllowedRole = (roles ?? []).some((r: { role: string }) =>
    allowedRoles.has(r.role)
  );
  if (!hasAllowedRole) {
    return err("forbidden", 403, "role_required");
  }

  // ─── 3. Parse + validate payload ───────────────────────────────────────
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  if (!body || typeof body !== "object" || !("action" in body)) {
    return err("missing_action", 400, "missing_action");
  }

  const env = getDuprEnv();
  const identifier = buildIdentifier(body.internal_source, body.internal_match_id);

  // ─── 4. Dispatch ───────────────────────────────────────────────────────
  switch (body.action as Action) {
    case "create":
      return await handleCreate(supabase, user.id, env, body as CreatePayload, identifier);
    case "update":
      return await handleUpdate(supabase, env, body as UpdatePayload, identifier);
    case "delete":
      return await handleDelete(supabase, env, body as DeletePayload, identifier);
    default:
      return err("unknown_action", 400, "unknown_action");
  }
});

async function ensureAllPlayersBasic(
  supabase: ReturnType<typeof createClient>,
  duprIds: string[],
): Promise<{ ok: boolean; missing: string[] }> {
  if (duprIds.length === 0) return { ok: true, missing: [] };

  // Look up our user_ids for the supplied dupr_ids (only mapped ones).
  const { data: tokens } = await supabase
    .from("dupr_user_tokens")
    .select("user_id, dupr_id")
    .in("dupr_id", duprIds)
    .is("revoked_at", null);

  const mapped = new Map<string, string>();
  for (const t of (tokens ?? []) as { user_id: string; dupr_id: string }[]) {
    mapped.set(t.dupr_id, t.user_id);
  }

  const missing: string[] = [];
  for (const duprId of duprIds) {
    const userId = mapped.get(duprId);
    if (!userId) {
      // Unconnected player — DUPR rules say only BASIC_L1-eligible
      // players can be added; we treat unconnected as missing.
      missing.push(duprId);
      continue;
    }
    const { data, error } = await supabase.rpc("dupr_user_has_entitlement", {
      p_user_id: userId,
      p_entitlement: "BASIC_L1",
      p_resource: "tournaments",
    });
    if (error || !data) {
      missing.push(duprId);
    }
  }

  return { ok: missing.length === 0, missing };
}

async function handleCreate(
  supabase: ReturnType<typeof createClient>,
  submitterId: string,
  env: ReturnType<typeof getDuprEnv>,
  p: CreatePayload,
  identifier: string,
): Promise<Response> {
  // Validate basic shape
  if (!p.team_a?.player1 || !p.team_b?.player1) {
    return err("missing_player1", 400, "missing_player1");
  }
  if (p.format === "DOUBLES" && (!p.team_a.player2 || !p.team_b.player2)) {
    return err("missing_player2_for_doubles", 400, "missing_player2_for_doubles");
  }
  if (!p.match_date || !p.format) {
    return err("missing_match_date_or_format", 400, "missing_match_date_or_format");
  }

  // Entitlement gate
  const duprIds = collectDuprIds(p);
  const gate = await ensureAllPlayersBasic(supabase, duprIds);
  if (!gate.ok) {
    return err("players_missing_basic_l1", 412, "players_missing_basic_l1", {
      missing: gate.missing,
    });
  }

  const partnerBody: Record<string, unknown> = {
    identifier,
    location: p.location ?? "",
    matchDate: p.match_date,
    teamA: buildTeam(p.team_a),
    teamB: buildTeam(p.team_b),
    format: p.format,
    event: p.event ?? "ThePickleHub event",
    bracket: p.bracket ?? "",
    matchType: p.match_type ?? "SIDEOUT",
    matchSource: p.club_id ? "CLUB" : "PARTNER",
  };
  if (p.club_id) partnerBody.clubId = p.club_id;

  let duprBody: DuprCreateResponse;
  try {
    const res = await partnerFetch(supabase, "/match/v1.0/create", {
      method: "POST",
      body: JSON.stringify(partnerBody),
    });
    duprBody = (await res.json().catch(() => null)) as DuprCreateResponse;
    if (!res.ok || duprBody?.status !== "SUCCESS" || !duprBody?.result?.matchCode) {
      return err("dupr_create_failed", 502, "dupr_create_failed", {
        status: res.status,
        body: duprBody,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("dupr match create failed:", msg);
    return err("dupr_create_failed", 502, "dupr_create_failed");
  }

  const matchCode = duprBody.result!.matchCode!;
  const hashedMatchCode = duprBody.result!.hashedMatchCode ?? null;

  const { error: insertError } = await supabase
    .from("dupr_match_submissions")
    .insert({
      environment: env,
      internal_source: p.internal_source,
      internal_match_id: p.internal_match_id,
      identifier,
      match_code: matchCode,
      hashed_match_code: hashedMatchCode,
      submitted_by: submitterId,
      club_id: p.club_id ?? null,
      match_format: p.format,
      match_date: p.match_date,
      raw_request: partnerBody,
      raw_response: duprBody as unknown as Record<string, unknown>,
    });

  if (insertError) {
    console.error("dupr_match_submissions insert failed:", insertError);
    // DUPR side already created — surface but don't fail the user.
    return jsonResponse({
      created: true,
      match_code: matchCode,
      hashed_match_code: hashedMatchCode,
      identifier,
      persist_warning: insertError.message,
    });
  }

  return jsonResponse({
    created: true,
    match_code: matchCode,
    hashed_match_code: hashedMatchCode,
    identifier,
  });
}

async function handleUpdate(
  supabase: ReturnType<typeof createClient>,
  env: ReturnType<typeof getDuprEnv>,
  p: UpdatePayload,
  identifier: string,
): Promise<Response> {
  const { data: existing } = await supabase
    .from("dupr_match_submissions")
    .select("match_code, club_id, match_format, match_date")
    .eq("environment", env)
    .eq("internal_source", p.internal_source)
    .eq("internal_match_id", p.internal_match_id)
    .is("deleted_at", null)
    .maybeSingle<{
      match_code: string;
      club_id: number | null;
      match_format: string;
      match_date: string;
    }>();

  if (!existing) {
    return err("match_not_found", 404, "match_not_found");
  }

  // Entitlement gate if team composition changes
  const duprIds = collectDuprIds(p);
  if (duprIds.length > 0) {
    const gate = await ensureAllPlayersBasic(supabase, duprIds);
    if (!gate.ok) {
      return err("players_missing_basic_l1", 412, "players_missing_basic_l1", {
        missing: gate.missing,
      });
    }
  }

  const partnerBody: Record<string, unknown> = {
    identifier,
    matchCode: existing.match_code,
    location: p.location ?? "",
    matchDate: p.match_date ?? existing.match_date,
    format: p.format ?? existing.match_format,
    event: p.event ?? "ThePickleHub event",
    bracket: p.bracket ?? "",
    matchType: p.match_type ?? "SIDEOUT",
  };
  if (p.team_a) partnerBody.teamA = buildTeam(p.team_a);
  if (p.team_b) partnerBody.teamB = buildTeam(p.team_b);
  if (existing.club_id) partnerBody.clubId = existing.club_id;

  try {
    const res = await partnerFetch(supabase, "/match/v1.0/update", {
      method: "POST",
      body: JSON.stringify(partnerBody),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return err("dupr_update_failed", 502, "dupr_update_failed", {
        status: res.status,
        body,
      });
    }
    await supabase
      .from("dupr_match_submissions")
      .update({
        last_updated_at: new Date().toISOString(),
        raw_request: partnerBody,
        raw_response: body,
      })
      .eq("environment", env)
      .eq("internal_source", p.internal_source)
      .eq("internal_match_id", p.internal_match_id);
    return jsonResponse({ updated: true, match_code: existing.match_code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("dupr match update failed:", msg);
    return err("dupr_update_failed", 502, "dupr_update_failed");
  }
}

async function handleDelete(
  supabase: ReturnType<typeof createClient>,
  env: ReturnType<typeof getDuprEnv>,
  p: DeletePayload,
  identifier: string,
): Promise<Response> {
  const { data: existing } = await supabase
    .from("dupr_match_submissions")
    .select("match_code")
    .eq("environment", env)
    .eq("internal_source", p.internal_source)
    .eq("internal_match_id", p.internal_match_id)
    .is("deleted_at", null)
    .maybeSingle<{ match_code: string }>();

  if (!existing) {
    return err("match_not_found", 404, "match_not_found");
  }

  try {
    const res = await partnerFetch(supabase, "/match/v1.0/delete", {
      method: "DELETE",
      body: JSON.stringify({
        identifier,
        matchCode: existing.match_code,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return err("dupr_delete_failed", 502, "dupr_delete_failed", {
        status: res.status,
        body,
      });
    }
    await supabase
      .from("dupr_match_submissions")
      .update({
        deleted_at: new Date().toISOString(),
        raw_response: body,
      })
      .eq("environment", env)
      .eq("internal_source", p.internal_source)
      .eq("internal_match_id", p.internal_match_id);
    return jsonResponse({ deleted: true, match_code: existing.match_code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("dupr match delete failed:", msg);
    return err("dupr_delete_failed", 502, "dupr_delete_failed");
  }
}
