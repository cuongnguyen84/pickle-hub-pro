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
const githubToken = Deno.env.get("GITHUB_OPS_TOKEN") ?? "";
const githubRepository = Deno.env.get("GITHUB_OPS_REPOSITORY") ?? "cuongnguyen84/pickle-hub-pro";
// Webhook secret độc lập (không dẫn xuất từ CRON_SECRET dùng chung) + khoá theo
// đúng Telegram user của Cuong — chat_id một mình không xác thực NGƯỜI bấm.
const tgWebhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const adminFromId = Deno.env.get("TELEGRAM_ADMIN_ID") ?? "";
const NEWS_FETCHER_URL = Deno.env.get("NEWS_FETCHER_URL") ?? "https://news-fetcher.thecuong.workers.dev";

async function sendTelegram(chatId: string, text: string, replyMarkup?: Record<string, unknown>): Promise<void> {
  if (!tgToken || chatId !== allowedChat) throw new Error("telegram_chat_not_allowed");
  const response = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true, reply_markup: replyMarkup }),
  });
  if (!response.ok) throw new Error(`telegram_http_${response.status}`);
}

const mainKeyboard = {
  keyboard: [
    [{ text: "/jobs" }, { text: "/functions" }],
    [{ text: "/probe" }, { text: "/help" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

function jobActionButtons(jobs: Job[]): Record<string, unknown> | undefined {
  const unhealthy = jobs.filter((job) => ["warning", "failed"].includes(job.health_state)).slice(0, 4);
  if (!unhealthy.length) return undefined;
  return { inline_keyboard: unhealthy.map((job) => [
    { text: `🔎 ${job.job_key}`, callback_data: `diagnose|${job.job_key}` },
    { text: `🛠 Xử lý`, callback_data: `fix|${job.job_key}` },
  ]) };
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

type EdgeState = { function_slug: string; display_name: string; job_key: string | null; state: string; http_status: number | null; response_ms: number | null; reason: string | null };

type FacebookCounts = { thepicklehub: number | null; taPickleball: number | null };

async function facebookCountsToday(supabase: ReturnType<typeof createClient>): Promise<FacebookCounts> {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const start = new Date(`${date}T00:00:00+07:00`);
  const { data, error } = await supabase.from("fb_post_log").select("page_key")
    .eq("status", "posted").gte("posted_at", start.toISOString())
    .lt("posted_at", new Date(start.getTime() + 86_400_000).toISOString());
  if (error) return { thepicklehub: null, taPickleball: null };
  return {
    thepicklehub: (data ?? []).filter((row) => row.page_key === "thepicklehub").length,
    taPickleball: (data ?? []).filter((row) => row.page_key === "ta-pickleball").length,
  };
}

async function edgeStates(supabase: ReturnType<typeof createClient>): Promise<EdgeState[]> {
  const { data, error } = await supabase.from("ops_edge_function_registry")
    .select("function_slug,display_name,job_key,ops_edge_function_state(state,http_status,response_ms,reason)")
    .eq("enabled", true).order("function_slug");
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => {
    const nested = (Array.isArray(row.ops_edge_function_state) ? row.ops_edge_function_state[0] : row.ops_edge_function_state) as Record<string, unknown> | null;
    return { function_slug: String(row.function_slug), display_name: String(row.display_name), job_key: row.job_key ? String(row.job_key) : null,
      state: String(nested?.state ?? "pending"), http_status: typeof nested?.http_status === "number" ? nested.http_status : null,
      response_ms: typeof nested?.response_ms === "number" ? nested.response_ms : null, reason: nested?.reason ? String(nested.reason) : null };
  });
}

function functionsText(functions: EdgeState[]): string {
  const available = functions.filter((fn) => fn.state === "available").length;
  const lines = [`⚙️ Edge Functions: ✅ ${available}/${functions.length} available`];
  for (const fn of functions.filter((item) => item.state !== "available")) lines.push(`❌ ${fn.function_slug}: ${fn.state} · ${fn.reason || "Không có chi tiết"}`);
  lines.push("https://www.thepicklehub.net/admin/jobs");
  return lines.join("\n").slice(0, 4000);
}

async function runEdgeProbe(supabase: ReturnType<typeof createClient>): Promise<EdgeState[]> {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ops-edge-health`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "" }, body: "{}",
  });
  if (!response.ok) throw new Error(`edge_probe_http_${response.status}`);
  return await edgeStates(supabase);
}

async function finishRetry(supabase: ReturnType<typeof createClient>, requestId: string, success: boolean, status: number | null, response: string): Promise<void> {
  const { error } = await supabase.rpc("ops_finish_job_retry", {
    p_request_id: requestId, p_success: success, p_http_status: status, p_response: response,
  });
  if (error) throw error;
}

async function retryOutcome(supabase: ReturnType<typeof createClient>, jobKey: string, requestId: string, dispatchRequestId: number): Promise<string> {
  let data: { http_status_code: number | null; timed_out: boolean | null; transport_error: string | null; response_content: string | null } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await supabase.rpc("ops_refresh_cron_health_snapshot");
    const latest = await supabase.from("ops_cron_dispatches")
      .select("http_status_code,timed_out,transport_error,response_content")
      .eq("request_id", dispatchRequestId).maybeSingle();
    data = latest.data;
    if (data?.http_status_code !== null || data?.timed_out || data?.transport_error) break;
  }
  if (!data || data.http_status_code === null) return `⏳ ${jobKey} đã được dispatch (#${dispatchRequestId}), downstream chưa trả kết quả. Hệ thống vẫn theo dõi đúng lần chạy này.`;
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/errors-telegram-alert`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "" }, body: "{}",
  }).catch(() => undefined);
  if (data.timed_out || data.transport_error || data.http_status_code < 200 || data.http_status_code >= 300) {
    const detail = `${data.transport_error || `HTTP ${data.http_status_code}`}\n${String(data.response_content || "").slice(0, 500)}`;
    await finishRetry(supabase, requestId, false, data.http_status_code, detail);
    return `❌ Retry ${jobKey} vẫn lỗi: ${detail}`;
  }
  try {
    const payload = JSON.parse(data.response_content || "{}") as { error?: unknown; ok?: boolean; failed?: number };
    if (payload.error || payload.ok === false || (payload.failed ?? 0) > 0) {
      const detail = `HTTP ${data.http_status_code} có lỗi nghiệp vụ: ${String(data.response_content).slice(0, 1000)}`;
      await finishRetry(supabase, requestId, false, data.http_status_code, detail);
      return `⚠️ Retry ${jobKey} trả HTTP ${data.http_status_code} nhưng có lỗi nghiệp vụ:\n${String(data.response_content).slice(0, 500)}`;
    }
  } catch { /* A successful non-JSON response is still a valid downstream result. */ }
  await finishRetry(supabase, requestId, true, data.http_status_code, String(data.response_content || ""));
  return `✅ ${jobKey} đã chạy lại thành công (HTTP ${data.http_status_code}, dispatch #${dispatchRequestId}).`;
}

async function requestEdgeRepair(functionSlug: string, requestedBy: string): Promise<string> {
  if (!githubToken) throw new Error("github_ops_token_missing");
  const response = await fetch(`https://api.github.com/repos/${githubRepository}/actions/workflows/edge-function-repair.yml/dispatches`, {
    method: "POST",
    headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${githubToken}`, "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs: { function_slug: functionSlug, requested_by: requestedBy.slice(0, 100) } }),
  });
  if (!response.ok) throw new Error(`github_repair_dispatch_${response.status}: ${(await response.text()).slice(0, 300)}`);
  return `🛠 Đã khởi động recovery workflow cho ${functionSlug}. GitHub sẽ redeploy, probe lại runtime và báo kết quả qua Telegram.`;
}

const VI_STATE: Record<string, string> = {
  healthy: "Khoẻ", warning: "Cảnh báo", failed: "Lỗi", pending: "Chờ chu kỳ đầu", stale: "Quá hạn chạy",
};

const RETRY_CODE_VI: Record<string, string> = {
  retry_not_supported: "Job này không có cơ chế chạy lại trực tiếp qua lịch pg_cron.",
  cooldown: "Vừa chạy lại trong 10 phút gần đây — đây KHÔNG phải lỗi, chờ hết cooldown rồi thử lại nếu cần.",
  cron_job_unavailable: "Không tìm thấy lịch chạy của job trong pg_cron — có thể job đã bị gỡ lịch.",
  dispatch_failed: "Không gửi được lệnh chạy tới hệ thống đích (pg_net lỗi).",
};

function fmtICT(iso: string | null): string {
  if (!iso) return "chưa từng chạy";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  }).format(new Date(iso));
}

// Q1 (duyệt 05/08): nguồn tin tắt-có-dấu-vết phải hiện việc-cần-làm ở /jobs + digest,
// không bao giờ tắt câm (pre-mortem: "tắt thứ đang kêu" = mất nguồn 5 tuần không ai biết).
async function newsSourcesLine(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data, error } = await supabase.from("news_sources").select("id,active,last_error");
  if (error || !data?.length) return null;
  const rows = data as { id: string; active: boolean; last_error: string | null }[];
  const active = rows.filter((row) => row.active).length;
  const needsWork = rows.filter((row) => !row.active && row.last_error).map((row) => row.id);
  let line = `📰 Nguồn tin: ${active}/${rows.length} active`;
  if (needsWork.length) line += ` · cần xử lý: ${needsWork.join(", ")}`;
  return line;
}

type WorkerSourceResult = { source_id: string; ok: boolean; inserted: number; error: string | null };

// Chạy lại news-fetcher bằng cách gọi thẳng worker /run (đồng bộ, trả kết quả thật
// từng nguồn) — worker tự ghi ops_job_runs qua runTracked nên verdict là số liệu thật.
async function rerunNewsFetcher(supabase: ReturnType<typeof createClient>): Promise<string> {
  const secret = Deno.env.get("SCRAPER_AUTH_SECRET") ?? "";
  if (!secret) return "❌ KHÔNG XỬ LÝ ĐƯỢC · news-fetcher\nThiếu SCRAPER_AUTH_SECRET trong env của bot.";
  let response: Response;
  try {
    response = await fetch(`${NEWS_FETCHER_URL}/run`, {
      method: "POST", headers: { "x-auth-secret": secret }, signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    return `❌ CHƯA SỬA ĐƯỢC · news-fetcher\nGọi worker thất bại: ${error instanceof Error ? error.message : String(error)}\nCần anh làm: kiểm tra worker trên Cloudflare dashboard.`;
  }
  if (response.status === 401) {
    return "❌ CHƯA SỬA ĐƯỢC · news-fetcher\nWorker trả 401: SCRAPER_AUTH_SECRET lệch giữa Supabase và Cloudflare (bài học 03/08 — không còn auto-sync).\nCần anh làm: sync secret tay theo vault rồi bấm lại.";
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; results?: WorkerSourceResult[] } | null;
  const results = payload?.results ?? [];
  const failing = results.filter((row) => !row.ok);
  const inserted = results.reduce((sum, row) => sum + (row.inserted ?? 0), 0);
  await supabase.rpc("ops_refresh_cron_health_snapshot");
  if (!failing.length) {
    return `✅ ĐÃ SỬA · news-fetcher\nChạy lại xong: ${results.length}/${results.length} nguồn OK, ${inserted} bài mới.\nCần anh làm: không có.`;
  }
  const lines = failing.map((row) => `• ${row.source_id}: ${(row.error ?? "lỗi không rõ").slice(0, 150)}`);
  return [
    `🛠 CHƯA SỬA · CẦN ANH XỬ LÝ · news-fetcher`,
    `Chạy lại xong: ${results.length - failing.length}/${results.length} nguồn OK, ${inserted} bài mới. Nguồn vẫn lỗi:`,
    ...lines,
    `Lỗi nguồn là lỗi DATA (URL chết/đổi) — chạy lại không sửa được. Cần đổi URL hoặc tắt nguồn có ghi chú.`,
  ].join("\n");
}

// Job chạy bằng GitHub Actions không retry được qua pg_net — kích workflow_dispatch
// trên chính workflow của job (tra từ ops_cron_monitors.external_identifier).
async function requestWorkflowRun(supabase: ReturnType<typeof createClient>, job: Job): Promise<string> {
  if (!githubToken) throw new Error("github_ops_token_missing");
  const { data } = await supabase.from("ops_cron_monitors")
    .select("external_identifier").eq("monitor_key", job.job_key).maybeSingle();
  const workflowFile = (data as { external_identifier?: string | null } | null)?.external_identifier;
  if (!workflowFile) {
    return `⛔ ${job.display_name} chạy bằng GitHub Actions nhưng chưa khai báo workflow trong ops_cron_monitors.external_identifier nên bot không kích lại được.`;
  }
  const response = await fetch(`https://api.github.com/repos/${githubRepository}/actions/workflows/${workflowFile}/dispatches`, {
    method: "POST",
    headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${githubToken}`, "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!response.ok) {
    if (response.status === 403 || response.status === 422) {
      return `⛔ Không kích được ${workflowFile} (HTTP ${response.status}) — workflow có thể đang bị disable trên GitHub. Bật lại: https://github.com/${githubRepository}/actions/workflows/${workflowFile}`;
    }
    throw new Error(`github_workflow_dispatch_${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return `🛠 Đã kích workflow ${workflowFile} chạy lại cho ${job.display_name}. Theo dõi: https://github.com/${githubRepository}/actions — trạng thái job sẽ tự xanh sau khi run thành công.`;
}

// Giai đoạn 2: lỗi không có nhánh cứng nào xử được → xếp một dòng /agentfix cho
// daemon local (fix_agent_daemon.py) rút. /agentfix không khớp allowlist drain của
// chính function này nên bot không bao giờ tự rút lại nó.
async function enqueueAgentFix(supabase: ReturnType<typeof createClient>, job: Job): Promise<string> {
  const { data: existing } = await supabase.from("telegram_commands")
    .select("id,created_at").ilike("text", `/agentfix ${job.job_key}`)
    .in("status", ["pending", "processing"])
    .gte("created_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing?.id) {
    return `⏳ ${job.job_key} đang được agent xử lý (FX-${existing.id}). Không cần bấm lại.`;
  }
  const { data: inserted, error } = await supabase.from("telegram_commands").insert({
    update_id: -Date.now(),
    chat_id: Number(allowedChat),
    from_id: adminFromId ? Number(adminFromId) : null,
    from_username: "ops-job-control",
    message_date: new Date().toISOString(),
    text: `/agentfix ${job.job_key}`,
    status: "pending",
  }).select("id").maybeSingle();
  if (error || !inserted?.id) {
    return `❌ KHÔNG XỬ LÝ ĐƯỢC · ${job.job_key}\nKhông xếp được việc cho agent: ${error?.message ?? "insert failed"}.\nDùng /diagnose ${job.job_key} để xem chi tiết.`;
  }
  return [
    `⏳ ĐÃ NHẬN · ${job.job_key}`,
    `Không có nhánh sửa tự động cho lỗi này — agent trên máy Mac sẽ điều tra, dự kiến 5-10 phút.`,
    `Anh không cần bấm lại.`,
    `Mã: FX-${inserted.id} · ${fmtICT(new Date().toISOString())}`,
  ].join("\n");
}

// Chạy trong vòng drain 1 phút: /agentfix pending quá 3' → cảnh báo máy có thể ngủ;
// quá 30' → hết hạn, đóng lại rõ ràng (im lặng vĩnh viễn tệ hơn ⛔ ngày xưa).
async function agentFixWatchdog(supabase: ReturnType<typeof createClient>): Promise<void> {
  const { data } = await supabase.from("telegram_commands")
    .select("id,text,created_at,result").ilike("text", "/agentfix %").eq("status", "pending");
  for (const row of (data ?? []) as { id: number; text: string; created_at: string; result: string | null }[]) {
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    const jobKey = row.text.replace("/agentfix ", "").trim();
    if (ageMs > 30 * 60_000) {
      const msg = `❌ KHÔNG XỬ LÝ ĐƯỢC · ${jobKey}\nAgent ngoại tuyến 30 phút. Yêu cầu FX-${row.id} đã hết hạn, chưa có thay đổi nào được thực hiện.\nAnh kiểm tra máy Mac (daemon fix-agent) rồi bấm lại nếu cần.`;
      await sendTelegram(allowedChat, msg);
      await supabase.from("telegram_commands").update({ status: "error", processed_at: new Date().toISOString(), result: "agent_offline_expired" }).eq("id", row.id).eq("status", "pending");
    } else if (ageMs > 3 * 60_000 && row.result !== "warned_no_consumer") {
      await sendTelegram(allowedChat, `⚠️ CHƯA BẮT ĐẦU ĐƯỢC · ${jobKey}\nAgent trên máy Mac chưa nhận việc sau 3 phút — có thể máy đang ngủ hoặc daemon tắt.\nChưa có thay đổi nào. Yêu cầu FX-${row.id} vẫn trong hàng đợi (hết hạn sau 30 phút).`);
      await supabase.from("telegram_commands").update({ result: "warned_no_consumer" }).eq("id", row.id).eq("status", "pending");
    }
  }
}

async function processTelegram(supabase: ReturnType<typeof createClient>, onlyId?: number): Promise<Record<string, unknown>> {
  let query = supabase.from("telegram_commands")
    .select("id,chat_id,text,from_id,from_username")
    .eq("status", "pending")
    .or("text.ilike./start%,text.ilike./help%,text.ilike./jobs%,text.ilike./retry%,text.ilike./diagnose%,text.ilike./functions%,text.ilike./probe%,text.ilike./fix%")
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
      const [command, rawKey] = String(row.text).trim().split(/\s+/, 2);
      const key = rawKey?.trim();
      if (!command.toLowerCase().startsWith("/retry")) await supabase.rpc("ops_refresh_cron_health_snapshot");
      const { data: snapshot, error: snapshotError } = await supabase.rpc("ops_job_health_snapshot");
      if (snapshotError) throw snapshotError;
      const jobs = ((snapshot as { jobs?: Job[] })?.jobs ?? []);
      let reply: string;
      let replyMarkup: Record<string, unknown> | undefined;
      if (command.toLowerCase().startsWith("/jobs")) {
        const functions = await edgeStates(supabase);
        const facebook = await facebookCountsToday(supabase);
        const sources = await newsSourcesLine(supabase);
        const failedEdges = functions.filter((fn) => fn.state !== "available").length;
        reply = `${jobsText(jobs)}\n📣 Facebook hôm nay: ThePickleHub ${facebook.thepicklehub ?? "—"} bài · TAPickleball ${facebook.taPickleball ?? "—"} bài${sources ? `\n${sources}` : ""}\n⚙️ Edge runtime: ${functions.length - failedEdges}/${functions.length} available${failedEdges ? ` · ❌ ${failedEdges}` : ""}`;
        replyMarkup = jobActionButtons(jobs);
      } else if (command.toLowerCase().startsWith("/functions")) {
        reply = functionsText(await edgeStates(supabase));
        replyMarkup = { inline_keyboard: [[{ text: "🔄 Probe lại", callback_data: "probe" }]] };
      } else if (command.toLowerCase().startsWith("/probe")) {
        reply = `🔄 Probe hoàn tất\n${functionsText(await runEdgeProbe(supabase))}`;
      } else if (command.toLowerCase().startsWith("/start") || command.toLowerCase().startsWith("/help")) {
        reply = ["🤖 TPH Job Operations", "", "Dùng các nút bên dưới để xem trạng thái.", "Trong /jobs, job lỗi sẽ có nút Chẩn đoán và Fix.", "", "Lệnh nâng cao:", "/diagnose <job>", "/retry <job>", "/fix <job>"].join("\n");
        replyMarkup = mainKeyboard;
      } else if (!key) {
        reply = `Thiếu job key. Ví dụ: ${command.toLowerCase().startsWith("/fix") ? "/fix news-rewrite" : command.toLowerCase().startsWith("/retry") ? "/retry dupr-sync-daily" : "/diagnose dupr-sync-daily"}`;
      } else {
        const job = jobs.find((item) => item.job_key === key);
        if (!job) reply = `Không tìm thấy job: ${key}`;
        else if (command.toLowerCase().startsWith("/diagnose")) {
          reply = [
            `🔎 ${job.display_name}`,
            `Job: ${job.job_key}`,
            `Trạng thái: ${VI_STATE[job.health_state] ?? job.health_state}`,
            `Lịch: ${job.schedule_label}`,
            `Lần gần nhất: ${fmtICT(job.last_activity_at)} (giờ VN)`,
            `Lý do: ${job.error_message || job.summary || "Không có chi tiết"}`,
          ].join("\n");
        } else {
          if (command.toLowerCase().startsWith("/fix")) {
            const functions = await runEdgeProbe(supabase);
            const dependency = functions.find((fn) => fn.job_key === key);
            if (dependency && dependency.state !== "available") {
              reply = dependency.state === "missing_blob"
                ? await requestEdgeRepair(dependency.function_slug, row.from_username || String(row.from_id || row.chat_id))
                : `🛠 Đã chẩn đoán ${key}: ${dependency.function_slug} đang ${dependency.state}. Chưa tự redeploy vì đây có thể là lỗi code/downstream; hãy xem /diagnose và log trước.`;
              await sendTelegram(chatId, reply);
              await supabase.from("telegram_commands").update({ status: "done", processed_at: new Date().toISOString(), result: reply }).eq("id", row.id);
              processed++;
              continue;
            }
          }
          if (job.executor === "github_actions") {
            reply = await requestWorkflowRun(supabase, job);
            await sendTelegram(chatId, reply);
            await supabase.from("telegram_commands").update({ status: "done", processed_at: new Date().toISOString(), result: reply }).eq("id", row.id);
            processed++;
            continue;
          }
          if (job.executor === "cloudflare_worker") {
            reply = job.job_key === "news-fetcher"
              ? await rerunNewsFetcher(supabase)
              : await enqueueAgentFix(supabase, job);
            await sendTelegram(chatId, reply);
            await supabase.from("telegram_commands").update({ status: "done", processed_at: new Date().toISOString(), result: reply.slice(0, 2000) }).eq("id", row.id);
            processed++;
            continue;
          }
          const { data: retry, error: retryError } = await supabase.rpc("ops_request_job_retry", {
            p_job_key: key, p_source: "telegram",
            p_requested_by: row.from_username || String(row.from_id || row.chat_id),
            p_reason: command.toLowerCase().startsWith("/fix") ? "Telegram diagnose-and-fix" : "Telegram command",
          });
          if (retryError) throw retryError;
          const result = retry as { ok?: boolean; code?: string; request_id?: string; dispatch_request_id?: number };
          reply = result.ok && result.request_id && result.dispatch_request_id
            ? await retryOutcome(supabase, key, result.request_id, result.dispatch_request_id)
            : result.ok ? `❌ Retry ${key} đã dispatch nhưng không lấy được mã đối chiếu; không thể xác minh an toàn.`
            : result.code === "retry_not_supported" ? await enqueueAgentFix(supabase, job)
            : `⛔ CHƯA CHẠY LẠI ĐƯỢC · ${key}\n${RETRY_CODE_VI[result.code ?? ""] ?? `Mã lỗi: ${result.code || "unknown"}`}`;
        }
      }
      await sendTelegram(chatId, reply, replyMarkup);
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
  // Secret độc lập nếu đã set; fallback SHA256(CRON_SECRET) chỉ để không gãy webhook
  // trong lúc chuyển tiếp — set TELEGRAM_WEBHOOK_SECRET + gọi install_webhook để cắt hẳn.
  if (tgWebhookSecret) return tgWebhookSecret;
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
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    }),
  });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok || result.ok !== true) throw new Error(`set_webhook_failed: ${JSON.stringify(result).slice(0, 500)}`);
  const commandsResponse = await fetch(`https://api.telegram.org/bot${tgToken}/setMyCommands`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commands: [
      { command: "jobs", description: "Trạng thái các job" },
      { command: "functions", description: "Trạng thái Edge Functions" },
      { command: "probe", description: "Probe runtime ngay" },
      { command: "diagnose", description: "Chẩn đoán một job" },
      { command: "retry", description: "Chạy lại một job" },
      { command: "fix", description: "Chẩn đoán và sửa an toàn" },
      { command: "help", description: "Hiện bàn phím chức năng" },
    ] }),
  });
  if (!commandsResponse.ok) throw new Error(`set_commands_failed_${commandsResponse.status}`);
  await fetch(`https://api.telegram.org/bot${tgToken}/setChatMenuButton`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: allowedChat, menu_button: { type: "commands" } }),
  });
  await sendTelegram(allowedChat, "✅ Menu Job Operations đã sẵn sàng. Anh có thể dùng các nút bên dưới; trong /jobs sẽ có nút Chẩn đoán và Fix cho job đang lỗi.", mainKeyboard);
  return { ok: true, webhook_installed: true };
}

