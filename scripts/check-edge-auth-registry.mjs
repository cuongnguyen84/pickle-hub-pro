#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ACTORS = new Set(["public", "user", "admin", "cron", "internal_service"]);
const OPERATIONS = new Set(["read", "write", "callback", "mixed"]);
const CREDENTIALS = new Set([
  "none",
  "user_jwt",
  "cron_secret",
  "service_role_bearer",
  "shared_secret",
  "api_key",
  "webhook_signature",
  "magic_token",
  "otp_code",
  "captcha",
  "client_identifier",
]);
const AUTHORIZATIONS = new Set([
  "none",
  "derived_identity",
  "role_check",
  "resource_scope",
  "shared_secret",
  "one_time_secret",
  "permission_scope",
  "signature_check",
  "client_identifier",
  "human_challenge",
]);
const STATUSES = new Set(["classified", "hardening_required", "skeleton"]);

function finding(severity, code, message, functionName) {
  return {
    severity,
    code,
    message,
    ...(functionName ? { function: functionName } : {}),
  };
}

export function parseFunctionConfig(source) {
  const functions = new Map();
  let current = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const section = line.match(/^\[functions\.(?:"([^"]+)"|([^\]]+))\]$/);
    if (section) {
      current = section[1] ?? section[2];
      if (!functions.has(current)) functions.set(current, {});
      continue;
    }
    if (!current) continue;
    const verifyJwt = line.match(/^verify_jwt\s*=\s*(true|false)$/);
    if (verifyJwt) functions.get(current).verify_jwt = verifyJwt[1] === "true";
  }

  return functions;
}

