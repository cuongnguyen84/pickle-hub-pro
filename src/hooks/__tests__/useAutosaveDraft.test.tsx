// @vitest-environment jsdom
// UX-04 contract tests: round-trip save/restore, fail-loud on quota, clear.

import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAutosaveDraft, readDraft } from "../useAutosaveDraft";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const KEY = "draft:test:new";

describe("useAutosaveDraft", () => {
  it("debounce-saves and restores the payload on next mount (round-trip)", () => {
    vi.useFakeTimers();
    const first = renderHook(
      ({ value }) => useAutosaveDraft({ key: KEY, value, enabled: true }),
      { initialProps: { value: { title: "Giao lưu thứ 7", step: 2 } } },
    );
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(first.result.current.lastSavedAt).not.toBeNull();
    expect(readDraft<{ title: string }>(KEY)?.data.title).toBe("Giao lưu thứ 7");
    first.unmount();

    // Second mount (the organizer comes back): initial carries the draft.
    const second = renderHook(() =>
      useAutosaveDraft({ key: KEY, value: { title: "", step: 1 }, enabled: false }),
    );
    expect(second.result.current.initial).toEqual({ title: "Giao lưu thứ 7", step: 2 });
  });

  it("does not write when disabled (pristine form must not create a draft)", () => {
    vi.useFakeTimers();
    renderHook(() => useAutosaveDraft({ key: KEY, value: { a: 1 }, enabled: false }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("fail-loud: a setItem throw surfaces as saveFailed, never a green chip", () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const { result } = renderHook(() =>
      useAutosaveDraft({ key: KEY, value: { a: 1 }, enabled: true }),
    );
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.saveFailed).toBe(true);
    expect(result.current.lastSavedAt).toBeNull();
  });

  it("clear() removes the draft and stops subsequent debounced writes", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useAutosaveDraft({ key: KEY, value: { a: 1 }, enabled: true }),
    );
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(localStorage.getItem(KEY)).not.toBeNull();
    act(() => {
      result.current.clear();
    });
    expect(localStorage.getItem(KEY)).toBeNull();
    // A pending debounce after clear must not resurrect the draft (the
    // publish → clear → stray-timer race).
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("ignores an envelope from a different schema version", () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 999, savedAt: 1, data: { a: 1 } }));
    const { result } = renderHook(() =>
      useAutosaveDraft({ key: KEY, value: { a: 0 }, enabled: false }),
    );
    expect(result.current.initial).toBeNull();
  });
});
