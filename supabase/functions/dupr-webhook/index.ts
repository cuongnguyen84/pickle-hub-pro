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
// DUPR provides no signature header, and the clientId it sends is the SAME
// value as the PUBLIC frontend VITE_DUPR_CLIENT_KEY (embedded in the JS
// bundle — anyone can read it). So clientId is NOT a secret and the webhook
// body is UNTRUSTED. The rating numbers in the payload are never persisted;
// they only tell us "this duprId changed". We then PULL the authoritative
// rating over the partner API (Bearer-authenticated, forge-proof):
//   1. Bound the request body; secretsMatch(clientId) is a cheap spam filter
//      only, NOT auth — treat every field as attacker-controlled.
//   2. Claim a payload digest once so retries cannot duplicate history rows.
//   3. Look up the duprId in dupr_user_tokens (rejects unknown players — no
//      partner call is made for unlinked/forged duprIds).
//   4. GET /user/v1.0/{duprId} via partner token; persist the ratings IT
//      returns, ignoring whatever the payload claimed.
//
// MUST return 200 OK within a few seconds (DUPR retries otherwise).
//
// verify_jwt = false in config.toml; no JWT — public.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { jsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { partnerFetch } from "../_shared/dupr-client.ts";
import {
  parseJsonObject,
  readBoundedBody,
  secretsMatch,
  sha256Hex,
} from "./security.ts";

interface DuprUserDetail {
  status?: string;
  result?: {
    id?: string;
    ratings?: {
      singles?: number | string | null;
      doubles?: number | string | null;
    };
  };
}

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

  // clientId == the PUBLIC frontend key. Matching it is a spam filter, not
  // authentication — the trust boundary is the partner-API pull below.
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

  // ─── Cheap spam filter BEFORE persisting (avoid storage amplification) ─
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

  // ─── Pull the AUTHORITATIVE rating (payload numbers are untrusted) ──────
  // GET /user/v1.0/{duprId} over the partner Bearer token. A forged webhook
  // can make us pull for a real linked duprId, but the value we persist is
  // whatever DUPR returns here — never what the attacker put in the body.
  let detail: DuprUserDetail | null = null;
  try {
    const detailRes = await partnerFetch(supabase, `/user/v1.0/${duprId}`);
    detail = (await detailRes.json().catch(() => null)) as DuprUserDetail | null;
    if (!detailRes.ok || detail?.status !== "SUCCESS" || !detail.result?.id) {
      await markProcessed("dupr_pull_failed");
      return jsonResponse({ status: "error", reason: "dupr_pull_failed" });
    }
  } catch (e) {
    console.error("dupr-webhook: partner pull failed", String(e));
    await markProcessed("dupr_pull_failed");
    return jsonResponse({ status: "error", reason: "dupr_pull_failed" });
  }

  // Confirm DUPR echoed the same id we looked up (defense against a payload
  // duprId that maps to a linked user but a different real account).
  if (String(detail.result.id).toUpperCase() !== String(duprId).toUpperCase()) {
    await markProcessed("dupr_id_mismatch");
    return jsonResponse({ status: "ignored", reason: "dupr_id_mismatch" });
  }

  const singles = parseRating(detail.result.ratings?.singles);
  const doubles = parseRating(detail.result.ratings?.doubles);

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
