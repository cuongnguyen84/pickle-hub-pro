// ============================================================================
// errors-telegram-alert — push spike alerts to Telegram
// ----------------------------------------------------------------------------
// Runs on a 10-minute cron schedule. For each error fingerprint (message
// + first stack line) seen at least N times in the last 10 minutes, send
// a Telegram message to the admin chat — unless we already alerted on
// this fingerprint within the last hour (tracked in error_alert_dedup).
//
// Secrets required (set via `supabase secrets set --project-ref ...`):
//   TELEGRAM_BOT_TOKEN — from @BotFather
//   TELEGRAM_CHAT_ID   — Cuong's Telegram chat id (numeric, can be negative)
//
// The function is also exposed as a regular HTTP endpoint so it can be:
//   - Triggered manually via authenticated POST for testing
//   - Hit by an external cron (Cloudflare Worker, GitHub Action)
//   - Invoked from Supabase Scheduled Functions when available
//
// verify_jwt = false (cron invocations carry no JWT)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  evaluateGitHubWorkflow,
  evaluatePgNetCron,
  shouldSendCronAlert,
  type CronAlertState,
  type CronHealthResult,
  type CronMonitorConfig,
  type GitHubWorkflowRun,
  type PgNetCronSnapshot,
} from "../_shared/cron-health.ts";
import { requireCronRequest } from "../_shared/cron-auth.ts";

const SPIKE_THRESHOLD = 3;        // ≥ N occurrences of same fingerprint
const SPIKE_WINDOW_MIN = 10;      // ...within last 10 minutes
const DEDUPE_WINDOW_MIN = 60;     // ...silenced for 60 min after first alert

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT  = Deno.env.get("TELEGRAM_CHAT_ID")  ?? "";

interface ClientError {
  id: string;
  type: string;
  message: string | null;
  stack: string | null;
  url: string | null;
  recorded_at: string;
}

function fingerprint(message: string | null, stack: string | null): string {
  const msg = (message ?? "").slice(0, 200);
  const stackLine = (stack ?? "").split("\n")[0]?.slice(0, 200) ?? "";
  return `${msg}|${stackLine}`;
}

function escapeMarkdown(s: string): string {
  // Telegram MarkdownV2 reserved chars.
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

async function sendTelegram(text: string): Promise<boolean> {
  if (!TG_TOKEN || !TG_CHAT) {
    console.warn("Telegram secrets missing — skipping send");
    return false;
  }
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Telegram send failed", res.status, body.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Telegram fetch error", e instanceof Error ? e.message : String(e));
    return false;
  }
}

interface RunReport {
  scanned: number;
  unique_fingerprints: number;
  alerts_sent: number;
  alerts_suppressed: number;
}

interface CronHealthReport {
  checked: number;
  alerts_sent: number;
  alerts_suppressed: number;
  states: Record<string, string>;
  errors: string[];
}

