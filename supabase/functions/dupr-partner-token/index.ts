// ============================================================================
// dupr-partner-token — service-only token vending
// ----------------------------------------------------------------------------
// POST with the Supabase service-role key as the bearer. Returns a valid
// DUPR partner Bearer token, minting + caching a new one if the cached
// row is missing or near expiry.
//
// Almost no caller will hit this directly — every other dupr-* edge fn
// imports getPartnerToken() from _shared/dupr-client.ts and calls it in
// process. This function exists for:
//   - Manual token inspection during integration (curl-debug from admin)
//   - Future external services that need a partner token without
//     embedding DUPR_CLIENT_SECRET themselves.
//
// verify_jwt = false in config.toml; we enforce service-role bearer here.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { getPartnerToken, getDuprEnv } from "../_shared/dupr-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (!serviceKey || auth !== serviceKey) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
  );

  try {
    const token = await getPartnerToken(supabase);
    return jsonResponse({
      environment: getDuprEnv(),
      access_token: token,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("dupr-partner-token failed:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
