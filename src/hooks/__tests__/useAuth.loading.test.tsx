// @vitest-environment jsdom
// Regression tests for the 2026-10-27 /admin skeleton incident:
// AuthProvider used to clear `loading` only when getSession() settled or
// an auth event fired, with no .catch and no timeout — a wedged
// getSession (auth lock held by another tab during a stalled refresh, a
// hung refresh request, a rejected promise) left every gated screen on
// its loading state forever.

import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { getSession, onAuthStateChange, reportCaughtError } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  reportCaughtError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession, onAuthStateChange } },
}));
vi.mock("@/lib/errorReporter", () => ({ reportCaughtError }));
vi.mock("@/lib/pwa/cache", () => ({ purgeAuthSensitiveCaches: vi.fn() }));
vi.mock("@/utils/ga", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/auth-config", () => ({
  getEmailVerificationRedirectUrl: () => "https://example.test/verify",
}));

import { AuthProvider, useAuth, AUTH_LOADING_TIMEOUT_MS } from "../useAuth";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  getSession.mockReset();
  onAuthStateChange.mockReset();
  reportCaughtError.mockReset();
});

function stubSilentAuthListener() {
  onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
}

describe("AuthProvider loading resolution", () => {
  it("forces loading off and reports when getSession never settles", async () => {
    vi.useFakeTimers();
    stubSilentAuthListener();
    getSession.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(AUTH_LOADING_TIMEOUT_MS);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(reportCaughtError).toHaveBeenCalledTimes(1);
    expect(reportCaughtError.mock.calls[0][1]).toBe("auth:loadingTimeout");
  });

  it("clears loading and reports when getSession rejects", async () => {
    vi.useFakeTimers();
    stubSilentAuthListener();
    getSession.mockRejectedValue(new Error("refresh token revoked"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(reportCaughtError).toHaveBeenCalledTimes(1);
    expect(reportCaughtError.mock.calls[0][1]).toBe("auth:getSession");
  });

  it("applies a resolved session without logging a timeout", async () => {
    vi.useFakeTimers();
    stubSilentAuthListener();
    const fakeUser = { id: "user-1", created_at: "2020-01-01T00:00:00Z" };
    getSession.mockResolvedValue({ data: { session: { user: fakeUser } } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.user?.id).toBe("user-1");

    await act(async () => {
      vi.advanceTimersByTime(AUTH_LOADING_TIMEOUT_MS + 1000);
    });
    expect(reportCaughtError).not.toHaveBeenCalled();
  });
});
