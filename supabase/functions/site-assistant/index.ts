// ============================================================================
// site-assistant — trợ lý AI chung trên mọi màn hình (web + iOS), 12/11/2026.
//
// verify_jwt = false (ES256 workaround). JWT là TUỲ CHỌN: có thì kiểm bằng
// getAuthUser để áp hạn mức theo user; không có = khách, hạn mức theo IP băm.
//   POST { assistant: { thread_id, lang, page, route, label?, summary?, messages } }
//     → 200 { reply, links: [{ href, label }], lang, outcome, contact }
//   POST { support: { message, name?, phone?, email?, zalo?, page_type, route, page_label, lang, transcript, website } }
//     → 200 { ok: true, reply } | 200 { ok: false, error, reply }  (lỗi nghiệp vụ vẫn 200
//       để web lẫn iOS đọc được câu báo lỗi đã dịch — invoke() bỏ body khi non-2xx)
//
// support = "Liên hệ admin" (thay 2 nút Messenger/Zalo, 12/11/2026): form trong
// khung trợ lý → hạn mức (consume_support_request_quota, mặc định 3/giờ +
// 10/ngày theo user/IP băm) → INSERT support_requests (service_role, user_id
// từ JWT) → báo Telegram ops (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID). Telegram
// lỗi không làm hỏng yêu cầu của người dùng.
//
// Chỉ hỏi–đáp + dẫn link (allowlist shared.ts) — không ghi dữ liệu người dùng,
// không viết nội dung. Sửa giải vẫn là việc của tournament-assistant.
// Chặn chi phí: consume_site_assistant_quota (Postgres, nguyên tử) trước khi
// gọi Gemini; hết hạn mức / hết trần ngày / RPC lỗi → câu trả lời tĩnh,
// không gọi Gemini. Mọi lượt ghi site_assistant_log (giữ 30 ngày).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getAuthUser } from "../_shared/auth.ts";
import { supabaseClientPostCorsHeaders as corsHeaders } from "../_shared/cors.ts";
import { callGemini, geminiConfigured } from "../_shared/gemini.ts";
import { getViewEventClientIp } from "../_shared/view-events.ts";
import { needsContact, readSupport, supportLimitsFrom, supportQuotaOutcome, supportReply, telegramText, type SupportInput } from "./support.ts";
import {
  buildPayload, clipHistory, fallback, identityHash, limitsFrom, MAX_BODY_BYTES, parseModel, quotaOutcome,
  readPageCtx, replyLang, type Lang, type Link, type Outcome, type PageCtx,
} from "./rules.ts";

const LIMITS = limitsFrom((k) => Deno.env.get(k));
const SUPPORT_LIMITS = supportLimitsFrom((k) => Deno.env.get(k));
const admin = () => createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function log(row: {
  thread_id: string; user_id: string | null; ctx: PageCtx; lang: Lang; user_text: string;
  reply: string | null; outcome: Outcome; latency_ms: number; model: string | null;
}): Promise<void> {
  try {
    const { error } = await admin().from("site_assistant_log").insert({
      thread_id: row.thread_id || null, user_id: row.user_id, page_type: row.ctx.page, route: row.ctx.route || null,
      lang: row.lang, user_text: row.user_text.slice(0, 500), reply: row.reply?.slice(0, 1500) ?? null,
      outcome: row.outcome, model: row.model, latency_ms: row.latency_ms,
    });
    if (error) console.error("[site-assistant] log", error.message);
  } catch (err) {
    console.error("[site-assistant] log", err);
  }
}

async function notifyTelegram(r: SupportInput, id: string, userId: string | null): Promise<void> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chat = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
  if (!token || !chat) {
    console.error("[site-assistant] support notify: telegram not configured");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: telegramText(r, id, userId), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.error("[site-assistant] support notify", res.status);
  } catch (err) {
    console.error("[site-assistant] support notify", err instanceof Error ? err.name : "error");
  }
}

