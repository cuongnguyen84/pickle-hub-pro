// ============================================================================
// phone-otp-send — Social Events MVP (PR1, channel-extended in PR61)
// ----------------------------------------------------------------------------
// POST { phone, event_id, force_channel?: 'sms' | 'zalo' }
//
// Flow:
//   1. Normalize + validate VN phone via _shared/phone.ts
//   2. Check the target event is still accepting registrations
//      (status='published', start_at in the future, allow_guests=true,
//      not full).
//   3. Rate limit: max 3 OTPs per phone per 15 minutes per event.
//   4. Generate 6-digit OTP, hash with phone salt, persist in otp_codes
//      with a 5-minute TTL.
//   5. Channel resolution (PR61):
//        - dev mode (ENVIRONMENT=development) → log to stdout, return code
//        - force_channel='sms' → eSMS only
//        - force_channel='zalo' → Zalo only, no fallback (rarely used)
//        - default → try Zalo ZNS first; on any failure fall back to
//          eSMS so a user without Zalo OA still gets their OTP.
//      Every send (success or failure) writes a row to otp_send_logs.
//
// Returns channel actually used so the client hint can adapt ("check
// Zalo" vs "check SMS").
//
// verify_jwt=false in supabase/config.toml. Service-role key used
// internally for DB writes.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { normalizeVietnamPhone } from "../_shared/phone.ts";
import { generateOtpCode, hashOtp } from "../_shared/otp.ts";
import { sendBrandnameSms } from "../_shared/sms-esms.ts";
import { sendZaloZns } from "../_shared/zalo-zns.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 3;

// PR69 — abuse defense constants
const IP_RATE_MAX = 5;        // max successful OTPs / IP / RATE_WINDOW_MS
const ZBS_DEFAULT_BUDGET = 50000;  // VND/day if env unset
const ZBS_COST_PER_SEND = 400;     // VND per successful Zalo send (SDT pricing)
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface SendBody {
  phone?: unknown;
  event_id?: unknown;
  /** PR61 — let the client force the SMS fallback when the user
   *  doesn't follow the Zalo OA. Optional; default = "auto". */
  force_channel?: unknown;
  /** PR69 — Cloudflare Turnstile token (invisible CAPTCHA). Required
   *  in production to block bot scripts from burning Zalo ZBS credit. */
  turnstile_token?: unknown;
}

type Channel = "zalo" | "sms" | "dev";

async function logSendAttempt(
  supabase: ReturnType<typeof createClient>,
  args: {
    phone: string;
    event_id: string;
    channel: Channel;
    success: boolean;
    error_code?: string;
    /** PR69 — caller IP for per-IP rate limiting. Stored as inet. */
    ip_address?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("otp_send_logs").insert({
      phone_e164: args.phone,
      event_id: args.event_id,
      channel: args.channel,
      success: args.success,
      error_code: args.error_code ?? null,
      ip_address: args.ip_address ?? null,
    });
  } catch {
    // telemetry failure must never block the user
  }
}

// ─── PR69 helpers ──────────────────────────────────────────────────────────
/** Extract caller IP from Cloudflare / proxy headers. Returns null when
 *  no usable IP is present (e.g. server-to-server calls). */
