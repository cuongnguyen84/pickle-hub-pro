// ============================================================================
// add-registration-direct — Social Events PR: proxy + manual registration
// ----------------------------------------------------------------------------
// POST {
//   event_id,
//   guest_phone, guest_name, guest_self_rating?,
//   mode: 'proxy' | 'manual',
//   proxy_magic_token?,     // required when mode='proxy'
//   organizer_auth_token?,  // required when mode='manual'
//   initial_payment_status?: 'unpaid' | 'claimed_paid' | 'waived',  // manual only
//   internal_notes?         // manual only
// }
//
// Two flows under one endpoint:
//
//   - PROXY:    user A (already registered) adds a friend B. Authorization
//               proves A by looking up A's magic_token in registration_secrets
//               and confirming the event matches.
//
//   - MANUAL:   event organizer (club creator / event creator / admin) adds
//               someone outside OTP. Authorization is the caller's supabase
//               JWT, verified internally via supabase.auth.getUser() and
//               checked against verify_event_organizer RPC.
//
// On success a fresh registration is created with:
//   - registration_source = 'proxy' | 'manual'
//   - registered_by_profile_id = <A's profile> or <organizer's profile>
//   - internal_notes (manual only)
//   - player_claimed_paid (manual + 'claimed_paid')
// A magic_token is minted in registration_secrets so /dang-ky/<token>
// works the same as a normal OTP-verified registration.
//
// verify_jwt=false at the gateway; this function verifies internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { normalizeVietnamPhone } from "../_shared/phone.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROXY_RATE_LIMIT = 5;   // proxy registrations / 24h / proxy profile
const MANUAL_RATE_LIMIT = 50; // manual registrations / 24h / organizer profile

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const REFERENCE_LENGTH = 6;
const REFERENCE_MAX_RETRIES = 5;

type Mode = "proxy" | "manual";
type InitialPayment = "unpaid" | "claimed_paid" | "waived";

interface Body {
  event_id?: unknown;
  guest_phone?: unknown;
  guest_name?: unknown;
  guest_self_rating?: unknown;
  mode?: unknown;
  proxy_magic_token?: unknown;
  organizer_auth_token?: unknown;
  initial_payment_status?: unknown;
  internal_notes?: unknown;
}

function err(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "add-registration-direct", ...payload }));
}

