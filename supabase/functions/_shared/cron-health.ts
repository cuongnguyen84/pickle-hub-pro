export type CronHealthState =
  | "healthy"
  | "pending"
  | "never_ran"
  | "stale"
  | "ran_failed"
  | "partial_success"
  | "caller_auth_failed";

export interface CronMonitorConfig {
  monitor_key: string;
  display_name: string;
  expected_interval_seconds: number;
  grace_seconds: number;
  monitoring_started_at: string;
}

export interface PgNetCronSnapshot extends CronMonitorConfig {
  source: "pg_net";
  cron_job_name: string | null;
  job_exists: boolean;
  job_active: boolean | null;
  scheduler_started_at: string | null;
  scheduler_status: string | null;
  scheduler_message: string | null;
  dispatched_at: string | null;
  responded_at: string | null;
  http_status_code: number | null;
  timed_out: boolean | null;
  transport_error: string | null;
  response_content: string | null;
  business_error_summary: string | null;
}

export interface GitHubWorkflowRun {
  status: string;
  conclusion: string | null;
  run_started_at: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface CronHealthResult {
  monitorKey: string;
  displayName: string;
  state: CronHealthState;
  reason: string;
  lastActivityAt: string | null;
  detailsUrl?: string;
  alertAfterSeconds: number;
}

export interface CronAlertState {
  last_state: CronHealthState;
  last_alerted_at: string | null;
  recovered_at: string | null;
}

const HTTP_RESPONSE_WAIT_SECONDS = 10 * 60;
const GITHUB_RUN_WAIT_SECONDS = 6 * 60 * 60;
const MUX_PARTIAL_FAILURES = new Set([
  "mux_fetch_failed",
  "asset_fetch_failed",
  "update_failed",
  "error",
]);

function ageSeconds(timestamp: string, now: Date): number {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - parsed) / 1000);
}

function result(
  config: CronMonitorConfig,
  state: CronHealthState,
  reason: string,
  lastActivityAt: string | null,
  detailsUrl?: string,
): CronHealthResult {
  return {
    monitorKey: config.monitor_key,
    displayName: config.display_name,
    state,
    reason,
    lastActivityAt,
    detailsUrl,
    alertAfterSeconds:
      config.expected_interval_seconds + config.grace_seconds,
  };
}

function muxHasPartialFailure(content: string | null): boolean {
  if (!content) return false;
  try {
    const parsed = JSON.parse(content) as {
      results?: Array<{ status?: string }>;
    };
    return (parsed.results ?? []).some((item) =>
      item.status ? MUX_PARTIAL_FAILURES.has(item.status) : false
    );
  } catch {
    return false;
  }
}

function successfulResponseContainsError(content: string | null): boolean {
  if (!content) return false;
  try {
    const parsed = JSON.parse(content) as { error?: unknown };
    return Boolean(parsed.error);
  } catch {
    return false;
  }
}

