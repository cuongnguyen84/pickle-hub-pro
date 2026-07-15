import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { requireCronRequest } from "../../../supabase/functions/_shared/cron-auth";

function request(method = "POST", secret?: string): Request {
  return new Request("https://example.test/functions/v1/cron", {
    method,
    headers: secret ? { "x-cron-secret": secret } : undefined,
  });
}

describe("requireCronRequest", () => {
  it("rejects methods other than POST", async () => {
    const response = requireCronRequest(request("GET"), "expected");
    expect(response?.status).toBe(405);
    expect(await response?.json()).toEqual({ error: "method_not_allowed" });
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    const response = requireCronRequest(request("POST", "anything"), "");
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: "cron_secret_not_configured" });
  });

  it("rejects missing and incorrect secrets", () => {
    expect(requireCronRequest(request(), "expected")?.status).toBe(401);
    expect(requireCronRequest(request("POST", "wrong"), "expected")?.status).toBe(401);
  });

  it("allows POST with the configured secret", () => {
    expect(requireCronRequest(request("POST", "expected"), "expected")).toBeNull();
  });

  it.each([
    "auto-archive-tournaments",
    "leaderboard-compute",
    "match-expire",
    "mux-sync-assets",
    "errors-telegram-alert",
    "zalo-token-refresh",
  ])("is enforced by the public cron function %s", (functionName) => {
    const source = readFileSync(
      new URL(`../../../supabase/functions/${functionName}/index.ts`, import.meta.url),
      "utf8",
    );
    expect(source).toContain("requireCronRequest(req");
  });
});
