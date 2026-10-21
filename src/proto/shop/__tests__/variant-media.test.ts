// B04 regression net — a variant must point at the right photo.
//
// The bug this pins: `mediaIndex` existed on every fixture variant and the
// product page ignored it, so picking "Đen" left the white shoe on screen
// while the SKU, price and stock all switched. A buyer who trusts the photo
// over the label orders the wrong colour.
//
// The mapping is keyed on the PARTIAL selection on purpose — picking a colour
// before a size must move the gallery immediately.

import { describe, expect, it } from "vitest";
import { mediaIndexFor } from "../components/Commerce";
import { PRODUCTS, productById } from "../fixtures";

describe("variant → media mapping", () => {
  const shoes = productById("p-2"); // Màu × Size, two photos

  it("every variant points at a photo that exists", () => {
    const broken = PRODUCTS.flatMap((p) =>
      p.variants
        .filter((v) => p.media.length > 0 && v.mediaIndex >= p.media.length)
        .map((v) => `${p.id}/${v.sku} → media[${v.mediaIndex}] of ${p.media.length}`),
    );
    expect(broken).toEqual([]);
  });

  it("picking a colour alone already switches the photo", () => {
    expect(mediaIndexFor(shoes, ["Trắng", null])).toBe(0);
    expect(mediaIndexFor(shoes, ["Đen", null])).toBe(1);
  });

  it("keeps the colour's photo once a size is added", () => {
    for (const size of ["39", "40", "41"]) {
      expect(mediaIndexFor(shoes, ["Trắng", size])).toBe(0);
      expect(mediaIndexFor(shoes, ["Đen", size])).toBe(1);
    }
  });

  it("size alone does not change the photo", () => {
    expect(mediaIndexFor(shoes, [null, "41"])).toBe(mediaIndexFor(shoes, [null, "39"]));
  });

  it("falls back to the first photo with nothing selected", () => {
    expect(mediaIndexFor(shoes, [null, null])).toBe(0);
  });

  it("single-variant products always resolve to their first photo", () => {
    const paddle = productById("p-1");
    expect(paddle.optionNames).toHaveLength(0);
    expect(mediaIndexFor(paddle, [])).toBe(0);
  });

  it("two colours of the same product do not share a photo", () => {
    // If they did, the mapping would be decorative rather than load-bearing.
    expect(mediaIndexFor(shoes, ["Trắng", null])).not.toBe(mediaIndexFor(shoes, ["Đen", null]));
  });

  it("SKU, price and stock move with the same selection the photo does", () => {
    // The four must agree; the photo drifting from the other three is the bug.
    const white41 = shoes.variants.find((v) => v.values.join("/") === "Trắng/41")!;
    const black39 = shoes.variants.find((v) => v.values.join("/") === "Đen/39")!;
    expect(white41.mediaIndex).toBe(mediaIndexFor(shoes, ["Trắng", "41"]));
    expect(black39.mediaIndex).toBe(mediaIndexFor(shoes, ["Đen", "39"]));
    expect(white41.sku).not.toBe(black39.sku);
    expect(white41.priceVnd).not.toBe(black39.priceVnd);
  });
});
