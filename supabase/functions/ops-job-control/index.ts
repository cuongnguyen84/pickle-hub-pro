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

async function processTelegram(supabase: ReturnType<typeof createClient>): Promise<Record<string, unknown>> {
  const { data: rows, error } = await supabase.from("telegram_commands")
    .select("id,chat_id,text,from_id,from_username")
    .eq("status", "pending")
    .or("text.ilike./jobs%,text.ilike./retry%,text.ilike./diagnose%")
    .order("created_at", { ascending: true }).limit(10);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
  if (authError) return authError;
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  try {
    return Response.json(await processTelegram(supabase));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
