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
import {
  DEFAULT_BURN_CONFIG,
  burnMessageLines,
  evalBurn,
  type BurnState,
} from "../_shared/burn-alert.ts";

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

interface JobFailureReport {
  scanned: number;
  alerts_sent: number;
  alerts_suppressed: number;
}

interface FailedJobRun {
  id: string;
  job_key: string;
  status: "warning" | "failed";
  summary: string | null;
  error_message: string | null;
  details_url: string | null;
  started_at: string;
}

interface CronHealthReport {
  checked: number;
  alerts_sent: number;
  alerts_suppressed: number;
  states: Record<string, string>;
  errors: string[];
  auto_retries: number;
}

function isTransientCronFailure(health: CronHealthResult): boolean {
  if (["healthy", "pending", "partial_success"].includes(health.state)) return false;
  return /(timeout|timed out|http (?:429|5\d\d)|connection|network|missing.*response|dispatch)/i.test(health.reason);
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

interface BurnReport {
  count_60m: number;
  count_24h: number;
  burn_rate: number;
  alerts_sent: number;
  held_quiet: number;
  states: Record<string, string>;
  errors: string[];
}

// OPS-04 inc3 — fingerprint-independent volume (P1) + 24h-vs-30d-budget burn
// (P2) with state-transition dedup and required recovery messages. Pure
// decision logic lives in _shared/burn-alert.ts (unit-tested); this wrapper
// only counts rows, loads/persists state, and formats Telegram output.
async function runBurnAlert(): Promise<BurnReport> {
  const report: BurnReport = {
    count_60m: 0, count_24h: 0, burn_rate: 0,
    alerts_sent: 0, held_quiet: 0, states: {}, errors: [],
  };
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const now = new Date();

  const countSince = async (minutes: number): Promise<number | null> => {
    const { count, error } = await supabase
      .from("client_errors")
      .select("id", { count: "exact", head: true })
      .gte("recorded_at", new Date(now.getTime() - minutes * 60_000).toISOString());
    if (error) {
      report.errors.push(`count(${minutes}m): ${error.message}`);
      return null;
    }
    return count ?? 0;
  };

  const [c60, c24] = await Promise.all([countSince(60), countSince(24 * 60)]);
  if (c60 === null || c24 === null) return report; // fail loud in report, not silently ok
  report.count_60m = c60;
  report.count_24h = c24;

  const { data: stateRows, error: stateError } = await supabase
    .from("ops_slo_burn_state")
    .select("slo_key, state");
  if (stateError) {
    report.errors.push(`state load: ${stateError.message}`);
    return report;
  }
  const prev = {
    volume: ((stateRows ?? []).find((r) => r.slo_key === "client_errors_volume")?.state ?? "ok") as BurnState,
    budget: ((stateRows ?? []).find((r) => r.slo_key === "client_errors_budget")?.state ?? "ok") as BurnState,
  };

  const decisions = evalBurn(c60, c24, prev, now, DEFAULT_BURN_CONFIG);
  for (const d of decisions) {
    report.states[d.sloKey] = d.newState;
    report.burn_rate = Number(d.burnRate.toFixed(2));
    if (d.heldByQuietHours) report.held_quiet++;

    if (d.alert) {
      const lines = burnMessageLines(d, DEFAULT_BURN_CONFIG).map((l) => escapeMarkdown(l));
      lines.push("", `[Open admin dashboard](${escapeMarkdown("https://www.thepicklehub.net/admin/errors")})`);
      const ok = await sendTelegram(lines.join("\n"));
      if (!ok) {
        report.errors.push(`${d.sloKey}: telegram send failed`);
        continue; // don't persist a transition the operator never saw
      }
      report.alerts_sent++;
    }

    // Persist only real transitions (quiet-held P2 keeps prev state so the
    // first daytime run re-evaluates and fires).
    if (d.newState !== d.prevState || d.alert) {
      const { error: upsertError } = await supabase.from("ops_slo_burn_state").upsert({
        slo_key: d.sloKey,
        state: d.newState,
        since: d.newState !== d.prevState ? now.toISOString() : undefined,
        last_alerted_at: d.alert ? now.toISOString() : undefined,
        last_value: d.value,
        last_burn_rate: d.burnRate,
        updated_at: now.toISOString(),
      }, { onConflict: "slo_key" });
      if (upsertError) report.errors.push(`${d.sloKey}: upsert: ${upsertError.message}`);
    }
  }

  return report;
}

async function runJobFailureAlerts(): Promise<JobFailureReport> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("ops_job_runs")
    .select("id, job_key, status, summary, error_message, details_url, started_at")
    .eq("trigger_kind", "scheduled")
    .in("status", ["warning", "failed"])
    .gte("started_at", since)
    .order("started_at", { ascending: true });

  if (error) {
    console.error("ops_job_runs failure query failed", error.message);
    return { scanned: 0, alerts_sent: 0, alerts_suppressed: 0 };
  }

  let sent = 0;
  let suppressed = 0;
  for (const run of (data ?? []) as FailedJobRun[]) {
    const dedupeKey = `scheduled-job-failure:${run.id}`;
    const { data: existing } = await supabase
      .from("error_alert_dedup")
      .select("fingerprint")
      .eq("fingerprint", dedupeKey)
      .maybeSingle();
    if (existing) {
      suppressed++;
      continue;
    }

    const reason = (run.error_message ?? run.summary ?? "unknown failure").slice(0, 700);
    const lines = [
      "🚨 *ThePickleHub scheduled job failed*",
      "",
      `*Job:* \`${escapeMarkdown(run.job_key)}\``,
      `*State:* \`${escapeMarkdown(run.status)}\``,
      `*Reason:* ${escapeMarkdown(reason)}`,
      `*Started:* ${escapeMarkdown(new Date(run.started_at).toISOString())}`,
    ];
    if (run.details_url) {
      lines.push("", `[Open details](${escapeMarkdown(run.details_url)})`);
    }

    if (await sendTelegram(lines.join("\n"))) {
      sent++;
      await supabase.from("error_alert_dedup").upsert({
        fingerprint: dedupeKey,
        last_alerted_at: new Date().toISOString(),
        alert_count: 1,
      }, { onConflict: "fingerprint" });
    }
  }

  return { scanned: data?.length ?? 0, alerts_sent: sent, alerts_suppressed: suppressed };
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
    // Không lọc event=schedule: run kích tay qua nút Fix/workflow_dispatch cũng là
    // một lần refresh dữ liệu thật, phải được tính để trạng thái job tự xanh lại.
    "https://api.github.com/repos/cuongnguyen84/pickle-hub-pro/actions/workflows/dupr-refresh.yml/runs?per_page=1",
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
    auto_retries: 0,
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

    if (isIncident && isTransientCronFailure(health)) {
      const { data: retryResult, error: retryError } = await supabase.rpc("ops_request_job_retry", {
        p_job_key: health.monitorKey,
        p_source: "auto",
        p_requested_by: "errors-telegram-alert",
        p_reason: health.reason.slice(0, 1000),
      });
      if (retryError) report.errors.push(`${health.monitorKey}: auto_retry: ${retryError.message}`);
      else if ((retryResult as { ok?: boolean } | null)?.ok) report.auto_retries++;
    }
  }

  return report;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
  if (authError) return authError;

  const clientErrors = await runAlert();
  const jobFailures = await runJobFailureAlerts();
  const cronHealth = await runCronHealth();
  const burn = await runBurnAlert();
  return new Response(JSON.stringify({ client_errors: clientErrors, job_failures: jobFailures, cron_health: cronHealth, burn }), {
    headers: { "Content-Type": "application/json" },
  });
});