async function handleSupport(req: Request, raw: unknown): Promise<Response> {
  const parsed = readSupport(raw);
  const lang = ((raw ?? {}) as Record<string, unknown>).lang === "en" ? "en" : "vi";
  if (!parsed.ok) return json({ ok: false, error: parsed.error, reply: supportReply(lang, parsed.error) });
  const r = parsed.value;
  // Bot điền ô bẫy → trả như thành công, không ghi, không báo.
  if (r.honeypot) return json({ ok: true, reply: supportReply(r.lang, "sent") });
  const user = req.headers.get("Authorization")
    ? await getAuthUser(req, createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? ""))
    : null;
  const userId = user?.id ?? null;
  if (needsContact(r, userId)) return json({ ok: false, error: "contact_required", reply: supportReply(r.lang, "contact_required") });

  let quota: ReturnType<typeof supportQuotaOutcome> = "error";
  try {
    const rpc = await admin().rpc("consume_support_request_quota", {
      p_identity_hash: await identityHash(userId, userId ? null : getViewEventClientIp(req)),
      p_hourly_limit: SUPPORT_LIMITS.hourly,
      p_daily_limit: SUPPORT_LIMITS.daily,
    });
    quota = supportQuotaOutcome(rpc);
    if (rpc.error) console.error("[site-assistant] support quota", rpc.error.message);
  } catch (err) {
    console.error("[site-assistant] support quota", err);
  }
  if (quota !== "ok") return json({ ok: false, error: quota, reply: supportReply(r.lang, quota) });

  const { data, error } = await admin().from("support_requests").insert({
    user_id: userId, name: r.name, phone: r.phone, email: r.email, zalo: r.zalo, message: r.message,
    page_type: r.page_type, route: r.route, page_label: r.page_label, lang: r.lang,
    transcript: r.transcript.length ? r.transcript : null,
  }).select("id").single();
  if (error || !data) {
    console.error("[site-assistant] support insert", error?.message);
    return json({ ok: false, error: "save_failed", reply: supportReply(r.lang, "error") });
  }
  await notifyTelegram(r, String(data.id), userId);
  return json({ ok: true, reply: supportReply(r.lang, "sent") });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  let body: Record<string, unknown>;
  try {
    body = (JSON.parse(raw) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (body.support != null) return handleSupport(req, body.support);
  const b = (body.assistant ?? null) as Record<string, unknown>;
  if (!b || typeof b !== "object") return json({ error: "invalid_request" }, 400);
  const msgs = clipHistory(b.messages);
  if (!msgs) return json({ error: "invalid_messages" }, 400);

  const started = Date.now();
  const ctx = readPageCtx(b);
  const userText = msgs[msgs.length - 1].text;
  const lang = replyLang(msgs.filter((m) => m.role === "user").map((m) => m.text), b.lang);
  const threadId = typeof b.thread_id === "string" ? b.thread_id.slice(0, 60) : "";
  const user = req.headers.get("Authorization")
    ? await getAuthUser(req, createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? ""))
    : null;
  const userId = user?.id ?? null;

  const done = async (outcome: Outcome, reply: string, links: Link[], model: string | null = null, contact = false) => {
    await log({ thread_id: threadId, user_id: userId, ctx, lang, user_text: userText, reply, outcome, latency_ms: Date.now() - started, model });
    return json({ reply, links, lang, outcome, contact });
  };

  // Hạn mức trước, Gemini sau. Thiếu RPC/bảng → đóng (trả câu tĩnh), không gọi Gemini.
  let quota: ReturnType<typeof quotaOutcome> = "error";
  try {
    const rpc = await admin().rpc("consume_site_assistant_quota", {
      p_identity_hash: await identityHash(userId, userId ? null : getViewEventClientIp(req)),
      p_daily_limit: userId ? LIMITS.userDaily : LIMITS.anonDaily,
      p_burst_limit: LIMITS.burstPerMin,
      p_global_limit: LIMITS.globalDaily,
    });
    quota = quotaOutcome(rpc);
    if (rpc.error) console.error("[site-assistant] quota", rpc.error.message);
  } catch (err) {
    console.error("[site-assistant] quota", err);
  }
  if (quota !== "ok") {
    const f = fallback(lang, quota, ctx.page);
    return done(quota, f.reply, f.links);
  }
  if (!geminiConfigured()) {
    const f = fallback(lang, "error", ctx.page);
    return done("error", f.reply, f.links);
  }

  const { text, error } = await callGemini(LIMITS.model, buildPayload(msgs, ctx, lang), { budgetMs: 15_000, perModelMs: 8_000, tag: "site-assistant" });
  const parsed = parseModel(text);
  if (!parsed) {
    if (error) console.error("[site-assistant] gemini", error.slice(0, 300));
    const f = fallback(lang, "error", ctx.page);
    return done("error", f.reply, f.links, LIMITS.model);
  }
  return done(parsed.intent === "off_topic" ? "off_topic" : "answered", parsed.reply, parsed.links, LIMITS.model, parsed.intent === "contact");
});
