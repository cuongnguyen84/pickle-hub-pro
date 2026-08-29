import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  detectServiceRoleClient,
  loadRepositorySnapshot,
  parseFunctionConfig,
  validateProductionParity,
  validateRegistrySnapshot,
  type RegistrySnapshot,
} from "../../../scripts/check-edge-auth-registry.mjs";

const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));

function minimalSnapshot(overrides: Partial<RegistrySnapshot> = {}): RegistrySnapshot {
  return {
    registry: {
      schema_version: 1,
      enforcement: "strict",
      functions: {
        example: {
          verify_jwt: false,
          service_role: { uses_client: false, accepts_bearer: false },
          flows: ["public.read.none.none"],
          status: "classified",
        },
      },
    },
    sourceFunctions: ["example"],
    configFunctions: new Map([["example", { verify_jwt: false }]]),
    sourceByName: new Map([["example", "Deno.serve(() => new Response())"]]),
    ...overrides,
  };
}

describe("Edge Function auth registry", () => {
  it("strictly classifies every repository function without findings", () => {
    const snapshot = loadRepositorySnapshot(projectRoot);
    const findings = validateRegistrySnapshot(snapshot);

    expect(snapshot.sourceFunctions).toHaveLength(81);
    expect(snapshot.configFunctions).toHaveLength(81);
    expect(Object.keys(snapshot.registry.functions ?? {})).toHaveLength(81);
    expect(snapshot.registry.enforcement).toBe("strict");
    expect(findings).toEqual([]);
  });

  it("finds an unclassified source function", () => {
    const snapshot = minimalSnapshot({
      sourceFunctions: ["example", "missing"],
      sourceByName: new Map([
        ["example", "Deno.serve(() => new Response())"],
        ["missing", "Deno.serve(() => new Response())"],
      ]),
      configFunctions: new Map([
        ["example", { verify_jwt: false }],
        ["missing", { verify_jwt: false }],
      ]),
    });

    expect(validateRegistrySnapshot(snapshot)).toContainEqual(
      expect.objectContaining({ code: "unclassified-source", function: "missing" }),
    );
  });

  it("detects verify_jwt and service-role drift", () => {
    const snapshot = minimalSnapshot({
      configFunctions: new Map([["example", { verify_jwt: true }]]),
      sourceByName: new Map([
        [
          "example",
          'const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); createClient(url, key);',
        ],
      ]),
    });
    const codes = validateRegistrySnapshot(snapshot).map((item) => item.code);

    expect(codes).toContain("verify-jwt-drift");
    expect(codes).toContain("service-role-drift");
  });

  it("parses quoted config sections and ignores service-role mentions in comments", () => {
    const config = parseFunctionConfig(`
      [functions."quoted-name"]
      verify_jwt = false
    `);

    expect(config.get("quoted-name")?.verify_jwt).toBe(false);
    expect(detectServiceRoleClient('// Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")')).toBe(false);
    expect(detectServiceRoleClient('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")')).toBe(false);
    expect(detectServiceRoleClient(`
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const client = createClient(url, key);
    `)).toBe(true);
  });

  it("rejects public callbacks without proof of purpose", () => {
    const snapshot = minimalSnapshot();
    const example = snapshot.registry.functions?.example as {
      flows: string[];
    };
    example.flows = ["public.callback.client_identifier.client_identifier"];

    expect(validateRegistrySnapshot(snapshot)).toContainEqual(
      expect.objectContaining({ code: "callback-without-proof", function: "example" }),
    );
  });

  it("detects production orphans, missing functions, and verify_jwt drift", () => {
    const snapshot = minimalSnapshot();
    const findings = validateProductionParity(snapshot.registry, [
      { name: "example", verify_jwt: true },
      { name: "orphan", verify_jwt: false },
    ]);
    const codes = findings.map((item) => item.code);

    expect(codes).toContain("production-verify-jwt-drift");
    expect(codes).toContain("production-orphan");
    expect(validateProductionParity(snapshot.registry, [])).toContainEqual(
      expect.objectContaining({ code: "missing-production-function", function: "example" }),
    );
  });

  it("keeps representative actor controls in source", () => {
    const source = (name: string) => readFileSync(
      new URL(`../../../supabase/functions/${name}/index.ts`, import.meta.url),
      "utf8",
    );
    const duprWebhookSecurity = readFileSync(
      new URL("../../../supabase/functions/dupr-webhook/security.ts", import.meta.url),
      "utf8",
    );
    // The dedup-claim, authoritative-pull and retry-release controls moved from
    // index.ts into the Deno-free handler.ts (so they can be unit-tested).
    const duprWebhookHandler = readFileSync(
      new URL("../../../supabase/functions/dupr-webhook/handler.ts", import.meta.url),
      "utf8",
    );

    expect(duprWebhookSecurity).toContain("MAX_WEBHOOK_BODY_BYTES");
    expect(duprWebhookHandler).toContain("claimEvent"); // event dedup
    expect(duprWebhookHandler).toContain("partnerFetch"); // authoritative pull, not payload
    expect(duprWebhookHandler).toContain("releaseEvent"); // transient failure is retryable
    expect(source("delete-account")).toContain("supabaseUser.auth.getUser()");
    expect(source("api-keys-admin-generate")).toContain('roleData?.role !== "admin"');
    expect(source("auto-cancel-unpaid-registrations")).toContain("requireCronRequest(req");
    expect(source("notification-send")).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source("send-event-registration-email")).toContain("if (!INTERNAL_SECRET)");
  });
});
