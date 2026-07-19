// @vitest-environment jsdom
// Overlay contract: the signup CTA must hit Login's REAL query param
// (mode=signup — `tab=signup` was a live prod bug that opened the wrong tab),
// signup is the primary action, embed opens first-party in a new tab with a
// post-auth redirect, and the dialog is announced to AT.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LivestreamGateOverlay } from "../LivestreamGateOverlay";

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

vi.mock("@/lib/journeys", () => ({
  startJourney: vi.fn(),
  trackJourneyStep: vi.fn(),
}));

// The overlay imports markGateCtaClicked from livestreamGateAttribution, which
// statically imports the supabase client — createClient throws without env in
// CI. Mock the client (repo convention; see useIntervalViewCounter.test.ts).
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

afterEach(cleanup);

const ID = "abc-123";

describe("LivestreamGateOverlay", () => {
  it("signup CTA uses mode=signup (the param Login.tsx actually reads) and a redirect back", () => {
    render(<LivestreamGateOverlay livestreamId={ID} surface="watch" />);
    const signup = screen.getByRole("link", { name: "Tạo tài khoản miễn phí" });
    const href = signup.getAttribute("href")!;
    expect(href).toContain("mode=signup");
    expect(href).not.toContain("tab=signup");
    expect(href).toContain(encodeURIComponent(`/live/${ID}`));
  });

  it("signup is the primary button; login is the secondary text link", () => {
    render(<LivestreamGateOverlay livestreamId={ID} surface="watch" />);
    const login = screen.getByRole("link", { name: "Đã có tài khoản? Đăng nhập" });
    expect(login.className).toContain("underline");
    expect(login.getAttribute("href")).not.toContain("mode=signup");
  });

  it("embed variant opens first-party in a new tab with source attribution", () => {
    render(<LivestreamGateOverlay livestreamId={ID} surface="embed" />);
    const signup = screen.getByRole("link", { name: "Tạo tài khoản miễn phí" });
    expect(signup.getAttribute("target")).toBe("_blank");
    expect(signup.getAttribute("rel")).toContain("noopener");
    expect(signup.getAttribute("href")).toContain("source=embed_live_gate");
    // Embed copy explains continuing on the first-party site.
    expect(screen.getByText("Xem tiếp trên ThePickleHub")).toBeTruthy();
  });

  it("is an announced dialog with focus moved to the heading", () => {
    render(<LivestreamGateOverlay livestreamId={ID} surface="watch" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("livestream-gate-heading");
    expect(document.activeElement?.id).toBe("livestream-gate-heading");
  });
});
