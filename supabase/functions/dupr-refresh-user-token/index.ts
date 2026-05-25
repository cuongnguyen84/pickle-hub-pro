// ============================================================================
// dupr-refresh-user-token — refresh the calling user's DUPR access token
// ----------------------------------------------------------------------------
// DUPR user access tokens are 7-day; refresh tokens are 30-day. When an
// endpoint that needs the user token (entitlements, club membership)
// returns 401, the client can POST to this function. We hit DUPR's refresh
// endpoint with the stored refresh_token and persist the new pair.
//
// Returns:
//   200 + { access_token (NEW), refreshed_at }   on success
//   401 + { error: "token_expired" }             refresh_token rejected
//   412 + { error: "dupr_not_connected" }        no row, or row revoked
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { buildUserApiUrl, getDuprEnv } from "../_shared/dupr-client.ts";

interface RefreshResponse {
  status?: string;
  result?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  message?: string;
}

function err(error: string, status: number, code?: string) {
  return jsonResponse({ error, ...(code ? { code } : {}) }, status);
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
  if (!user) return err("unauthorized", 401, "unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // 1. Read the current token row.
  const { data: tokenRow, error: rowErr } = await supabase
    .from("dupr_user_tokens")
    .select("refresh_token, revoked_at, dupr_id")
    .eq("user_id", user.id)
    .maybeSingle<{
      refresh_token: string;
      revoked_at: string | null;
      dupr_id: string;
    }>();

  if (rowErr) {
    console.error("dupr_user_tokens read failed:", rowErr);
    return err("token_read_failed", 500, "token_read_failed");
  }
  if (!tokenRow || tokenRow.revoked_at) {
    return err("dupr_not_connected", 412, "dupr_not_connected");
  }

  // 2. Call DUPR's refresh endpoint on the user API host.
  // Path per DUPR FAQ: POST /auth/v1.0/refresh with refreshToken body.
  let body: RefreshResponse;
  try {
    const res = await fetch(
      `${buildUserApiUrl(getDuprEnv())}/auth/v1.0/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokenRow.refresh_token }),
      },
    );
    body = (await res.json().catch(() => null)) as RefreshResponse;

    if (res.status === 401 || res.status === 403) {
      // Refresh token rejected — mark row revoked so SPA prompts re-SSO.
      await supabase
        .from("dupr_user_tokens")
        .update({
          revoked_at: new Date().toISOString(),
          webhook_subscribed_at: null,
        })
        .eq("user_id", user.id);
      return err("token_expired", 401, "token_expired");
    }

    if (!res.ok || body?.status !== "SUCCESS" || !body?.result?.accessToken) {
      console.warn("dupr refresh non-ok:", res.status, body);
      return err("dupr_refresh_failed", 502, "dupr_refresh_failed");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("dupr refresh fetch failed:", msg);
    return err("dupr_refresh_failed", 502, "dupr_refresh_failed");
  }

  // 3. Persist the new token pair.
  const now = new Date().toISOString();
  const newAccess = body.result!.accessToken!;
  const newRefresh = body.result!.refreshToken ?? tokenRow.refresh_token;

  const { error: updateErr } = await supabase
    .from("dupr_user_tokens")
    .update({
      access_token: newAccess,
      refresh_token: newRefresh,
      last_refreshed_at: now,
    })
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("dupr_user_tokens update failed:", updateErr);
    return err("token_persist_failed", 500, "token_persist_failed");
  }

  return jsonResponse({
    refreshed_at: now,
    // Do not echo the new access token to the SPA — front-end should never
    // see the raw user token (security hardening migration revoked column-
    // level grants on access_token/refresh_token).
    ok: true,
  });
});
