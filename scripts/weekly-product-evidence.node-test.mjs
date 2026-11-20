import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  checkReadOnlySql,
  collectSnapshot,
  dateInVietnam,
  normalizeStages,
  normalizeRegistrationSourceCounts,
  queryReadOnly,
  renderReport,
} from "./weekly-product-evidence.mjs";

const SQL_FILES = [
  "docs/sql/quicktable-observable-stages.sql",
  "docs/sql/quicktable-baseline.sql",
  "docs/sql/quicktable-returning-creators.sql",
  "docs/sql/social-event-baseline.sql",
];

const observedAt = "2026-11-20T01:31:53.000Z";
const fromAt = "2026-10-20T17:00:00.000Z";
const untilAt = "2026-11-19T17:00:00.000Z";
function stageRows(values = [14, 0, 21, 5, 5]) {
  const names = ["created_no_roster", "roster_no_matches", "matches_no_scores", "scored", "completed"];
  return names.map((stage, i) => ({
    stage,
    tables: values[i],
    creators: values[i] === 0 ? 0 : 1,
    with_team_registrations: 0,
    with_matches_but_no_roster: 0,
    completed_without_score: stage === "completed" ? 1 : 0,
    observed_at: observedAt,
    cohort_from_at: fromAt,
    cohort_until_at: untilAt,
  }));
}

test("read-only guard rejects writes and multiple statements", () => {
  assert.doesNotThrow(() => checkReadOnlySql("-- update is commentary\nselect 1;"));
  assert.throws(() => checkReadOnlySql("select 1; delete from x;"), /mutating SQL/);
  assert.throws(() => checkReadOnlySql("select 1; select 2;"), /one SQL statement/);
});

test("all scheduled SQL sources satisfy the read-only contract", async () => {
  for (const file of SQL_FILES) checkReadOnlySql(await readFile(join(process.cwd(), file), "utf8"), file);
});

test("stage normalizer requires exactly the five named buckets and shared timestamps", () => {
  const parsed = normalizeStages(stageRows());
  assert.equal(parsed.stages.reduce((sum, row) => sum + row.tables, 0), 45);
  assert.equal(parsed.stages[2].stage, "matches_no_scores");
  assert.throws(() => normalizeStages(stageRows().slice(0, 4)), /expected all/);
  const shifted = stageRows();
  shifted[1].observed_at = "2026-11-20T01:31:54.000Z";
  assert.throws(() => normalizeStages(shifted), /do not share/);
});

test("registration source counts only permit fixed, non-identifying buckets", () => {
  assert.deepEqual(normalizeRegistrationSourceCounts({ self: 2, proxy: 1, manual: 0, other: 3 }), {
    self: 2, proxy: 1, manual: 0, other: 3,
  });
  assert.throws(() => normalizeRegistrationSourceCounts({ "person@example.com": 1 }), /unexpected/);
});

test("Management API calls the read-only endpoint and does not expose token in URL", async () => {
  let requested;
  const rows = await queryReadOnly("select 1 as count;", {
    token: "secret-token-test",
    projectRef: "test-ref",
    label: "contract test",
    fetchImpl: async (url, options) => {
      requested = { url, options };
      return { ok: true, json: async () => [{ count: 1 }] };
    },
  });
  assert.equal(requested.url, "https://api.supabase.com/v1/projects/test-ref/database/query/read-only");
  assert.equal(requested.options.headers.Authorization, "Bearer secret-token-test");
  assert.deepEqual(rows, [{ count: 1 }]);
});

test("collector accepts only matching windows and records aggregate results", async () => {
  const cohortFrom = "2026-10-20 17:00:00+00";
  const cohortUntil = "2026-11-19 17:00:00+00";
  const stageData = stageRows().map((row) => ({
    ...row, cohort_from_at: cohortFrom, cohort_until_at: cohortUntil, observed_at: observedAt,
  }));
  const canned = {
    stages: stageData,
    quicktable: [{ from_at: cohortFrom, until_at: cohortUntil, observed_at: observedAt, created: 45, with_score: 10, with_completed_match: 9, finished: 5, completed: 5, archived: 0, completed_matches: 49, creators: 32 }],
    repeat: [{ from_at: cohortFrom, until_at: cohortUntil, observed_at: observedAt, recent_creators: 32, returning_creators: 1 }],
    social: [{ from_at: cohortFrom, until_at: cohortUntil, observed_at: observedAt, registration_rows_by_source: { self: 0 }, events_past_scheduled_end: 0, marked_completed: 0, with_completed_score: 0, marked_completed_with_score: 0, social_events_all_time: 27, registration_rows_all_time: 107 }],
  };
  const snapshot = await collectSnapshot({
    token: "test-token",
    projectRef: "test-ref",
    now: () => new Date(observedAt),
    readSql: async (path) => `select '${({
      "docs/sql/quicktable-observable-stages.sql": "stages",
      "docs/sql/quicktable-baseline.sql": "quicktable",
      "docs/sql/quicktable-returning-creators.sql": "repeat",
      "docs/sql/social-event-baseline.sql": "social",
    })[path]}'`,
    fetchImpl: async (_url, options) => {
      const query = JSON.parse(options.body).query;
      const key = query.match(/^select '(\w+)'/)?.[1];
      assert.ok(key in canned);
      return { ok: true, json: async () => canned[key] };
    },
  });
  assert.equal(snapshot.stages.stages.reduce((sum, row) => sum + row.tables, 0), 45);
  assert.equal(snapshot.repeat.returningCreators, 1);
  assert.deepEqual(snapshot.social.registrationRowsBySource, { self: 0 });
});

test("report shows date/window, stage sums and caveats without IDs", () => {
  const stages = normalizeStages(stageRows());
  const report = renderReport({
    generatedAt: observedAt,
    stages,
    quicktable: {
      created: 45, observedAt, withScore: 10, withCompletedMatch: 9, completedMatches: 49,
      completed: 5, archived: 0, creators: 32,
    },
    repeat: { recentCreators: 32, returningCreators: 1 },
    social: {
      fromAt, untilAt, observedAt, registrationRowsBySource: {}, eventsPastEnd: 0,
      markedCompleted: 0, withCompletedScore: 0, completedWithScore: 0,
      eventsAllTime: 27, registrationsAllTime: 107,
    },
  });
  assert.match(report, /2026-10-20.*2026-11-19/s);
  assert.match(report, /\*\*45\*\*/);
  assert.match(report, /does not reveal intent/);
  assert.doesNotMatch(report, /creator_user_id|table_id|secret-token-test/);
  assert.equal(dateInVietnam(new Date("2026-11-19T17:30:00.000Z")), "2026-11-20");
});
