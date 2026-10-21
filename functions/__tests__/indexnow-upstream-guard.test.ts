import { describe, expect, it, vi, afterEach } from "vitest";

import { INDEXNOW_TIMEOUT_MS, onRequest } from "../api/indexnow";

/**
 * /api/indexnow answered with a Cloudflare "Bad gateway" HTML page on
 * 2026-08-25 (docs/defects/2026-08-25-indexnow-endpoint-502.md). The handler
 * awaited a bare `fetch()` to api.indexnow.org with no try/catch and no
 * timeout, so anything that went wrong out there escaped the function and the
 * edge synthesised the response — status 502, `content-type: text/html`, and
 * no way to tell which failure it was.
 *
 * These tests pin the contract that replaced it: whatever the upstream does,
 * the endpoint answers with JSON, and an unreachable IndexNow is reported as
 * `indexnow_status: 0` plus `indexnow_error` rather than thrown.
 */

const SECRET = "test-secret";

interface FakeEnv {
  INDEXNOW_KEY: string;
  INDEXNOW_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PRERENDER_CACHE?: { get: () => Promise<string | null>; put: () => Promise<void> };
}

function env(overrides: Partial<FakeEnv> = {}): FakeEnv {
  return {
    INDEXNOW_KEY: "key123",
    INDEXNOW_SECRET: SECRET,
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    ...overrides,
  };
}

function post(urls: string[] = ["https://www.thepicklehub.net/blog/x"]) {
  return new Request(`https://www.thepicklehub.net/api/indexnow?key=${SECRET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  });
}

// The Pages Function only ever reads `request` and `env` off the context.
const call = (request: Request, e: FakeEnv) =>
  (onRequest as unknown as (c: { request: Request; env: FakeEnv }) => Promise<Response>)({
    request,
    env: e,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/indexnow upstream failure handling", () => {
  it("answers 502 with JSON — not a thrown error — when IndexNow is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("The operation was aborted due to timeout")),
    );

    const res = await call(post(), env());

    expect(res.status).toBe(502);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const body = await res.json();
    expect(body.indexnow_status).toBe(0);
    expect(body.indexnow_error).toContain("timeout");
    expect(body.submitted).toBe(1);
  });

  it("passes a live abort signal so a hanging upstream cannot hold the request open", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await call(post(), env());

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const signal = init.signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    // `AbortSignal.abort()` is also an AbortSignal and would satisfy the check
    // above while aborting every request on arrival. Pin that the signal is
    // still live, and that the budget is the one we intended.
    expect(signal.aborted).toBe(false);
    expect(INDEXNOW_TIMEOUT_MS).toBe(10_000);

    // The success contract is unchanged — this is the claim the whole patch
    // rests on, so assert it rather than assume it.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("indexnow_error");
    expect(body.indexnow_status).toBe(200);
  });

  it("reports a real upstream rejection verbatim instead of masking it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unprocessable", { status: 422 })),
    );

    const res = await call(post(), env());

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.indexnow_status).toBe(422);
    expect(body.indexnow_error).toBeUndefined();
  });

  it("fails the rate limit open when KV throws, instead of 502-ing the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 200 })),
    );

    const res = await call(
      post(),
      env({
        PRERENDER_CACHE: {
          get: () => Promise.reject(new Error("KV namespace unavailable")),
          put: () => Promise.resolve(),
        },
      }),
    );

    expect(res.status).toBe(200);
  });

  it("still rejects an unauthorized call before touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await call(
      new Request("https://www.thepicklehub.net/api/indexnow?key=wrong", {
        method: "POST",
        body: JSON.stringify({ urls: ["https://www.thepicklehub.net/"] }),
      }),
      env(),
    );

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
