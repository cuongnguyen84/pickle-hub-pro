// @vitest-environment jsdom
// Covers the gate-signup attribution hook that was split out of useAuth so the
// RED auth surface stays untouched. Same <120s fresh-account heuristic and
// CTA-flag gating as useAuth's sign_up attribution — exercised here because the
// hook is otherwise never run by any other test (coverage + regression guard).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const completeJourneyMock = vi.fn();
vi.mock("@/lib/journeys", () => ({
  completeJourney: (...args: unknown[]) => completeJourneyMock(...args),
}));

// Capture the onAuthStateChange callback so tests can drive auth events.
let authCallback: ((event: string, session: unknown) => void) | null = null;
const unsubscribe = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe } } };
      },
    },
  },
}));

import {
  useLivestreamGateAttribution,
  markGateCtaClicked,
} from "../livestreamGateAttribution";

const freshUser = (provider?: string) => ({
  created_at: new Date().toISOString(),
  app_metadata: provider ? { provider } : {},
});

beforeEach(() => {
  completeJourneyMock.mockClear();
  sessionStorage.clear();
});

describe("useLivestreamGateAttribution", () => {
  it("markGateCtaClicked sets the attribution flag", () => {
    markGateCtaClicked();
    expect(sessionStorage.getItem("journey_livestream_gate_cta")).toBe("1");
  });

  it("ignores unrelated events, missing user, old accounts, and missing CTA flag; attributes exactly once", () => {
    const { unmount } = renderHook(() => useLivestreamGateAttribution());
    expect(authCallback).toBeTypeOf("function");
    const fire = (e: string, s: unknown) => authCallback!(e, s);

    // Not a sign-in event.
    markGateCtaClicked();
    fire("SIGNED_OUT", null);
    expect(completeJourneyMock).not.toHaveBeenCalled();

    // Sign-in but no created_at.
    fire("SIGNED_IN", { user: {} });
    expect(completeJourneyMock).not.toHaveBeenCalled();

    // Fresh sign-in but the CTA flag was never set (unrelated later signup).
    sessionStorage.clear();
    fire("SIGNED_IN", { user: freshUser() });
    expect(completeJourneyMock).not.toHaveBeenCalled();

    // Old account (>120s) with the flag present.
    markGateCtaClicked();
    fire("SIGNED_IN", {
      user: { created_at: new Date(Date.now() - 200_000).toISOString() },
    });
    expect(completeJourneyMock).not.toHaveBeenCalled();

    // Fresh account + flag → attributed, flag consumed.
    fire("INITIAL_SESSION", { user: freshUser() });
    expect(completeJourneyMock).toHaveBeenCalledTimes(1);
    expect(completeJourneyMock).toHaveBeenCalledWith(
      "livestream_gate",
      "livestream_gate_signup_completed",
      { method: "email", auth_state: "authenticated" },
    );
    expect(sessionStorage.getItem("journey_livestream_gate_cta")).toBeNull();

    // Module-level dedup: a second fresh sign-in does not re-attribute.
    markGateCtaClicked();
    fire("SIGNED_IN", { user: freshUser("google") });
    expect(completeJourneyMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
