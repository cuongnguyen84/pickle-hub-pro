// ============================================================================
// reactivate-registration — Social Events MVP (PR58) edge function
// ----------------------------------------------------------------------------
// POST { magic_token }
//
// Player-facing reactivate flow for /dang-ky/:magic_token. Re-opens a
// previously cancelled registration *only if* the event is still open
// and a free slot is available. Keeps the same registration row +
// magic_token so the player doesn't have to re-OTP.
//
// Flow:
//   1. Validate magic_token shape.
//   2. Lookup registration_id via registration_secrets.
//   3. Fetch registration + event. Reject if:
//      - registration not actually cancelled (idempotent no-op)
//      - event already started / cancelled / completed
//      - event would be over capacity once we re-add this row
//   4. UPDATE event_registrations SET status='registered',
//      cancelled_at=NULL, cancelled_reason=NULL.
//   5. Return { ok }.
//
// verify_jwt=false; service-role client.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReactivateBody {
  magic_token?: unknown;
}

function err(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "reactivate-registration", ...payload }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  let body: ReactivateBody;
  try {
    body = (await req.json()) as ReactivateBody;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const magicToken = typeof body.magic_token === "string" ? body.magic_token.trim() : "";
  if (!UUID_RE.test(magicToken)) {
    return err("invalid_magic_token", 400, "invalid_magic_token");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── 1. Resolve magic_token → registration_id ────────────────────────────
  const { data: secret, error: secretErr } = await supabase
    .from("registration_secrets")
    .select("registration_id")
    .eq("magic_token", magicToken)
    .maybeSingle();

  if (secretErr) {
    logEvent({ step: "lookup_secret", error: secretErr.message });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!secret) return err("not_found", 404, "not_found");

  const registrationId = secret.registration_id as string;

  // ─── 2. Fetch registration ───────────────────────────────────────────────
  const { data: reg, error: regErr } = await supabase
    .from("event_registrations")
    .select("id, event_id, status, cancelled_at")
    .eq("id", registrationId)
    .maybeSingle();

  if (regErr) {
    logEvent({ step: "lookup_registration", error: regErr.message });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!reg) return err("registration_missing", 404, "registration_missing");
  if (!reg.cancelled_at) {
    // Already active — idempotent success.
    return jsonResponse({ ok: true, already_active: true });
  }

  // ─── 3. Event guard rails ────────────────────────────────────────────────
  const { data: event, error: eventErr } = await supabase
    .from("social_events")
    .select("id, status, start_at, max_players")
    .eq("id", reg.event_id)
    .maybeSingle();

  if (eventErr) {
    logEvent({ step: "lookup_event", error: eventErr.message });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!event) return err("event_missing", 404, "event_missing");

  if (event.status === "cancelled") {
    return err("event_cancelled", 409, "event_cancelled");
  }
  if (event.status === "completed") {
    return err("event_completed", 409, "event_completed");
  }
  if (event.status !== "published") {
    return err("event_not_open", 409, "event_not_open");
  }

  const startAt = new Date(event.start_at as string).getTime();
  if (!Number.isFinite(startAt) || startAt <= Date.now()) {
    return err("event_started", 409, "event_started");
  }

  // ─── 4. Slot capacity check ──────────────────────────────────────────────
  const { count: activeCount, error: countErr } = await supabase
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .is("cancelled_at", null);

  if (countErr) {
    logEvent({ step: "count_active", error: countErr.message });
    return err("count_failed", 500, "count_failed");
  }

  const maxPlayers = (event.max_players as number | null) ?? 0;
  if ((activeCount ?? 0) >= maxPlayers) {
    return err("event_full", 409, "event_full");
  }

  // ─── 5. Flip back to registered ──────────────────────────────────────────
  const { error: updErr } = await supabase
    .from("event_registrations")
    .update({
      status: "registered",
      cancelled_at: null,
      cancelled_reason: null,
    })
    .eq("id", registrationId)
    .not("cancelled_at", "is", null);

  if (updErr) {
    logEvent({ step: "update_registration", error: updErr.message, registration_id: registrationId });
    return err("update_failed", 500, "update_failed");
  }

  logEvent({
    step: "reactivated",
    registration_id: registrationId,
    event_id: event.id,
  });

  return jsonResponse({ ok: true });
});