export function detectServiceRoleClient(source) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return (
    /Deno\.env\.get\(["']SUPABASE_SERVICE_ROLE_KEY["']\)/.test(withoutComments) &&
    /\bcreateClient\s*\(/.test(withoutComments)
  );
}

function parseFlow(flow) {
  if (typeof flow !== "string") return null;
  const parts = flow.split(".");
  if (parts.length !== 4) return null;
  const [actor, operation, credential, authorization] = parts;
  return { actor, operation, credential, authorization };
}

export function validateRegistrySnapshot(snapshot) {
  const findings = [];
  const { registry, sourceFunctions, configFunctions, sourceByName } = snapshot;
  const entries = registry?.functions;

  if (registry?.schema_version !== 1) {
    findings.push(finding("error", "schema-version", "schema_version must be 1."));
  }
  if (registry?.enforcement !== "strict") {
    findings.push(finding(
      "error",
      "enforcement-mode",
      "SEC-04 requires registry enforcement=strict.",
    ));
  }
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    findings.push(finding("error", "registry-shape", "functions must be an object keyed by function name."));
    return findings;
  }

  const sourceNames = new Set(sourceFunctions);
  const registryNames = new Set(Object.keys(entries));

  for (const name of [...sourceNames].sort()) {
    if (!registryNames.has(name)) {
      findings.push(finding("error", "unclassified-source", "Source function has no registry entry.", name));
    }
    if (!configFunctions.has(name)) {
      findings.push(finding("error", "missing-config", "Source function has no supabase/config.toml section.", name));
    }
  }

  for (const name of [...registryNames].sort()) {
    if (!sourceNames.has(name)) {
      findings.push(finding("error", "registry-without-source", "Registry entry has no source index.ts.", name));
    }
  }

  for (const name of [...configFunctions.keys()].sort()) {
    if (!sourceNames.has(name)) {
      findings.push(finding("warning", "config-without-source", "Config section has no source index.ts.", name));
    }
  }

  for (const [name, entry] of Object.entries(entries)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      findings.push(finding("error", "entry-shape", "Registry entry must be an object.", name));
      continue;
    }

    if (typeof entry.verify_jwt !== "boolean") {
      findings.push(finding("error", "verify-jwt-type", "verify_jwt must be boolean.", name));
    } else {
      const configured = configFunctions.get(name)?.verify_jwt;
      if (configured !== undefined && configured !== entry.verify_jwt) {
        findings.push(finding(
          "error",
          "verify-jwt-drift",
          `Registry verify_jwt=${entry.verify_jwt} but config has ${configured}.`,
          name,
        ));
      }
    }

    if (
      !entry.service_role ||
      typeof entry.service_role.uses_client !== "boolean" ||
      typeof entry.service_role.accepts_bearer !== "boolean"
    ) {
      findings.push(finding(
        "error",
        "service-role-shape",
        "service_role must contain boolean uses_client and accepts_bearer fields.",
        name,
      ));
    } else if (sourceByName.has(name)) {
      const detected = detectServiceRoleClient(sourceByName.get(name));
      if (detected !== entry.service_role.uses_client) {
        findings.push(finding(
          "error",
          "service-role-drift",
          `Registry uses_client=${entry.service_role.uses_client} but source detection is ${detected}.`,
          name,
        ));
      }
    }

    if (!Array.isArray(entry.flows) || entry.flows.length === 0) {
      findings.push(finding("error", "missing-flow", "At least one auth flow is required.", name));
      continue;
    }

    const parsedFlows = [];
    for (const rawFlow of entry.flows) {
      const flow = parseFlow(rawFlow);
      if (!flow) {
        findings.push(finding(
          "error",
          "invalid-flow-shape",
          `Flow ${JSON.stringify(rawFlow)} must match actor.operation.credential.authorization.`,
          name,
        ));
        continue;
      }
      parsedFlows.push(flow);
      for (const [field, value, allowed] of [
        ["actor", flow.actor, ACTORS],
        ["operation", flow.operation, OPERATIONS],
        ["credential", flow.credential, CREDENTIALS],
        ["authorization", flow.authorization, AUTHORIZATIONS],
      ]) {
        if (!allowed.has(value)) {
          findings.push(finding("error", `invalid-${field}`, `Unknown ${field}: ${value}.`, name));
        }
      }

      if (flow.actor === "user" && flow.credential !== "user_jwt") {
        findings.push(finding("error", "user-without-jwt", "User flows must use a user JWT.", name));
      }
      if (
        flow.actor === "admin" &&
        (flow.credential !== "user_jwt" || flow.authorization !== "role_check")
      ) {
        findings.push(finding("error", "admin-without-role-check", "Admin flows require user_jwt plus role_check.", name));
      }
      if (flow.actor === "cron" && flow.credential !== "cron_secret") {
        findings.push(finding(
          "warning",
          "nonstandard-cron-credential",
          `Cron flow uses ${flow.credential}; SEC-04 target is cron_secret + requireCronRequest.`,
          name,
        ));
      }
      if (
        flow.actor === "public" &&
        flow.operation === "callback" &&
        !["shared_secret", "webhook_signature"].includes(flow.credential)
      ) {
        findings.push(finding(
          "error",
          "callback-without-proof",
          "Public callbacks require a shared secret or verified webhook signature.",
          name,
        ));
      }
    }

    const hasServiceBearer = parsedFlows.some((flow) => flow.credential === "service_role_bearer");
    if (entry.service_role?.accepts_bearer !== hasServiceBearer) {
      findings.push(finding(
        "error",
        "service-bearer-flow-drift",
        "accepts_bearer must match whether a service_role_bearer flow is declared.",
        name,
      ));
    }

    const hasStandardCron = parsedFlows.some(
      (flow) => flow.actor === "cron" && flow.credential === "cron_secret",
    );
    if (hasStandardCron && sourceByName.has(name) && !sourceByName.get(name).includes("requireCronRequest(req")) {
      findings.push(finding(
        "warning",
        "cron-helper-missing",
        "Cron flow declares cron_secret but source does not call requireCronRequest(req).",
        name,
      ));
    }

    if (!STATUSES.has(entry.status)) {
      findings.push(finding("error", "invalid-status", `Unknown status: ${entry.status}.`, name));
    } else if (entry.status === "hardening_required") {
      findings.push(finding(
        "warning",
        "known-hardening-gap",
        `Known gap${entry.follow_up?.length ? ` tracked by ${entry.follow_up.join(", ")}` : ""}.`,
        name,
      ));
    }

    const unauthenticatedInternal = parsedFlows.some(
      (flow) => flow.actor === "internal_service" && flow.credential === "none",
    );
    if (unauthenticatedInternal) {
      findings.push(finding(
        "warning",
        "unauthenticated-internal-flow",
        "Internal-service flow currently declares no caller credential.",
        name,
      ));
    }
  }

  return findings;
}

