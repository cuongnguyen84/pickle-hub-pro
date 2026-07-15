import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const chat = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

type CronState = {
  job_name: string;
  expected_interval_seconds: number;
  grace_seconds: number;
  state: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  return_message: string | null;
};

function escapeMarkdown(value: string): string {
  return value.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

async function notify(state: CronState): Promise<boolean> {
  if (!token || !chat) return false;
  const text = [
    "🚨 *ThePickleHub cron health alert*",
    `*Job:* \`${escapeMarkdown(state.job_name)}\``,
    `*State:* \`${escapeMarkdown(state.state)}\``,
    `*Last start:* ${escapeMarkdown(state.last_started_at ?? "never")}`,
    `*Last finish:* ${escapeMarkdown(state.last_finished_at ?? "never")}`,
    `*Detail:* ${escapeMarkdown((state.return_message ?? "no run found").slice(0, 300))}`,
  ].join("\n");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "MarkdownV2" }),
  });
  return response.ok;
}

Deno.serve(async (request) => {
  const rejected = requireCronRequest(request, Deno.env.get("CRON_SECRET") ?? "");
  if (rejected) return rejected;

  const { data, error } = await supabase.rpc("ops_cron_health_snapshot");
  if (error) {
    console.error("ops_cron_health_snapshot failed", error.message);
    return new Response(JSON.stringify({ error: "snapshot_failed" }), { status: 503 });
  }

  const alerts: string[] = [];
  for (const state of (data ?? []) as CronState[]) {
    if (state.state === "healthy") continue;
    const fingerprint = `cron-health:${state.job_name}:${state.state}`;
    const { data: previous } = await supabase
      .from("error_alert_dedup")
      .select("last_alerted_at")
      .eq("fingerprint", fingerprint)
      .maybeSingle<{ last_alerted_at: string }>();
    if (previous && Date.now() - Date.parse(previous.last_alerted_at) < 60 * 60_000) continue;
    if (await notify(state)) {
      alerts.push(state.job_name);
      await supabase.from("error_alert_dedup").upsert(
        { fingerprint, last_alerted_at: new Date().toISOString(), alert_count: 1 },
        { onConflict: "fingerprint" },
      );
    }
  }

  return new Response(JSON.stringify({ checked: (data ?? []).length, alerts }), {
    headers: { "Content-Type": "application/json" },
  });
});
