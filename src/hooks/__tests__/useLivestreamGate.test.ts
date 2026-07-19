// @vitest-environment jsdom
// Gate contract: preview budget survives reloads (no fresh 15s on refresh),
// keys are namespaced per surface (home hero must not burn the watch page's
// budget), and corrupted storage can never over-lock the gate.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLivestreamGate } from "../useLivestreamGate";

const ID = "stream-1";

function options(overrides: Partial<Parameters<typeof useLivestreamGate>[0]> = {}) {
  return {
    livestreamId: ID,
    surface: "watch" as const,
    previewSeconds: 15,
    isEnabled: true,
    isAuthenticated: false,
    isPlaying: true,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLivestreamGate", () => {
  it("counts down while playing and gates at zero", () => {
    const { result } = renderHook(() => useLivestreamGate(options()));
    expect(result.current.secondsRemaining).toBe(15);

    act(() => vi.advanceTimersByTime(15_000));
    expect(result.current.isGated).toBe(true);
    expect(result.current.secondsRemaining).toBe(0);
    expect(localStorage.getItem(`pkl_preview_seen_watch_${ID}`)).toBe("1");
  });

  it("does not tick while paused", () => {
    const { result } = renderHook(() => useLivestreamGate(options({ isPlaying: false })));
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.isGated).toBe(false);
    expect(result.current.secondsRemaining).toBe(15);
  });

  it("reload at second 14 resumes with ~1s left, not a fresh 15s", () => {
    const first = renderHook(() => useLivestreamGate(options()));
    act(() => vi.advanceTimersByTime(14_000));
    expect(first.result.current.isGated).toBe(false);
    first.unmount();

    // "Reload": fresh hook instance, same storage.
    const second = renderHook(() => useLivestreamGate(options()));
    expect(second.result.current.secondsRemaining).toBe(1);
    act(() => vi.advanceTimersByTime(1_000));
    expect(second.result.current.isGated).toBe(true);
  });

  it("home surface consuming its budget does NOT gate the watch surface", () => {
    const home = renderHook(() => useLivestreamGate(options({ surface: "home" })));
    act(() => vi.advanceTimersByTime(15_000));
    expect(home.result.current.isGated).toBe(true);
    home.unmount();

    const watch = renderHook(() => useLivestreamGate(options({ surface: "watch" })));
    expect(watch.result.current.isGated).toBe(false);
    expect(watch.result.current.secondsRemaining).toBe(15);
  });

  it("never arms for authenticated or disabled viewers", () => {
    localStorage.setItem(`pkl_preview_seen_watch_${ID}`, "1");
    const authed = renderHook(() => useLivestreamGate(options({ isAuthenticated: true })));
    expect(authed.result.current.isGated).toBe(false);
    expect(authed.result.current.showCountdown).toBe(false);

    const disabled = renderHook(() => useLivestreamGate(options({ isEnabled: false })));
    expect(disabled.result.current.isGated).toBe(false);
  });

  it("clamps corrupted elapsed storage instead of over-locking", () => {
    localStorage.setItem(`pkl_preview_elapsed_watch_${ID}`, "not-a-number");
    const { result } = renderHook(() => useLivestreamGate(options()));
    expect(result.current.secondsRemaining).toBe(15);

    localStorage.setItem(`pkl_preview_elapsed_watch_${ID}`, "-5");
    const negative = renderHook(() => useLivestreamGate(options()));
    expect(negative.result.current.secondsRemaining).toBe(15);
  });

  it("reports sessionSeconds so gate-at-second-0 is observable", () => {
    localStorage.setItem(`pkl_preview_seen_watch_${ID}`, "1");
    const { result } = renderHook(() => useLivestreamGate(options()));
    expect(result.current.isGated).toBe(true);
    expect(result.current.sessionSeconds).toBe(0);
  });
});
