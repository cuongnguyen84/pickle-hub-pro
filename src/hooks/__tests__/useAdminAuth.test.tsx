// @vitest-environment jsdom
// Regression tests for the 2026-10-27 /admin skeleton incident, second
// step of the gate: the user_roles lookup had no timeout, so a stalled
// PostgREST request kept AdminLayout's isLoading true forever even with
// a healthy session.

import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

const { useAuthState, maybeSingle, fromMock, reportCaughtError, signalRef } =
  vi.hoisted(() => ({
    useAuthState: { user: null as { id: string } | null, loading: false },
    maybeSingle: vi.fn(),
    fromMock: vi.fn(),
    reportCaughtError: vi.fn(),
    signalRef: { current: null as AbortSignal | null },
  }));

vi.mock("../useAuth", () => ({
  useAuth: () => useAuthState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock },
}));

vi.mock("@/lib/errorReporter", () => ({ reportCaughtError }));

import { useAdminAuth, ROLE_CHECK_TIMEOUT_MS } from "../useAdminAuth";

function stubBuilder() {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.abortSignal = (signal: AbortSignal) => {
    signalRef.current = signal;
    return builder;
  };
  builder.maybeSingle = () => maybeSingle();
  fromMock.mockReturnValue(builder);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  maybeSingle.mockReset();
  fromMock.mockReset();
  reportCaughtError.mockReset();
  signalRef.current = null;
  useAuthState.user = null;
  useAuthState.loading = false;
  vi.spyOn(console, "error").mockRestore();
});

describe("useAdminAuth role check", () => {
  it("resolves as admin when the role row exists", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    useAuthState.user = { id: "admin-1" };
    stubBuilder();
    maybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });

    const { result } = renderHook(() => useAdminAuth());
    await act(async () => {});

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("stops loading and reports when the role query stalls past the timeout", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    useAuthState.user = { id: "admin-1" };
    stubBuilder();
    // A stalled request: settles only when the abort signal fires.
    maybeSingle.mockImplementation(
      () =>
        new Promise((_, reject) => {
          signalRef.current?.addEventListener("abort", () =>
            reject(new Error("AbortError: signal aborted")),
          );
        }),
    );

    const { result } = renderHook(() => useAdminAuth());
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(ROLE_CHECK_TIMEOUT_MS);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(reportCaughtError).toHaveBeenCalledTimes(1);
    expect(reportCaughtError.mock.calls[0][1]).toBe("auth:roleCheckTimeout");
  });

  it("does not query at all when signed out", async () => {
    vi.useFakeTimers();
    useAuthState.user = null;
    stubBuilder();

    const { result } = renderHook(() => useAdminAuth());
    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
