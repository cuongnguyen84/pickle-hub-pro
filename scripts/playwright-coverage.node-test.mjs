import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { COVERAGE_CASES, coverageManifest, missingPrerequisites, stagingErrors, isStagingBackend, verifyFrontendBackend } from "./playwright-coverage.mjs";

const staging = {
  PLAYWRIGHT_COVERAGE_REQUIRED: "1",
  PLAYWRIGHT_BASE_URL: "https://integration.example.test",
  PLAYWRIGHT_STAGING_BASE_URL: "https://integration.example.test",
  SUPABASE_URL: "https://bbbbbbbbbbbbbbbbbbbb.supabase.co",
  PLAYWRIGHT_STAGING_SUPABASE_URL: "https://bbbbbbbbbbbbbbbbbbbb.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "DO-NOT-PRINT-THIS-SECRET",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  PLAYWRIGHT_ORGANIZER_CLUB_SLUG: "fixture-club",
  PLAYWRIGHT_EVENT_PATH: "/social/fixture-event",
};
const report = (status = "passed") => ({ suites: [{ suites: [{ specs: COVERAGE_CASES.map(({ id, project }) => ({ title: `${id} example`, tests: [{ projectName: project, annotations: status === "skipped" ? [{ type: "skip", description: "No eligible event" }] : [], results: [{ status }] }] })) }] }] });

