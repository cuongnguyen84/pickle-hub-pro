// ============================================================================
// zalo-token-refresh — refresh the Zalo OA access token on a cron schedule
// ----------------------------------------------------------------------------
// This function rotates credentials stored in the service-role-only
// `zalo_tokens` table. The scheduled caller must authenticate with the shared
// CRON_SECRET; never expose this handler as a public health-check endpoint.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";
import { zaloCronCorsHeaders as corsHeaders } from "../_shared/cors.ts";

interface ZaloRefreshResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  error?: number;
  error_name?: string;
  error_description?: string;
  message?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "zalo-token-refresh", ...payload }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
  if (authError) return authError;

  const appId = Deno.env.get("ZALO_APP_ID") ?? "";
  const secretKey = Deno.env.get("ZALO_APP_SECRET_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!appId || !secretKey || !supabaseUrl || !serviceRoleKey) {
    logEvent({
      error: "missing_env",
      app_id_configured: Boolean(appId),
      app_secret_configured: Boolean(secretKey),
      supabase_url_configured: Boolean(supabaseUrl),
      service_role_configured: Boolean(serviceRoleKey),
    });
    return json({ ok: false, error: "missing_env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: row, error: loadError } = await supabase
    .from("zalo_tokens")
    .select("refresh_token")
    .eq("id", 1)
    .maybeSingle();

  if (loadError) {
    logEvent({ error: "db_load_failed", message: loadError.message });
    return json({ ok: false, error: "db_load_failed" }, 500);
  }

  if (!row?.refresh_token) {
    logEvent({ error: "no_refresh_token" });
    return json({ ok: false, error: "no_refresh_token" }, 412);
  }

  const formBody = new URLSearchParams({
    refresh_token: row.refresh_token,
    app_id: appId,
    grant_type: "refresh_token",
  });

  let zaloResponse: ZaloRefreshResponse;
  let httpStatus = 0;
  try {
    const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: {
        secret_key: secretKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });
    httpStatus = response.status;
    zaloResponse = (await response.json()) as ZaloRefreshResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent({ error: "network_failure", message });
    await supabase
      .from("zalo_tokens")
      .update({
        last_refresh_at: new Date().toISOString(),
        last_refresh_error: `network: ${message}`.slice(0, 500),
      })
      .eq("id", 1);
    return json({ ok: false, error: "network_failure" }, 502);
  }

  if (!zaloResponse.access_token || !zaloResponse.refresh_token) {
    const errorMessage =
      zaloResponse.error_description ??
      zaloResponse.message ??
      `zalo_error_${zaloResponse.error ?? "unknown"}`;
    logEvent({
      error: "zalo_error",
      http_status: httpStatus,
      zalo_error: zaloResponse.error,
      zalo_error_name: zaloResponse.error_name,
      message: errorMessage,
    });
    await supabase
      .from("zalo_tokens")
      .update({
        last_refresh_at: new Date().toISOString(),
        last_refresh_error: `zalo: ${errorMessage}`.slice(0, 500),
      })
      .eq("id", 1);
    return json({ ok: false, error: "zalo_error" }, 502);
  }

  const parsedExpiresIn = Number.parseInt(zaloResponse.expires_in ?? "90000", 10);
  const expiresInSeconds = Number.isFinite(parsedExpiresIn) ? parsedExpiresIn : 90000;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const refreshedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("zalo_tokens")
    .update({
      access_token: zaloResponse.access_token,
      refresh_token: zaloResponse.refresh_token,
      expires_at: expiresAt,
      last_refresh_at: refreshedAt,
      last_refresh_error: null,
    })
    .eq("id", 1);

  if (updateError) {
    logEvent({ error: "db_update_failed", message: updateError.message });
    return json({ ok: false, error: "db_update_failed" }, 500);
  }

  logEvent({ step: "refresh_ok", expires_at: expiresAt });
  return json({ ok: true, expires_at: expiresAt, refreshed_at: refreshedAt });
});