async function handleTelegramWebhook(req: Request, supabase: ReturnType<typeof createClient>): Promise<Record<string, unknown>> {
  const update = await req.json() as {
    update_id?: number;
    message?: { message_id?: number; date?: number; text?: string; chat?: { id?: number }; from?: { id?: number; username?: string } };
    callback_query?: { id?: string; data?: string; from?: { id?: number; username?: string }; message?: { date?: number; chat?: { id?: number } } };
  };
  const callback = update.callback_query;
  const callbackParts = callback?.data?.split("|", 2);
  const callbackText = callbackParts?.[0] === "diagnose" ? `/diagnose ${callbackParts[1]}`
    : callbackParts?.[0] === "fix" ? `/fix ${callbackParts[1]}`
    : callback?.data === "probe" ? "/probe" : undefined;
  const message = update.message ?? (callbackText ? {
    date: callback?.message?.date, text: callbackText, chat: callback?.message?.chat, from: callback?.from,
  } : undefined);
  if (!update.update_id || !message?.text || message.chat?.id === undefined) return { ok: true, ignored: true };
  const chatId = String(message.chat.id);
  if (chatId !== allowedChat) return { ok: true, ignored: true };
  // chat_id xác thực CHAT, không xác thực NGƯỜI — khoá thêm theo Telegram user id
  // của Cuong (TELEGRAM_ADMIN_ID). Không set env này thì giữ hành vi cũ.
  if (adminFromId && String(message.from?.id ?? "") !== adminFromId) return { ok: true, ignored: true };
  if (callback?.id) {
    await fetch(`https://api.telegram.org/bot${tgToken}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id, text: "Đang xử lý…" }),
    });
  }

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

  if (/^\/(start|help|jobs|retry|diagnose|functions|probe|fix)(?:@\w+)?(?:\s|$)/i.test(message.text.trim())) {
    return await processTelegram(supabase, inserted.id);
  }
  // Text tự do không có consumer nào — nói thật thay vì hứa suông, và đóng row
  // ngay để không tồn kho pending vô hạn (risk-auditor #7).
  await supabase.from("telegram_commands").update({ status: "skipped", processed_at: new Date().toISOString(), result: "free_text_unsupported" }).eq("id", inserted.id);
  await sendTelegram(chatId, `Chưa hiểu lệnh này. Gửi /help để xem các lệnh có sẵn, hoặc /jobs để thao tác bằng nút.`);
  return { ok: true, skipped: true };
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
    await agentFixWatchdog(supabase);
    return Response.json(await processTelegram(supabase));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
