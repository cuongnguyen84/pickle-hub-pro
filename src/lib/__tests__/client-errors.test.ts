import { describe, expect, it } from "vitest";
import {
  MAX_CLIENT_ERROR_BATCH,
  getClientErrorIp,
  hashClientErrorIdentity,
  parseClientErrorType,
  isThirdPartyCspReport,
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

    const forwardedOnly = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "198.51.100.1, 198.51.100.2",
      },
    });
    expect(getClientErrorIp(forwardedOnly)).toBe("198.51.100.2");
  });
});

// ============================================================================
// Third-party injections (2026-08-30 site audit).
// ----------------------------------------------------------------------------
// 312 of the 336 rows recorded in the preceding week were scripts and styles
// injected into our pages by the Facebook in-app browser, Google Translate and
// browser extensions — none of which appear anywhere in this repo. They are
// dropped at ingestion so they cannot spend the per-identity rate limit that a
// real error from the same reader needs.
// ============================================================================
describe("third-party CSP injections are dropped at ingestion", () => {
  const cspBody = (blocked: string, sourceFile?: string) => ({
    "csp-report": {
      "document-uri": "https://www.thepicklehub.net/live",
      "violated-directive": "script-src-elem",
      "effective-directive": "script-src-elem",
      "blocked-uri": blocked,
      ...(sourceFile ? { "source-file": sourceFile } : {}),
    },
  });

  it("recognises the injectors by host, path prefix and extension scheme", () => {
    expect(isThirdPartyCspReport({
      "blocked-uri": "https://connect.facebook.net/en_US/pcm.js",
    })).toBe(true);
    expect(isThirdPartyCspReport({
      "blocked-uri": "https://www.gstatic.com/_/translate_http/_/ss/k=translate_http.tr/d=0",
    })).toBe(true);
    expect(isThirdPartyCspReport({
      "blocked-uri": "https://static.shopback.com/fonts/ShopBackSans-Bold.woff2",
    })).toBe(true);
    expect(isThirdPartyCspReport({
      "blocked-uri": "https://cdn.honey.io/css/empty.css",
      "source-file": "safari-extension:",
    })).toBe(true);
  });

  it("matches the host exactly, so a lookalike domain still reports", () => {
    expect(isThirdPartyCspReport({
      "blocked-uri": "https://connect.facebook.net.evil.example/x.js",
    })).toBe(false);
    expect(isThirdPartyCspReport({
      "blocked-uri": "https://cdn.connect.facebook.net/x.js",
    })).toBe(false);
  });

  it("keeps adware and proxy injections, which are evidence about readers", () => {
    // lottingem.com and gateway.zscloud.net both appeared in the 30 days to
    // 2026-08-30. They are third-party too, but they say something about the
    // audience — an infected reader, a corporate TLS proxy — rather than about
    // a browser feature we already understand. Deliberately not filtered.
    expect(isThirdPartyCspReport({ "blocked-uri": "https://lottingem.com/re.php" })).toBe(false);
    expect(isThirdPartyCspReport({ "blocked-uri": "https://gateway.zscloud.net/" })).toBe(false);
  });

  it("keeps our own violations, and the rest of gstatic", () => {
    // The fonts we really do load — the prefix match must not become a host
    // match, or a genuine font-src regression would go unreported.
    expect(isThirdPartyCspReport({
      "blocked-uri": "https://www.gstatic.com/fonts/roboto.woff2",
    })).toBe(false);
    // A real violation from our own bundle: the one signal this whole feed is
    // for. It was in the same week's data, under 200 rows of Facebook noise.
    expect(isThirdPartyCspReport({
      "blocked-uri": "data:",
      "source-file": "https://www.thepicklehub.net/assets/index-DBiY9zW5.js",
    })).toBe(false);
    // sanitizeClientErrorUrl turns every CSP keyword into a bare string that
    // new URL() rejects. None of them may be read as a third-party host.
    for (const keyword of ["data:", "blob:", "inline", "eval", "self", "none", ""]) {
      expect(isThirdPartyCspReport({ "blocked-uri": keyword })).toBe(false);
    }
    expect(isThirdPartyCspReport(null)).toBe(false);
    expect(isThirdPartyCspReport({})).toBe(false);
  });

  it("stores nothing for a legacy report that is pure injection", () => {
    const parsed = parseCspClientErrors(
      cspBody("https://connect.facebook.net/en_US/pcm.js"),
      null,
      "Mozilla/5.0",
    );
    expect(parsed.rows).toEqual([]);
    expect(parsed.injectedCount).toBe(1);
    // rawCount is untouched: the request WAS one report, and the caller still
    // needs that to tell "filtered" apart from "unparseable".
    expect(parsed.rawCount).toBe(1);
  });

  it("keeps the real report when a Reporting API batch mixes both", () => {
    const parsed = parseCspClientErrors(
      [
        {
          type: "csp-violation",
          url: "https://www.thepicklehub.net/live",
          body: cspBody("https://connect.facebook.net/en_US/pcm.js")["csp-report"],
        },
        {
          type: "csp-violation",
          url: "https://www.thepicklehub.net/shop",
          body: {
            "document-uri": "https://www.thepicklehub.net/shop",
            "violated-directive": "connect-src",
            "effective-directive": "connect-src",
            "blocked-uri": "data:text/plain,x",
            "source-file": "https://www.thepicklehub.net/assets/index-DBiY9zW5.js",
          },
        },
      ],
      null,
      "Mozilla/5.0",
    );
    expect(parsed.injectedCount).toBe(1);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].message).toContain("connect-src");
  });

  it("leaves js_error parsing alone", () => {
    const parsed = parseJsClientError("js_error", { message: "boom" }, null, "Mozilla/5.0");
    expect(parsed.injectedCount).toBe(0);
    expect(parsed.rows).toHaveLength(1);
  });
});
