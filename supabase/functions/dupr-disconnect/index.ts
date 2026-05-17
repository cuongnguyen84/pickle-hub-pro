// ============================================================================
// dupr-disconnect — user unlinks their DUPR account
// ----------------------------------------------------------------------------
// 1. Best-effort unsubscribe from RATING webhook on DUPR side (so we stop
//    receiving updates immediately, not just when the next event fires
//    against a missing user_token row).
// 2. Soft-revokes the user's row in dupr_user_tokens (sets revoked_at).
// 3. Nulls the DUPR fields on profiles.
//
// History rows are kept for audit.
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { unsubscribeRating } from "../_shared/dupr-client.ts";

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

  const now = new Date().toISOString();

  // ─── 1. Unsubscribe from DUPR RATING webhook (best-effort) ─────────────
  const { data: tokenLookup } = await supabase
    .from("dupr_user_tokens")
    .select("dupr_id")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle<{ dupr_id: string }>();

  if (tokenLookup?.dupr_id) {
    try {
      const unsub = await unsubscribeRating(supabase, tokenLookup.dupr_id);
      if (!unsub.ok) {
        console.warn("unsubscribeRating non-ok:", unsub.status, unsub.body);
      }
    } catch (e) {
      console.warn("unsubscribeRating failed:", e);
    }
  }

  const { error: tokenError } = await supabase
    .from("dupr_user_tokens")
    .update({ revoked_at: now, webhook_subscribed_at: null })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (tokenError) {
    console.error("dupr_user_tokens revoke failed:", tokenError);
    return err("token_revoke_failed", 500, "token_revoke_failed");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      dupr_id: null,
      dupr_singles: null,
      dupr_doubles: null,
      dupr_profile_url: null,
      dupr_synced_at: null,
      dupr_last_error: null,
      dupr_connected_via: null,
    })
    .eq("id", user.id);

  if (profileError) {
    console.error("profiles disconnect failed:", profileError);
    return err("profile_update_failed", 500, "profile_update_failed");
  }

  return jsonResponse({ disconnected_at: now });
});
