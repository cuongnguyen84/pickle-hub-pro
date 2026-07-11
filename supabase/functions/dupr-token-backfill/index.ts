// ============================================================================
// dupr-token-backfill — one-off migration: encrypt/re-encrypt stored tokens.
// ----------------------------------------------------------------------------
// Step 4 of TOKEN_ENCRYPTION_ROLLOUT.md. Reads dupr_user_tokens in pages and
// brings every access_token/refresh_token to the ACTIVE key version:
//   • plaintext          → encrypt (fail-closed via encryptUserTokenRequired)
//   • enc:<older-version> → decrypt with the retained key, re-encrypt (rotation)
//   • enc:<active>        → skip (idempotent)
//
// Fail-closed: refuses to run without a key, uses required-encryption (throws
// rather than writing plaintext), and reports remaining_plaintext from a fresh
// count so "done" means the DB is actually clean — not just that the loop ran.
//
// Gated backend-to-backend: caller MUST present the service-role key as bearer.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  decryptUserToken,
  encryptUserTokenRequired,
  activeKeyVersion,
  type TokenColumn,
} from "../_shared/dupr-token-keyring.ts";
import { tokenVersion } from "../_shared/token-crypto.ts";

const PAGE = 100;

type Row = { user_id: string; access_token: string; refresh_token: string };

/** Returns the ciphertext to store, or null if this value is already current. */
async function toActive(
  value: string,
  active: string,
  column: TokenColumn,
  userId: string,
): Promise<string | null> {
  if (tokenVersion(value) === active) return null; // already at active version
  const plain = await decryptUserToken(value, column, userId); // plaintext→self, older enc→decrypt
  return await encryptUserTokenRequired(plain, column, userId); // asserts ciphertext
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  // Precondition: a key must be configured, or every "encrypt" would be a no-op.
  const active = await activeKeyVersion();
  if (!active) return jsonResponse({ error: "no_encryption_key_configured" }, 412);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false },
  });

  let scanned = 0;
  let rowsUpdated = 0;
  let tokensEncrypted = 0;
  let from = 0;

  for (;;) {
    const { data: rows, error } = await supabase
      .from("dupr_user_tokens")
      .select("user_id, access_token, refresh_token")
      .order("user_id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("backfill read failed:", error);
      return jsonResponse({ error: "read_failed", scanned, rowsUpdated, tokensEncrypted }, 500);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows as Row[]) {
      scanned++;
      const update: Record<string, string> = {};

      const nextAccess = await toActive(row.access_token, active, "access_token", row.user_id);
      if (nextAccess !== null) update.access_token = nextAccess;

      const nextRefresh = await toActive(row.refresh_token, active, "refresh_token", row.user_id);
      if (nextRefresh !== null) update.refresh_token = nextRefresh;

      if (Object.keys(update).length === 0) continue;

      const { error: upErr } = await supabase
        .from("dupr_user_tokens")
        .update(update)
        .eq("user_id", row.user_id);
      if (upErr) {
        console.error("backfill update failed for", row.user_id, upErr);
        return jsonResponse({ error: "update_failed", scanned, rowsUpdated, tokensEncrypted }, 500);
      }
      rowsUpdated++;
      tokensEncrypted += Object.keys(update).length;
    }

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  // Fresh count so "done" reflects the DB, not the loop.
  const { count: remainingPlaintext } = await supabase
    .from("dupr_user_tokens")
    .select("user_id", { count: "exact", head: true })
    .or("access_token.not.like.enc:%,refresh_token.not.like.enc:%");

  return jsonResponse({
    ok: true,
    active_version: active,
    scanned,
    rows_updated: rowsUpdated,
    tokens_encrypted: tokensEncrypted,
    remaining_plaintext: remainingPlaintext ?? null,
  });
});