test("required staging rejects missing credentials by name without exposing values", () => {
  const output = coverageManifest(undefined, { ...staging, SUPABASE_SERVICE_ROLE_KEY: "" });
  assert.ok(output.errors.some((error) => error.includes("SUPABASE_SERVICE_ROLE_KEY")));
  assert.equal(JSON.stringify(output).includes("DO-NOT-PRINT"), false);
  assert.deepEqual(missingPrerequisites(staging, true), []);
});
test("all required cases passing is the only successful complete staging evidence", () => {
  const output = coverageManifest(report(), staging);
  assert.deepEqual(output.errors, []);
  assert.equal(output.summary.executed, 8);
  assert.equal(output.summary.eligible, 8);
});
test("required staging fails skipped and absent cases, retains skip reason", () => {
  const skipped = coverageManifest(report("skipped"), staging);
  assert.equal(skipped.summary.skipped, 8);
  assert.equal(skipped.summary.executed, 0);
  assert.ok(skipped.errors.length >= 8);
  assert.deepEqual(skipped.cases[0].skipReasons, ["No eligible event"]);
  assert.equal(coverageManifest({ suites: [] }, staging).summary.notRun, 8);
});
test("production reporting tolerates absent or skipped optional coverage", () => {
  assert.deepEqual(coverageManifest(undefined, {}).errors, []);
  assert.deepEqual(coverageManifest(report("skipped"), {}).errors, []);
});
test("required mode rejects production, invalid fixtures and mismatched staging DB", () => {
  for (const url of ["https://www.thepicklehub.net", "https://thepicklehub.net", "https://preview.thepicklehub.net", "http://integration.example.test", "https://integration.example.test/path"]) {
    assert.ok(stagingErrors({ ...staging, PLAYWRIGHT_BASE_URL: url, PLAYWRIGHT_STAGING_BASE_URL: url }).length);
  }
  assert.ok(stagingErrors({ ...staging, PLAYWRIGHT_STAGING_SUPABASE_URL: "other" }).length);
  for (const path of ["https://www.thepicklehub.net/social/event", "//other/social/event", "/social/event?secret=x", ""]) {
    assert.ok(missingPrerequisites({ ...staging, PLAYWRIGHT_EVENT_PATH: path }, true).some((name) => name.startsWith("PLAYWRIGHT_EVENT_PATH")));
  }
});
test("retry failure followed by pass is executed; final failure is not green", () => {
  const retried = report();
  retried.suites[0].suites[0].specs[0].tests[0].results.unshift({ status: "failed" });
  assert.deepEqual(coverageManifest(retried, staging).errors, []);
  const failed = report("failed");
  assert.ok(coverageManifest(failed, staging).errors.some((error) => error.includes("mandatory case failed")));
});
test("matching ID from the wrong project cannot satisfy mandatory evidence", () => {
  const wrong = report();
  wrong.suites[0].suites[0].specs[0].tests[0].projectName = "other-project";
  const output = coverageManifest(wrong, staging);
  assert.equal(output.cases[0].status, "not-run");
  assert.ok(output.errors.includes("a11y/P1: mandatory case not-run"));
});
test("CLI preflight fails closed before tests, disclosing credential names only", () => {
  const child = spawnSync(process.execPath, ["scripts/playwright-coverage.mjs", "--preflight"], {
    env: { PLAYWRIGHT_COVERAGE_REQUIRED: "1", SUPABASE_SERVICE_ROLE_KEY: "DO-NOT-PRINT-THIS-SECRET" }, encoding: "utf8",
  });
  assert.equal(child.status, 1);
  assert.match(child.stdout, /SUPABASE_URL/);
  assert.doesNotMatch(child.stdout, /DO-NOT-PRINT/);
});
test("production backend is rejected even when declared staging URLs match", () => {
  const production = "https://ajvlcamxemgbxduhiqrl.supabase.co";
  assert.equal(isStagingBackend(production), false);
  const env = { ...staging, SUPABASE_URL: production, PLAYWRIGHT_STAGING_SUPABASE_URL: production };
  assert.ok(stagingErrors(env).some((error) => error.includes("known production project")));
  assert.ok(coverageManifest(report(), env).errors.length);
});
test("backend guard rejects malformed, non-HTTPS, credentialed, local and proxy URLs", () => {
  for (const value of [
    "not-a-url", "http://bbbbbbbbbbbbbbbbbbbb.supabase.co", "https://localhost", "https://127.0.0.1", "https://[::1]",
    "https://proxy.example.test", "https://bbbbbbbbbbbbbbbbbbbb.supabase.co.attacker.test", "https://bbbbbbbbbbbbbbbbbbbb.supabase.co:443",
    "https://user:password@bbbbbbbbbbbbbbbbbbbb.supabase.co", "https://bbbbbbbbbbbbbbbbbbbb.supabase.co/rest/v1", "https://bbbbbbbbbbbbbbbbbbbb.supabase.co?proxy=prod",
    "https://bbbbbbbbbbbbbbbbbbbb.supabase.co#fragment", "https://bbbbbbbbbbbbbbbbbbbb.supabase.co.", "https://%61jvlcamxemgbxduhiqrl.supabase.co",
  ]) assert.equal(isStagingBackend(value), false, "unsafe backend URL was accepted");
  assert.equal(isStagingBackend(staging.SUPABASE_URL), true);
});
test("frontend preflight verifies build marker using a credential-free read and rejects mismatches", async () => {
  let calls = 0;
  const result = await verifyFrontendBackend(staging, async (url, options) => {
    calls++;
    assert.equal(url, staging.PLAYWRIGHT_BASE_URL);
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, text: async () => `<html><link rel="preconnect" href="${staging.SUPABASE_URL}" crossorigin /></html>` };
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "build-marker-verified-runtime-unverified");
  for (const html of ["<html></html>", '<link rel="preconnect" href="https://ajvlcamxemgbxduhiqrl.supabase.co" />', '<link rel="preconnect" href="https://cccccccccccccccccccc.supabase.co" />']) {
    assert.ok((await verifyFrontendBackend(staging, async () => ({ ok: true, text: async () => html }))).errors.length);
  }
});
test("frontend verification never fetches when configuration names production backend", async () => {
  const production = "https://ajvlcamxemgbxduhiqrl.supabase.co";
  const result = await verifyFrontendBackend({ ...staging, SUPABASE_URL: production, PLAYWRIGHT_STAGING_SUPABASE_URL: production }, async () => { throw new Error("must not fetch"); });
  assert.equal(result.status, "blocked-by-configuration");
  assert.ok(result.errors.length);
});
test("frontend redirects and network errors fail closed without leaking credentials", async () => {
  const result = await verifyFrontendBackend(staging, async () => { throw Error(staging.SUPABASE_SERVICE_ROLE_KEY); });
  assert.ok(result.errors.length);
  assert.equal(JSON.stringify(result).includes(staging.SUPABASE_SERVICE_ROLE_KEY), false);
});
