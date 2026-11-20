import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// These are UI inspection cases only: none submits a registration or publishes.
export const COVERAGE_CASES = [
  { project: "a11y", id: "P1", needs: ["event"] },
  { project: "a11y", id: "P2", needs: ["event"] },
  { project: "a11y", id: "O2", needs: ["auth", "organizer"] },
  { project: "journeys", id: "J1", needs: ["event"] },
  { project: "journeys", id: "J2", needs: ["event"] },
  { project: "journeys", id: "J3", needs: ["event", "auth"] },
  { project: "journeys", id: "J5", needs: ["auth", "organizer"] },
  { project: "journeys", id: "J6", needs: ["auth", "organizer"] },
];

const PRODUCTION_PROJECT_REF = "ajvlcamxemgbxduhiqrl";

/** Hosted canonical origins only: no custom proxy, loopback, credentials or paths. */
export function isStagingBackend(value) {
  const match = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(value ?? "");
  return Boolean(match && match[1] !== PRODUCTION_PROJECT_REF);
}

export function missingPrerequisites(env = process.env, mandatory = false) {
  const missing = [];
  if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.SUPABASE_ANON_KEY && !env.SUPABASE_PUBLISHABLE_KEY) missing.push("SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY");
  if (!env.PLAYWRIGHT_ORGANIZER_CLUB_SLUG) missing.push("PLAYWRIGHT_ORGANIZER_CLUB_SLUG");
  if (mandatory && !/^\/social\/[a-zA-Z0-9_-]+$/.test(env.PLAYWRIGHT_EVENT_PATH ?? "")) missing.push("PLAYWRIGHT_EVENT_PATH (relative /social/<slug>)");
  return missing;
}

export function stagingErrors(env = process.env) {
  const errors = [];
  try {
    const base = new URL(env.PLAYWRIGHT_BASE_URL);
    const declared = new URL(env.PLAYWRIGHT_STAGING_BASE_URL);
    const host = base.hostname.toLowerCase();
    if (base.origin !== declared.origin || base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash || host === "thepicklehub.net" || host.endsWith(".thepicklehub.net")) {
      errors.push("PLAYWRIGHT_BASE_URL must match the declared HTTPS staging origin outside the production domain");
    }
  } catch {
    errors.push("PLAYWRIGHT_BASE_URL and PLAYWRIGHT_STAGING_BASE_URL must name a valid staging origin");
  }
  if (!env.PLAYWRIGHT_STAGING_SUPABASE_URL || env.SUPABASE_URL !== env.PLAYWRIGHT_STAGING_SUPABASE_URL) {
    errors.push("SUPABASE_URL must match PLAYWRIGHT_STAGING_SUPABASE_URL (use staging credentials only)");
  }
  if (!isStagingBackend(env.SUPABASE_URL) || !isStagingBackend(env.PLAYWRIGHT_STAGING_SUPABASE_URL)) {
    errors.push("SUPABASE_URL and PLAYWRIGHT_STAGING_SUPABASE_URL must be canonical HTTPS hosted staging project origins; known production project, custom proxies and local backends are forbidden");
  }
  return errors;
}

/** Read HTML only; do not execute frontend scripts or send auth credentials. */
export async function verifyFrontendBackend(env = process.env, fetchImpl = fetch) {
  const errors = stagingErrors(env);
  if (errors.length) return { status: "blocked-by-configuration", errors };
  try {
    const response = await fetchImpl(env.PLAYWRIGHT_BASE_URL, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "text/html" },
    });
    if (!response.ok) return { status: "unverified", errors: ["Staging frontend HTML request failed"] };
    const html = await response.text();
    if (html.length > 500_000) return { status: "unverified", errors: ["Staging frontend HTML exceeds the preflight inspection limit"] };
    const links = html.match(/<link\b[^>]*>/gi) ?? [];
    const configured = links.filter((tag) => /\brel\s*=\s*["']preconnect["']/i.test(tag))
      .map((tag) => /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1])
      .filter((url) => url && /supabase/i.test(url));
    const expected = new URL(env.SUPABASE_URL).origin;
    if (configured.length !== 1 || !isStagingBackend(configured[0]) || new URL(configured[0]).origin !== expected) {
      return { status: "mismatch-or-missing", errors: ["Staging frontend Supabase build marker is missing, ambiguous, production, or does not match the expected staging backend"] };
    }
    // Vite substitutes this marker from the same VITE_SUPABASE_URL as the
    // client. It is build configuration evidence, not runtime attestation.
    return { status: "build-marker-verified-runtime-unverified", errors: [] };
  } catch {
    return { status: "unverified", errors: ["Cannot verify staging frontend Supabase build marker (network, redirect or malformed response)"] };
  }
}

