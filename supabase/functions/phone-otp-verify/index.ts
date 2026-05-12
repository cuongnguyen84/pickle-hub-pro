// ============================================================================
// phone-otp-verify — Social Events MVP (PR1) edge function
// ----------------------------------------------------------------------------
// POST { phone, event_id, code, display_name, self_rated_level? }
//
// Flow:
//   1. Normalize + validate phone, validate inputs.
//   2. Fetch latest unused OTP for (phone, event_id). Reject if expired,
//      already used, or attempts >= 3.
//   3. Constant-time-ish compare the SHA-256 hash. Bump attempts on a
//      mismatch so 3 wrong tries burns the OTP.
//   4. Mark the OTP row used. Re-verify event is still open + has capacity
//      (between send + verify the event may have filled up).
//   5. Find or create a ghost profile keyed by phone. Insert
//      event_registrations row referencing that profile.
//   6. Return { registration_id, profile_id, magic_token } — magic_token
//      is a server-issued UUID the frontend stores in a 90-day cookie so
//      a returning guest doesn't have to OTP again.
//
// verify_jwt=false; service-role client used internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { normalizeVietnamPhone } from "../_shared/phone.ts";
import { hashOtp } from "../_shared/otp.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OTP_ATTEMPTS = 3;

interface VerifyBody {
  phone?: unknown;
  event_id?: unknown;
  code?: unknown;
  display_name?: unknown;
  self_rated_level?: unknown;
}

function err(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "phone-otp-verify", ...payload }));
}

/**
 * Constant-time string equality for two equal-length hex digests.
 * Not strictly required for SHA-256 hash compare (the hash itself is
 * one-way), but cheap insurance against side-channel poking.
 */
function constEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const phone = normalizeVietnamPhone(
    typeof body.phone === "string" ? body.phone : "",
  );
  if (!phone) return err("invalid_phone", 400, "invalid_phone");

  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  if (!UUID_RE.test(eventId)) {
    return err("invalid_event_id", 400, "invalid_event_id");
  }

  const rawCode = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(rawCode)) {
    return err("invalid_code_format", 400, "invalid_code_format");
  }

  const displayName =
    typeof body.display_name === "string" ? body.display_name.trim() : "";
  if (displayName.length < 1 || displayName.length > 80) {
    return err("invalid_display_name", 400, "invalid_display_name");
  }

  let selfRatedLevel: number | null = null;
  if (body.self_rated_level !== undefined && body.self_rated_level !== null) {
    const n = Number(body.self_rated_level);
    if (Number.isNaN(n) || n < 1 || n > 7) {
      return err("invalid_self_rated_level", 400, "invalid_self_rated_level");
    }
    selfRatedLevel = Math.round(n * 100) / 100;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── Look up the most recent unused OTP for this (phone, event) ─────────
  const { data: otp, error: otpErr } = await supabase
    .from("otp_codes")
    .select("id, code_hash, attempts, expires_at, used_at, created_at")
    .eq("phone", phone)
    .eq("event_id", eventId)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (otpErr) {
    logEvent({ error: otpErr.message, step: "fetch_otp" });
    return err("otp_lookup_failed", 500, "otp_lookup_failed");
  }
  if (!otp) {
    return err("otp_not_found", 404, "otp_not_found");
  }
  if (new Date(otp.expires_at as string).getTime() < Date.now()) {
    return err("otp_expired", 410, "otp_expired");
  }
  if ((otp.attempts as number) >= MAX_OTP_ATTEMPTS) {
    return err("otp_too_many_attempts", 429, "otp_too_many_attempts");
  }

  // ─── Compare ─────────────────────────────────────────────────────────────
  const candidateHash = await hashOtp(rawCode, phone);
  if (!constEq(candidateHash, otp.code_hash as string)) {
    // Bump attempts. We ignore the result on a best-effort basis — even
    // if the bump fails, the OTP still expires in TTL seconds.
    await supabase
      .from("otp_codes")
      .update({ attempts: (otp.attempts as number) + 1 })
      .eq("id", otp.id);
    return err("otp_mismatch", 401, "otp_mismatch");
  }

  // ─── Re-verify event still open ─────────────────────────────────────────
  const { data: event, error: eventErr } = await supabase
    .from("social_events")
    .select("id, status, visibility, start_at, max_players, allow_guests")
    .eq("id", eventId)
    .maybeSingle();
  if (eventErr || !event) {
    logEvent({ error: eventErr?.message ?? "no_event", step: "reverify_event" });
    return err("event_lookup_failed", 500, "event_lookup_failed");
  }
  if (event.status !== "published") {
    return err("event_not_published", 404, "event_not_published");
  }
  // Codex Bug 2 (PR #42): re-check visibility between send and verify.
  // phone-otp-send rejects non-public events, but if the organizer flips
  // visibility from `public` to `club_only` after an OTP is issued, the
  // outstanding OTP would otherwise redeem and bypass the new restriction.
  if (event.visibility !== "public") {
    return err("event_not_public", 403, "event_not_public");
  }
  const startAt = new Date(event.start_at as string).getTime();
  if (Number.isNaN(startAt) || startAt < Date.now()) {
    return err("event_started_or_ended", 409, "event_started_or_ended");
  }
  if (!event.allow_guests) {
    return err("guests_not_allowed", 403, "guests_not_allowed");
  }

  // ─── Find or create ghost profile by phone ──────────────────────────────
  const { data: existingProfile, error: profErr } = await supabase
    .from("profiles")
    .select("id, is_ghost, display_name")
    .eq("phone", phone)
    .maybeSingle();
  if (profErr) {
    logEvent({ error: profErr.message, step: "fetch_profile" });
    return err("profile_lookup_failed", 500, "profile_lookup_failed");
  }

  let profileId: string;
  if (existingProfile) {
    profileId = existingProfile.id as string;
  } else {
    // Ghost profile: no auth.users row, just a phone-keyed shell so we
    // can attach registrations + future match results. Email is
    // synthesized + NOT NULL on profiles, so we use an unreachable
    // placeholder. When the guest later signs up with Google/Email,
    // the existing migration `dupr-link` style code can merge profiles
    // by phone match (out of scope here).
    const placeholderEmail = `ghost+${crypto.randomUUID()}@guest.thepicklehub.net`;
    const ghostId = crypto.randomUUID();
    const { data: created, error: createErr } = await supabase
      .from("profiles")
      .insert({
        id: ghostId,
        email: placeholderEmail,
        phone,
        display_name: displayName,
        is_ghost: true,
        self_rating: selfRatedLevel,
        source_provider: "community",
      })
      .select("id")
      .single();
    if (createErr || !created) {
      logEvent({
        error: createErr?.message ?? "no_row",
        step: "create_ghost_profile",
        phone,
      });
      return err("ghost_profile_create_failed", 500, "ghost_profile_create_failed");
    }
    profileId = created.id as string;
  }

  // ─── Capacity check (race-safe: re-check before insert) ─────────────────
  const { count: activeCount, error: countErr } = await supabase
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .neq("status", "cancelled");
  if (countErr) {
    logEvent({ error: countErr.message, step: "recapacity_check" });
    return err("capacity_check_failed", 500, "capacity_check_failed");
  }
  if ((activeCount ?? 0) >= (event.max_players as number)) {
    return err("event_full", 409, "event_full");
  }

  // ─── Insert registration. Unique indexes catch double-register. ────────
  const { data: registration, error: regErr } = await supabase
    .from("event_registrations")
    .insert({
      event_id: eventId,
      profile_id: profileId,
      phone,
      display_name: displayName,
      self_rated_level: selfRatedLevel,
      status: "registered",
      payment_status: "unpaid",
    })
    .select("id, registered_at")
    .single();

  if (regErr || !registration) {
    // Unique-violation race: someone registered the same phone between
    // the upstream check and this insert. Translate to a friendlier
    // 409 if that's the case.
    const msg = (regErr?.message ?? "").toLowerCase();
    if (msg.includes("uq_event_registrations") || msg.includes("duplicate")) {
      return err("already_registered", 409, "already_registered");
    }
    logEvent({
      error: regErr?.message ?? "no_row",
      step: "insert_registration",
      phone,
      event_id: eventId,
    });
    return err("registration_insert_failed", 500, "registration_insert_failed");
  }

  // ─── Magic token — write to the private registration_secrets table ─────
  // Post-Codex-review (PR47 bug 1): magic_token no longer lives on
  // event_registrations (where the public SELECT policy would have leaked
  // it). It now lives in a sibling table with zero public access; only
  // service-role clients (this function and submit-match-score) can read
  // or write it.
  const magicToken = crypto.randomUUID();
  const { error: secretErr } = await supabase
    .from("registration_secrets")
    .insert({
      registration_id: registration.id as string,
      magic_token: magicToken,
    });
  if (secretErr) {
    // Don't fail the registration just because the secret write failed —
    // the row was already committed, refusing now would leave the user
    // double-registered on retry. Log loudly so we notice the drift.
    logEvent({
      error: secretErr.message,
      step: "insert_registration_secret",
      registration_id: registration.id,
    });
  }

  // ─── Burn the OTP ───────────────────────────────────────────────────────
  await supabase
    .from("otp_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", otp.id);

  logEvent({
    step: "register_ok",
    phone,
    event_id: eventId,
    profile_id: profileId,
    registration_id: registration.id,
  });

  return jsonResponse({
    ok: true,
    registration_id: registration.id,
    profile_id: profileId,
    magic_token: magicToken,
    registered_at: registration.registered_at,
  });
});
