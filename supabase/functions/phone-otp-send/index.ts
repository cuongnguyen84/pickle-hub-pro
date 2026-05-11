// ============================================================================
// phone-otp-send — Social Events MVP (PR1) edge function
// ----------------------------------------------------------------------------
// POST { phone: string, event_id: uuid }
//
// Flow:
//   1. Normalize + validate VN phone via _shared/phone.ts
//   2. Check the target event is still accepting registrations
//      (status='published', start_at in the future, allow_guests=true,
//      not full).
//   3. Rate limit: max 3 OTPs per phone per 15 minutes per event.
//   4. Generate 6-digit OTP, hash with phone salt, persist in otp_codes
//      with a 5-minute TTL.
//   5. Send via eSMS.vn brandname route — unless ENVIRONMENT=development,
//      in which case the OTP is logged to stdout so the dev can paste it.
//
// verify_jwt=false in supabase/config.toml — this is a fully public
// endpoint. Service role key used internally for DB writes.
//
// Response shapes:
//   200 { ok: true, expires_at: ISO8601, dev_mode_code?: string }
//   400 { error, code }     — validation failure
//   404 { error, code }     — event not found / not open
//   409 { error, code }     — event full / already registered
//   429 { error, code }     — rate limit
//   500 { error, code }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { normalizeVietnamPhone } from "../_shared/phone.ts";
import { generateOtpCode, hashOtp } from "../_shared/otp.ts";
import { sendBrandnameSms } from "../_shared/sms-esms.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 3;

interface SendBody {
  phone?: unknown;
  event_id?: unknown;
}

function err(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "phone-otp-send", ...payload }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const phoneInput = typeof body.phone === "string" ? body.phone : "";
  const eventIdInput = typeof body.event_id === "string" ? body.event_id : "";

  const phone = normalizeVietnamPhone(phoneInput);
  if (!phone) return err("invalid_phone", 400, "invalid_phone");

  if (!UUID_RE.test(eventIdInput)) {
    return err("invalid_event_id", 400, "invalid_event_id");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── Verify event is open for registration ──────────────────────────────
  const { data: event, error: eventErr } = await supabase
    .from("social_events")
    .select(
      "id, status, visibility, start_at, max_players, allow_guests, title_vi, title_en",
    )
    .eq("id", eventIdInput)
    .maybeSingle();

  if (eventErr) {
    logEvent({ error: eventErr.message, step: "fetch_event", phone, event_id: eventIdInput });
    return err("event_lookup_failed", 500, "event_lookup_failed");
  }
  if (!event) {
    return err("event_not_found", 404, "event_not_found");
  }
  if (event.status !== "published") {
    return err("event_not_published", 404, "event_not_published");
  }
  if (event.visibility !== "public") {
    // club_only events still go through this endpoint, but the public
    // landing page won't expose them. Block here to prevent ID-guessing.
    return err("event_not_public", 404, "event_not_public");
  }
  if (!event.allow_guests) {
    return err("guests_not_allowed", 403, "guests_not_allowed");
  }
  const startAt = new Date(event.start_at as string).getTime();
  if (Number.isNaN(startAt) || startAt < Date.now()) {
    return err("event_started_or_ended", 409, "event_started_or_ended");
  }

  // ─── Already registered? ────────────────────────────────────────────────
  // Codex P1 on PR #45: filter out cancelled rows in the query itself.
  // After the PR42 Bug 1 fix the partial unique index on (event_id, phone)
  // excludes status='cancelled', so a single phone may have N cancelled
  // rows alongside (at most) one active row. The previous
  // `.maybeSingle()` without the status filter would throw
  // "multiple rows returned" — surfacing as a spurious
  // `registration_lookup_failed` 500 that blocked re-registration.
  //
  // The query predicate now matches the unique-index predicate exactly,
  // so .maybeSingle() is guaranteed safe.
  const { data: existing, error: existingErr } = await supabase
    .from("event_registrations")
    .select("id, status")
    .eq("event_id", eventIdInput)
    .eq("phone", phone)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existingErr) {
    logEvent({
      error: existingErr.message,
      step: "check_existing",
      phone,
      event_id: eventIdInput,
    });
    return err("registration_lookup_failed", 500, "registration_lookup_failed");
  }
  if (existing) {
    return err("already_registered", 409, "already_registered");
  }

  // ─── Capacity check ─────────────────────────────────────────────────────
  const { count: activeCount, error: countErr } = await supabase
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventIdInput)
    .neq("status", "cancelled");
  if (countErr) {
    logEvent({ error: countErr.message, step: "capacity_check" });
    return err("capacity_check_failed", 500, "capacity_check_failed");
  }
  if ((activeCount ?? 0) >= (event.max_players as number)) {
    return err("event_full", 409, "event_full");
  }

  // ─── Rate limit ─────────────────────────────────────────────────────────
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count: recentCount, error: rlErr } = await supabase
    .from("otp_codes")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .eq("event_id", eventIdInput)
    .gte("created_at", windowStart);
  if (rlErr) {
    logEvent({ error: rlErr.message, step: "rate_limit_check" });
    return err("rate_limit_check_failed", 500, "rate_limit_check_failed");
  }
  if ((recentCount ?? 0) >= RATE_MAX_PER_WINDOW) {
    return err("too_many_otps", 429, "too_many_otps");
  }

  // ─── Generate, hash, persist OTP ────────────────────────────────────────
  const code = generateOtpCode();
  const codeHash = await hashOtp(code, phone);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error: insertErr } = await supabase
    .from("otp_codes")
    .insert({
      phone,
      event_id: eventIdInput,
      code_hash: codeHash,
      attempts: 0,
      expires_at: expiresAt,
    });
  if (insertErr) {
    logEvent({ error: insertErr.message, step: "insert_otp" });
    return err("otp_persist_failed", 500, "otp_persist_failed");
  }

  // ─── Deliver: SMS in prod, console in dev ───────────────────────────────
  const env = (Deno.env.get("ENVIRONMENT") ?? "production").toLowerCase();
  const isDevMode = env === "development" || env === "dev" || env === "local";
  const eventLabel =
    (event.title_vi as string | null) || (event.title_en as string | null) || "ThePickleHub";
  const content =
    `[ThePickleHub] Ma OTP dang ky su kien "${eventLabel}": ${code} (5 phut). ` +
    `Khong chia se ma nay.`;

  if (isDevMode) {
    logEvent({
      step: "dev_mode_otp",
      phone,
      event_id: eventIdInput,
      otp: code,
      note: "SMS not sent — ENVIRONMENT=development",
    });
    return jsonResponse({
      ok: true,
      expires_at: expiresAt,
      dev_mode_code: code,
    });
  }

  const smsResult = await sendBrandnameSms({ phoneE164: phone, content });
  if (!smsResult.ok) {
    // We deliberately do NOT roll back the OTP row — the user can hit
    // "Resend OTP" without bumping the rate limit further if they wait.
    // But we log loudly so ops can react.
    logEvent({
      step: "sms_send_failed",
      phone,
      event_id: eventIdInput,
      provider_code: smsResult.codeResult,
      provider_error: smsResult.errorMessage,
    });
    return err("sms_send_failed", 502, "sms_send_failed");
  }

  logEvent({
    step: "sms_send_ok",
    phone,
    event_id: eventIdInput,
    provider_message_id: smsResult.messageId,
  });

  return jsonResponse({ ok: true, expires_at: expiresAt });
});
