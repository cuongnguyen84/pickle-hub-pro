// ============================================================================
// newsletter-subscribe — public POST endpoint
//
// Accepts { email, language, source } and upserts into newsletter_subscribers.
// verify_jwt = false because this is public; rate limit by IP upstream (Cloudflare).
//
// Confirmation email via Resend is intentionally deferred to a follow-up
// commit so this edge function stays small and reliable.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { newsletterCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// RFC-5322-ish lightweight email regex (not strictly exhaustive; edge cases
// like quoted-local-part are rejected — fine for a newsletter form).
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const MAX_PER_IP_PER_HOUR = 20;

// SHA-256 hex of the client IP — we store a hash, never the raw IP.
async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, code: "method_not_allowed", message: "Use POST" }),
      { status: 405, headers: corsHeaders },
    );
  }

  let body: { email?: string; language?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, code: "invalid_json", message: "Body must be JSON" }),
      { status: 400, headers: corsHeaders },
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const language = body.language === "vi" ? "vi" : "en";
  const source = (body.source ?? "the-line-homepage").slice(0, 64);

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return new Response(
      JSON.stringify({ ok: false, code: "invalid_email", message: "Please enter a valid email address." }),
      { status: 400, headers: corsHeaders },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ─── Rate limit: MAX_PER_IP_PER_HOUR subscribes per IP per hour (M9) ───────
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
  const ipHash = await hashIp(ip);
  const windowHour = new Date();
  windowHour.setUTCMinutes(0, 0, 0);
  const wh = windowHour.toISOString();
  const { data: rl } = await supabase
    .from("newsletter_rate_limits")
    .select("count")
    .eq("ip_hash", ipHash)
    .eq("window_hour", wh)
    .maybeSingle();
  const current = (rl?.count as number | undefined) ?? 0;
  if (current >= MAX_PER_IP_PER_HOUR) {
    return new Response(
      JSON.stringify({ ok: false, code: "rate_limited", message: "Too many requests. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Retry-After": "3600" } },
    );
  }
  await supabase
    .from("newsletter_rate_limits")
    .upsert({ ip_hash: ipHash, window_hour: wh, count: current + 1 }, { onConflict: "ip_hash,window_hour" });

  // Upsert — if email already subscribed, update language + source but keep
  // existing confirmed flag + created_at. Don't treat duplicates as errors;
  // idempotent UX is friendlier than "already subscribed" shaming.
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      { email, language, source },
      { onConflict: "email", ignoreDuplicates: false },
    );

  if (error) {
    console.error("[newsletter-subscribe] upsert error", error);
    return new Response(
      JSON.stringify({ ok: false, code: "server_error", message: "Couldn't save right now. Try again in a minute." }),
      { status: 500, headers: corsHeaders },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: language === "vi"
        ? "Đã đăng ký. Hẹn gặp lại vào sáng mai."
        : "Subscribed. See you in your inbox tomorrow morning.",
    }),
    { status: 200, headers: corsHeaders },
  );
});
