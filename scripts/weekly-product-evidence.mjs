#!/usr/bin/env node
// Read-only weekly aggregate snapshot for QuickTable and Social Events.
// Requires SUPABASE_ACCESS_TOKEN; never prints token or raw API error bodies.

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "ajvlcamxemgbxduhiqrl";
const QUERY_FILES = {
  stages: "docs/sql/quicktable-observable-stages.sql",
  quicktable: "docs/sql/quicktable-baseline.sql",
  repeat: "docs/sql/quicktable-returning-creators.sql",
  social: "docs/sql/social-event-baseline.sql",
};

const TABLE_STAGES = [
  "created_no_roster",
  "roster_no_matches",
  "matches_no_scores",
  "scored",
  "completed",
];

export function rowsFromPayload(payload, label) {
  if (!Array.isArray(payload) || payload.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error(`${label}: Management API response must be an array of row objects`);
  }
  return payload;
}

function nonNegativeInteger(value, field, label) {
  if (!(typeof value === "number" || (typeof value === "string" && value.trim() !== ""))) {
    throw new Error(`${label}: ${field} must be a non-negative integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label}: ${field} must be a non-negative integer`);
  }
  return parsed;
}

function requiredTimestamp(value, field, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label}: ${field} must be a timestamp string`);
  }
  return value;
}

export function normalizeStages(rows) {
  const label = "QuickTable stages";
  const data = rowsFromPayload(rows, label);
  const byStage = new Map();
  for (const row of data) {
    if (!TABLE_STAGES.includes(row.stage) || byStage.has(row.stage)) {
      throw new Error(`${label}: unknown or duplicate stage`);
    }
    byStage.set(row.stage, {
      stage: row.stage,
      tables: nonNegativeInteger(row.tables, "tables", label),
      creators: nonNegativeInteger(row.creators, "creators", label),
      withTeamRegistrations: nonNegativeInteger(row.with_team_registrations, "with_team_registrations", label),
      matchesWithoutRoster: nonNegativeInteger(row.with_matches_but_no_roster, "with_matches_but_no_roster", label),
      completedWithoutScore: nonNegativeInteger(row.completed_without_score, "completed_without_score", label),
      observedAt: requiredTimestamp(row.observed_at, "observed_at", label),
      fromAt: requiredTimestamp(row.cohort_from_at, "cohort_from_at", label),
      untilAt: requiredTimestamp(row.cohort_until_at, "cohort_until_at", label),
    });
  }
  if (byStage.size !== TABLE_STAGES.length) throw new Error(`${label}: expected all ${TABLE_STAGES.length} stage buckets`);
  const ordered = TABLE_STAGES.map((stage) => byStage.get(stage));
  const first = ordered[0];
  if (ordered.some((row) => row.fromAt !== first.fromAt || row.untilAt !== first.untilAt || row.observedAt !== first.observedAt)) {
    throw new Error(`${label}: stage rows do not share one cohort window and observation time`);
  }
  return { fromAt: first.fromAt, untilAt: first.untilAt, observedAt: first.observedAt, stages: ordered };
}

export function normalizeSingleRow(payload, label, fields) {
  const rows = rowsFromPayload(payload, label);
  if (rows.length !== 1) throw new Error(`${label}: expected exactly one aggregate row`);
  const row = rows[0];
  const result = {};
  for (const [output, source] of Object.entries(fields)) {
    if (output.endsWith("At")) result[output] = requiredTimestamp(row[source], source, label);
    else result[output] = nonNegativeInteger(row[source], source, label);
  }
  return result;
}

export function normalizeRegistrationSourceCounts(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("social baseline: registration_rows_by_source must be a JSON object");
  }
  const allowed = new Set(["self", "proxy", "manual", "other"]);
  const counts = {};
  for (const [source, count] of Object.entries(value)) {
    if (!allowed.has(source)) throw new Error("social baseline: unexpected registration-source bucket");
    counts[source] = nonNegativeInteger(count, `registration_rows_by_source.${source}`, "social baseline");
  }
  return counts;
}

export function checkReadOnlySql(sql, label = "query") {
  const withoutComments = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  if (/\b(insert|update|delete|alter|drop|create|grant|revoke|truncate|call|do)\b/i.test(withoutComments)) {
    throw new Error(`${label}: mutating SQL is not allowed in the weekly evidence runner`);
  }
  if ((withoutComments.match(/;/g) || []).length > 1) throw new Error(`${label}: only one SQL statement is allowed`);
}

export async function queryReadOnly(sql, { token, projectRef = PROJECT_REF, fetchImpl = fetch, label = "query" }) {
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is required");
  if (!/^[a-z0-9-]+$/.test(projectRef)) throw new Error("Invalid Supabase project reference");
  checkReadOnlySql(sql, label);
  const response = await fetchImpl(`https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(`${label}: read-only Management API returned HTTP ${response.status}`);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${label}: Management API returned invalid JSON`);
  }
  return rowsFromPayload(payload, label);
}

function asPercent(part, total) {
  return total === 0 ? "n/a (n=0)" : `${(100 * part / total).toFixed(1)}%`;
}

export function renderReport({ stages, quicktable, repeat, social, generatedAt }) {
  const stageTotal = stages.stages.reduce((sum, stage) => sum + stage.tables, 0);
  const reconciliation = stageTotal === quicktable.created
    ? "matches"
    : `DIFFERS (${stageTotal} staged vs ${quicktable.created} baseline); data may have changed between queries`;
  const sourceCounts = normalizeRegistrationSourceCounts(social.registrationRowsBySource);
  const lines = [
    `# Weekly product evidence — ${generatedAt.slice(0, 10)}`,
    "",
    "Read-only aggregate snapshot from Supabase Management API. No production writes.",
    "No row-level IDs or personal data are included.",
    "",
    "## QuickTable",
    `Cohort: ${stages.fromAt} ≤ created_at < ${stages.untilAt}; stage observed at ${stages.observedAt}.`,
    `Cross-query reconciliation: ${reconciliation}. Baseline observed at ${quicktable.observedAt}.`,
    "",
    "| Current observable stage | Tables | Creators with non-null creator ID |",
    "|---|---:|---:|",
    ...stages.stages.map((stage) => `| ${stage.stage} | ${stage.tables} | ${stage.creators} |`),
    `| **Exclusive stage total** | **${stageTotal}** | — |`,
    "",
    `Baseline aggregates: ${quicktable.created} tables; ${quicktable.withScore} with ≥1 non-null score pair (${asPercent(quicktable.withScore, quicktable.created)}); ${quicktable.withCompletedMatch} with a completed match; ${quicktable.completedMatches} completed matches; ${quicktable.completed} currently completed; ${quicktable.archived} archived; ${quicktable.creators} creators.`,
    `Diagnostics: ${stages.stages.reduce((n, stage) => n + stage.withTeamRegistrations, 0)} team-registration table-stage associations; ${stages.stages.reduce((n, stage) => n + stage.matchesWithoutRoster, 0)} tables with matches/no roster; ${stages.stages.reduce((n, stage) => n + stage.completedWithoutScore, 0)} completed tables with no score pair.`,
    `Prior-table creator signal: ${repeat.returningCreators}/${repeat.recentCreators} current-window creators had a table before the cohort (${asPercent(repeat.returningCreators, repeat.recentCreators)}). This is exploratory, not a 30-day retention rate.`,
    "",
    "Interpretation limit: stored state does not reveal intent. Do not label a table as trial, abandoned, or a real event from this aggregate.",
    "",
    "## Social Events",
    `Cohort: ${social.fromAt} ≤ registered_at/end_at < ${social.untilAt}; observed at ${social.observedAt}.`,
    `Registration rows by source: \`${JSON.stringify(sourceCounts)}\` (rows, not started journeys).`,
    `Past-scheduled-end events in published/completed status: ${social.eventsPastEnd}; marked completed: ${social.markedCompleted}; with a completed scored match: ${social.withCompletedScore}; completed + scored: ${social.completedWithScore}.`,
    `All-time counts at observation: ${social.eventsAllTime} Social Events and ${social.registrationsAllTime} registration rows.`,
    "",
    "These are current-state aggregates, not timestamped transition history or user funnel events. GA4 journeys, GSC, field CWV, native device tests, and Shop cohorts are not queried by this workflow.",
    "",
  ];
  return lines.join("\n");
}

