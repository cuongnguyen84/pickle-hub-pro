// @vitest-environment jsdom
// Regression for the 2026-11-09 /vi homepage incident: a stored session whose
// refresh token was expired/revoked made supabase-js fire SIGNED_OUT while the
// homepage queries were in flight. AuthProvider answered with
// queryClient.clear(), which removed those queries from the cache under their
// still-mounted observers — the responses landed (HTTP 200) on orphaned
// queries and the page sat on its skeletons forever.

import { describe, it, expect, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

const { onAuthStateChange } = vi.hoisted(() => ({ onAuthStateChange: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: () => new Promise(() => {}), onAuthStateChange } },
}));
vi.mock("@/lib/errorReporter", () => ({ reportCaughtError: vi.fn() }));
vi.mock("@/lib/pwa/cache", () => ({ purgeAuthSensitiveCaches: vi.fn() }));
vi.mock("@/utils/ga", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/auth-config", () => ({
  getEmailVerificationRedirectUrl: () => "https://example.test/verify",
}));

import { AuthProvider } from "../useAuth";

function Probe({ queryFn }: { queryFn: () => Promise<string> }) {
  const q = useQuery({ queryKey: ["home"], queryFn });
  return <div>{q.isLoading ? "loading" : `data:${q.data}`}</div>;
}

describe("AuthProvider SIGNED_OUT with in-flight queries", () => {
  it("does not strand mounted queries on loading", async () => {
    let emit: (event: string, session: null) => void = () => {};
    onAuthStateChange.mockImplementation((cb) => {
      emit = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const resolvers: Array<(v: string) => void> = [];
    const queryFn = () => new Promise<string>((r) => resolvers.push(r));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Probe queryFn={queryFn} />
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("loading")).toBeTruthy();

    act(() => emit("SIGNED_OUT", null));
    // Settle every fetch that was started, before and after the sign-out.
    await act(async () => {
      resolvers.forEach((r) => r("rows"));
    });

    await waitFor(() => expect(screen.getByText("data:rows")).toBeTruthy());
  });
});
