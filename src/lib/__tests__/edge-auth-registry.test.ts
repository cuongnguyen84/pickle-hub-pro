import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import {
  detectServiceRoleClient,
  loadRepositorySnapshot,
  parseFunctionConfig,
  validateRegistrySnapshot,
  type RegistrySnapshot,
} from "../../../scripts/check-edge-auth-registry.mjs";

const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));

function minimalSnapshot(overrides: Partial<RegistrySnapshot> = {}): RegistrySnapshot {
  return {
    registry: {
      schema_version: 1,
      enforcement: "report",
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
  it("classifies every repository function without schema or drift errors", () => {
    const snapshot = loadRepositorySnapshot(projectRoot);
    const findings = validateRegistrySnapshot(snapshot);

    expect(snapshot.sourceFunctions).toHaveLength(76);
    expect(snapshot.configFunctions).toHaveLength(76);
    expect(Object.keys(snapshot.registry.functions ?? {})).toHaveLength(76);
    expect(findings.filter((item) => item.severity === "error")).toEqual([]);
    expect(findings.some((item) => item.code === "known-hardening-gap")).toBe(true);
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
        ["example", 'const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");'],
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
  });
});
