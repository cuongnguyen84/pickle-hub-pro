// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installStaleShellGuard } from "../staleShell";

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("installStaleShellGuard", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("id lệch → SPA navigation kế tiếp reload, cooldown chặn lần 2", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("newid123")));
    const reload = vi.fn();
    installStaleShellGuard(reload);

    setVisibility("visible");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await new Promise((r) => setTimeout(r, 0)); // flush res.text() → stale=true

    history.pushState(null, "", "/live");
    expect(reload).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/live"); // URL cập nhật TRƯỚC reload

    history.pushState(null, "", "/feed");
    expect(reload).toHaveBeenCalledOnce(); // cooldown 5' chặn loop
  });

  it("fetch hỏng (offline/404) → fail open, không bao giờ reload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const reload = vi.fn();
    installStaleShellGuard(reload);

    setVisibility("visible");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));

    history.pushState(null, "", "/tournaments");
    expect(reload).not.toHaveBeenCalled();
  });
});
