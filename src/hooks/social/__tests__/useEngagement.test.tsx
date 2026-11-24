// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { rpc, authState, toast } = vi.hoisted(() => ({
  rpc: vi.fn(),
  authState: { user: null as { id: string } | null },
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
  useAuthOptional: () => authState,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ language: "en" }),
}));

import { useEngagementCounts, useToggleTargetKudos } from "../useEngagement";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

afterEach(() => {
  cleanup();
  rpc.mockReset();
  toast.mockReset();
  authState.user = null;
});

describe("useEngagementCounts", () => {
  it("batches same-tick count requests for one type into a single RPC", async () => {
    rpc.mockResolvedValue({
      data: [
        { target_id: "id-a", kudos_count: 3, comment_count: 1, viewer_kudoed: false },
        { target_id: "id-b", kudos_count: 0, comment_count: 5, viewer_kudoed: true },
      ],
      error: null,
    });
    const { wrapper } = makeWrapper();
    const a = renderHook(() => useEngagementCounts("news", "id-a"), { wrapper });
    const b = renderHook(() => useEngagementCounts("news", "id-b"), { wrapper });

    await waitFor(() => expect(a.result.current.data?.kudos_count).toBe(3));
    await waitFor(() => expect(b.result.current.data?.comment_count).toBe(5));
    expect(b.result.current.data?.viewer_kudoed).toBe(true);

    const countCalls = rpc.mock.calls.filter(
      (c) => c[0] === "get_engagement_counts",
    );
    expect(countCalls).toHaveLength(1);
    expect(countCalls[0][1].p_target_type).toBe("news");
    expect(countCalls[0][1].p_target_ids).toEqual(
      expect.arrayContaining(["id-a", "id-b"]),
    );
  });

  it("returns zeros for a target with no engagement row", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEngagementCounts("blog", "id-x"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      kudos_count: 0,
      comment_count: 0,
      viewer_kudoed: false,
    });
  });

  it("propagates an RPC error to the query", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEngagementCounts("post", "id-e"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useToggleTargetKudos", () => {
  it("applies the server truth after a successful toggle", async () => {
    authState.user = { id: "user-1" };
    rpc.mockImplementation(async (name: string) => {
      if (name === "get_engagement_counts") {
        return {
          data: [
            { target_id: "id-a", kudos_count: 3, comment_count: 2, viewer_kudoed: false },
          ],
          error: null,
        };
      }
      return { data: { kudoed: true, count: 4 }, error: null };
    });
    const { wrapper, qc } = makeWrapper();
    const counts = renderHook(() => useEngagementCounts("news", "id-a"), {
      wrapper,
    });
    await waitFor(() => expect(counts.result.current.data?.kudos_count).toBe(3));

    const toggle = renderHook(() => useToggleTargetKudos("news"), { wrapper });
    await act(async () => {
      await toggle.result.current.mutateAsync("id-a");
    });

    const cached = qc.getQueryData<{
      kudos_count: number;
      comment_count: number;
      viewer_kudoed: boolean;
    }>(["engagement-counts", "news", "id-a", "user-1"]);
    expect(cached).toEqual({
      kudos_count: 4,
      comment_count: 2,
      viewer_kudoed: true,
    });
  });

  it("rejects and toasts when a guest tries to toggle", async () => {
    authState.user = null;
    const { wrapper } = makeWrapper();
    const toggle = renderHook(() => useToggleTargetKudos("news"), { wrapper });
    await act(async () => {
      await expect(
        toggle.result.current.mutateAsync("id-a"),
      ).rejects.toThrow("not_authenticated");
    });
    expect(toast).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith(
      "toggle_target_kudos",
      expect.anything(),
    );
  });
});