function extractIp(req: Request): string | null {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // x-forwarded-for is a comma-separated list; the client IP is the first.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

/** Verify a Turnstile token with Cloudflare. Returns { ok, errorCodes }.
 *  Network failures count as `ok: false` so a Cloudflare outage doesn't
 *  let bots through. */
async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | null,
): Promise<{ ok: boolean; errorCodes?: string[] }> {
  if (!token || !secret) {
    return { ok: false, errorCodes: ["missing_token_or_secret"] };
  }
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.append("remoteip", ip);
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const body = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    return {
      ok: body.success === true,
      errorCodes: body["error-codes"],
    };
  } catch (e) {
    return { ok: false, errorCodes: ["network_error:" + String(e).slice(0, 80)] };
  }
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

  // ─── PR69 — abuse defense (run BEFORE charging-side checks) ────────────
  const ip = extractIp(req);
  const _defenseEnv = (Deno.env.get("ENVIRONMENT") ?? "production").toLowerCase();
  const isDev = _defenseEnv === "development" || _defenseEnv === "dev" || _defenseEnv === "local";

  // a) Turnstile verify — REQUIRED in production. In dev mode we skip so
  //    local cURL testing doesn't break.
  if (!isDev) {
    const turnstileToken =
      typeof body.turnstile_token === "string" ? body.turnstile_token : "";
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET") ?? "";
    if (!turnstileSecret) {
      logEvent({ step: "turnstile_secret_missing" });
      return err("captcha_misconfigured", 500, "captcha_misconfigured");
    }
    const ts = await verifyTurnstile(turnstileToken, turnstileSecret, ip);
    if (!ts.ok) {
      logEvent({
        step: "turnstile_failed",
        ip,
        phone,
        error_codes: ts.errorCodes,
      });
      // Don't log to otp_send_logs — no Zalo credit spent, just a bot attempt.
      return err("captcha_failed", 403, "captcha_failed");
    }
  }

  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

  // b) IP rate limit — max IP_RATE_MAX successful OTPs / IP / window.
  //    Only counts success=true so failed/rejected sends don't punish the IP.
  if (ip) {
    const { count: ipCount, error: ipErr } = await supabase
      .from("otp_send_logs")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("success", true)
      .gte("sent_at", windowStart);
    if (ipErr) {
      logEvent({ error: ipErr.message, step: "ip_rate_check" });
      // Fail-open on lookup error — better UX than blocking everyone if the
      // query plan regresses; abuse case still caught by Turnstile + budget cap.
    } else if ((ipCount ?? 0) >= IP_RATE_MAX) {
      logEvent({ step: "ip_rate_exceeded", ip, count: ipCount });
      return err("too_many_otps_ip", 429, "too_many_otps_ip");
    }
  }

  // c) Daily ZBS budget kill-switch — caps the worst-case daily spend
  //    when Turnstile + IP limits are somehow bypassed (e.g. residential
  //    botnet sharing valid Turnstile tokens).
  if (!isDev) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count: todayCount, error: budgetErr } = await supabase
      .from("otp_send_logs")
      .select("id", { count: "exact", head: true })
      .eq("channel", "zalo")
      .eq("success", true)
      .gte("sent_at", todayStart.toISOString());
    if (budgetErr) {
      logEvent({ error: budgetErr.message, step: "budget_check" });
      // Fail-open — abuse already caught by Turnstile + IP
    } else {
      const budget = parseInt(
        Deno.env.get("ZBS_DAILY_BUDGET_VND") ?? String(ZBS_DEFAULT_BUDGET),
        10,
      );
      const todayCost = (todayCount ?? 0) * ZBS_COST_PER_SEND;
      if (todayCost >= budget) {
        logEvent({
          step: "budget_exceeded",
          today_count: todayCount,
          today_cost: todayCost,
          budget,
        });
        return err("daily_budget_exceeded", 503, "daily_budget_exceeded");
      }
    }
  }

  // ─── Per-phone rate limit (existing) ────────────────────────────────────
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

  // ─── Deliver — channel resolution ───────────────────────────────────────
  const env = (Deno.env.get("ENVIRONMENT") ?? "production").toLowerCase();
  const isDevMode = env === "development" || env === "dev" || env === "local";
  const eventLabel =
    (event.title_vi as string | null) || (event.title_en as string | null) || "ThePickleHub";
  const smsContent =
    `[ThePickleHub] Ma OTP dang ky su kien "${eventLabel}": ${code} (5 phut). ` +
    `Khong chia se ma nay.`;

  if (isDevMode) {
    logEvent({
      step: "dev_mode_otp",
      phone,
      event_id: eventIdInput,
      otp: code,
      note: "SMS/Zalo not sent — ENVIRONMENT=development",
    });
    await logSendAttempt(supabase, {
      phone,
      event_id: eventIdInput,
      channel: "dev",
      success: true,
    ip_address: ip,
      });
    return jsonResponse({
      ok: true,
      expires_at: expiresAt,
      channel: "dev",
      dev_mode_code: code,
    });
  }

  const forceChannelRaw = typeof body.force_channel === "string"
    ? body.force_channel.toLowerCase()
    : "";
  const forceChannel: "sms" | "zalo" | null =
    forceChannelRaw === "sms" ? "sms" : forceChannelRaw === "zalo" ? "zalo" : null;

  // PR61 — channel resolution. Try Zalo ZNS first (cheaper + brand
  // trust) and fall back to eSMS so users without the OA still
  // receive an OTP. force_channel='sms' skips Zalo entirely.
  //
  // PR65: ZALO_OA_ACCESS_TOKEN is now loaded from the `zalo_tokens`
  // DB row (id=1, auto-refreshed every 23h by zalo-token-refresh
  // edge function). The env var is no longer the source of truth.
  const templateId = Deno.env.get("ZALO_TEMPLATE_ID_OTP") ?? "";

  let zaloAccessToken = "";
  if (templateId.length > 0 && forceChannel !== "sms") {
    const { data: tokenRow } = await supabase
      .from("zalo_tokens")
      .select("access_token")
      .eq("id", 1)
      .maybeSingle();
    zaloAccessToken = (tokenRow?.access_token as string | undefined) ?? "";
  }

  const zaloConfigured = templateId.length > 0 && zaloAccessToken.length > 0;
  const tryZalo = forceChannel !== "sms" && zaloConfigured;

  if (tryZalo) {
    const zaloResult = await sendZaloZns({
      phone_no_plus: phone.replace(/^\+/, ""),
      template_id: templateId,
      // Stock Zalo "Mẫu xác thực" template uses param name `otp`.
      template_data: { otp: code },
      tracking_id: `${eventIdInput}:${phone}:${Date.now()}`,
      access_token: zaloAccessToken,
    });

    if (zaloResult.ok) {
      logEvent({
        step: "zalo_send_ok",
        phone,
        event_id: eventIdInput,
        provider_message_id: zaloResult.provider_message_id,
      });
      await logSendAttempt(supabase, {
        phone,
        event_id: eventIdInput,
        channel: "zalo",
        success: true,
      ip_address: ip,
      });
      return jsonResponse({ ok: true, expires_at: expiresAt, channel: "zalo" });
    }

    logEvent({
      step: "zalo_send_failed",
      phone,
      event_id: eventIdInput,
      reason: zaloResult.reason,
      provider_code: zaloResult.code,
      provider_error: zaloResult.message,
    });
    await logSendAttempt(supabase, {
      phone,
      event_id: eventIdInput,
      channel: "zalo",
      success: false,
      error_code: zaloResult.reason,
    ip_address: ip,
      });

    if (forceChannel === "zalo") {
      // Explicit zalo-only request — don't silently fall back.
      return err("zalo_send_failed", 502, "zalo_send_failed");
    }
    // Otherwise fall through to eSMS.
  }

  const smsResult = await sendBrandnameSms({ phoneE164: phone, content: smsContent });
  if (!smsResult.ok) {
    logEvent({
      step: "sms_send_failed",
      phone,
      event_id: eventIdInput,
      provider_code: smsResult.codeResult,
      provider_error: smsResult.errorMessage,
    });
    await logSendAttempt(supabase, {
      phone,
      event_id: eventIdInput,
      channel: "sms",
      success: false,
      error_code: smsResult.codeResult ?? smsResult.errorMessage,
    ip_address: ip,
      });
    return err("sms_send_failed", 502, "sms_send_failed");
  }

  logEvent({
    step: "sms_send_ok",
    phone,
    event_id: eventIdInput,
    provider_message_id: smsResult.messageId,
  });
  await logSendAttempt(supabase, {
    phone,
    event_id: eventIdInput,
    channel: "sms",
    success: true,
  ip_address: ip,
      });
  return jsonResponse({ ok: true, expires_at: expiresAt, channel: "sms" });
});
