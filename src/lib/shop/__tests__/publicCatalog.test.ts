// Everything a buyer reads on a card is a claim they act on. These are the
// branches worth pinning: the ones where an optimistic reading would be a lie.

import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_LABEL,
  CARD_ASPECT,
  availabilityLabel,
  catalogMood,
  formatVnd,
  isSoldOut,
  mediaBox,
  priceLabel,
  publicMediaUrl,
} from "../publicCatalog";

describe("price", () => {
  it("formats VND as an integer currency", () => {
    expect(formatVnd(1500000)).toBe("1.500.000₫");
  });

  it("collapses a range when both ends agree", () => {
    // "1.500.000₫ – 1.500.000₫" reads as a bug.
    expect(priceLabel({ price_min: 1500000, price_max: 1500000 })).toBe("1.500.000₫");
  });

  it("shows a real range when variants differ", () => {
    expect(priceLabel({ price_min: 900000, price_max: 2100000 })).toBe("900.000₫ – 2.100.000₫");
  });

  it("returns null rather than 0₫ when the server quoted nothing", () => {
    // A product with no live variant has no price. Rendering 0₫ would be a
    // price nobody set.
    expect(priceLabel({ price_min: null, price_max: null })).toBeNull();
    expect(priceLabel({ price_min: 1000, price_max: null })).toBeNull();
  });
});

describe("availability", () => {
  it("never dresses `unknown` up as in stock or sold out", () => {
    // stock_on_hand IS NULL means the seller did not count. Saying "còn hàng"
    // would be a promise nobody made, and "hết hàng" would cost them a sale.
    expect(availabilityLabel("unknown")).toBe(AVAILABILITY_LABEL.unknown);
    expect(availabilityLabel("unknown")).not.toBe(AVAILABILITY_LABEL.in_stock);
    expect(availabilityLabel("unknown")).not.toBe(AVAILABILITY_LABEL.out_of_stock);
    expect(isSoldOut("unknown")).toBe(false);
  });

  it("treats a missing label as unknown, not as available", () => {
    expect(availabilityLabel(null)).toBe(AVAILABILITY_LABEL.unknown);
    expect(isSoldOut(null)).toBe(false);
  });

  it("marks only an explicit out_of_stock as sold out", () => {
    expect(isSoldOut("out_of_stock")).toBe(true);
    expect(isSoldOut("in_stock")).toBe(false);
  });
});

describe("publicMediaUrl", () => {
  it("builds a public-bucket URL from a bucket key", () => {
    expect(publicMediaUrl("https://x.supabase.co", "shop/prod/img-v1.webp")).toBe(
      "https://x.supabase.co/storage/v1/object/public/shop-product-media/shop/prod/img-v1.webp",
    );
  });

  it("refuses anything that is not a bucket key", () => {
    // P2b.3 made the draft path seller-only in the projection. If a future
    // change starts handing a signed URL or an absolute link to a buyer
    // surface, it fails here rather than in someone's browser.
    expect(() => publicMediaUrl("https://x", "https://evil.example/x.webp")).toThrow();
    expect(() => publicMediaUrl("https://x", "shop/a.webp?token=abc")).toThrow();
    expect(() => publicMediaUrl("https://x", "/object/sign/shop/a.webp")).toThrow();
  });
});

describe("mediaBox", () => {
  it("uses the real ratio when the server recorded dimensions", () => {
    expect(mediaBox(1000, 500, 400)).toEqual({ width: 400, height: 200 });
  });

  it("falls back to the card ratio so the grid still reserves space", () => {
    // Reserving the wrong box is bad; reserving none is worse — that is the
    // layout shift.
    expect(mediaBox(null, null, 400)).toEqual({ width: 400, height: Math.round(400 / CARD_ASPECT) });
    expect(mediaBox(1000, null, 400).height).toBeGreaterThan(0);
  });
});

describe("catalogMood", () => {
  it("separates 'empty' from 'small but real'", () => {
    // The pilot catalogue IS small. Saying so beats padding the page, and it
    // is a different message from "nothing matched".
    expect(catalogMood(0)).toBe("empty");
    expect(catalogMood(3)).toBe("sparse");
    expect(catalogMood(11)).toBe("sparse");
    expect(catalogMood(12)).toBe("normal");
  });
});
