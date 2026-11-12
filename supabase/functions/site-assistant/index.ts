// ============================================================================
// site-assistant — trợ lý AI chung trên mọi màn hình (web + iOS), 12/11/2026.
//
// verify_jwt = false (ES256 workaround). JWT là TUỲ CHỌN: có thì kiểm bằng
// getAuthUser để áp hạn mức theo user; không có = khách, hạn mức theo IP băm.
//   POST { assistant: { thread_id, lang, page, route, label?, summary?, messages } }
//     → 200 { reply, links: [{ href, label }], lang, outcome }
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
import {
  buildPayload, clipHistory, fallback, identityHash, limitsFrom, MAX_BODY_BYTES, parseModel, quotaOutcome,
  readPageCtx, replyLang, type Lang, type Link, type Outcome, type PageCtx,
} from "./rules.ts";

const LIMITS = limitsFrom((k) => Deno.env.get(k));
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  let b: Record<string, unknown>;
  try {
    b = ((JSON.parse(raw) as Record<string, unknown>)?.assistant ?? null) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!b || typeof b !== "object") return json({ error: "invalid_request" }, 400);
  const msgs = clipHistory(b.messages);
  if (!msgs) return json({ error: "invalid_messages" }, 400);

  const started = Date.now();
  const ctx = readPageCtx(b);
  const userText = msgs[msgs.length - 1].text;
  const lang = replyLang(userText, b.lang);
  const threadId = typeof b.thread_id === "string" ? b.thread_id.slice(0, 60) : "";
  const user = req.headers.get("Authorization")
    ? await getAuthUser(req, createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? ""))
    : null;
  const userId = user?.id ?? null;

  const done = async (outcome: Outcome, reply: string, links: Link[], model: string | null = null) => {
    await log({ thread_id: threadId, user_id: userId, ctx, lang, user_text: userText, reply, outcome, latency_ms: Date.now() - started, model });
    return json({ reply, links, lang, outcome });
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
  return done(parsed.intent === "off_topic" ? "off_topic" : "answered", parsed.reply, parsed.links, LIMITS.model);
});
