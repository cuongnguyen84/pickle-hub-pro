import type { Metric } from "web-vitals";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWebVitalEvent,
  getDeviceClass,
  initWebVitalsRum,
  isMarketSegment,
  normalizeRumRoute,
} from "../webVitalsRum";
import { marketSegmentForCountry } from "../../../functions/_lib/rum-context";

const rumMocks = vi.hoisted(() => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("@/utils/ga", () => ({
  trackEvent: rumMocks.trackEvent,
}));

vi.mock("web-vitals/attribution", () => ({
  onCLS: rumMocks.onCLS,
  onFCP: rumMocks.onFCP,
  onINP: rumMocks.onINP,
  onLCP: rumMocks.onLCP,
  onTTFB: rumMocks.onTTFB,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("normalizeRumRoute", () => {
  it.each([
    ["/", "/"],
    ["/vi", "/"],
    ["/social/beijing-open", "/social/:id"],
    ["/vi/social/beijing-open/live", "/social/:id/live"],
    ["/dang-ky/550e8400-e29b-41d4-a716-446655440000", "/dang-ky/:id"],
    [
      "/clb/my-club/quan-ly/social/sunday-games/sua",
      "/clb/:id/quan-ly/social/:id/sua",
    ],
    ["/tools/team-match/new", "/tools/team-match/new"],
    ["/unrecognized-secret", "/:id"],
  ])("normalizes %s without leaking dynamic values", (input, expected) => {
    expect(normalizeRumRoute(input)).toBe(expected);
  });
});

describe("RUM dimensions", () => {
  it("uses stable viewport breakpoints", () => {
    expect(getDeviceClass(390)).toBe("mobile");
    expect(getDeviceClass(768)).toBe("tablet");
    expect(getDeviceClass(1024)).toBe("desktop");
  });

  it("accepts only the three market buckets", () => {
    expect(isMarketSegment("vn")).toBe(true);
    expect(isMarketSegment("international")).toBe(true);
    expect(isMarketSegment("unknown")).toBe(true);
    expect(isMarketSegment("VN")).toBe(false);
    expect(isMarketSegment(null)).toBe(false);
  });

  it("keeps Vietnam, international, and unknown traffic separate", () => {
    expect(marketSegmentForCountry("VN")).toBe("vn");
    expect(marketSegmentForCountry("vn")).toBe("vn");
    expect(marketSegmentForCountry("SG")).toBe("international");
    expect(marketSegmentForCountry(null)).toBe("unknown");
  });

  it("builds a route-, device-, and market-segmented GA4 event", () => {
    const event = buildWebVitalEvent(
      {
        delta: 0.10123,
        id: "v5-test",
        name: "CLS",
        navigationType: "navigate",
        rating: "poor",
        value: 0.10123,
      },
      {
        appSurface: "web",
        deviceClass: "mobile",
        locale: "vi",
        route: "/social/:id",
      },
      "vn",
    );

    expect(event).toMatchObject({
      value: 101,
      metric_value: 0.1012,
      metric_name: "CLS",
      metric_rating: "poor",
      route: "/social/:id",
      device_class: "mobile",
      market_segment: "vn",
      auth_state: "anonymous",
      sample_rate: 1,
    });
  });

  it("segments auth_state from the supabase token in storage (INC0)", () => {
    // Node test env has no localStorage — stub the minimal surface getAuthState reads.
    const store = ["sb-ajvlcamxemgbxduhiqrl-auth-token"];
    vi.stubGlobal("localStorage", {
      length: store.length,
      key: (i: number) => store[i] ?? null,
    });
    try {
      const event = buildWebVitalEvent(
        {
          delta: 0.1,
          id: "v5-auth",
          name: "CLS",
          navigationType: "navigate",
          rating: "poor",
          value: 0.1,
        },
        { appSurface: "web", deviceClass: "mobile", locale: "vi", route: "/live/:id" },
        "vn",
      );
      expect(event.auth_state).toBe("authenticated");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("attaches CLS shift attribution when provided", () => {
    const event = buildWebVitalEvent(
      {
        delta: 0.2,
        id: "v5-cls-attr",
        name: "CLS",
        navigationType: "navigate",
        rating: "poor",
        value: 0.2,
      },
      {
        appSurface: "web",
        deviceClass: "mobile",
        locale: "vi",
        route: "/feed",
      },
      "vn",
      { largestShiftTarget: "main#app>div.feed>article", loadState: "dom-interactive" },
    );

    expect(event).toMatchObject({
      metric_name: "CLS",
      cls_shift_target: "main#app>div.feed>article",
      cls_load_state: "dom-interactive",
    });
  });

  it("omits shift attribution for non-CLS metrics", () => {
    const event = buildWebVitalEvent(
      {
        delta: 10,
        id: "v5-lcp-attr",
        name: "LCP",
        navigationType: "navigate",
        rating: "good",
        value: 1200,
      },
      {
        appSurface: "web",
        deviceClass: "desktop",
        locale: "en",
        route: "/",
      },
      "international",
      { largestShiftTarget: "img.hero", loadState: "complete" },
    );

    expect(event).not.toHaveProperty("cls_shift_target");
    expect(event).not.toHaveProperty("cls_load_state");
  });

  it("initializes all observers and reports a cached market segment", async () => {
    vi.stubEnv("DEV", false);

    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      callback({
        didTimeout: false,
        timeRemaining: () => 50,
      });
      return 1;
    });
    const sessionStorage = {
      getItem: vi.fn((key: string) =>
        key === "rum_market_segment_v1" ? "vn" : null,
      ),
      setItem: vi.fn(),
    };

    vi.stubGlobal("window", {
      gtag: vi.fn(),
      innerWidth: 390,
      location: { pathname: "/vi/social/beijing-open" },
      requestIdleCallback,
    });
    vi.stubGlobal("navigator", { webdriver: false });
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null) });
    vi.stubGlobal("sessionStorage", sessionStorage);

    initWebVitalsRum();

    await vi.waitFor(() => expect(rumMocks.onLCP).toHaveBeenCalledOnce());
    expect(requestIdleCallback).toHaveBeenCalledOnce();
    expect(rumMocks.onCLS).toHaveBeenCalledOnce();
    expect(rumMocks.onFCP).toHaveBeenCalledOnce();
    expect(rumMocks.onINP).toHaveBeenCalledOnce();
    expect(rumMocks.onTTFB).toHaveBeenCalledOnce();

    const report = rumMocks.onLCP.mock.calls[0][0] as (metric: Metric) => void;
    report({
      delta: 123.456,
      id: "v5-runtime",
      name: "LCP",
      navigationType: "navigate",
      rating: "good",
      value: 1234.56,
    } as Metric);

    await vi.waitFor(() => expect(rumMocks.trackEvent).toHaveBeenCalledOnce());
    expect(rumMocks.trackEvent).toHaveBeenCalledWith(
      "web_vital",
      expect.objectContaining({
        app_surface: "web",
        device_class: "mobile",
        locale: "vi",
        market_segment: "vn",
        metric_name: "LCP",
        metric_value: 1234.56,
        route: "/social/:id",
        value: 1235,
      }),
    );

    initWebVitalsRum();
    expect(requestIdleCallback).toHaveBeenCalledOnce();
  });
});
