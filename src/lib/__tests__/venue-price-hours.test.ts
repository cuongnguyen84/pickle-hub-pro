import { describe, expect, it } from "vitest";
import {
  isVerifiedVenueSource,
  formatVnd,
  venuePriceRange,
  uniformWeekHours,
  formatHoursRange,
  VENUE_DETAIL_COLUMNS,
} from "@/lib/venues";

/**
 * PRICE-01 follow-up (2026-08-24).
 *
 * The first pass taught the BOT renderer the difference between a verified
 * price and a blanket default, and stopped there. The React page — the one an
 * actual visitor sees — was never touched, so:
 *
 *   - price was invisible to humans and visible only to Googlebot;
 *   - the default 06:00–24:00 rendered as seven identical unlabelled rows,
 *     indistinguishable from a checked figure.
 *
 * Caught by Cuong opening the page in a browser after the merge. These tests
 * pin the SPA to the same source contract the bot path already follows.
 */

describe("venue price/hours helpers", () => {
  it("treats only partner and manual as verified", () => {
    expect(isVerifiedVenueSource("partner")).toBe(true);
    expect(isVerifiedVenueSource("manual")).toBe(true);
    expect(isVerifiedVenueSource("default")).toBe(false);
    expect(isVerifiedVenueSource(null)).toBe(false);
  });

  it("formats VND with dot thousands separators, matching the bot renderer", () => {
    expect(formatVnd(80000)).toBe("80.000đ");
    expect(formatVnd(100000)).toBe("100.000đ");
    expect(formatVnd(1250000)).toBe("1.250.000đ");
  });

  it("collapses an equal min and max to a single figure", () => {
    expect(venuePriceRange(100000, 160000)).toBe("100.000đ–160.000đ");
    expect(venuePriceRange(120000, 120000)).toBe("120.000đ");
    expect(venuePriceRange(null, 160000)).toBeNull();
    expect(venuePriceRange(100000, null)).toBeNull();
  });

  it("returns a single week range only when all seven days agree", () => {
    const week = (r: string) =>
      Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, r]));

    expect(uniformWeekHours(week("05:00-22:00"))).toBe("05:00-22:00");
    expect(uniformWeekHours({ ...week("05:00-22:00"), sun: "08:00-20:00" })).toBeNull();
    expect(uniformWeekHours({ mon: "05:00-22:00" })).toBeNull();
    expect(uniformWeekHours(null)).toBeNull();
  });

  it("renders a full day as words rather than a clock range", () => {
    expect(formatHoursRange("00:00-24:00", "vi")).toBe("Mở cả ngày");
    expect(formatHoursRange("00:00-24:00", "en")).toBe("Open 24 hours");
    expect(formatHoursRange("06:00-22:00", "vi")).toBe("06:00-22:00");
  });

  it("selects the price columns — without them the page silently renders nothing", () => {
    // The regression was not in the display logic, it was that the query never
    // asked for the data. Assert the column list directly.
    for (const col of ["price_min_vnd", "price_max_vnd", "price_source", "hours_source"]) {
      expect(VENUE_DETAIL_COLUMNS).toContain(col);
    }
  });
});
