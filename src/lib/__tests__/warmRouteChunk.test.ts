/** @vitest-environment jsdom */
// ============================================================================
// The route-chunk warm-up's own failure mode.
// ----------------------------------------------------------------------------
// App.tsx used to warm the active route's chunk with a bare `void load()`.
// `void` satisfies the floating-promise lint rule; it does NOT attach a
// rejection handler. So every stale-chunk failure after a deploy rejected into
// window.onunhandledrejection and was written to client_errors as "Importing a
// module script failed" — 21 of the 150 rows in the 30 days to 24/08/2026,
// all four warmed paths, all describing a failure ChunkErrorBoundary had
// already recovered from.
//
// What has to hold forever: warmRouteChunk NEVER rejects and NEVER throws, for
// any thunk at all. The assertions below are about that contract, not about
// any particular error message.
// ============================================================================
import { afterEach, describe, expect, it, vi } from "vitest";
import { warmRouteChunk } from "../warmRouteChunk";

describe("warmRouteChunk", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when the chunk loads", async () => {
    const load = vi.fn(() => Promise.resolve({ default: () => null }));
    await expect(warmRouteChunk(load)).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
  });

  // The exact production case: Cloudflare Pages deleted the old hashed chunk.
  it("swallows a rejected import instead of leaving it unhandled", async () => {
    const load = () => Promise.reject(new Error("Importing a module script failed"));
    await expect(warmRouteChunk(load)).resolves.toBeUndefined();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "boom"],
    ["a non-Error object", { name: "ApiError" }],
  ])("swallows a rejection carrying %s", async (_label, reason) => {
    await expect(warmRouteChunk(() => Promise.reject(reason))).resolves.toBeUndefined();
  });

  // A thunk that throws before returning a promise never reaches .then().
  it("swallows a synchronous throw from the thunk", async () => {
    const load = () => {
      throw new Error("bad specifier");
    };
    await expect(warmRouteChunk(load)).resolves.toBeUndefined();
  });

  it("tolerates a thunk that returns a non-promise", async () => {
    const load = () => undefined as unknown as Promise<unknown>;
    await expect(warmRouteChunk(load)).resolves.toBeUndefined();
  });

  // The regression itself: nothing may reach the unhandledrejection handler,
  // because that handler is what writes the noise row to client_errors.
  it("fires no unhandledrejection event", async () => {
    const onUnhandled = vi.fn();
    window.addEventListener("unhandledrejection", onUnhandled);
    try {
      await warmRouteChunk(() => Promise.reject(new Error("Importing a module script failed")));
      // Let the microtask queue drain the way the browser would before it
      // decides a rejection was never handled.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("unhandledrejection", onUnhandled);
    }
  });
});
