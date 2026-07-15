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

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { jsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  decryptUserToken,
  encryptUserTokenRequired,
  activeKeyVersion,
  type TokenColumn,
} from "../_shared/dupr-token-keyring.ts";
import { tokenState } from "../_shared/token-crypto.ts";

const PAGE = 100;

type Row = { user_id: string; access_token: string; refresh_token: string };

/** Returns the ciphertext to store, or null if this value is already current. */
async function toActive(
  value: string,
  active: string,
  column: TokenColumn,
  userId: string,
): Promise<string | null> {
  if (tokenState(value, active) === "current") return null;
  const plain = await decryptUserToken(value, column, userId); // plaintext→self, older enc→decrypt
  return await encryptUserTokenRequired(plain, column, userId); // asserts ciphertext
}

/**
 * Fresh verification scan — counts token VALUES (not rows) still needing work,
 * classified in JS via tokenState. Deliberately avoids a PostgREST `like`
 * count: the URL wildcard is `*` not `%`, so a `like.enc:%` filter silently
 * matches the wrong thing. This is the source of truth for "is backfill done?"
 * (both counters 0 = done, including after a rotation pass).
 */
async function countRemaining(
  supabase: SupabaseClient,
  active: string,
): Promise<{ plaintext: number; stale: number }> {
  let plaintext = 0;
  let stale = 0;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("dupr_user_tokens")
      .select("access_token, refresh_token")
      .order("user_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as Array<{ access_token: string; refresh_token: string }>) {
      for (const v of [r.access_token, r.refresh_token]) {
        const state = tokenState(v, active);
        if (state === "plaintext") plaintext++;
        else if (state === "stale") stale++;
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return { plaintext, stale };
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

  // Fresh verification scan so "done" reflects the DB, not the loop. Both
  // counters must be 0 to declare the backfill complete (stale catches a
  // rotation pass that hasn't finished re-encrypting old-version ciphertext).
  let remaining;
  try {
    remaining = await countRemaining(supabase, active);
  } catch (e) {
    console.error("backfill verify count failed:", e);
    return jsonResponse({ error: "verify_failed", scanned, rowsUpdated, tokensEncrypted }, 500);
  }

  return jsonResponse({
    ok: true,
    active_version: active,
    scanned,
    rows_updated: rowsUpdated,
    tokens_encrypted: tokensEncrypted,
    remaining_plaintext: remaining.plaintext,
    remaining_stale_version: remaining.stale,
    complete: remaining.plaintext === 0 && remaining.stale === 0,
  });
});
