import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";
import {
  formatJobHealthDigest,
  type JobHealthDigestSnapshot as HealthSnapshot,
} from "../_shared/job-health-digest.ts";

// Keep a deployment revision in the entrypoint because the Supabase API
// deployer has previously reused a stale bundle when only a shared import changed.
const deploymentRevision = "20260802-job-business-metrics-v2";

function reportDateIct(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function ictDayBounds(reportDate: string): { start: string; end: string } {
  const start = new Date(`${reportDate}T00:00:00+07:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
  if (!token || !chatId) return { ok: false, error: "telegram_secrets_missing" };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `telegram_http_${response.status}: ${(await response.text()).slice(0, 300)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
  if (authError) return authError;

  let mode: "preview" | "send" = "send";
  try {
    const body = await req.json() as { mode?: "preview" | "send" };
    if (body.mode) mode = body.mode;
  } catch {
    // Empty scheduled bodies use send mode.
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data, error } = await supabase.rpc("ops_job_health_snapshot");
  if (error) return Response.json({ error: "snapshot_failed", detail: error.message }, { status: 500 });

  const reportDate = reportDateIct();
  const snapshot = data as HealthSnapshot;
  const bounds = ictDayBounds(reportDate);
  const { data: facebookRows, error: facebookError } = await supabase
    .from("fb_post_log")
    .select("page_key")
    .eq("status", "posted")
    .gte("posted_at", bounds.start)
    .lt("posted_at", bounds.end);
  snapshot.facebook_posts = facebookError
    ? { thepicklehub: null, ta_pickleball: null }
    : {
      thepicklehub: (facebookRows ?? []).filter((row) => row.page_key === "thepicklehub").length,
      ta_pickleball: (facebookRows ?? []).filter((row) => row.page_key === "ta-pickleball").length,
    };
  const { data: sourceRows, error: sourcesError } = await supabase
    .from("news_sources")
    .select("id,active,last_error");
  if (!sourcesError && (sourceRows ?? []).length > 0) {
    const rows = sourceRows as { id: string; active: boolean; last_error: string | null }[];
    snapshot.news_sources = {
      active: rows.filter((row) => row.active).length,
      total: rows.length,
      needs_attention: rows.filter((row) => !row.active && row.last_error).map((row) => row.id),
    };
  }
  const text = formatJobHealthDigest(snapshot, reportDate);
  if (mode === "preview") return Response.json({ ok: true, mode, report_date: reportDate, deployment_revision: deploymentRevision, text, snapshot });

  const { data: claimed, error: claimError } = await supabase.rpc("ops_claim_daily_digest", {
    p_report_date: reportDate,
  });
  if (claimError) return Response.json({ error: "claim_failed", detail: claimError.message }, { status: 500 });
  if (!claimed) return Response.json({ ok: true, duplicate: true, report_date: reportDate });

  const sent = await sendTelegram(text);
  const counts = snapshot.counts;
  await supabase.rpc("ops_finish_daily_digest", {
    p_report_date: reportDate,
    p_status: sent.ok ? "sent" : "failed",
    p_healthy: counts.healthy ?? 0,
    p_warning: counts.warning ?? 0,
    p_failed: counts.failed ?? 0,
    p_preview: text,
    p_error: sent.error ?? null,
  });

  return Response.json(
    sent.ok ? { ok: true, report_date: reportDate } : { ok: false, error: sent.error },
    { status: sent.ok ? 200 : 502 },
  );
});
