// ============================================================================
// dupr-webhook-register — register our webhook URL with DUPR (setup step)
// ----------------------------------------------------------------------------
// Idempotent admin/setup function. POSTs to DUPR partner API
// POST /v1.0/webhook to register the public dupr-webhook URL.
//
// Call this ONCE per environment (UAT, prod). Re-running with the same URL
// is a no-op on DUPR's side (per docs the registration replaces any prior).
//
// Requires the Supabase service-role key as the bearer (same pattern as
// dupr-partner-token).
//
// The webhookUrl is auto-derived from SUPABASE_URL — override with
// `?url=https://...` if you want to register a different host (e.g. a
// proxy in front of the function).
//
// verify_jwt = false in config.toml; service-role enforced internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { partnerFetch, getDuprEnv } from "../_shared/dupr-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!serviceKey || auth !== serviceKey) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
  );

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const defaultWebhookUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/dupr-webhook`;
  const override = new URL(req.url).searchParams.get("url");
  const webhookUrl = override ?? defaultWebhookUrl;

  if (!/^https:\/\/.+/.test(webhookUrl)) {
    return jsonResponse({ error: "invalid_webhook_url", webhookUrl }, 400);
  }

  try {
    const res = await partnerFetch(supabase, "/v1.0/webhook", {
      method: "POST",
      body: JSON.stringify({ webhookUrl, topics: ["RATING"] }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return jsonResponse(
        { error: "dupr_register_failed", status: res.status, body },
        502,
      );
    }
    return jsonResponse({
      registered: true,
      environment: getDuprEnv(),
      webhookUrl,
      topics: ["RATING"],
      dupr_response: body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("webhook registration failed:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
