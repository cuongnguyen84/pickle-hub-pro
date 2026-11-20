// ============================================================================
// request-recovery-link — Social Events MVP (PR59) edge function
// ----------------------------------------------------------------------------
// POST { phone_e164, event_id?: string, captcha_token?: string }
//
// Recovery is delivered only through a registered channel. CAPTCHA is an
// abuse check, never proof of phone ownership or permission to receive a token.
// Rate-limited at 5 attempts/phone/24h via public.recovery_attempts. The
// table itself is service-role-only.
//
// verify_jwt=false; uses SUPABASE_SERVICE_ROLE_KEY internally to read
// registration_secrets (service-role-only table).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { jsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
    logEvent({ step: "turnstile_error", error: "provider_request_failed" });
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
    if (res.ok && body.error === 0) return true;
    logEvent({ step: "zalo_send_failed", status: res.status, error: typeof body.error === "number" ? body.error : "invalid_provider_response" });
    return false;
  } catch (e) {
    logEvent({ step: "zalo_error", error: "provider_request_failed" });
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
      logEvent({ step: "resend_send_failed", status: res.status });
      return false;
    }
    const result = await res.json() as { id?: unknown };
    return typeof result.id === "string" && result.id.length > 0;
  } catch (e) {
    logEvent({ step: "resend_error", error: "provider_request_failed" });
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
  const { count: recentCount, error: rateError } = await supabase
    .from("recovery_attempts")
    .select("id", { count: "exact", head: true })
    .eq("phone_e164", phone)
    .gte("attempted_at", since);
  if (rateError) return err("rate_limit_check_failed", 503, "rate_limit_check_failed");
  if ((recentCount ?? 0) >= MAX_ATTEMPTS_PER_DAY) {
    await supabase
      .from("recovery_attempts")
      .insert({ phone_e164: phone, method: "rejected", succeeded: false });
    return err("rate_limit_exceeded", 429, "rate_limit_exceeded");
  }

  // Require the abuse check before any lookup or notification, for every phone.
  if (!captchaToken) return jsonResponse({ ok: false, code: "captcha_required" });
  if (!await verifyTurnstile(captchaToken, req.headers.get("cf-connecting-ip") ?? undefined)) {
    return err("captcha_failed", 400, "captcha_failed");
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

  let target = regs.find((row) => !row.cancelled_at) ?? null;
  if (target) {
    const { data: secret, error } = await supabase.from("registration_secrets")
      .select("expires_at").eq("registration_id", target.registration_id).maybeSingle();
    const expires = secret?.expires_at ? Date.parse(secret.expires_at) : NaN;
    if (error || !Number.isFinite(expires) || expires <= Date.now()) target = null;
  }
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://www.thepicklehub.net";
  const recoveryUrl = target ? `${siteUrl}/dang-ky/${target.magic_token}` : "";
  let method = "rejected";
  let delivered = false;
  // ZNS delivers to the registered phone, never to a request-supplied address.
  if (target?.zalo_user_id) {
    delivered = await sendZalo({
      phone_no_plus: phone.replace(/^\+/, ""), zalo_user_id: target.zalo_user_id,
      event_title: target.event_title_vi, recovery_url: recoveryUrl,
      tracking_id: target.registration_id,
    });
    if (delivered) method = "zalo";
  }
  // contact_email is user-supplied. Require an independently confirmed Auth
  // email for that profile, not merely a matching string in profiles.
  if (!delivered && target?.contact_email && target.profile_id) {
    const { data, error } = await supabase.auth.admin.getUserById(target.profile_id);
    const owner = data?.user;
    if (!error && owner?.email_confirmed_at && owner.email &&
        owner.email.toLowerCase() === target.contact_email.toLowerCase()) {
      delivered = await sendEmail({ to: owner.email,
        event_title: target.event_title_vi, recovery_url: recoveryUrl });
      if (delivered) method = "email";
    }
  }
  await supabase.from("recovery_attempts").insert({
    phone_e164: phone, method, succeeded: delivered,
  });
  // Same response for absent registration, no verified channel, provider failure
  // and successful delivery. Never return a bearer token or a channel hint.
  return jsonResponse({ ok: true, channel: "registered_channel" });
});
