// ============================================================================
// request-recovery-link — Social Events MVP (PR59) edge function
// ----------------------------------------------------------------------------
// POST { phone_e164, event_id?: string, captcha_token?: string }
//
// Tiered recovery flow for players who lost their /dang-ky/:token URL.
// Channel resolution order:
//   1. Zalo ZNS — when the matched profile has zalo_user_id set
//   2. Email   — when the matched profile has contact_email set
//   3. CAPTCHA — when neither channel is available but a valid
//                Cloudflare Turnstile token is presented; returns the
//                magic_token in the response so the client can deep-link
//
// Rate-limited at 5 attempts/phone/24h via public.recovery_attempts. The
// table itself is service-role-only.
//
// verify_jwt=false; uses SUPABASE_SERVICE_ROLE_KEY internally to read
// registration_secrets (service-role-only table).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

const E164_RE = /^\+[1-9][0-9]{7,14}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ATTEMPTS_PER_DAY = 5;

interface RecoveryBody {
  phone_e164?: unknown;
  event_id?: unknown;
  captcha_token?: unknown;
}

interface RegistrationRow {
  registration_id: string;
  magic_token: string;
  event_id: string;
  event_slug: string;
  event_title_vi: string;
  event_start_at: string;
  cancelled_at: string | null;
  profile_id: string | null;
  contact_email: string | null;
  zalo_user_id: string | null;
}

function err(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "request-recovery-link", ...payload }));
}

async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET") ?? "";
  if (!secret) {
    logEvent({ step: "captcha_disabled" });
    return false;
  }
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (ip) form.set("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    const body = (await res.json()) as { success?: boolean };
    return Boolean(body.success);
  } catch (e) {
    logEvent({ step: "turnstile_error", error: String(e) });
    return false;
  }
}

async function sendZalo(args: {
  phone_no_plus: string;
  zalo_user_id: string;
  event_title: string;
  recovery_url: string;
  tracking_id: string;
}): Promise<boolean> {
  const accessToken = Deno.env.get("ZALO_OA_ACCESS_TOKEN") ?? "";
  const templateId = Deno.env.get("ZALO_TEMPLATE_ID_RECOVERY") ?? "";
  if (!accessToken || !templateId) {
    logEvent({ step: "zalo_not_configured" });
    return false;
  }
  try {
    const res = await fetch(
      "https://business.openapi.zalo.me/message/template",
      {
        method: "POST",
        headers: {
          access_token: accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: args.phone_no_plus,
          template_id: templateId,
          template_data: {
            event_name: args.event_title,
            recovery_url: args.recovery_url,
          },
          tracking_id: args.tracking_id,
        }),
      },
    );
    const body = (await res.json()) as { error?: number; message?: string };
    if (body.error === 0 || body.error === undefined) return true;
    logEvent({ step: "zalo_send_failed", error: body.error, message: body.message });
    return false;
  } catch (e) {
    logEvent({ step: "zalo_error", error: String(e) });
    return false;
  }
}

