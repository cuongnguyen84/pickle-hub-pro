// @vitest-environment jsdom
// Merge-gate from the livestream-gate-hardening panel (D1): this hook is
// shared by video AND livestream. Plain video pages pass active: true and
// MUST keep counting exactly as before; an inactive (gated/paused) livestream
// tab must accumulate nothing. Toggling active must not reset the interval.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const invokeMock = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

import { useIntervalViewCounter } from "../useIntervalViewCounter";

beforeEach(() => {
  invokeMock.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIntervalViewCounter", () => {
  it("video with active: true still counts (regression guard for shared hook)", async () => {
    renderHook(() =>
      useIntervalViewCounter({ targetType: "video", targetId: "v1", active: true }),
    );

    // 2 ticks (30s each) + 1 flush (60s)
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledWith("batch-view-events", {
      body: {
        events: [
          { target_type: "video", target_id: "v1" },
          { target_type: "video", target_id: "v1" },
        ],
      },
    });
  });

  it("accumulates nothing while inactive (gated/paused livestream)", async () => {
    renderHook(() =>
      useIntervalViewCounter({ targetType: "livestream", targetId: "l1", active: false }),
    );

    await act(async () => {
      vi.advanceTimersByTime(120_000);
      await Promise.resolve();
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("resumes counting when active flips true without resetting the interval", async () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useIntervalViewCounter({ targetType: "livestream", targetId: "l1", active }),
      { initialProps: { active: false } },
    );

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(invokeMock).not.toHaveBeenCalled();

    rerender({ active: true });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const batch = invokeMock.mock.calls[0][1] as { body: { events: unknown[] } };
    expect(batch.body.events.length).toBe(2);
  });
});
