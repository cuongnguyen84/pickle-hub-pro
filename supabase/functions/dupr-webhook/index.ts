// ============================================================================
// dupr-webhook — receive RATING events from DUPR
// ----------------------------------------------------------------------------
// Public endpoint registered with DUPR via POST /v1.0/webhook
// (see dupr-webhook-register). DUPR POSTs a payload like:
//
//   {
//     "clientId":  "5892527483",
//     "event":     "RATING",
//     "timestamp": "1778953113",
//     "message": {
//       "duprId":             "1A1A1A",
//       "name":               "Player Name",
//       "rating": {
//         "singles":              "4.0",
//         "doubles":              "4.0",
//         "singlesReliability":   "0.9",
//         "doublesReliability":   "0.9",
//         "matchId":              12345,
//         "singlesProvisional":   "4.0",
//         "doublesProvisional":   "4.0"
//       }
//     }
//   }
//
// DUPR does not provide a separate signature header. Production payloads put
// the partner CLIENT_KEY in clientId, so it is treated as a shared secret:
//   1. Bound the request body and match clientId against DUPR_CLIENT_KEY.
//   2. Claim a payload digest once so retries cannot duplicate history rows.
//   3. Look up the duprId in dupr_user_tokens (rejects unknown players).
//   4. Persist a redacted event + update profile + history.
//
// MUST return 200 OK within a few seconds (DUPR retries otherwise).
//
// verify_jwt = false in config.toml; no JWT — public.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  parseJsonObject,
  readBoundedBody,
  secretsMatch,
  sha256Hex,
} from "./security.ts";

interface RatingPayload {
  clientId?: string | number;
  event?: string;
  timestamp?: string | number;
  message?: {
    duprId?: string;
    name?: string;
    rating?: {
      singles?: number | string | null;
      doubles?: number | string | null;
      singlesReliability?: number | string | null;
      doublesReliability?: number | string | null;
      matchId?: number | string | null;
      singlesProvisional?: number | string | null;
      doublesProvisional?: number | string | null;
    };
  };
}

const RATING_MIN = 2.0;
const RATING_MAX = 7.0;

function parseRating(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < RATING_MIN || n > RATING_MAX) return null;
  return Math.round(n * 100) / 100;
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const rawBody = await readBoundedBody(req);
  if (rawBody === null) {
    return jsonResponse({ error: "payload_too_large" }, 413);
  }

  const parsedPayload = parseJsonObject(rawBody);
  if (!parsedPayload) {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  const payload = parsedPayload as RatingPayload;

  // DUPR sends the CLIENT_KEY (e.g. "test-ck-abc...") in the clientId field
  // of webhook payloads. Treat it as the callback's proof of purpose.
  const expectedClientKey = Deno.env.get("DUPR_CLIENT_KEY") ?? "";
  const incomingClientId = String(payload.clientId ?? "");
  const event = String(payload.event ?? "");
  const duprId = payload.message?.duprId ?? null;

  // ─── Fail closed if the callback secret is not configured ──────────────
  if (!expectedClientKey) {
    console.error("dupr-webhook: DUPR_CLIENT_KEY is unset — refusing");
    return jsonResponse(
      { status: "error", reason: "server_misconfigured" },
      503,
    );
  }

  // ─── Validate clientId BEFORE persisting (avoid storage amplification) ─
  if (!secretsMatch(incomingClientId, expectedClientKey)) {
    console.warn("dupr-webhook: client_key_mismatch");
    return jsonResponse({ status: "ignored", reason: "client_key_mismatch" }, 401);
  }

  // ─── Claim + log event (secret redacted, exact retries deduplicated) ───
  const eventKey = await sha256Hex(rawBody);
  const clientFingerprint = (await sha256Hex(incomingClientId)).slice(0, 16);
  const storedPayload = {
    ...(payload as unknown as Record<string, unknown>),
    clientId: "[redacted]",
  };
  const { data: logRow, error: logError } = await supabase
    .from("dupr_webhook_events")
    .insert({
      topic: event,
      dupr_id: duprId,
      client_id: `sha256:${clientFingerprint}`,
      event_key: eventKey,
      payload: storedPayload,
    })
    .select("id")
    .single<{ id: number }>();

  if (logError?.code === "23505") {
    return jsonResponse({ status: "ok", reason: "duplicate_event" });
  }
  if (logError || !logRow) {
    console.error("dupr-webhook: event claim failed", logError?.message ?? "no row");
    return jsonResponse({ status: "error", reason: "event_claim_failed" }, 503);
  }

  const logId = logRow.id;

  const markProcessed = async (err?: string) => {
    if (!logId) return;
    await supabase
      .from("dupr_webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_error: err ?? null,
      })
      .eq("id", logId);
  };

  // ─── REGISTRATION + RATING_SEED are handshake events — ack but no-op ───
  if (event === "REGISTRATION" || event === "RATING_SEED") {
    await markProcessed();
    return jsonResponse({ status: "ok", reason: `${event}_acknowledged` });
  }

  if (event !== "RATING") {
    await markProcessed("unsupported_event");
    return jsonResponse({ status: "ignored", reason: "unsupported_event" });
  }

  if (!duprId) {
    await markProcessed("missing_dupr_id");
    return jsonResponse({ status: "ignored", reason: "missing_dupr_id" });
  }

  // ─── Look up user via dupr_user_tokens.dupr_id ──────────────────────────
  const { data: tokenRow } = await supabase
    .from("dupr_user_tokens")
    .select("user_id, revoked_at")
    .eq("dupr_id", duprId)
    .is("revoked_at", null)
    .maybeSingle<{ user_id: string; revoked_at: string | null }>();

  if (!tokenRow) {
    await markProcessed("user_not_found");
    return jsonResponse({ status: "ignored", reason: "user_not_found" });
  }

  const rating = payload.message?.rating ?? {};
  const singles = parseRating(rating.singles);
  const doubles = parseRating(rating.doubles);

  const now = new Date().toISOString();
  const profileUpdate: Record<string, unknown> = {
    dupr_synced_at: now,
    dupr_last_error: null,
    dupr_last_attempt_at: now,
  };
  if (singles !== null) profileUpdate.dupr_singles = singles;
  if (doubles !== null) profileUpdate.dupr_doubles = doubles;

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", tokenRow.user_id);

  if (profileError) {
    console.error("profiles update failed:", profileError);
    await markProcessed(`profile_update_failed:${profileError.message}`);
    // Still 200 — DUPR retries don't help with our DB error.
    return jsonResponse({ status: "error", reason: "profile_update_failed" });
  }

  // History snapshot — only if at least one rating changed.
  if (singles !== null || doubles !== null) {
    const { error: historyError } = await supabase
      .from("dupr_rating_history")
      .insert({
        profile_id: tokenRow.user_id,
        source: "dupr_webhook",
        dupr_singles: singles,
        dupr_doubles: doubles,
        recorded_at: now,
      });
    if (historyError) {
      console.warn("dupr_rating_history insert failed:", historyError);
    }
  }

  await markProcessed();
  return jsonResponse({
    status: "ok",
    dupr_id: duprId,
    singles,
    doubles,
  });
});