function generateReferenceCode(): string {
  const ALPHABET = REFERENCE_ALPHABET;
  const MAX = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const out: string[] = [];
  const pool = new Uint8Array(REFERENCE_LENGTH * 2);
  crypto.getRandomValues(pool);
  let i = 0;
  while (out.length < REFERENCE_LENGTH) {
    if (i >= pool.length) {
      crypto.getRandomValues(pool);
      i = 0;
    }
    const b = pool[i++];
    if (b < MAX) out.push(ALPHABET[b % ALPHABET.length]);
  }
  return `PHUB-${out.join("")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  // ─── Parse + validate input ────────────────────────────────────────────────
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  if (!UUID_RE.test(eventId)) {
    return err("invalid_event_id", 400, "invalid_event_id");
  }

  const mode = (body.mode === "proxy" || body.mode === "manual") ? body.mode as Mode : null;
  if (!mode) return err("invalid_mode", 400, "invalid_mode");

  const guestPhone = normalizeVietnamPhone(
    typeof body.guest_phone === "string" ? body.guest_phone : "",
  );
  if (!guestPhone) return err("invalid_phone", 400, "invalid_phone");

  const guestName =
    typeof body.guest_name === "string" ? body.guest_name.trim() : "";
  if (guestName.length < 1 || guestName.length > 80) {
    return err("invalid_display_name", 400, "invalid_display_name");
  }

  let guestSelfRating: number | null = null;
  if (body.guest_self_rating !== undefined && body.guest_self_rating !== null && body.guest_self_rating !== "") {
    const n = Number(body.guest_self_rating);
    if (Number.isNaN(n) || n < 1 || n > 7) {
      return err("invalid_self_rating", 400, "invalid_self_rating");
    }
    guestSelfRating = Math.round(n * 100) / 100;
  }

  const internalNotes =
    mode === "manual" && typeof body.internal_notes === "string"
      ? body.internal_notes.trim().slice(0, 500) || null
      : null;

  const initialPayment: InitialPayment | null =
    mode === "manual" &&
    (body.initial_payment_status === "unpaid"
      || body.initial_payment_status === "claimed_paid"
      || body.initial_payment_status === "waived")
      ? body.initial_payment_status as InitialPayment
      : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── Authorize based on mode ───────────────────────────────────────────────
  let registeredByProfileId: string;

  if (mode === "proxy") {
    const proxyToken = typeof body.proxy_magic_token === "string" ? body.proxy_magic_token.trim() : "";
    if (!UUID_RE.test(proxyToken)) {
      return err("invalid_proxy_magic_token", 400, "invalid_proxy_magic_token");
    }
    // Resolve token → registration_id → registration (must belong to this event + active).
    const { data: secret, error: secretErr } = await supabase
      .from("registration_secrets")
      .select("registration_id")
      .eq("magic_token", proxyToken)
      .maybeSingle();
    if (secretErr) {
      logEvent({ step: "lookup_proxy_secret", error: secretErr.message });
      return err("lookup_failed", 500, "lookup_failed");
    }
    if (!secret) return err("unauthorized", 403, "unauthorized");

    const { data: proxyReg, error: proxyRegErr } = await supabase
      .from("event_registrations")
      .select("id, event_id, profile_id, cancelled_at")
      .eq("id", secret.registration_id as string)
      .maybeSingle();
    if (proxyRegErr) {
      logEvent({ step: "lookup_proxy_reg", error: proxyRegErr.message });
      return err("lookup_failed", 500, "lookup_failed");
    }
    if (!proxyReg) return err("unauthorized", 403, "unauthorized");
    if (proxyReg.event_id !== eventId) {
      return err("unauthorized", 403, "unauthorized");
    }
    if (proxyReg.cancelled_at != null) {
      return err("unauthorized", 403, "unauthorized");
    }
    if (!proxyReg.profile_id) {
      // Shouldn't happen — walk-in backfill ensures every reg has a profile_id.
      return err("unauthorized", 403, "unauthorized");
    }
    registeredByProfileId = proxyReg.profile_id as string;
  } else {
    // mode === 'manual'
    const orgToken = typeof body.organizer_auth_token === "string" ? body.organizer_auth_token.trim() : "";
    if (!orgToken) return err("unauthorized", 401, "unauthorized");

    const { data: userData, error: userErr } = await supabase.auth.getUser(orgToken);
    if (userErr || !userData?.user) {
      return err("unauthorized", 401, "unauthorized");
    }
    const userId = userData.user.id;

    // Confirm user is event organizer (club creator / event creator / admin).
    const { data: okData, error: verifyErr } = await supabase.rpc(
      "verify_event_organizer",
      { p_user_id: userId, p_event_id: eventId },
    );
    if (verifyErr) {
      logEvent({ step: "verify_event_organizer", error: verifyErr.message });
      return err("lookup_failed", 500, "lookup_failed");
    }
    if (!okData) {
      return err("unauthorized", 403, "unauthorized");
    }
    registeredByProfileId = userId;
  }

  // ─── Rate limit ────────────────────────────────────────────────────────────
  if (mode === "proxy") {
    const { data: cnt, error: cntErr } = await supabase.rpc(
      "count_proxy_registrations_recent",
      { p_proxy_profile_id: registeredByProfileId, p_hours: 24 },
    );
    if (cntErr) {
      logEvent({ step: "rate_limit_lookup_proxy", error: cntErr.message });
    } else if (typeof cnt === "number" && cnt >= PROXY_RATE_LIMIT) {
      return err("rate_limit_exceeded", 429, "rate_limit_exceeded");
    }
  } else {
    const { data: cnt, error: cntErr } = await supabase.rpc(
      "count_manual_registrations_recent",
      { p_organizer_profile_id: registeredByProfileId, p_hours: 24 },
    );
    if (cntErr) {
      logEvent({ step: "rate_limit_lookup_manual", error: cntErr.message });
    } else if (typeof cnt === "number" && cnt >= MANUAL_RATE_LIMIT) {
      return err("rate_limit_exceeded", 429, "rate_limit_exceeded");
    }
  }

  // ─── Fetch event + capacity ───────────────────────────────────────────────
  const { data: event, error: eventErr } = await supabase
    .from("social_events")
    .select(
      "id, status, visibility, start_at, max_players, allow_guests, price_vnd, requires_prepayment, title_vi, title_en, slug",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (eventErr || !event) {
    logEvent({ step: "lookup_event", error: eventErr?.message ?? "no_event" });
    return err("event_not_found", 404, "event_not_found");
  }
  if (event.status === "cancelled") return err("event_cancelled", 410, "event_cancelled");
  if (event.status === "completed") return err("event_completed", 410, "event_completed");
  // Proxy mode requires the event to still be open + public. Manual mode
  // is organizer-driven so we let the organizer add even draft/club_only
  // events (matches the existing add_walk_in_registration behavior).
  if (mode === "proxy") {
    if (event.status !== "published") return err("event_not_published", 403, "event_not_published");
    if (event.visibility !== "public") return err("event_not_public", 403, "event_not_public");
    if (!event.allow_guests) return err("guests_not_allowed", 403, "guests_not_allowed");
  }
  const startAt = new Date(event.start_at as string).getTime();
  if (!Number.isFinite(startAt) || startAt <= Date.now()) {
    return err("event_started_or_ended", 409, "event_started_or_ended");
  }

  // ─── Check existing registration for this phone in this event ────────────
  const { data: existingReg, error: existingErr } = await supabase
    .from("event_registrations")
    .select("id, status, cancelled_at")
    .eq("event_id", eventId)
    .eq("phone", guestPhone)
    .order("registered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) {
    logEvent({ step: "lookup_existing", error: existingErr.message });
    return err("lookup_failed", 500, "lookup_failed");
  }

  if (existingReg && existingReg.cancelled_at == null) {
    return err("already_registered", 409, "already_registered");
  }

  // ─── Capacity check ───────────────────────────────────────────────────────
  const { count: activeCount, error: countErr } = await supabase
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .is("cancelled_at", null);
  if (countErr) {
    logEvent({ step: "capacity_check", error: countErr.message });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if ((activeCount ?? 0) >= (event.max_players as number)) {
    return err("event_full", 409, "event_full");
  }

  // ─── Find or create ghost profile for the guest phone ────────────────────
  let guestProfileId: string;
  {
    const { data: existingProfile, error: profErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", guestPhone)
      .maybeSingle();
    if (profErr) {
      logEvent({ step: "lookup_profile", error: profErr.message });
      return err("lookup_failed", 500, "lookup_failed");
    }
    if (existingProfile) {
      guestProfileId = existingProfile.id as string;
    } else {
      const newId = crypto.randomUUID();
      const { data: created, error: createErr } = await supabase
        .from("profiles")
        .insert({
          id: newId,
          email: `ghost+${newId}@guest.thepicklehub.net`,
          phone: guestPhone,
          display_name: guestName,
          is_ghost: true,
          self_rating: guestSelfRating,
          source_provider: "community",
        })
        .select("id")
        .single();
      if (createErr || !created) {
        logEvent({ step: "create_ghost_profile", error: createErr?.message ?? "no_row" });
        return err("ghost_profile_create_failed", 500, "ghost_profile_create_failed");
      }
      guestProfileId = created.id as string;
    }
  }

  // ─── Insert or revive the registration ────────────────────────────────────
  // Payment status:
  //   - free event → 'unpaid'
  //   - manual + 'claimed_paid' → 'paid' (organizer says player paid at venue)
  //   - manual + 'waived' → 'paid' (organizer skipped fee for this person)
  //   - prepayment-required + paid event → 'pending_payment'
  //   - everything else → 'unpaid'
  const priceVnd = (event.price_vnd as number) ?? 0;
  let paymentStatus: "unpaid" | "pending_payment" | "paid";
  let playerClaimedPaid = false;
  let playerClaimedAt: string | null = null;
  if (priceVnd === 0) {
    paymentStatus = "unpaid";
  } else if (mode === "manual" && initialPayment === "claimed_paid") {
    paymentStatus = "paid";
    playerClaimedPaid = true;
    playerClaimedAt = new Date().toISOString();
  } else if (mode === "manual" && initialPayment === "waived") {
    paymentStatus = "paid";
  } else if (event.requires_prepayment) {
    paymentStatus = "pending_payment";
  } else {
    paymentStatus = "unpaid";
  }

  let registrationId: string;
  let registeredAt: string;

  if (existingReg && existingReg.cancelled_at != null) {
    // Re-register: clear cancelled_at, update fields, keep existing magic_token.
    const { data: revived, error: reviveErr } = await supabase
      .from("event_registrations")
      .update({
        status: "registered",
        cancelled_at: null,
        cancelled_reason: null,
        display_name: guestName,
        self_rated_level: guestSelfRating,
        profile_id: guestProfileId,
        registered_by_profile_id: registeredByProfileId,
        registration_source: mode,
        internal_notes: internalNotes,
        payment_status: paymentStatus,
        registered_at: new Date().toISOString(),
      })
      .eq("id", existingReg.id as string)
      .select("id, registered_at")
      .single();
    if (reviveErr || !revived) {
      logEvent({ step: "revive_registration", error: reviveErr?.message ?? "no_row" });
      return err("registration_insert_failed", 500, "registration_insert_failed");
    }
    registrationId = revived.id as string;
    registeredAt = revived.registered_at as string;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("event_registrations")
      .insert({
        event_id: eventId,
        profile_id: guestProfileId,
        phone: guestPhone,
        display_name: guestName,
        self_rated_level: guestSelfRating,
        status: "registered",
        payment_status: paymentStatus,
        registered_by_profile_id: registeredByProfileId,
        registration_source: mode,
        internal_notes: internalNotes,
      })
      .select("id, registered_at")
      .single();
    if (insertErr || !inserted) {
      const msg = (insertErr?.message ?? "").toLowerCase();
      if (msg.includes("uq_event_registrations") || msg.includes("duplicate")) {
        return err("already_registered", 409, "already_registered");
      }
      logEvent({ step: "insert_registration", error: insertErr?.message ?? "no_row" });
      return err("registration_insert_failed", 500, "registration_insert_failed");
    }
    registrationId = inserted.id as string;
    registeredAt = inserted.registered_at as string;
  }

  // ─── Magic token (re-use existing on revive, mint new on insert) ──────────
  let magicToken: string;
  {
    const { data: existingSecret, error: secretLookupErr } = await supabase
      .from("registration_secrets")
      .select("magic_token")
      .eq("registration_id", registrationId)
      .maybeSingle();
    if (secretLookupErr) {
      logEvent({ step: "lookup_existing_secret", error: secretLookupErr.message });
      return err("lookup_failed", 500, "lookup_failed");
    }
    if (existingSecret) {
      magicToken = existingSecret.magic_token as string;
    } else {
      magicToken = crypto.randomUUID();
      const { error: secretErr } = await supabase
        .from("registration_secrets")
        .insert({ registration_id: registrationId, magic_token: magicToken });
      if (secretErr) {
        logEvent({
          step: "insert_registration_secret",
          error: secretErr.message,
          registration_id: registrationId,
        });
        // Don't fail the registration — magic_token can be recovered via
        // SQL if needed. Log loudly.
      }
    }
  }

  // ─── Telemetry log (otp_send_logs with channel='manual') ──────────────────
  // Best-effort — non-fatal.
  await supabase
    .from("otp_send_logs")
    .insert({
      phone_e164: guestPhone,
      event_id: eventId,
      channel: "dev",   // schema CHECK accepts only zalo/sms/dev — repurpose
                       // 'dev' here for proxy/manual so we stay schema-safe
                       // without a separate migration.
      success: true,
      error_code: `proxy_or_manual:${mode}`,
    })
    .then(({ error }) => {
      if (error) logEvent({ step: "log_send", error: error.message });
    });

  // ─── Payment order (paid event) ───────────────────────────────────────────
  let referenceCode: string | null = null;
  if (priceVnd > 0) {
    // Idempotent — re-uses existing order on revive.
    const { data: existingOrder } = await supabase
      .from("payment_orders")
      .select("id, reference_code")
      .eq("registration_id", registrationId)
      .maybeSingle();
    if (existingOrder) {
      referenceCode = existingOrder.reference_code as string;
      if (mode === "manual" && initialPayment === "claimed_paid") {
        await supabase
          .from("payment_orders")
          .update({ player_claimed_paid: true, player_claimed_at: playerClaimedAt })
          .eq("id", existingOrder.id as string);
      }
    } else {
      for (let attempt = 0; attempt < REFERENCE_MAX_RETRIES; attempt++) {
        const code = generateReferenceCode();
        const insertPayload: Record<string, unknown> = {
          registration_id: registrationId,
          amount_vnd: priceVnd,
          reference_code: code,
        };
        if (mode === "manual" && initialPayment === "claimed_paid") {
          insertPayload.player_claimed_paid = true;
          insertPayload.player_claimed_at = playerClaimedAt;
        }
        const { data: inserted, error: orderErr } = await supabase
          .from("payment_orders")
          .insert(insertPayload)
          .select("id, reference_code")
          .single();
        if (!orderErr && inserted) {
          referenceCode = inserted.reference_code as string;
          break;
        }
        const m = (orderErr?.message ?? "").toLowerCase();
        if (m.includes("reference_code")) continue; // collision — retry
        if (m.includes("registration_id")) {
          // race — re-read
          const { data: raced } = await supabase
            .from("payment_orders")
            .select("reference_code")
            .eq("registration_id", registrationId)
            .maybeSingle();
          if (raced) {
            referenceCode = raced.reference_code as string;
          }
          break;
        }
        logEvent({ step: "create_payment_order", error: orderErr?.message ?? "no_row" });
        break;
      }
    }
  }

  const siteUrl = Deno.env.get("SITE_URL") ?? "https://www.thepicklehub.net";
  const recoveryUrl = `${siteUrl.replace(/\/$/, "")}/dang-ky/${magicToken}`;

  const eventName =
    (event.title_vi as string | null) ?? (event.title_en as string | null) ?? "";

  logEvent({
    step: "ok",
    mode,
    event_id: eventId,
    registration_id: registrationId,
    registered_by_profile_id: registeredByProfileId,
    payment_status: paymentStatus,
  });

  return jsonResponse({
    success: true,
    ok: true,
    mode,
    registration_id: registrationId,
    magic_token: magicToken,
    reference_code: referenceCode,
    recovery_url: recoveryUrl,
    guest_name: guestName,
    guest_phone: guestPhone,
    event_name: eventName,
    event_slug: event.slug ?? null,
    payment_status: paymentStatus,
    player_claimed_paid: playerClaimedPaid,
    registered_at: registeredAt,
  });
});
