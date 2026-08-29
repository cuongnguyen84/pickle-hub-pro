/**
 * Publish resilience on mobile data. Safari surfaces a dropped connection as
 * `TypeError: Load failed`; the batch used to abandon every remaining row on
 * the first one. These pin the two rules: transient errors are replayed
 * (the RPCs are idempotent), real errors are not.
 */
import { describe, expect, it, vi } from "vitest";

import { isTransientNetworkError, publishErrorMessage, withNetworkRetry } from "@/lib/shop/publishRetry";

describe("isTransientNetworkError", () => {
  it("treats Safari's and Chrome's fetch failures as transient", () => {
    expect(isTransientNetworkError(new TypeError("Load failed"))).toBe(true);
    expect(isTransientNetworkError({ message: "Failed to fetch" })).toBe(true);
    expect(isTransientNetworkError({ message: "NOT_FOUND_FUNCTION_BLOB" })).toBe(true);
  });

  it("does not retry a real refusal", () => {
    expect(isTransientNetworkError({ code: "42501", message: "row-level security" })).toBe(false);
    expect(isTransientNetworkError(new Error("product_image_required"))).toBe(false);
  });
});

describe("withNetworkRetry", () => {
  it("replays a transient failure and returns the eventual result", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const work = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new TypeError("Load failed");
      return "ok";
    });
    const pending = withNetworkRetry(work, 3);
    await vi.runAllTimersAsync();
    expect(await pending).toBe("ok");
    expect(work).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("gives up after the retry budget and surfaces the last error", async () => {
    vi.useFakeTimers();
    const work = vi.fn(async () => {
      throw new TypeError("Load failed");
    });
    const pending = withNetworkRetry(work, 2).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(await pending).toBeInstanceOf(TypeError);
    expect(work).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("throws a non-transient error immediately", async () => {
    const work = vi.fn(async () => {
      throw new Error("product_image_required");
    });
    await expect(withNetworkRetry(work)).rejects.toThrow("product_image_required");
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe("publishErrorMessage", () => {
  it("explains a dropped connection in the seller's terms", () => {
    expect(publishErrorMessage(new TypeError("Load failed"))).toMatch(/Mất kết nối/);
  });
});
