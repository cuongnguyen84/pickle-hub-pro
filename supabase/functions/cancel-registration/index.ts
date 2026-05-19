// ============================================================================
// cancel-registration — Social Events MVP (PR58) edge function
// ----------------------------------------------------------------------------
// POST { magic_token, reason? }
//
// Player-facing cancellation for /dang-ky/:magic_token. Auth happens via
// magic_token (lookup in registration_secrets, service-role-only table),
// not JWT — guests have no auth.users row.
//
// Flow:
//   1. Validate magic_token shape (UUID v4).
//   2. Lookup registration_id via registration_secrets.
//   3. Fetch the registration + parent event. Reject if:
//      - registration already cancelled
//      - event already started (start_at <= now())
//      - event already cancelled / completed at the source
//   4. UPDATE event_registrations SET status='cancelled', cancelled_at=now(),
//      cancelled_reason=<sanitized reason>.
//   5. Return { ok, cancelled_at }.
//
// Slot capacity is automatic — phone-otp-verify already counts WHERE
// status != 'cancelled', so once we flip status the slot is free.
//
// verify_jwt=false; service-role client used internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_REASON_LEN = 280;

interface CancelBody {
  magic_token?: unknown;
  reason?: unknown;
}

function err(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "cancel-registration", ...payload }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  let body: CancelBody;
  try {
    body = (await req.json()) as CancelBody;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const magicToken = typeof body.magic_token === "string" ? body.magic_token.trim() : "";
  if (!UUID_RE.test(magicToken)) {
    return err("invalid_magic_token", 400, "invalid_magic_token");
  }

  const rawReason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reason = rawReason.length > 0 ? rawReason.slice(0, MAX_REASON_LEN) : null;

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
  if (!secret) {
    return err("not_found", 404, "not_found");
  }

  const registrationId = secret.registration_id as string;

  // ─── 2. Fetch registration + parent event ────────────────────────────────
  const { data: reg, error: regErr } = await supabase
    .from("event_registrations")
    .select("id, event_id, status, cancelled_at")
    .eq("id", registrationId)
    .maybeSingle();

  if (regErr) {
    logEvent({ step: "lookup_registration", error: regErr.message });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!reg) {
    return err("registration_missing", 404, "registration_missing");
  }
  if (reg.cancelled_at) {
    return err("already_cancelled", 409, "already_cancelled");
  }

  const { data: event, error: eventErr } = await supabase
    .from("social_events")
    .select("id, slug, status, start_at")
    .eq("id", reg.event_id)
    .maybeSingle();

  if (eventErr) {
    logEvent({ step: "lookup_event", error: eventErr.message });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!event) {
    return err("event_missing", 404, "event_missing");
  }

  if (event.status === "cancelled") {
    // Whole event cancelled — registrations are already moot. Treat as
    // success to make the player flow idempotent.
    return jsonResponse({ ok: true, already_cancelled: true });
  }
  if (event.status === "completed") {
    return err("event_completed", 409, "event_completed");
  }

  const startAt = new Date(event.start_at as string).getTime();
  if (!Number.isFinite(startAt) || startAt <= Date.now()) {
    return err("event_started", 409, "event_started");
  }

  // ─── 3. Flip status + record metadata ────────────────────────────────────
  const cancelledAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("event_registrations")
    .update({
      status: "cancelled",
      cancelled_at: cancelledAt,
      cancelled_reason: reason,
    })
    .eq("id", registrationId)
    .is("cancelled_at", null);

  if (updErr) {
    logEvent({ step: "update_registration", error: updErr.message, registration_id: registrationId });
    return err("update_failed", 500, "update_failed");
  }

  logEvent({
    step: "cancelled",
    registration_id: registrationId,
    event_id: event.id,
    reason_set: reason !== null,
  });

  return jsonResponse({ ok: true, cancelled_at: cancelledAt });
});
