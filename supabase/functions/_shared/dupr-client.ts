// ============================================================================
// _shared/dupr-client.ts — DUPR Partner API client helpers
// ----------------------------------------------------------------------------
// Shared by every dupr-* edge function. Centralizes:
//   - base URL per environment (uat vs prod)
//   - partner Bearer token fetch + DB cache (1h TTL with 5-min safety margin)
//   - small fetch wrapper that retries once on 401 (cached token rotated
//     mid-request).
//
// DUPR has two host families:
//   - Partner host (this file): <env>.mydupr.com/api  — partner Bearer
//     required, used for token/user/match/webhook endpoints.
//   - User host (api.<env>.dupr.gg): per-user Bearer required, used by
//     getBasicInfo / getSubscriptions / getClubMembership. NOT covered here;
//     functions that need it import buildUserApiUrl().
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export type DuprEnv = "uat" | "prod";

/** 5 minutes before nominal expiry — refresh proactively so in-flight
 *  requests don't race the expiry. */
const TOKEN_REFRESH_SAFETY_MS = 5 * 60 * 1000;

export function getDuprEnv(): DuprEnv {
  const v = (Deno.env.get("DUPR_ENV") ?? "uat").toLowerCase();
  return v === "prod" ? "prod" : "uat";
}

/** Partner API base, e.g. https://uat.mydupr.com/api */
export function buildPartnerApiUrl(env: DuprEnv = getDuprEnv()): string {
  return env === "prod"
    ? "https://prod.mydupr.com/api"
    : "https://uat.mydupr.com/api";
}

/** User API base, e.g. https://api.uat.dupr.gg */
export function buildUserApiUrl(env: DuprEnv = getDuprEnv()): string {
  return env === "prod"
    ? "https://api.dupr.gg"
    : "https://api.uat.dupr.gg";
}

/** SSO iframe origin, e.g. https://uat.dupr.gg */
export function buildSsoOrigin(env: DuprEnv = getDuprEnv()): string {
  return env === "prod"
    ? "https://dashboard.dupr.com"
    : "https://uat.dupr.gg";
}

interface TokenRow {
  access_token: string;
  expires_at: string;
}

interface MintResponse {
  status: string;
  result?: { token: string; expiry: string };
  message?: string;
}

/**
 * Returns a valid partner Bearer token. Reads the cached row first;
 * mints + persists a fresh token if the cached one is missing or within
 * the safety window of expiry.
 *
 * Requires service-role client (RLS denies all access to dupr_partner_tokens).
 */
export async function getPartnerToken(
  supabase: SupabaseClient,
  env: DuprEnv = getDuprEnv(),
): Promise<string> {
  const clientId = Deno.env.get("DUPR_CLIENT_ID") ?? "";
  const clientKey = Deno.env.get("DUPR_CLIENT_KEY") ?? "";
  const clientSecret = Deno.env.get("DUPR_CLIENT_SECRET") ?? "";

  if (!clientKey || !clientSecret) {
    throw new Error("dupr_credentials_missing");
  }

  // 1. Check cache.
  const { data: cached } = await supabase
    .from("dupr_partner_tokens")
    .select("access_token, expires_at")
    .eq("environment", env)
    .eq("client_id", clientId)
    .maybeSingle<TokenRow>();

  if (cached) {
    const expiresMs = new Date(cached.expires_at).getTime();
    if (expiresMs - Date.now() > TOKEN_REFRESH_SAFETY_MS) {
      return cached.access_token;
    }
  }

  // 2. Mint a new token.
  const authHeader = btoa(`${clientKey}:${clientSecret}`);
  const res = await fetch(`${buildPartnerApiUrl(env)}/auth/v1.0/token`, {
    method: "POST",
    headers: {
      "x-authorization": authHeader,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const body = (await res.json().catch(() => null)) as MintResponse | null;

  if (!res.ok || !body?.result?.token) {
    const msg = body?.message ?? `http_${res.status}`;
    throw new Error(`dupr_token_mint_failed:${msg}`);
  }

  const token = body.result.token;
  const expiresAt = body.result.expiry;

  // 3. Upsert cache.
  await supabase
    .from("dupr_partner_tokens")
    .upsert(
      {
        environment: env,
        client_id: clientId,
        access_token: token,
        expires_at: expiresAt,
        refreshed_at: new Date().toISOString(),
      },
      { onConflict: "environment,client_id" },
    );

  return token;
}

/**
 * Authenticated fetch against the DUPR partner API. Retries once on 401
 * (token rotated mid-request) by forcing a fresh mint.
 */
export async function partnerFetch(
  supabase: SupabaseClient,
  path: string,
  init: RequestInit = {},
  env: DuprEnv = getDuprEnv(),
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${buildPartnerApiUrl(env)}${path}`;

  const doFetch = async (token: string) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

  let token = await getPartnerToken(supabase, env);
  let res = await doFetch(token);

  if (res.status === 401) {
    // Invalidate cache and retry once with a freshly minted token.
    await supabase
      .from("dupr_partner_tokens")
      .delete()
      .eq("environment", env);
    token = await getPartnerToken(supabase, env);
    res = await doFetch(token);
  }

  return res;
}

/**
 * Subscribe one DUPR user to RATING webhook events. Idempotent on DUPR's
 * side — re-subscribing returns SUCCESS with no side effects. Safe to call
 * from dupr-sso-callback every time a user re-connects.
 */
export async function subscribeRating(
  supabase: SupabaseClient,
  duprId: string,
  env: DuprEnv = getDuprEnv(),
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await partnerFetch(
    supabase,
    "/user/v1.0/subscribe/webhook-event",
    {
      method: "POST",
      body: JSON.stringify({ duprIds: [duprId], topic: "RATING" }),
    },
    env,
  );
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

/**
 * Inverse of subscribeRating. Called from dupr-disconnect.
 */
export async function unsubscribeRating(
  supabase: SupabaseClient,
  duprId: string,
  env: DuprEnv = getDuprEnv(),
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await partnerFetch(
    supabase,
    "/user/v1.0/subscribe/webhook-event",
    {
      method: "DELETE",
      body: JSON.stringify({ duprIds: [duprId], topic: "RATING" }),
    },
    env,
  );
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}