async function runAlert(): Promise<RunReport> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const since = new Date(
    Date.now() - SPIKE_WINDOW_MIN * 60_000,
  ).toISOString();

  const { data: errors, error } = await supabase
    .from("client_errors")
    .select("id, type, message, stack, url, recorded_at")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("client_errors query failed", error.message);
    return { scanned: 0, unique_fingerprints: 0, alerts_sent: 0, alerts_suppressed: 0 };
  }

  // Group by fingerprint.
  const groups = new Map<string, { sample: ClientError; count: number }>();
  for (const e of (errors ?? []) as ClientError[]) {
    const fp = fingerprint(e.message, e.stack);
    const g = groups.get(fp);
    if (g) {
      g.count++;
      // Keep the newest sample so the alert reflects current state.
      if (e.recorded_at > g.sample.recorded_at) g.sample = e;
    } else {
      groups.set(fp, { sample: e, count: 1 });
    }
  }

  let sent = 0;
  let suppressed = 0;

  for (const [fp, { sample, count }] of groups) {
    if (count < SPIKE_THRESHOLD) continue;

    // Dedupe — alerted recently?
    const { data: dedup } = await supabase
      .from("error_alert_dedup")
      .select("last_alerted_at, alert_count")
      .eq("fingerprint", fp)
      .maybeSingle<{ last_alerted_at: string; alert_count: number | null }>();

    if (dedup) {
      const since = Date.now() - new Date(dedup.last_alerted_at).getTime();
      if (since < DEDUPE_WINDOW_MIN * 60_000) {
        suppressed++;
        continue;
      }
    }

    // Compose Telegram message (MarkdownV2).
    const msgLine = escapeMarkdown(
      (sample.message ?? "unknown").slice(0, 200),
    );
    const urlLine = escapeMarkdown((sample.url ?? "—").slice(0, 200));
    const typeLine = escapeMarkdown(sample.type);
    const adminLink = escapeMarkdown(
      "https://www.thepicklehub.net/admin/errors",
    );

    const text = [
      `🚨 *ThePickleHub error spike*`,
      ``,
      `*Type:* \`${typeLine}\``,
      `*Count:* ${count} in last ${SPIKE_WINDOW_MIN}m`,
      `*Message:* ${msgLine}`,
      `*URL:* ${urlLine}`,
      ``,
      `[Open admin dashboard](${adminLink})`,
    ].join("\n");

    const ok = await sendTelegram(text);
    if (ok) {
      sent++;
      // Upsert dedup row.
      await supabase
        .from("error_alert_dedup")
        .upsert(
          {
            fingerprint: fp,
            last_alerted_at: new Date().toISOString(),
            // OPS-04: was `(dedup ? 1 : 1)` — a dead ternary that pinned every
            // fingerprint at 1 and made recurrence invisible in the table.
            alert_count: (dedup?.alert_count ?? 0) + 1,
          },
          { onConflict: "fingerprint" },
        );
    }
  }

  return {
    scanned: errors?.length ?? 0,
    unique_fingerprints: groups.size,
    alerts_sent: sent,
    alerts_suppressed: suppressed,
  };
}

function formatCronHealthMessage(
  health: CronHealthResult,
  kind: "incident" | "recovery",
): string {
  const title = kind === "recovery"
    ? "✅ *ThePickleHub cron recovered*"
    : "🚨 *ThePickleHub cron unhealthy*";
  const activity = health.lastActivityAt
    ? new Date(health.lastActivityAt).toISOString()
    : "never";
  const lines = [
    title,
    "",
    `*Job:* ${escapeMarkdown(health.displayName)}`,
    `*State:* \`${escapeMarkdown(health.state)}\``,
    `*Reason:* ${escapeMarkdown(health.reason.slice(0, 500))}`,
    `*Last activity:* ${escapeMarkdown(activity)}`,
  ];

  if (health.detailsUrl) {
    lines.push(
      "",
      `[Open run details](${escapeMarkdown(health.detailsUrl)})`,
    );
  }

  return lines.join("\n");
}

async function fetchLatestScheduledDuprWorkflow(): Promise<GitHubWorkflowRun | null> {
  // Authenticate when a token is configured. Unauthenticated calls share the
  // 60/hr GitHub limit across every function on this Supabase egress IP, so a
  // busy neighbour would 403 us and (previously) manufacture a false incident.
  // Any token — even a zero-scope fine-grained one — lifts us to 5000/hr.
  const ghToken = Deno.env.get("GITHUB_TOKEN")?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ThePickleHub-Cron-Health",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (ghToken) headers.Authorization = `Bearer ${ghToken}`;

  const response = await fetch(
    "https://api.github.com/repos/cuongnguyen84/pickle-hub-pro/actions/workflows/dupr-refresh.yml/runs?per_page=1&event=schedule",
    { headers },
  );

  if (!response.ok) {
    throw new Error(`GitHub workflow lookup returned HTTP ${response.status}`);
  }

  const payload = await response.json() as { workflow_runs?: GitHubWorkflowRun[] };
  return payload.workflow_runs?.[0] ?? null;
}

