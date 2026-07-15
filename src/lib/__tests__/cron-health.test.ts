import { describe, expect, it } from "vitest";
import {
  evaluateGitHubWorkflow,
  evaluatePgNetCron,
  shouldSendCronAlert,
  type CronAlertState,
  type CronHealthResult,
  type CronMonitorConfig,
  type GitHubWorkflowRun,
  type PgNetCronSnapshot,
} from "../../../supabase/functions/_shared/cron-health";

const NOW = new Date("2026-07-15T12:00:00.000Z");

function pgSnapshot(
  overrides: Partial<PgNetCronSnapshot> = {},
): PgNetCronSnapshot {
  return {
    monitor_key: "mux-sync-assets",
    display_name: "Mux asset reconciliation",
    source: "pg_net",
    cron_job_name: "mux-sync-assets-every-4-hours",
    expected_interval_seconds: 4 * 60 * 60,
    grace_seconds: 2 * 60 * 60,
    monitoring_started_at: "2026-07-01T00:00:00.000Z",
    job_exists: true,
    job_active: true,
    scheduler_started_at: "2026-07-15T08:00:00.000Z",
    scheduler_status: "succeeded",
    scheduler_message: "DO",
    dispatched_at: "2026-07-15T08:00:01.000Z",
    responded_at: "2026-07-15T08:00:03.000Z",
    http_status_code: 200,
    timed_out: false,
    transport_error: null,
    response_content: '{"total":0,"synced":0,"results":[]}',
    business_error_summary: null,
    ...overrides,
  };
}

describe("evaluatePgNetCron", () => {
  it("marks a successful recent response healthy", () => {
    expect(evaluatePgNetCron(pgSnapshot(), NOW).state).toBe("healthy");
  });

  it("distinguishes a job that has never run", () => {
    const health = evaluatePgNetCron(pgSnapshot({
      job_exists: false,
      job_active: null,
      scheduler_started_at: null,
      dispatched_at: null,
      responded_at: null,
      http_status_code: null,
    }), NOW);

    expect(health.state).toBe("never_ran");
  });

  it("marks a scheduler failure as ran_failed", () => {
    const health = evaluatePgNetCron(pgSnapshot({
      scheduler_status: "failed",
      scheduler_message: "cron_secret is not configured",
    }), NOW);

    expect(health.state).toBe("ran_failed");
    expect(health.reason).toContain("cron_secret");
  });

  it("marks an old run stale after interval plus grace", () => {
    const health = evaluatePgNetCron(pgSnapshot({
      scheduler_started_at: "2026-07-15T05:59:59.000Z",
      dispatched_at: "2026-07-15T05:59:59.000Z",
      responded_at: "2026-07-15T06:00:00.000Z",
    }), NOW);

    expect(health.state).toBe("stale");
  });

  it.each([401, 503])("classifies HTTP %s as caller_auth_failed", (status) => {
    expect(evaluatePgNetCron(pgSnapshot({
      http_status_code: status,
    }), NOW).state).toBe("caller_auth_failed");
  });

  it("waits briefly for an asynchronous pg_net response", () => {
    const health = evaluatePgNetCron(pgSnapshot({
      scheduler_started_at: "2026-07-15T11:55:00.000Z",
      dispatched_at: "2026-07-15T11:55:01.000Z",
      responded_at: null,
      http_status_code: null,
    }), NOW);

    expect(health.state).toBe("pending");
  });

  it("marks a missing HTTP response failed after ten minutes", () => {
    const health = evaluatePgNetCron(pgSnapshot({
      scheduler_started_at: "2026-07-15T11:40:00.000Z",
      dispatched_at: "2026-07-15T11:40:01.000Z",
      responded_at: null,
      http_status_code: null,
    }), NOW);

    expect(health.state).toBe("ran_failed");
  });

  it("detects a Mux item failure inside an HTTP 200 response", () => {
    const health = evaluatePgNetCron(pgSnapshot({
      response_content: JSON.stringify({
        total: 2,
        synced: 1,
        results: [
          { status: "synced" },
          { status: "asset_fetch_failed" },
        ],
      }),
    }), NOW);

    expect(health.state).toBe("partial_success");
  });

  it("detects a DUPR business-level partial failure", () => {
    const health = evaluatePgNetCron(pgSnapshot({
      monitor_key: "dupr-sync-daily",
      expected_interval_seconds: 24 * 60 * 60,
      business_error_summary: "backfill: statement timeout",
    }), NOW);

    expect(health.state).toBe("partial_success");
  });
});

const githubConfig: CronMonitorConfig = {
  monitor_key: "dupr-rankings-refresh",
  display_name: "DUPR weekly rankings refresh",
  expected_interval_seconds: 7 * 24 * 60 * 60,
  grace_seconds: 24 * 60 * 60,
  monitoring_started_at: "2026-07-01T00:00:00.000Z",
};

function workflowRun(
  overrides: Partial<GitHubWorkflowRun> = {},
): GitHubWorkflowRun {
  return {
    status: "completed",
    conclusion: "success",
    created_at: "2026-07-13T02:00:00.000Z",
    run_started_at: "2026-07-13T02:00:00.000Z",
    updated_at: "2026-07-13T02:05:00.000Z",
    html_url: "https://github.com/example/actions/runs/1",
    ...overrides,
  };
}

describe("evaluateGitHubWorkflow", () => {
  it("accepts a recent successful scheduled workflow", () => {
    expect(evaluateGitHubWorkflow(githubConfig, workflowRun(), NOW).state)
      .toBe("healthy");
  });

  it("marks a failed scheduled workflow ran_failed", () => {
    expect(evaluateGitHubWorkflow(githubConfig, workflowRun({
      conclusion: "failure",
    }), NOW).state).toBe("ran_failed");
  });

  it("marks a workflow stale after eight days", () => {
    expect(evaluateGitHubWorkflow(githubConfig, workflowRun({
      created_at: "2026-07-01T02:00:00.000Z",
      run_started_at: "2026-07-01T02:00:00.000Z",
      updated_at: "2026-07-01T02:05:00.000Z",
    }), NOW).state).toBe("stale");
  });
});

function health(state: CronHealthResult["state"]): CronHealthResult {
  return {
    monitorKey: "mux-sync-assets",
    displayName: "Mux asset reconciliation",
    state,
    reason: state,
    lastActivityAt: NOW.toISOString(),
    alertAfterSeconds: 6 * 60 * 60,
  };
}

function alertState(
  overrides: Partial<CronAlertState> = {},
): CronAlertState {
  return {
    last_state: "ran_failed",
    last_alerted_at: "2026-07-15T10:00:00.000Z",
    recovered_at: null,
    ...overrides,
  };
}

describe("shouldSendCronAlert", () => {
  it("alerts immediately for a new incident", () => {
    expect(shouldSendCronAlert(health("ran_failed"), null, NOW)).toBe("incident");
  });

  it("suppresses a repeated incident inside its reminder window", () => {
    expect(shouldSendCronAlert(
      health("ran_failed"),
      alertState(),
      NOW,
    )).toBeNull();
  });

  it("reminds after one alert-after interval", () => {
    expect(shouldSendCronAlert(
      health("ran_failed"),
      alertState({ last_alerted_at: "2026-07-15T05:59:59.000Z" }),
      NOW,
    )).toBe("incident");
  });

  it("sends one recovery after an open incident", () => {
    expect(shouldSendCronAlert(
      health("healthy"),
      alertState(),
      NOW,
    )).toBe("recovery");
  });
});
