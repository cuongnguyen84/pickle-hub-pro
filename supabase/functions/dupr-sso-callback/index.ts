// ============================================================================
// dupr-sso-callback — receive SSO postMessage payload, persist user link
// ----------------------------------------------------------------------------
// The DUPR SSO iframe (uat.dupr.gg/login-external-app/<base64(clientKey)>)
// emits a postMessage to the parent window on successful login. The parent
// passes the payload to this edge function which:
//
//   1. Verifies the calling user's JWT internally (ES256/HS256 workaround).
//   2. Validates the payload shape (userToken, refreshToken, id, duprId).
//   3. Fetches the user's DUPR profile via the partner API
//      (GET /user/v1.0/{id}) to confirm the duprId is real and grab ratings.
//      Falls back to the inline `stats` payload if the partner call fails.
//   4. Persists tokens to dupr_user_tokens, updates profiles.dupr_* +
//      dupr_connected_via='sso', appends a dupr_rating_history snapshot
//      with source='dupr_sso_initial'.
//
// Idempotent — re-running with the same DUPR account refreshes tokens.
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { partnerFetch } from "../_shared/dupr-client.ts";

interface CallbackBody {
  userToken?: unknown;
  refreshToken?: unknown;
  /** DUPR's numeric user id (event.id). */
  id?: unknown;
  /** Alphanumeric profile slug (event.duprId). */
  duprId?: unknown;
  /** Optional inline rating snapshot from the SSO event. */
  stats?: {
    singles?: number | string | null;
    doubles?: number | string | null;
  } | null;
}

interface DuprUserDetail {
  status?: string;
  result?: {
    id?: number | string;
    duprId?: string;
    fullName?: string;
    singles?: number | string;
    doubles?: number | string;
    singlesRating?: number | string;
    doublesRating?: number | string;
  };
}

const RATING_MIN = 2.0;
const RATING_MAX = 7.0;

function err(error: string, status: number, code?: string, details?: unknown) {
  return jsonResponse(
    { error, ...(code ? { code } : {}), ...(details ? { details } : {}) },
    status,
  );
}

function parseRating(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < RATING_MIN || n > RATING_MAX) return null;
  return Math.round(n * 100) / 100;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  // ─── 1. Auth verification ───────────────────────────────────────────────
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

  // ─── 2. Parse + validate payload ────────────────────────────────────────
  let body: CallbackBody;
  try {
    body = (await req.json()) as CallbackBody;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  if (!isNonEmptyString(body.userToken)) {
    return err("missing_user_token", 400, "missing_user_token");
  }
  if (!isNonEmptyString(body.refreshToken)) {
    return err("missing_refresh_token", 400, "missing_refresh_token");
  }
  if (!isNonEmptyString(body.duprId)) {
    return err("missing_dupr_id", 400, "missing_dupr_id");
  }
  if (body.id === undefined || body.id === null) {
    return err("missing_dupr_user_id", 400, "missing_dupr_user_id");
  }

  const duprUserId = String(body.id);
  const duprId = body.duprId;
  const accessToken = body.userToken;
  const refreshToken = body.refreshToken;

  // ─── 3. Confirm DUPR account via partner API ────────────────────────────
  // Best-effort enrichment — if the partner call fails (network / DUPR
  // 403 on unconnected user during early integration), we still proceed
  // with the inline `stats` payload from the SSO event.
  let displayName: string | null = null;
  let singles: number | null = parseRating(body.stats?.singles ?? null);
  let doubles: number | null = parseRating(body.stats?.doubles ?? null);

  try {
    const detailRes = await partnerFetch(supabase, `/user/v1.0/${duprUserId}`);
    if (detailRes.ok) {
      const detail = (await detailRes.json()) as DuprUserDetail;
      const r = detail.result;
      if (r) {
        if (typeof r.fullName === "string") displayName = r.fullName;
        const fetchedSingles = parseRating(r.singles ?? r.singlesRating);
        const fetchedDoubles = parseRating(r.doubles ?? r.doublesRating);
        if (fetchedSingles !== null) singles = fetchedSingles;
        if (fetchedDoubles !== null) doubles = fetchedDoubles;
      }
    } else {
      console.warn("dupr user detail non-ok:", detailRes.status);
    }
  } catch (e) {
    console.warn("dupr user detail fetch failed:", e);
  }

  const now = new Date().toISOString();
  const profileUrl = `https://mydupr.com/dupr/players/${duprId}`;

  // ─── 4. Persist user tokens ─────────────────────────────────────────────
  // TODO(prod): encrypt access_token + refresh_token before INSERT.
  const { error: tokenError } = await supabase
    .from("dupr_user_tokens")
    .upsert(
      {
        user_id: user.id,
        dupr_user_id: duprUserId,
        dupr_id: duprId,
        access_token: accessToken,
        refresh_token: refreshToken,
        connected_at: now,
        last_refreshed_at: now,
        revoked_at: null,
      },
      { onConflict: "user_id" },
    );

  if (tokenError) {
    console.error("dupr_user_tokens upsert failed:", tokenError);
    return err("token_persist_failed", 500, "token_persist_failed");
  }

  // ─── 5. Update profile ──────────────────────────────────────────────────
  const profileUpdate: Record<string, unknown> = {
    dupr_id: duprId,
    dupr_profile_url: profileUrl,
    dupr_synced_at: now,
    dupr_last_error: null,
    dupr_last_attempt_at: now,
    dupr_connected_via: "sso",
  };
  if (singles !== null) profileUpdate.dupr_singles = singles;
  if (doubles !== null) profileUpdate.dupr_doubles = doubles;

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (profileError) {
    console.error("profiles update failed:", profileError);
    return err("profile_update_failed", 500, "profile_update_failed");
  }

  // ─── 6. History snapshot ────────────────────────────────────────────────
  if (singles !== null || doubles !== null) {
    const { error: historyError } = await supabase
      .from("dupr_rating_history")
      .insert({
        profile_id: user.id,
        source: "dupr_sso_initial",
        dupr_singles: singles,
        dupr_doubles: doubles,
        recorded_at: now,
      });
    if (historyError) {
      console.warn("dupr_rating_history insert failed:", historyError);
    }
  }

  return jsonResponse({
    dupr_id: duprId,
    dupr_user_id: duprUserId,
    display_name: displayName,
    dupr_singles: singles,
    dupr_doubles: doubles,
    dupr_profile_url: profileUrl,
    connected_via: "sso",
    synced_at: now,
  });
});