export function evaluatePgNetCron(
  snapshot: PgNetCronSnapshot,
  now = new Date(),
): CronHealthResult {
  const alertAfter =
    snapshot.expected_interval_seconds + snapshot.grace_seconds;
  const monitoringAge = ageSeconds(snapshot.monitoring_started_at, now);

  if (!snapshot.job_exists) {
    return monitoringAge < alertAfter
      ? result(snapshot, "pending", "Waiting for the monitored cron job to be installed", null)
      : result(snapshot, "never_ran", "Cron job is missing and has never run", null);
  }

  if (snapshot.job_active === false) {
    return result(
      snapshot,
      "ran_failed",
      "Cron job is disabled",
      snapshot.scheduler_started_at,
    );
  }

  if (!snapshot.scheduler_started_at) {
    return monitoringAge < alertAfter
      ? result(snapshot, "pending", "Waiting for the first scheduled run", null)
      : result(snapshot, "never_ran", "No scheduled run has ever been recorded", null);
  }

  if (ageSeconds(snapshot.scheduler_started_at, now) > alertAfter) {
    return result(
      snapshot,
      "stale",
      "Latest scheduler run is older than the expected interval plus grace",
      snapshot.scheduler_started_at,
    );
  }

  if (snapshot.scheduler_status && snapshot.scheduler_status !== "succeeded") {
    return result(
      snapshot,
      "ran_failed",
      `Scheduler failed: ${snapshot.scheduler_message ?? snapshot.scheduler_status}`,
      snapshot.scheduler_started_at,
    );
  }

  if (!snapshot.dispatched_at) {
    return monitoringAge < alertAfter
      ? result(snapshot, "pending", "Waiting for the first instrumented dispatch", snapshot.scheduler_started_at)
      : result(snapshot, "never_ran", "Scheduler ran but no monitored request was dispatched", snapshot.scheduler_started_at);
  }

  if (ageSeconds(snapshot.dispatched_at, now) > alertAfter) {
    return result(
      snapshot,
      "stale",
      "Latest HTTP dispatch is older than the expected interval plus grace",
      snapshot.dispatched_at,
    );
  }

  if (!snapshot.responded_at) {
    if (ageSeconds(snapshot.dispatched_at, now) <= HTTP_RESPONSE_WAIT_SECONDS) {
      return result(
        snapshot,
        "pending",
        "The latest HTTP dispatch is still awaiting a response",
        snapshot.dispatched_at,
      );
    }
    return result(
      snapshot,
      "ran_failed",
      "The HTTP dispatch produced no response within 10 minutes",
      snapshot.dispatched_at,
    );
  }

  if (snapshot.http_status_code === 401 || snapshot.http_status_code === 503) {
    return result(
      snapshot,
      "caller_auth_failed",
      `Cron caller received HTTP ${snapshot.http_status_code}`,
      snapshot.responded_at,
    );
  }

  if (
    snapshot.timed_out ||
    snapshot.transport_error ||
    snapshot.http_status_code === null ||
    snapshot.http_status_code < 200 ||
    snapshot.http_status_code >= 300
  ) {
    return result(
      snapshot,
      "ran_failed",
      snapshot.transport_error
        ? `HTTP transport failed: ${snapshot.transport_error}`
        : snapshot.timed_out
          ? "HTTP dispatch timed out"
          : `Cron caller received HTTP ${snapshot.http_status_code ?? "unknown"}`,
      snapshot.responded_at,
    );
  }

  if (
    snapshot.business_error_summary ||
    successfulResponseContainsError(snapshot.response_content) ||
    (snapshot.monitor_key === "mux-sync-assets" &&
      muxHasPartialFailure(snapshot.response_content))
  ) {
    return result(
      snapshot,
      "partial_success",
      snapshot.business_error_summary
        ? `Run completed with partial errors: ${snapshot.business_error_summary}`
        : "Run returned HTTP success but reported one or more item failures",
      snapshot.responded_at,
    );
  }

  return result(
    snapshot,
    "healthy",
    `Latest run completed with HTTP ${snapshot.http_status_code}`,
    snapshot.responded_at,
  );
}

export function evaluateGitHubWorkflow(
  config: CronMonitorConfig,
  run: GitHubWorkflowRun | null,
  now = new Date(),
): CronHealthResult {
  const alertAfter = config.expected_interval_seconds + config.grace_seconds;
  const monitoringAge = ageSeconds(config.monitoring_started_at, now);

  if (!run) {
    return monitoringAge < alertAfter
      ? result(config, "pending", "Waiting for the first scheduled GitHub Actions run", null)
      : result(config, "never_ran", "No scheduled GitHub Actions run was found", null);
  }

  const activityAt = run.updated_at || run.run_started_at || run.created_at;
  if (ageSeconds(activityAt, now) > alertAfter) {
    return result(
      config,
      "stale",
      "Latest scheduled workflow run is older than eight days",
      activityAt,
      run.html_url,
    );
  }

  if (run.status !== "completed") {
    return ageSeconds(run.run_started_at ?? run.created_at, now) <=
      GITHUB_RUN_WAIT_SECONDS
      ? result(config, "pending", `Workflow is ${run.status}`, activityAt, run.html_url)
      : result(config, "ran_failed", `Workflow remained ${run.status} for over six hours`, activityAt, run.html_url);
  }

  if (run.conclusion !== "success") {
    return result(
      config,
      "ran_failed",
      `Latest scheduled workflow concluded with ${run.conclusion ?? "unknown"}`,
      activityAt,
      run.html_url,
    );
  }

  return result(
    config,
    "healthy",
    "Latest scheduled workflow completed successfully",
    activityAt,
    run.html_url,
  );
}

export function isUnhealthyCronState(state: CronHealthState): boolean {
  return !["healthy", "pending"].includes(state);
}

export function shouldSendCronAlert(
  current: CronHealthResult,
  previous: CronAlertState | null,
  now = new Date(),
): "incident" | "recovery" | null {
  const unhealthy = isUnhealthyCronState(current.state);

  if (!unhealthy) {
    if (
      current.state === "healthy" &&
      previous &&
      isUnhealthyCronState(previous.last_state) &&
      previous.recovered_at === null
    ) {
      return "recovery";
    }
    return null;
  }

  if (
    !previous ||
    previous.last_state !== current.state ||
    previous.recovered_at !== null ||
    !previous.last_alerted_at
  ) {
    return "incident";
  }

  return ageSeconds(previous.last_alerted_at, now) >= current.alertAfterSeconds
    ? "incident"
    : null;
}
