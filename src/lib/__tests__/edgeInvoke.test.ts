import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invokeMock(...a) } },
}));

import { invokeWithBlobRetry } from "@/lib/edgeInvoke";

function blobLossError() {
  return {
    context: new Response(
      JSON.stringify({ code: "NOT_FOUND_FUNCTION_BLOB" }),
      { status: 404 },
    ),
  };
}

describe("invokeWithBlobRetry", () => {
  beforeEach(() => invokeMock.mockReset());

  it("retries blob-loss 404 then returns the eventual success", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: null, error: blobLossError() })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const res = await invokeWithBlobRetry("fn", {}, { delayMs: 1 });
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ ok: true });
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a non-blob error (e.g. captcha_failed)", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        context: new Response(JSON.stringify({ code: "captcha_failed" }), {
          status: 403,
        }),
      },
    });
    const res = await invokeWithBlobRetry("fn", {}, { delayMs: 1 });
    expect(res.error).toBeTruthy();
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after `retries` attempts if blob-loss persists", async () => {
    invokeMock.mockResolvedValue({ data: null, error: blobLossError() });
    const res = await invokeWithBlobRetry("fn", {}, { retries: 2, delayMs: 1 });
    expect(res.error).toBeTruthy();
    expect(invokeMock).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it("leaves the caller's response body readable (clones for detection)", async () => {
    const err = blobLossError();
    invokeMock.mockResolvedValue({ data: null, error: err });
    const res = await invokeWithBlobRetry("fn", {}, { retries: 1, delayMs: 1 });
    // Caller can still read the original body — detection used a clone.
    const body = await (res.error as { context: Response }).context.text();
    expect(body).toContain("NOT_FOUND_FUNCTION_BLOB");
  });
});
