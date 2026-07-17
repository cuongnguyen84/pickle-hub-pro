// ============================================================================
// dupr-webhook — receive RATING events from DUPR
// ----------------------------------------------------------------------------
// Public endpoint registered with DUPR via POST /v1.0/webhook. DUPR POSTs:
//
//   {
//     "clientId": "5892527483", "event": "RATING", "timestamp": "1778953113",
//     "message": { "duprId": "1A1A1A", "name": "...", "rating": { ... } }
//   }
//
// DUPR provides no signature header, and the clientId it sends is the SAME
// value as the PUBLIC frontend VITE_DUPR_CLIENT_KEY (embedded in the JS
// bundle — anyone can read it). So clientId is NOT a secret and the webhook
// body is UNTRUSTED. The rating numbers in the payload are never persisted;
// they only tell us "this duprId changed". We PULL the authoritative rating
// over the partner API (Bearer-authenticated, forge-proof).
//
// All logic lives in handler.ts (Deno-free, unit-tested). This file is the
// Deno.serve wrapper + the supabase-backed WebhookStore.
//
// MUST return 200 OK for terminal outcomes; a non-2xx makes DUPR retry.
// verify_jwt = false in config.toml; no JWT — public.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { jsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { partnerFetch } from "../_shared/dupr-client.ts";
import { readBoundedBody } from "./security.ts";
import { processDuprWebhook, type WebhookStore } from "./handler.ts";

function createSupabaseStore(supabase: SupabaseClient): WebhookStore {
  return {
    async claimEvent(input) {
      const { data, error } = await supabase
        .from("dupr_webhook_events")
        .insert({
          topic: input.topic,
          dupr_id: input.duprId,
          client_id: `sha256:${input.clientFingerprint}`,
          event_key: input.eventKey,
          payload: input.payload,
        })
        .select("id")
        .single<{ id: number }>();
      if (error?.code === "23505") return { id: null, duplicate: true, error: null };
      if (error || !data) {
        return { id: null, duplicate: false, error: error?.message ?? "no_row" };
      }
      return { id: data.id, duplicate: false, error: null };
    },
    async releaseEvent(id) {
      await supabase.from("dupr_webhook_events").delete().eq("id", id);
    },
    async markProcessed(id, nowIso, error) {
      await supabase
        .from("dupr_webhook_events")
        .update({ processed_at: nowIso, processing_error: error ?? null })
        .eq("id", id);
    },
    async findActiveToken(duprId) {
      const { data } = await supabase
        .from("dupr_user_tokens")
        .select("user_id, revoked_at")
        .eq("dupr_id", duprId)
        .is("revoked_at", null)
        .maybeSingle<{ user_id: string; revoked_at: string | null }>();
      return data ? { user_id: data.user_id } : null;
    },
    async updateProfile(userId, update) {
      const { error } = await supabase.from("profiles").update(update).eq("id", userId);
      return { error: error?.message ?? null };
    },
    async insertRatingHistory(input) {
      const { error } = await supabase.from("dupr_rating_history").insert({
        profile_id: input.profileId,
        source: "dupr_webhook",
        dupr_singles: input.singles,
        dupr_doubles: input.doubles,
        recorded_at: input.recordedAt,
      });
      return { error: error?.message ?? null };
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // DUPR may probe with GET during registration handshake — return 200.
  if (req.method === "GET") {
    return jsonResponse({ status: "ok" });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const rawBody = await readBoundedBody(req);
  if (rawBody === null) {
    return jsonResponse({ error: "payload_too_large" }, 413);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const result = await processDuprWebhook(
    {
      store: createSupabaseStore(supabase),
      partnerFetch: (path) => partnerFetch(supabase, path),
      expectedClientKey: Deno.env.get("DUPR_CLIENT_KEY") ?? "",
      now: () => new Date().toISOString(),
    },
    rawBody,
  );

  return jsonResponse(result.body, result.status);
});
