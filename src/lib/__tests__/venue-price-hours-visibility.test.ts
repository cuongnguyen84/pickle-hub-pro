import { describe, expect, it } from "vitest";
import { venuePriceHoursVisibility } from "@/lib/venues";

/**
 * 2026-08-25 site audit.
 *
 * #666 taught every row inside the "Price & opening hours" box to require a
 * verified source, but left the section itself gated on the raw values:
 *
 *   {(priceText || weekHours || hours.length > 0) && ( … <div className="rounded-md border"> … )}
 *
 * On a 'default'-source venue all three raw values are truthy and all three
 * children are false, so the page rendered the heading, an empty bordered div
 * — a stray 2px hairline — and then the disclaimer. 684 of 896 courts were in
 * that state, because price_source/hours_source is 'default' on every row the
 * Google Places import could not confirm.
 *
 * It passed review twice because nothing tested the gating: the PRICE-01 suite
 * is all pure helpers and never rendered the component. Hence this file, and
 * hence the decision living in a pure function.
 */
const DEFAULT_IMPORT_ROW = {
  priceText: "80.000đ–200.000đ",
  priceVerified: false,
  weekHours: "06:00-24:00",
  hoursVerified: false,
  dayRowCount: 0,
};

describe("venuePriceHoursVisibility", () => {
  it("renders no box for a default-source venue — the regression", () => {
    const v = venuePriceHoursVisibility(DEFAULT_IMPORT_ROW);
    expect(v.box).toBe(false);
    expect(v.priceRow).toBe(false);
    expect(v.weekHoursRow).toBeNull();
    expect(v.dayRows).toBe(false);
  });

  it("still shows the section and the disclaimer for that venue", () => {
    const v = venuePriceHoursVisibility(DEFAULT_IMPORT_ROW);
    // Dropping the box must not drop the sentence explaining why there is no
    // price — that sentence is the whole point of #666.
    expect(v.disclaimer).toBe(true);
    expect(v.section).toBe(true);
  });

  it("shows the price row and the box for a verified price", () => {
    const v = venuePriceHoursVisibility({
      ...DEFAULT_IMPORT_ROW,
      priceVerified: true,
    });
    expect(v.priceRow).toBe(true);
    expect(v.box).toBe(true);
    // A verified price is stated plainly, so the "no confirmed rate" sentence
    // would contradict the row directly above it.
    expect(v.disclaimer).toBe(false);
  });

  it("shows the uniform-week line only when hours are verified", () => {
    expect(venuePriceHoursVisibility(DEFAULT_IMPORT_ROW).weekHoursRow).toBeNull();
    expect(
      venuePriceHoursVisibility({ ...DEFAULT_IMPORT_ROW, hoursVerified: true })
        .weekHoursRow,
    ).toBe("06:00-24:00");
  });

  it("holds the per-day rows to the same source rule as the week line", () => {
    // A non-uniform week (uniformWeekHours returns null) on a 'default' source.
    // Before this change the per-day rows read hours_json directly and printed
    // unlabelled times — the claim #666 says it stopped making.
    const nonUniformDefault = {
      ...DEFAULT_IMPORT_ROW,
      weekHours: null,
      dayRowCount: 7,
    };
    expect(venuePriceHoursVisibility(nonUniformDefault).dayRows).toBe(false);
    expect(venuePriceHoursVisibility(nonUniformDefault).box).toBe(false);
    expect(
      venuePriceHoursVisibility({ ...nonUniformDefault, hoursVerified: true })
        .dayRows,
    ).toBe(true);
  });

  it("hides the whole section when the venue has no price and no hours", () => {
    const v = venuePriceHoursVisibility({
      priceText: null,
      priceVerified: false,
      weekHours: null,
      hoursVerified: false,
      dayRowCount: 0,
    });
    expect(v.section).toBe(false);
    expect(v.box).toBe(false);
    expect(v.disclaimer).toBe(false);
  });

  it("never renders a box with nothing in it", () => {
    for (const priceVerified of [true, false])
      for (const hoursVerified of [true, false])
        for (const priceText of ["100.000đ", null])
          for (const weekHours of ["06:00-22:00", null])
            for (const dayRowCount of [0, 7]) {
              const v = venuePriceHoursVisibility({
                priceText,
                priceVerified,
                weekHours,
                hoursVerified,
                dayRowCount,
              });
              if (v.box) {
                expect(
                  v.priceRow || v.weekHoursRow != null || v.dayRows,
                ).toBe(true);
              }
              // And the section never renders with neither box nor sentence.
              expect(v.section).toBe(v.box || v.disclaimer);
            }
  });
});