async function sendEmail(args: {
  to: string;
  event_title: string;
  recovery_url: string;
}): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!apiKey) {
    logEvent({ step: "resend_not_configured" });
    return false;
  }
  try {
    const html = `
      <!DOCTYPE html>
      <html><body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #222;">
        <h2>Link quản lý đăng ký của bạn</h2>
        <p>Sự kiện: <strong>${args.event_title.replace(/</g, "&lt;")}</strong></p>
        <p>Nhấn vào nút bên dưới để xem/huỷ đăng ký:</p>
        <p>
          <a href="${args.recovery_url}"
             style="display:inline-block; padding:10px 18px; background:#16a34a; color:white; text-decoration:none; border-radius:6px;">
            Xem đăng ký
          </a>
        </p>
        <p style="color:#666; font-size:13px;">
          Hoặc copy URL này: <a href="${args.recovery_url}">${args.recovery_url}</a>
        </p>
        <hr style="border:0; border-top:1px solid #eee; margin:24px 0;" />
        <p style="color:#888; font-size:12px;">
          Bạn nhận email này vì có người yêu cầu khôi phục link đăng ký với số điện thoại đã đăng ký event này.
          Nếu không phải bạn, hãy bỏ qua email.
        </p>
      </body></html>
    `;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "The Pickle Hub <no-reply@mail.thepicklehub.net>",
        to: args.to,
        subject: `Link quản lý đăng ký — ${args.event_title}`,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      logEvent({ step: "resend_send_failed", status: res.status, body: text });
      return false;
    }
    return true;
  } catch (e) {
    logEvent({ step: "resend_error", error: String(e) });
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  let body: RecoveryBody;
  try {
    body = (await req.json()) as RecoveryBody;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const phone = typeof body.phone_e164 === "string" ? body.phone_e164.trim() : "";
  if (!E164_RE.test(phone)) {
    return err("invalid_phone", 400, "invalid_phone");
  }

  const eventId =
    typeof body.event_id === "string" && UUID_RE.test(body.event_id)
      ? body.event_id
      : null;
  const captchaToken =
    typeof body.captcha_token === "string" && body.captcha_token.trim().length > 0
      ? body.captcha_token.trim()
      : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── Rate limit: 5 attempts / phone / 24h ────────────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("recovery_attempts")
    .select("id", { count: "exact", head: true })
    .eq("phone_e164", phone)
    .gte("attempted_at", since);
  if ((recentCount ?? 0) >= MAX_ATTEMPTS_PER_DAY) {
    await supabase
      .from("recovery_attempts")
      .insert({ phone_e164: phone, method: "rejected", succeeded: false });
    return err("rate_limit_exceeded", 429, "rate_limit_exceeded");
  }

  // ─── Lookup registrations ────────────────────────────────────────────────
  const { data: rows, error: rpcErr } = await supabase.rpc(
    "find_registrations_by_phone",
    { p_phone_e164: phone },
  );
  if (rpcErr) {
    logEvent({ step: "rpc_error", error: rpcErr.message });
    return err("lookup_failed", 500, "lookup_failed");
  }
  const allRegs = (rows ?? []) as RegistrationRow[];
  const regs = eventId ? allRegs.filter((r) => r.event_id === eventId) : allRegs;

  if (regs.length === 0) {
    await supabase
      .from("recovery_attempts")
      .insert({ phone_e164: phone, method: "rejected", succeeded: false });
    return err("no_registration_found", 404, "no_registration_found");
  }

  // The recovery URL points to the most-recent registration when there
  // are several. Future improvement: a phone-keyed list page.
  const target = regs[0];
  const siteUrl =
    Deno.env.get("SITE_URL") ?? "https://www.thepicklehub.net";
  const recoveryUrl = `${siteUrl}/dang-ky/${target.magic_token}`;

  // ─── Channel selection ───────────────────────────────────────────────────
  // 1. Zalo (if zalo_user_id present + secrets configured)
  if (target.zalo_user_id) {
    const ok = await sendZalo({
      phone_no_plus: phone.replace(/^\+/, ""),
      zalo_user_id: target.zalo_user_id,
      event_title: target.event_title_vi,
      recovery_url: recoveryUrl,
      tracking_id: target.registration_id,
    });
    if (ok) {
      await supabase
        .from("recovery_attempts")
        .insert({ phone_e164: phone, method: "zalo", succeeded: true });
      return jsonResponse({
        ok: true,
        channel: "zalo",
        count: regs.length,
      });
    }
    // fall through to email if Zalo failed
  }

  // 2. Email
  if (target.contact_email) {
    const ok = await sendEmail({
      to: target.contact_email,
      event_title: target.event_title_vi,
      recovery_url: recoveryUrl,
    });
    if (ok) {
      await supabase
        .from("recovery_attempts")
        .insert({ phone_e164: phone, method: "email", succeeded: true });
      const masked = target.contact_email.replace(
        /^(.).+(@.+)$/,
        (_m, a, c) => `${a}***${c}`,
      );
      return jsonResponse({
        ok: true,
        channel: "email",
        masked_email: masked,
        count: regs.length,
      });
    }
  }

  // 3. CAPTCHA — return the token directly when the user passes Turnstile.
  // We only echo the magic_token here, never via Zalo/email logs.
  if (captchaToken) {
    const ip = req.headers.get("cf-connecting-ip") ?? undefined;
    const captchaOk = await verifyTurnstile(captchaToken, ip);
    if (captchaOk) {
      await supabase
        .from("recovery_attempts")
        .insert({ phone_e164: phone, method: "captcha", succeeded: true });
      return jsonResponse({
        ok: true,
        channel: "captcha",
        magic_token: target.magic_token,
        recovery_url: recoveryUrl,
        count: regs.length,
      });
    }
    return err("captcha_failed", 400, "captcha_failed");
  }

  // None of the channels resolved → ask client to surface CAPTCHA.
  await supabase
    .from("recovery_attempts")
    .insert({ phone_e164: phone, method: "rejected", succeeded: false });
  return jsonResponse(
    { ok: false, code: "captcha_required", count: regs.length },
    200,
  );
});