async function runCronHealth(): Promise<CronHealthReport> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const report: CronHealthReport = {
    checked: 0,
    alerts_sent: 0,
    alerts_suppressed: 0,
    states: {},
    errors: [],
  };

  const { data: snapshots, error: snapshotError } = await supabase
    .rpc("ops_refresh_cron_health_snapshot");

  if (snapshotError) {
    console.error("cron health snapshot failed", snapshotError.message);
    report.errors.push(`snapshot: ${snapshotError.message}`);
    return report;
  }

  const now = new Date();
  const healthResults: CronHealthResult[] = [];

  for (const raw of snapshots ?? []) {
    const config = raw as CronMonitorConfig & {
      source: "pg_net" | "github_actions";
    };

    if (config.source === "pg_net") {
      healthResults.push(evaluatePgNetCron(raw as PgNetCronSnapshot, now));
      continue;
    }

    try {
      const latestRun = await fetchLatestScheduledDuprWorkflow();
      healthResults.push(evaluateGitHubWorkflow(config, latestRun, now));
    } catch (error) {
      // A failed health CHECK (GitHub API unreachable / rate-limited) is not
      // the monitored workflow failing. Record it and skip this monitor so a
      // transient GitHub outage cannot fire a false "ran_failed" incident; the
      // monitor's previous state is preserved for the next cycle.
      const message = error instanceof Error ? error.message : String(error);
      report.errors.push(`${config.monitor_key}: github_check_unavailable: ${message}`);
    }
  }

  for (const health of healthResults) {
    report.checked++;
    report.states[health.monitorKey] = health.state;

    const { data: stored, error: stateError } = await supabase
      .from("ops_cron_alert_state")
      .select("last_state, last_alerted_at, recovered_at")
      .eq("monitor_key", health.monitorKey)
      .maybeSingle<CronAlertState>();

    if (stateError) {
      report.errors.push(`${health.monitorKey}: ${stateError.message}`);
      continue;
    }

    // A fresh pg_net dispatch remains pending for at most ten minutes. Do not
    // overwrite an open incident until the new response proves recovery.
    if (health.state === "pending") continue;

    const notification = shouldSendCronAlert(health, stored, now);
    let sent = false;
    if (notification) {
      sent = await sendTelegram(formatCronHealthMessage(health, notification));
      if (sent) report.alerts_sent++;
    } else if (health.state !== "healthy" && health.state !== "pending") {
      report.alerts_suppressed++;
    }

    if (notification && !sent) {
      report.errors.push(`${health.monitorKey}: Telegram send failed`);
      continue;
    }

    const isRecovery = notification === "recovery";
    const isIncident = notification === "incident";
    const previousWasOpenIncident = stored && stored.recovered_at === null &&
      stored.last_state !== "healthy" && stored.last_state !== "pending";

    const { error: upsertError } = await supabase
      .from("ops_cron_alert_state")
      .upsert({
        monitor_key: health.monitorKey,
        last_state: health.state,
        incident_started_at: isIncident
          ? now.toISOString()
          : previousWasOpenIncident
            ? undefined
            : null,
        last_alerted_at: isIncident ? now.toISOString() : undefined,
        recovered_at: isRecovery ? now.toISOString() : isIncident ? null : undefined,
        last_reason: health.reason.slice(0, 1000),
        updated_at: now.toISOString(),
      }, { onConflict: "monitor_key" });

    if (upsertError) {
      report.errors.push(`${health.monitorKey}: ${upsertError.message}`);
    }
  }

  return report;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
  if (authError) return authError;

  const clientErrors = await runAlert();
  const cronHealth = await runCronHealth();
  return new Response(JSON.stringify({ client_errors: clientErrors, cron_health: cronHealth }), {
    headers: { "Content-Type": "application/json" },
  });
});