function one(rows, label) {
  if (rows.length !== 1) throw new Error(`${label}: expected one result row`);
  return rows[0];
}

export function dateInVietnam(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function collectSnapshot({ token, projectRef, fetchImpl = fetch, readSql = (p) => readFile(join(ROOT, p), "utf8"), now = () => new Date() }) {
  async function run(key) {
    const sql = await readSql(QUERY_FILES[key]);
    return queryReadOnly(sql, { token, projectRef, fetchImpl, label: key });
  }
  const stageRows = await run("stages");
  const stageRowWindow = normalizeStages(stageRows);
  const [baselineRows, repeatRows, socialRows] = await Promise.all([run("quicktable"), run("repeat"), run("social")]);
  const quicktableRow = one(baselineRows, "quicktable baseline");
  const repeatRow = one(repeatRows, "creator repeat");
  const socialRow = one(socialRows, "Social Event baseline");
  const snapshot = {
    generatedAt: now().toISOString(),
    stages: stageRowWindow,
    quicktable: normalizeSingleRow([quicktableRow], "quicktable baseline", {
      fromAt: "from_at", untilAt: "until_at", observedAt: "observed_at", created: "created",
      withScore: "with_score", withCompletedMatch: "with_completed_match", finished: "finished",
      completed: "completed", archived: "archived", completedMatches: "completed_matches", creators: "creators",
    }),
    repeat: normalizeSingleRow([repeatRow], "creator repeat", {
      fromAt: "from_at", untilAt: "until_at", observedAt: "observed_at",
      recentCreators: "recent_creators", returningCreators: "returning_creators",
    }),
    social: {
      fromAt: requiredTimestamp(socialRow.from_at, "from_at", "social baseline"),
      untilAt: requiredTimestamp(socialRow.until_at, "until_at", "social baseline"),
      observedAt: requiredTimestamp(socialRow.observed_at, "observed_at", "social baseline"),
      registrationRowsBySource: normalizeRegistrationSourceCounts(socialRow.registration_rows_by_source),
      eventsPastEnd: nonNegativeInteger(socialRow.events_past_scheduled_end, "events_past_scheduled_end", "social baseline"),
      markedCompleted: nonNegativeInteger(socialRow.marked_completed, "marked_completed", "social baseline"),
      withCompletedScore: nonNegativeInteger(socialRow.with_completed_score, "with_completed_score", "social baseline"),
      completedWithScore: nonNegativeInteger(socialRow.marked_completed_with_score, "marked_completed_with_score", "social baseline"),
      eventsAllTime: nonNegativeInteger(socialRow.social_events_all_time, "social_events_all_time", "social baseline"),
      registrationsAllTime: nonNegativeInteger(socialRow.registration_rows_all_time, "registration_rows_all_time", "social baseline"),
    },
  };
  const window = `${snapshot.stages.fromAt}|${snapshot.stages.untilAt}`;
  if ([snapshot.quicktable, snapshot.repeat, snapshot.social].some((item) => `${item.fromAt}|${item.untilAt}` !== window)) {
    throw new Error("Aggregate queries crossed a cohort boundary; rerun the snapshot");
  }
  return snapshot;
}

async function main() {
  const snapshot = await collectSnapshot({
    token: process.env.SUPABASE_ACCESS_TOKEN,
    projectRef: PROJECT_REF,
  });
  const report = renderReport(snapshot);
  const outDir = resolve(process.env.EVIDENCE_OUTPUT_DIR || "artifacts/weekly-evidence");
  await mkdir(outDir, { recursive: true });
  const output = join(outDir, `${dateInVietnam()}-product-evidence.md`);
  await writeFile(output, report, "utf8");
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `report=${output}\n`, "utf8");
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report, "utf8");
  process.stdout.write(`Wrote dated aggregate evidence report: ${output}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Weekly product evidence failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
