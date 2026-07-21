// BASE-02: journey lifecycle — the contract rules that matter are the
// dedup semantics (completion emits once per journey_id; steps cannot
// fire outside an active journey) and the shared-property envelope.

import { describe, it, expect, vi, beforeEach } from "vitest";

const trackEvent = vi.fn();
vi.mock("@/utils/ga", () => ({ trackEvent: (...a: unknown[]) => trackEvent(...a) }));
vi.mock("../webVitalsRum", () => ({
  getAppSurface: () => "web",
  getDeviceClass: () => "mobile",
  getLocale: () => "vi",
  normalizeRumRoute: (p: string) => p,
  resolveMarketSegment: async () => "vn",
}));

import { startJourney, startJourneyOnce, trackJourneyStep, completeJourney } from "../journeys";

function stubBrowserGlobals() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { pathname: "/social/test-event" }, innerWidth: 390 },
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("journeys", () => {
  beforeEach(() => {
    trackEvent.mockClear();
    stubBrowserGlobals();
  });

  it("steps are silently dropped when no journey is active", async () => {
    trackJourneyStep("player_registration", "player_registration_started");
    await flush();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("a started journey stamps every event with the same journey_id + envelope", async () => {
    const id = startJourney("player_registration");
    trackJourneyStep("player_registration", "player_registration_started", { price_type: "paid" });
    trackJourneyStep("player_registration", "player_registration_submit_attempted");
    await flush();

    expect(trackEvent).toHaveBeenCalledTimes(2);
    for (const [, props] of trackEvent.mock.calls) {
      expect(props).toMatchObject({
        journey_schema_version: 1,
        journey_id: id,
        source_route: "/social/test-event",
        locale: "vi",
        app_surface: "web",
        device_class: "mobile",
        market_segment: "vn",
      });
    }
    expect(trackEvent.mock.calls[0][1].price_type).toBe("paid");
  });

  it("completion emits exactly once per journey — reruns are no-ops", async () => {
    startJourney("player_registration");
    completeJourney("player_registration", "player_registration_completed");
    completeJourney("player_registration", "player_registration_completed"); // React rerun
    trackJourneyStep("player_registration", "player_registration_failed"); // stray refetch
    await flush();

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent.mock.calls[0][0]).toBe("player_registration_completed");
  });

  it("restarting mints a new journey_id (new intent denominator)", () => {
    const first = startJourney("organizer_event");
    const second = startJourney("organizer_event");
    expect(second).not.toBe(first);
  });

  it("journeys of different kinds do not interfere", async () => {
    startJourney("player_registration");
    completeJourney("organizer_event", "organizer_event_published"); // never started
    await flush();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  // Regression for the collision that shipped past Codex + CI: the QuickTable
  // flow used to reuse the `player_registration` kind, so it shared the
  // sessionStorage key with the Social Event modal. Two concurrent journeys of
  // those kinds must now hold INDEPENDENT ids — otherwise one flow's completion
  // clears the other's id and the D5 funnel blends two flows.
  it("player_registration and quicktable_registration keep independent ids", async () => {
    const social = startJourney("player_registration");
    const quicktable = startJourney("quicktable_registration");
    expect(quicktable).not.toBe(social);
    // Completing one must not disturb the other's active id.
    completeJourney("quicktable_registration", "registration_complete");
    trackEvent.mockClear();
    trackJourneyStep("player_registration", "player_registration_submit_attempted");
    await flush();
    // The social step still fires → its id survived the quicktable completion.
    expect(trackEvent).toHaveBeenCalled();
  });

  describe("startJourneyOnce", () => {
    it("reuses the active id instead of minting a new one", () => {
      const first = startJourneyOnce("quicktable_registration");
      const second = startJourneyOnce("quicktable_registration");
      expect(second).toBe(first);
    });

    it("mints a fresh id once the previous journey is stale", () => {
      vi.useFakeTimers();
      try {
        const first = startJourneyOnce("quicktable_registration");
        vi.advanceTimersByTime(61 * 60 * 1000); // past the 1h abandon window
        const second = startJourneyOnce("quicktable_registration");
        expect(second).not.toBe(first);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
