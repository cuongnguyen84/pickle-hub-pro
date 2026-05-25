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
import { partnerFetch, subscribeRating } from "../_shared/dupr-client.ts";

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
    id?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    ratings?: {
      singles?: number | string | null;
      doubles?: number | string | null;
    };
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
  // Required server-side verification — without confirming the claimed
  // duprId actually exists on DUPR side, any authenticated caller could
  // POST arbitrary {duprId, userToken, refreshToken} and we'd persist
  // them. We FAIL CLOSED if the partner lookup doesn't return SUCCESS
  // with a matching id.
  let displayName: string | null = null;
  let singles: number | null = parseRating(body.stats?.singles ?? null);
  let doubles: number | null = parseRating(body.stats?.doubles ?? null);

  let detail: DuprUserDetail | null = null;
  try {
    const detailRes = await partnerFetch(supabase, `/user/v1.0/${duprId}`);
    detail = (await detailRes.json().catch(() => null)) as DuprUserDetail | null;
    if (!detailRes.ok || detail?.status !== "SUCCESS" || !detail.result?.id) {
      console.warn("dupr user detail rejected:", detailRes.status, detail);
      return err("dupr_verification_failed", 502, "dupr_verification_failed");
    }
  } catch (e) {
    console.error("dupr user detail fetch failed:", e);
    return err("dupr_verification_failed", 502, "dupr_verification_failed");
  }

  // Confirm the partner-reported id matches what the client claimed.
  if (String(detail.result.id).toUpperCase() !== duprId.toUpperCase()) {
    console.warn("dupr id mismatch:", detail.result.id, "vs claimed", duprId);
    return err("dupr_id_mismatch", 400, "dupr_id_mismatch");
  }

  const r = detail.result;
  if (typeof r.fullName === "string") displayName = r.fullName;
  const fetchedSingles = parseRating(r.ratings?.singles);
  const fetchedDoubles = parseRating(r.ratings?.doubles);
  if (fetchedSingles !== null) singles = fetchedSingles;
  if (fetchedDoubles !== null) doubles = fetchedDoubles;

  const now = new Date().toISOString();
  const profileUrl = `https://mydupr.com/dupr/players/${duprId}`;

  // ─── 3b. Conflict check: 1 DUPR account → 1 ThePickleHub user ─────────
  // profiles.dupr_id is UNIQUE. If another active SSO link already owns
  // this duprId, the profile UPDATE below would 23505 with a generic
  // 500. Detect ahead of time and return a typed 409 so the SPA can
  // show the right copy.
  const { data: ownerRow } = await supabase
    .from("dupr_user_tokens")
    .select("user_id")
    .eq("dupr_id", duprId)
    .is("revoked_at", null)
    .neq("user_id", user.id)
    .maybeSingle<{ user_id: string }>();
  if (ownerRow) {
    return err(
      "dupr_id_already_linked",
      409,
      "dupr_id_already_linked",
      {
        dupr_id: duprId,
        hint: "This DUPR account is linked to another ThePickleHub account. Sign in there or contact support.",
      },
    );
  }

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

  // ─── 4b. Subscribe to RATING webhook (best-effort) ─────────────────────
  // Idempotent on DUPR side — re-subscribe is a no-op. If the webhook URL
  // hasn't been registered yet (dupr-webhook-register), DUPR returns 400;
  // we log and continue so SSO still succeeds.
  let webhookSubscribedAt: string | null = null;
  try {
    const sub = await subscribeRating(supabase, duprId);
    if (sub.ok) {
      webhookSubscribedAt = new Date().toISOString();
      await supabase
        .from("dupr_user_tokens")
        .update({ webhook_subscribed_at: webhookSubscribedAt })
        .eq("user_id", user.id);
    } else {
      console.warn("subscribeRating non-ok:", sub.status, sub.body);
    }
  } catch (e) {
    console.warn("subscribeRating failed:", e);
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
