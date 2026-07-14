import { describe, expect, it } from "vitest";
import {
  buildWebVitalEvent,
  getDeviceClass,
  isMarketSegment,
  normalizeRumRoute,
} from "../webVitalsRum";
import { marketSegmentForCountry } from "../../../functions/_lib/rum-context";

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
      sample_rate: 1,
    });
  });
});