function flatten(suites = []) {
  return suites.flatMap((suite) => [...(suite.specs ?? []), ...flatten(suite.suites)]);
}

export function coverageManifest(report, env = process.env) {
  const mandatory = env.PLAYWRIGHT_COVERAGE_REQUIRED === "1";
  const missing = missingPrerequisites(env, mandatory);
  const specs = flatten(report?.suites);
  const cases = COVERAGE_CASES.map((entry) => {
    const blocked = missing.filter((name) =>
      (entry.needs.includes("auth") && name.startsWith("SUPABASE_")) ||
      (entry.needs.includes("organizer") && name.startsWith("PLAYWRIGHT_ORGANIZER")) ||
      (entry.needs.includes("event") && name.startsWith("PLAYWRIGHT_EVENT")),
    );
    const matches = specs.filter((spec) => spec.title.startsWith(`${entry.id} `))
      .flatMap((spec) => spec.tests ?? []).filter((test) => test.projectName === entry.project);
    const attempts = matches.flatMap((test) => test.results ?? []);
    const executed = attempts.some((result) => result.status !== "skipped");
    const last = attempts.at(-1);
    const skipped = attempts.length > 0 && !executed;
    return {
      ...entry,
      eligible: blocked.length === 0,
      eligibilityBasis: entry.needs.includes("event") && !env.PLAYWRIGHT_EVENT_PATH ? "runtime event discovery" : "configured prerequisites",
      missingPrerequisites: blocked,
      executed,
      skipped,
      status: last?.status ?? "not-run",
      attempts: attempts.map(({ status }) => status),
      skipReasons: [...new Set(matches.flatMap((test) => test.annotations ?? []).filter((a) => a.type === "skip").map((a) => a.description ?? "unspecified"))],
    };
  });
  const errors = mandatory ? [...missing.map((name) => `Missing prerequisite: ${name}`), ...stagingErrors(env)] : [];
  if (mandatory) {
    for (const entry of cases) {
      if (entry.status !== "passed" || !entry.executed) errors.push(`${entry.project}/${entry.id}: mandatory case ${entry.status}`);
    }
    if ((report?.errors?.length ?? 0) > 0) errors.push("Playwright reported global errors");
  }
  return {
    schemaVersion: 1,
    mandatory,
    frontendBackendPairing: "not-attested-by-test-report; mandatory preflight checks build marker only, runtime pairing remains unverified",
    scope: "read-only event, registration modal and organizer draft/validation UI; does not prove publish or registration submission",
    summary: {
      expected: cases.length,
      eligible: cases.filter((entry) => entry.eligible).length,
      executed: cases.filter((entry) => entry.executed).length,
      skipped: cases.filter((entry) => entry.skipped).length,
      notRun: cases.filter((entry) => entry.status === "not-run").length,
    },
    cases,
    errors,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const preflight = process.argv.includes("--preflight");
  const required = process.env.PLAYWRIGHT_COVERAGE_REQUIRED === "1";
  if (preflight) {
    const errors = required ? [...missingPrerequisites(process.env, true).map((name) => `Missing prerequisite: ${name}`), ...stagingErrors()] : [];
    const pairing = required && errors.length === 0 ? await verifyFrontendBackend() : { status: "not-verified", errors: [] };
    errors.push(...pairing.errors);
    console.log(JSON.stringify({ mandatory: required, frontendBackendPairing: pairing.status, errors }, null, 2));
    process.exitCode = errors.length ? 1 : 0;
  } else {
    const source = process.argv[2] ?? "playwright-report/results.json";
    const destination = process.argv[3] ?? "playwright-report/coverage-manifest.json";
    let report;
    try { report = JSON.parse(readFileSync(source, "utf8")); } catch { /* missing report is visible as not-run */ }
    const manifest = coverageManifest(report);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify(manifest, null, 2));
    process.exitCode = manifest.errors.length ? 1 : 0;
  }
}
