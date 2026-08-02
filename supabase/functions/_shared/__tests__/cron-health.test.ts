import { describe, it, expect } from "vitest";
import {
  evaluatePgNetCron,
  evaluateGitHubWorkflow,
  shouldSendCronAlert,
  type PgNetCronSnapshot,
  type CronMonitorConfig,
  type GitHubWorkflowRun,
  type CronHealthResult,
} from "../cron-health";

const NOW = new Date("2026-07-15T12:00:00.000Z");
const iso = (secondsAgo: number) =>
  new Date(NOW.getTime() - secondsAgo * 1000).toISOString();

// A fully-healthy pg_net snapshot; individual tests override one field.
function healthySnapshot(over: Partial<PgNetCronSnapshot> = {}): PgNetCronSnapshot {
  return {
    source: "pg_net",
    monitor_key: "feed-generate",
    display_name: "Feed generate",
    expected_interval_seconds: 3600,
    grace_seconds: 600,
    monitoring_started_at: iso(86_400),
    cron_job_name: "feed-generate-hourly",
    job_exists: true,
    job_active: true,
    scheduler_started_at: iso(30),
    scheduler_status: "succeeded",
    scheduler_message: null,
    dispatched_at: iso(28),
    responded_at: iso(25),
    http_status_code: 200,
    timed_out: false,
    transport_error: null,
    response_content: '{"ok":true}',
    business_error_summary: null,
    ...over,
  };
}

describe("evaluatePgNetCron — scheduler status transience", () => {
  it("does NOT flag a mid-flight 'running' scheduler as failed", () => {
    const r = evaluatePgNetCron(healthySnapshot({ scheduler_status: "running" }), NOW);
    expect(r.state).toBe("healthy"); // falls through to the healthy response path
  });

  for (const transient of ["starting", "sending", "connecting"]) {
    it(`treats '${transient}' as transient, not ran_failed`, () => {
      const r = evaluatePgNetCron(healthySnapshot({ scheduler_status: transient }), NOW);
      expect(r.state).not.toBe("ran_failed");
    });
  }

  it("flags a terminal 'failed' scheduler status as ran_failed", () => {
    const r = evaluatePgNetCron(
      healthySnapshot({ scheduler_status: "failed", scheduler_message: "boom" }),
      NOW,
    );
    expect(r.state).toBe("ran_failed");
    expect(r.reason).toContain("boom");
  });

  it("still surfaces a genuine HTTP failure even while status is transient", () => {
    const r = evaluatePgNetCron(
      healthySnapshot({ scheduler_status: "running", http_status_code: 500 }),
      NOW,
    );
    expect(r.state).toBe("ran_failed");
  });

  it("maps a caller 401 to caller_auth_failed", () => {
    const r = evaluatePgNetCron(healthySnapshot({ http_status_code: 401 }), NOW);
    expect(r.state).toBe("caller_auth_failed");
  });

  it("is healthy on the happy path", () => {
    expect(evaluatePgNetCron(healthySnapshot(), NOW).state).toBe("healthy");
  });

  it("detects item-level failures inside a successful HTTP response", () => {
    const result = evaluatePgNetCron(healthySnapshot({
      response_content: JSON.stringify({ results: [{ username: "ok" }, { username: "broken", error: "token expired" }] }),
    }), NOW);
    expect(result.state).toBe("partial_success");
  });

  it("detects task errors encoded as result strings", () => {
    const result = evaluatePgNetCron(healthySnapshot({
      response_content: JSON.stringify({ results: { ai_recap: "error: quota exceeded", protour_digest: 1 } }),
    }), NOW);
    expect(result.state).toBe("partial_success");
  });
});

describe("evaluateGitHubWorkflow", () => {
  const config: CronMonitorConfig = {
    monitor_key: "dupr-refresh",
    display_name: "DUPR refresh",
    expected_interval_seconds: 7 * 24 * 3600,
    grace_seconds: 24 * 3600,
    monitoring_started_at: iso(30 * 24 * 3600),
  };
  const run = (over: Partial<GitHubWorkflowRun>): GitHubWorkflowRun => ({
    status: "completed",
    conclusion: "success",
    run_started_at: iso(3600),
    created_at: iso(3600),
    updated_at: iso(1800),
    html_url: "https://github.com/x/y/actions/runs/1",
    ...over,
  });

  it("is pending while a recent run is still in_progress", () => {
    const r = evaluateGitHubWorkflow(config, run({ status: "in_progress", conclusion: null }), NOW);
    expect(r.state).toBe("pending");
  });

  it("flags a completed failure as ran_failed", () => {
    const r = evaluateGitHubWorkflow(config, run({ conclusion: "failure" }), NOW);
    expect(r.state).toBe("ran_failed");
  });

  it("is healthy on a completed success", () => {
    expect(evaluateGitHubWorkflow(config, run({}), NOW).state).toBe("healthy");
  });
});

describe("shouldSendCronAlert", () => {
  const unhealthy: CronHealthResult = {
    monitorKey: "feed-generate",
    displayName: "Feed generate",
    state: "ran_failed",
    reason: "x",
    lastActivityAt: null,
    alertAfterSeconds: 4200,
  };

  it("fires an incident on a fresh unhealthy state", () => {
    expect(shouldSendCronAlert(unhealthy, null, NOW)).toBe("incident");
  });

  it("suppresses a repeat within the alert window", () => {
    const prev = { last_state: "ran_failed" as const, last_alerted_at: iso(60), recovered_at: null };
    expect(shouldSendCronAlert(unhealthy, prev, NOW)).toBeNull();
  });

  it("emits recovery when returning to healthy from an open incident", () => {
    const healthy: CronHealthResult = { ...unhealthy, state: "healthy" };
    const prev = { last_state: "ran_failed" as const, last_alerted_at: iso(60), recovered_at: null };
    expect(shouldSendCronAlert(healthy, prev, NOW)).toBe("recovery");
  });
});
