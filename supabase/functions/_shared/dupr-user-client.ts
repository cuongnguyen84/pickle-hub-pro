// ============================================================================
// _shared/dupr-user-client.ts — DUPR User API helpers (per-user bearer)
// ----------------------------------------------------------------------------
// The DUPR partner ecosystem has two API hosts:
//
//   - Partner host: <env>.mydupr.com/api  (handled by dupr-client.ts)
//   - User host:    api.<env>.dupr.gg     (this file)
//
// User host calls authenticate with the per-user access token returned from
// the SSO flow (stored in dupr_user_tokens.access_token). Read-only by
// design — DUPR rejects write attempts even with a valid user token.
//
// Per DUPR FAQ: requests for users who have not authenticated via SSO will
// return 403 Forbidden, so callers must confirm dupr_user_tokens.revoked_at
// IS NULL before calling.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { buildUserApiUrl, getDuprEnv, type DuprEnv } from "./dupr-client.ts";

interface UserTokenRow {
  access_token: string;
  refresh_token: string;
  revoked_at: string | null;
}

/**
 * Returns a usable user access token for the given Supabase user, or null
 * if the user hasn't completed SSO or has disconnected. Caller decides 401
 * vs 412 vs feature-disabled UX.
 */
export async function getUserAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserTokenRow | null> {
  const { data, error } = await supabase
    .from("dupr_user_tokens")
    .select("access_token, refresh_token, revoked_at")
    .eq("user_id", userId)
    .maybeSingle<UserTokenRow>();

  if (error || !data) return null;
  if (data.revoked_at) return null;
  return data;
}

/**
 * Authenticated fetch against the DUPR user API. Does NOT retry on 401 —
 * DUPR user tokens are 7-day, so a 401 means the user revoked from DUPR
 * side and re-SSO is required.
 */
export async function userFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  env: DuprEnv = getDuprEnv(),
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${buildUserApiUrl(env)}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}
