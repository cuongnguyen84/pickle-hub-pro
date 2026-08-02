import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";

type Job = {
  job_key: string;
  display_name: string;
  health_state: string;
  last_activity_at: string | null;
  summary: string | null;
  error_message: string | null;
  executor: string;
  schedule_label: string;
};

const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const allowedChat = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

async function sendTelegram(chatId: string, text: string): Promise<void> {
  if (!tgToken || chatId !== allowedChat) throw new Error("telegram_chat_not_allowed");
  const response = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`telegram_http_${response.status}`);
}

function jobsText(jobs: Job[]): string {
  const counts = jobs.reduce<Record<string, number>>((all, job) => {
    all[job.health_state] = (all[job.health_state] ?? 0) + 1;
    return all;
  }, {});
  const lines = [
    `📊 Job Health: ✅ ${counts.healthy ?? 0} · ⚠️ ${counts.warning ?? 0} · ❌ ${counts.failed ?? 0} · ⏳ ${counts.pending ?? 0}`,
  ];
  for (const job of jobs.filter((item) => ["warning", "failed"].includes(item.health_state))) {
    lines.push(`${job.health_state === "failed" ? "❌" : "⚠️"} ${job.job_key}: ${job.error_message || job.summary || "Không có chi tiết"}`);
  }
  lines.push("https://www.thepicklehub.net/admin/jobs");
  return lines.join("\n").slice(0, 4000);
}

async function processTelegram(supabase: ReturnType<typeof createClient>, onlyId?: number): Promise<Record<string, unknown>> {
  let query = supabase.from("telegram_commands")
    .select("id,chat_id,text,from_id,from_username")
    .eq("status", "pending")
    .or("text.ilike./jobs%,text.ilike./retry%,text.ilike./diagnose%")
    .order("created_at", { ascending: true }).limit(10);
  if (onlyId) query = query.eq("id", onlyId);
  const { data: rows, error } = await query;
  if (error) throw error;

  let processed = 0;
  for (const row of rows ?? []) {
    const chatId = String(row.chat_id);
    if (chatId !== allowedChat) continue;
    const claimed = await supabase.from("telegram_commands").update({ status: "processing" })
      .eq("id", row.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed.data) continue;
    try {
      const { data: snapshot, error: snapshotError } = await supabase.rpc("ops_job_health_snapshot");
      if (snapshotError) throw snapshotError;
      const jobs = ((snapshot as { jobs?: Job[] })?.jobs ?? []);
      const [command, rawKey] = String(row.text).trim().split(/\s+/, 2);
      const key = rawKey?.trim();
      let reply: string;
      if (command.toLowerCase().startsWith("/jobs")) {
        reply = jobsText(jobs);
      } else if (!key) {
        reply = `Thiếu job key. Ví dụ: ${command.toLowerCase().startsWith("/retry") ? "/retry dupr-sync-daily" : "/diagnose dupr-sync-daily"}`;
      } else {
        const job = jobs.find((item) => item.job_key === key);
        if (!job) reply = `Không tìm thấy job: ${key}`;
        else if (command.toLowerCase().startsWith("/diagnose")) {
          reply = [`🔎 ${job.display_name}`, `State: ${job.health_state}`, `Schedule: ${job.schedule_label}`, `Last: ${job.last_activity_at ?? "never"}`, `Reason: ${job.error_message || job.summary || "Không có chi tiết"}`].join("\n");
        } else {
          const { data: retry, error: retryError } = await supabase.rpc("ops_request_job_retry", {
            p_job_key: key, p_source: "telegram",
            p_requested_by: row.from_username || String(row.from_id || row.chat_id),
            p_reason: "Telegram command",
          });
          if (retryError) throw retryError;
          const result = retry as { ok?: boolean; code?: string };
          reply = result.ok ? `✅ Đã gửi retry cho ${key}. Dùng /diagnose ${key} để kiểm tra.`
            : `⛔ Không retry ${key}: ${result.code || "unknown"}`;
        }
      }
      await sendTelegram(chatId, reply);
      await supabase.from("telegram_commands").update({ status: "done", processed_at: new Date().toISOString(), result: reply.slice(0, 2000) }).eq("id", row.id);
      processed++;
    } catch (commandError) {
      const message = commandError instanceof Error ? commandError.message : String(commandError);
      await supabase.from("telegram_commands").update({ status: "error", processed_at: new Date().toISOString(), result: message.slice(0, 2000) }).eq("id", row.id);
    }
  }
  return { ok: true, processed };
}

async function telegramWebhookSecret(): Promise<string> {
  const bytes = new TextEncoder().encode(Deno.env.get("CRON_SECRET") ?? "");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function installWebhook(): Promise<Record<string, unknown>> {
  if (!tgToken) throw new Error("telegram_secrets_missing");
  const response = await fetch(`https://api.telegram.org/bot${tgToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/ops-job-control",
      secret_token: await telegramWebhookSecret(),
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok || result.ok !== true) throw new Error(`set_webhook_failed: ${JSON.stringify(result).slice(0, 500)}`);
  return { ok: true, webhook_installed: true };
}

async function handleTelegramWebhook(req: Request, supabase: ReturnType<typeof createClient>): Promise<Record<string, unknown>> {
  const update = await req.json() as {
    update_id?: number;
    message?: { message_id?: number; date?: number; text?: string; chat?: { id?: number }; from?: { id?: number; username?: string } };
  };
  const message = update.message;
  if (!update.update_id || !message?.text || message.chat?.id === undefined) return { ok: true, ignored: true };
  const chatId = String(message.chat.id);
  if (chatId !== allowedChat) return { ok: true, ignored: true };

  const { data: inserted, error } = await supabase.from("telegram_commands").upsert({
    update_id: update.update_id,
    chat_id: message.chat.id,
    from_id: message.from?.id ?? null,
    from_username: message.from?.username ?? null,
    message_date: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
    text: message.text,
    status: "pending",
  }, { onConflict: "update_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw error;
  if (!inserted) return { ok: true, duplicate: true };

  if (/^\/(jobs|retry|diagnose)(?:@\w+)?(?:\s|$)/i.test(message.text.trim())) {
    return await processTelegram(supabase, inserted.id);
  }
  await sendTelegram(chatId, `📥 Đã nhận lệnh: "${message.text.slice(0, 500)}"\nĐã vào hàng đợi — agent sẽ xử lý ở lần chạy tới.`);
  return { ok: true, queued: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  try {
    const telegramSignature = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    if (telegramSignature && telegramSignature === await telegramWebhookSecret()) {
      return Response.json(await handleTelegramWebhook(req, supabase));
    }
    const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
    if (authError) return authError;
    const body = await req.json().catch(() => ({})) as { action?: string };
    if (body.action === "install_webhook") return Response.json(await installWebhook());
    return Response.json(await processTelegram(supabase));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
