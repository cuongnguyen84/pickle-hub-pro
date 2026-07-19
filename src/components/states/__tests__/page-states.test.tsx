// @vitest-environment jsdom
// DS-04 contract tests for the canonical page states: a11y semantics on
// Loading, retry wiring on Error, and the OfflineBanner reacting to the
// browser's online/offline events.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { LoadingState, ErrorState, OfflineBanner } from "../PageStates";

// Real VI dictionary → assertions pin the actual user-facing copy.
vi.mock("@/i18n", async () => {
  const { vi: viDict } = await import("@/i18n/vi");
  return {
    useI18n: () => ({
      t: viDict,
      language: "vi",
      setLanguage: vi.fn(),
      setLanguageFromUrl: vi.fn(),
    }),
  };
});

afterEach(cleanup);

describe("LoadingState", () => {
  it("announces itself to screen readers (role=status + sr-only label)", () => {
    render(<LoadingState />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Đang tải");
  });

  it("fullScreen variant covers the viewport (auth/route boot, no chrome)", () => {
    render(<LoadingState fullScreen />);
    expect(screen.getByRole("status").className).toContain("min-h-screen");
  });
});

describe("ErrorState", () => {
  it("renders as an alert with the network-error copy and fires onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Lỗi kết nối");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when no handler is given", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("OfflineBanner", () => {
  it("is hidden while online, appears on offline, hides again on reconnect", () => {
    const onLine = vi.spyOn(window.navigator, "onLine", "get");
    onLine.mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();

    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status").textContent).toContain("Mất kết nối");

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).toBeNull();
    onLine.mockRestore();
  });
});
