import { describe, expect, it } from "vitest";
import {
  MAX_CLIENT_ERROR_BATCH,
  getClientErrorIp,
  hashClientErrorIdentity,
  parseClientErrorType,
  parseCspClientErrors,
  parseJsClientError,
  sanitizeClientErrorUrl,
} from "../../../supabase/functions/_shared/client-errors";

describe("client-error ingestion contract", () => {
  it("accepts only the documented event types", () => {
    expect(parseClientErrorType(null)).toBe("js_error");
    expect(parseClientErrorType("UNHANDLED_REJECTION")).toBe("unhandled_rejection");
    expect(parseClientErrorType("other")).toBeNull();
  });

  it("derives identity and user agent while discarding spoofed fields", () => {
    const parsed = parseJsClientError(
      "js_error",
      {
        message: "boom",
        stack: "Error: boom",
        url: "https://www.thepicklehub.net/callback?access_token=secret#fragment",
        user_id: "attacker-user",
        user_agent: "attacker-agent",
        details: {
          filename: "https://www.thepicklehub.net/assets/app.js?token=secret",
          lineno: 12,
          colno: 4,
          arbitrary: "discarded",
        },
      },
      "server-user",
      "Server Browser",
    );

    expect(parsed.rows).toEqual([{
      type: "js_error",
      message: "boom",
      stack: "Error: boom",
      url: "https://www.thepicklehub.net/callback",
      user_agent: "Server Browser",
      user_id: "server-user",
      details: {
        filename: "https://www.thepicklehub.net/assets/app.js",
        lineno: 12,
        colno: 4,
      },
    }]);
  });

  it("requires a message and caps free text", () => {
    expect(parseJsClientError("js_error", {}, null, null).rows).toEqual([]);
    const parsed = parseJsClientError(
      "unhandled_rejection",
      { message: "m".repeat(1_500), stack: "s".repeat(5_000) },
      null,
      null,
    );
    expect(parsed.rows[0]?.message).toHaveLength(1_000);
    expect(parsed.rows[0]?.stack).toHaveLength(4_000);
  });

  it("normalizes and bounds a legacy CSP report", () => {
    const parsed = parseCspClientErrors({
      "csp-report": {
        "document-uri": "https://www.thepicklehub.net/watch?private=yes",
        "violated-directive": "script-src",
        "blocked-uri": "data:text/javascript,secret",
        "source-file": "https://cdn.example.com/app.js?signature=secret",
        "line-number": 42,
        "original-policy": "p".repeat(9_000),
        "script-sample": "s".repeat(900),
        unexpected: "discarded",
      },
    }, null, "Browser UA");

    expect(parsed.rows[0]).toMatchObject({
      type: "csp_violation",
      message: "script-src blocked data:",
      url: "https://www.thepicklehub.net/watch",
      stack: "https://cdn.example.com/app.js:42",
      user_agent: "Browser UA",
      user_id: null,
      details: {
        "blocked-uri": "data:",
        "source-file": "https://cdn.example.com/app.js",
      },
    });
    expect(String(parsed.rows[0]?.details?.["original-policy"])).toHaveLength(8_000);
    expect(String(parsed.rows[0]?.details?.["script-sample"])).toHaveLength(500);
    expect(parsed.rows[0]?.details).not.toHaveProperty("unexpected");
  });

  it("supports Reporting API arrays and rejects oversized batches", () => {
    const parsed = parseCspClientErrors([
      {
        type: "csp-violation",
        url: "https://www.thepicklehub.net/feed?token=secret",
        body: { effectiveDirective: "img-src", blockedURL: "https://bad.test/a.png?q=1" },
      },
      { type: "other-report", body: {} },
    ], "real-user", "Browser UA");
    expect(parsed).toMatchObject({ rawCount: 2, tooLarge: false });
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      message: "img-src blocked https://bad.test/a.png",
      url: "https://www.thepicklehub.net/feed",
      user_id: "real-user",
    });

    expect(parseCspClientErrors(
      Array.from({ length: MAX_CLIENT_ERROR_BATCH + 1 }, () => ({
        type: "csp-violation",
        body: {},
      })),
      null,
      null,
    )).toMatchObject({ rows: [], tooLarge: true, rawCount: 21 });
  });

  it("removes query credentials and unsafe resource bodies from URLs", () => {
    expect(sanitizeClientErrorUrl("https://user:pass@example.com/a?token=x#y"))
      .toBe("https://example.com/a");
    expect(sanitizeClientErrorUrl("blob:https://example.com/private-id")).toBe("blob:");
    expect(sanitizeClientErrorUrl("data:text/plain,secret")).toBe("data:");
  });

  it("uses the trusted forwarding order and hashes limiter identities", async () => {
    const request = new Request("https://example.test", {
      headers: {
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.1, 198.51.100.2",
      },
    });
    const hash = await hashClientErrorIdentity("ip:203.0.113.9");
    expect(getClientErrorIp(request)).toBe("203.0.113.9");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.9");
  });
});
