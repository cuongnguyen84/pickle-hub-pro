// @vitest-environment jsdom
// Overlay contract: the signup CTA must hit Login's REAL query param
// (mode=signup — `tab=signup` was a live prod bug that opened the wrong tab),
// signup is the primary action, embed opens first-party in a new tab with a
// post-auth redirect, and the dialog is announced to AT.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

// The overlay reads useLocation() to carry the arriving query string into the
// post-login redirect, so every mount needs Router context. `at` lets a test
// simulate the URL Facebook actually sends viewers to.
const renderGate = (
  props: React.ComponentProps<typeof LivestreamGateOverlay>,
  at = `/live/${ID}`,
) =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <LivestreamGateOverlay {...props} />
    </MemoryRouter>,
  );

describe("LivestreamGateOverlay", () => {
  it("signup CTA uses mode=signup (the param Login.tsx actually reads) and a redirect back", () => {
    renderGate({ livestreamId: ID, surface: "watch" });
    const signup = screen.getByRole("link", { name: "Tạo tài khoản miễn phí" });
    const href = signup.getAttribute("href")!;
    expect(href).toContain("mode=signup");
    expect(href).not.toContain("tab=signup");
    expect(href).toContain(encodeURIComponent(`/live/${ID}`));
  });

  it("signup is the primary button; login is the secondary text link", () => {
    renderGate({ livestreamId: ID, surface: "watch" });
    const login = screen.getByRole("link", { name: "Đã có tài khoản? Đăng nhập" });
    expect(login.className).toContain("underline");
    expect(login.getAttribute("href")).not.toContain("mode=signup");
  });

  it("embed variant opens first-party in a new tab with source attribution", () => {
    renderGate({ livestreamId: ID, surface: "embed" });
    const signup = screen.getByRole("link", { name: "Tạo tài khoản miễn phí" });
    expect(signup.getAttribute("target")).toBe("_blank");
    expect(signup.getAttribute("rel")).toContain("noopener");
    expect(signup.getAttribute("href")).toContain("source=embed_live_gate");
    // Embed copy explains continuing on the first-party site.
    expect(screen.getByText("Xem tiếp trên ThePickleHub")).toBeTruthy();
  });

  // Regression: the gate used to hardcode `/live/<id>` as the post-login
  // destination, so a viewer arriving from a Facebook campaign link came back
  // from /login with no campaign params and GA4 filed the session under
  // "Unassigned". The redirect must carry the arriving query string.
  it("carries the arriving campaign query string into the post-login redirect", () => {
    const q = "?utm_source=facebook&utm_medium=social&fbclid=XYZ";
    renderGate({ livestreamId: ID, surface: "watch" }, `/live/${ID}${q}`);
    for (const name of ["Tạo tài khoản miễn phí", "Đã có tài khoản? Đăng nhập"]) {
      const href = screen.getByRole("link", { name }).getAttribute("href")!;
      expect(href).toContain(encodeURIComponent(`/live/${ID}${q}`));
    }
  });

  it("emits a bare path when there is no query string to carry", () => {
    renderGate({ livestreamId: ID, surface: "watch" });
    const href = screen.getByRole("link", { name: "Đã có tài khoản? Đăng nhập" }).getAttribute("href")!;
    expect(href).toContain(`redirect=${encodeURIComponent(`/live/${ID}`)}`);
    expect(href).not.toContain("%3F");
  });

  it("is an announced dialog with focus moved to the heading", () => {
    renderGate({ livestreamId: ID, surface: "watch" });
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("livestream-gate-heading");
    expect(document.activeElement?.id).toBe("livestream-gate-heading");
  });
});
