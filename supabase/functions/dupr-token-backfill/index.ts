// ============================================================================
// dupr-token-backfill — one-off migration: encrypt existing plaintext tokens.
// ----------------------------------------------------------------------------
// Step 4 of TOKEN_ENCRYPTION_ROLLOUT.md. Reads dupr_user_tokens in pages, and
// for any row still holding a plaintext access_token/refresh_token, re-writes
// both columns encrypted (AAD-bound to the row's user_id). Idempotent — a row
// whose columns are already `enc:`-prefixed is skipped, so it is safe to re-run
// and safe to run before/after the writers are deployed.
//
// Gated backend-to-backend: the caller MUST present the service-role key as the
// bearer. Never expose this to end users. Requires DUPR_TOKEN_ENC_KEY_V1 to be
// set — without it encryptUserToken is a no-op and the function reports that
// nothing was encrypted (so you can't accidentally "backfill" into plaintext).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { encryptUserToken } from "../_shared/dupr-token-keyring.ts";
import { isEncrypted } from "../_shared/token-crypto.ts";

const PAGE = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Gate: service-role bearer only.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  // Refuse to run before the key exists — otherwise every "encrypt" is a no-op
  // and we'd falsely report success.
  if (!Deno.env.get("DUPR_TOKEN_ENC_KEY_V1") && !Deno.env.get("DUPR_TOKEN_ENC_KEY_V2")) {
    return jsonResponse({ error: "no_encryption_key_configured" }, 412);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false } },
  );

  let scanned = 0;
  let encrypted = 0;
  let from = 0;

  // Paginate by created row order. We re-write in place, so rows already
  // encrypted are simply skipped on this and any subsequent pass.
  for (;;) {
    const { data: rows, error } = await supabase
      .from("dupr_user_tokens")
      .select("user_id, access_token, refresh_token")
      .order("user_id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("backfill read failed:", error);
      return jsonResponse({ error: "read_failed", scanned, encrypted }, 500);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows as Array<{ user_id: string; access_token: string; refresh_token: string }>) {
      scanned++;
      const accessPlain = !isEncrypted(row.access_token);
      const refreshPlain = !isEncrypted(row.refresh_token);
      if (!accessPlain && !refreshPlain) continue; // already encrypted

      const update: Record<string, string> = {};
      if (accessPlain) {
        update.access_token = await encryptUserToken(row.access_token, "access_token", row.user_id);
      }
      if (refreshPlain) {
        update.refresh_token = await encryptUserToken(row.refresh_token, "refresh_token", row.user_id);
      }

      const { error: upErr } = await supabase
        .from("dupr_user_tokens")
        .update(update)
        .eq("user_id", row.user_id);

      if (upErr) {
        console.error("backfill update failed for", row.user_id, upErr);
        return jsonResponse({ error: "update_failed", scanned, encrypted }, 500);
      }
      encrypted++;
    }

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return jsonResponse({ ok: true, scanned, encrypted });
});