export function validateProductionParity(registry, deployedFunctions) {
  const findings = [];
  const entries = registry?.functions;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return [finding("error", "registry-shape", "functions must be an object keyed by function name.")];
  }
  if (!Array.isArray(deployedFunctions)) {
    return [finding("error", "production-shape", "Production function list must be an array.")];
  }

  const deployedByName = new Map();
  for (const raw of deployedFunctions) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      findings.push(finding("error", "production-entry-shape", "Production entry must be an object."));
      continue;
    }
    const name = typeof raw.name === "string"
      ? raw.name
      : typeof raw.slug === "string"
        ? raw.slug
        : "";
    if (!name) {
      findings.push(finding("error", "production-name", "Production entry has no name or slug."));
      continue;
    }
    if (deployedByName.has(name)) {
      findings.push(finding("error", "production-duplicate", "Production lists the function more than once.", name));
      continue;
    }
    deployedByName.set(name, raw);
  }

  for (const name of Object.keys(entries).sort()) {
    const deployed = deployedByName.get(name);
    if (!deployed) {
      findings.push(finding("error", "missing-production-function", "Registry function is not deployed.", name));
      continue;
    }
    if (typeof deployed.verify_jwt !== "boolean") {
      findings.push(finding("error", "production-verify-jwt-type", "Production verify_jwt must be boolean.", name));
    } else if (deployed.verify_jwt !== entries[name].verify_jwt) {
      findings.push(finding(
        "error",
        "production-verify-jwt-drift",
        `Registry verify_jwt=${entries[name].verify_jwt} but production has ${deployed.verify_jwt}.`,
        name,
      ));
    }
  }

  for (const name of [...deployedByName.keys()].sort()) {
    if (!Object.hasOwn(entries, name)) {
      findings.push(finding("error", "production-orphan", "Deployed function has no registry entry.", name));
    }
  }

  return findings;
}

export function loadRepositorySnapshot(projectRoot) {
  const functionsDir = join(projectRoot, "supabase", "functions");
  const registry = JSON.parse(readFileSync(join(functionsDir, "auth-registry.json"), "utf8"));
  const configFunctions = parseFunctionConfig(
    readFileSync(join(projectRoot, "supabase", "config.toml"), "utf8"),
  );
  const sourceFunctions = [];
  const sourceByName = new Map();

  for (const name of readdirSync(functionsDir).sort()) {
    if (name === "_shared") continue;
    const indexPath = join(functionsDir, name, "index.ts");
    if (!existsSync(indexPath)) continue;
    sourceFunctions.push(name);
    sourceByName.set(name, readFileSync(indexPath, "utf8"));
  }

  return { registry, sourceFunctions, configFunctions, sourceByName };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const snapshot = loadRepositorySnapshot(projectRoot);
  const strict = process.argv.includes("--strict") || snapshot.registry.enforcement === "strict";
  const findings = [...validateRegistrySnapshot(snapshot)];
  const productionJsonIndex = process.argv.indexOf("--production-json");
  if (productionJsonIndex >= 0) {
    const productionJsonPath = process.argv[productionJsonIndex + 1];
    if (!productionJsonPath) {
      findings.push(finding("error", "production-json-path", "--production-json requires a file path."));
    } else {
      try {
        const deployedFunctions = JSON.parse(readFileSync(productionJsonPath, "utf8"));
        findings.push(...validateProductionParity(snapshot.registry, deployedFunctions));
      } catch (error) {
        findings.push(finding(
          "error",
          "production-json-read",
          `Could not read production function metadata: ${error instanceof Error ? error.message : String(error)}`,
        ));
      }
    }
  }
  const errors = findings.filter((item) => item.severity === "error");
  const warnings = findings.filter((item) => item.severity === "warning");

  console.log(
    `Edge auth registry: ${snapshot.sourceFunctions.length} source / ` +
      `${Object.keys(snapshot.registry.functions).length} registry / ` +
      `${snapshot.configFunctions.size} config.`,
  );
  for (const item of findings) {
    const label = item.severity === "error" ? "ERROR" : "WARN ";
    const scope = item.function ? ` ${item.function}` : "";
    console.log(`${label} [${item.code}]${scope}: ${item.message}`);
  }
  console.log(`Summary: ${errors.length} error(s), ${warnings.length} warning(s).`);

  if (strict && findings.length > 0) {
    console.error("Strict mode failed. Resolve every registry or production-parity finding.");
    process.exit(1);
  }
  if (!strict && findings.length > 0) {
    console.log("Report mode is non-blocking.");
  }
}
