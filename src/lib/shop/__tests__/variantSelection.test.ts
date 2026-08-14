// The PDP's selection rules. A bug here shows a buyer a price that belongs to
// a different variant, which is the worst thing this screen can do.

import { describe, expect, it } from "vitest";
import {
  activeMediaId,
  displayPrice,
  initialSelection,
  optionState,
  pickOption,
  resolveVariant,
  type OptionGroup,
  type PublicVariant,
} from "../variantSelection";

const GROUPS: OptionGroup[] = [
  { name: "Màu sắc", values: ["Trắng", "Đen"] },
  { name: "Kích cỡ", values: ["39", "40", "41"] },
];

const v = (
  id: string, colour: string, size: string, price: number,
  availability: PublicVariant["availability"] = "in_stock",
  media_id: string | null = null,
): PublicVariant => ({
  id, option_values: { "Màu sắc": colour, "Kích cỡ": size },
  option_key: `${colour}|${size}`, sku: `SKU-${id}`, price_vnd: price, availability, media_id,
});

// Trắng: 39, 40 (40 sold out) · Đen: 40, 41. There is no Trắng/41 at all —
// "does not exist" and "sold out" are different states and both are here.
const VARIANTS: PublicVariant[] = [
  v("a", "Trắng", "39", 1000000, "in_stock", "m-trang"),
  v("b", "Trắng", "40", 1000000, "out_of_stock", "m-trang"),
  v("c", "Đen", "40", 1200000, "in_stock", "m-den"),
  v("d", "Đen", "41", 1200000, "unknown", "m-den"),
];

describe("resolveVariant", () => {
  it("stays null while the selection is partial", () => {
    expect(resolveVariant(GROUPS, VARIANTS, { "Màu sắc": "Trắng" })).toBeNull();
  });

  it("resolves once every group is chosen", () => {
    expect(resolveVariant(GROUPS, VARIANTS, { "Màu sắc": "Đen", "Kích cỡ": "40" })?.id).toBe("c");
  });

  it("returns the single variant when a product has no options", () => {
    const only = [{ ...v("z", "", "", 500000), option_values: null, option_key: null }];
    expect(resolveVariant([], only, {})?.id).toBe("z");
  });
});

describe("optionState", () => {
  it("separates 'does not exist' from 'sold out'", () => {
    // Trắng/41 was never made; Trắng/40 exists and is sold out. Rendering
    // both the same way tells the buyer the wrong thing about the seller.
    expect(optionState(VARIANTS, { "Màu sắc": "Trắng" }, "Kích cỡ", "41"))
      .toEqual({ exists: false, available: false });
    expect(optionState(VARIANTS, { "Màu sắc": "Trắng" }, "Kích cỡ", "40"))
      .toEqual({ exists: true, available: false });
  });

  it("treats unknown stock as available", () => {
    // The seller did not give a number. Greying the option out would invent a
    // fact, and it would cost them a sale they could have made.
    expect(optionState(VARIANTS, { "Màu sắc": "Đen" }, "Kích cỡ", "41"))
      .toEqual({ exists: true, available: true });
  });

  it("judges a value against the OTHER options, not the whole catalogue", () => {
    // 41 exists in Đen but not in Trắng; the answer must depend on the colour
    // currently chosen.
    expect(optionState(VARIANTS, { "Màu sắc": "Đen" }, "Kích cỡ", "41").exists).toBe(true);
    expect(optionState(VARIANTS, { "Màu sắc": "Trắng" }, "Kích cỡ", "41").exists).toBe(false);
  });
});

describe("pickOption", () => {
  it("keeps the size when the new colour still has it", () => {
    const next = pickOption(GROUPS, VARIANTS, { "Màu sắc": "Trắng", "Kích cỡ": "40" }, "Màu sắc", "Đen");
    expect(next).toEqual({ "Màu sắc": "Đen", "Kích cỡ": "40" });
  });

  it("drops the size when the new colour does not have it", () => {
    // Đen/41 -> Trắng: Trắng has no 41, so the size is released rather than
    // leaving the buyer on a combination that does not exist.
    const next = pickOption(GROUPS, VARIANTS, { "Màu sắc": "Đen", "Kích cỡ": "41" }, "Màu sắc", "Trắng");
    expect(next).toEqual({ "Màu sắc": "Trắng" });
  });
});

describe("initialSelection", () => {
  it("opens on something buyable, not on a sold-out combination", () => {
    expect(initialSelection(GROUPS, VARIANTS)).toEqual({ "Màu sắc": "Trắng", "Kích cỡ": "39" });
  });

  it("still selects something when everything is sold out", () => {
    const allGone = VARIANTS.map((x) => ({ ...x, availability: "out_of_stock" as const }));
    expect(initialSelection(GROUPS, allGone)).toEqual({ "Màu sắc": "Trắng", "Kích cỡ": "39" });
  });
});

describe("displayPrice", () => {
  it("shows one price once a variant resolves", () => {
    const r = resolveVariant(GROUPS, VARIANTS, { "Màu sắc": "Đen", "Kích cỡ": "40" });
    expect(displayPrice(VARIANTS, { "Màu sắc": "Đen", "Kích cỡ": "40" }, r)).toEqual({ min: 1200000, max: 1200000 });
  });

  it("shows the range of what is still reachable while choosing", () => {
    expect(displayPrice(VARIANTS, {}, null)).toEqual({ min: 1000000, max: 1200000 });
    // Narrowed to Đen: the Trắng prices are no longer reachable and must not
    // appear in the range.
    expect(displayPrice(VARIANTS, { "Màu sắc": "Đen" }, null)).toEqual({ min: 1200000, max: 1200000 });
  });
});

describe("activeMediaId", () => {
  it("follows the chosen variant", () => {
    const r = resolveVariant(GROUPS, VARIANTS, { "Màu sắc": "Đen", "Kích cỡ": "40" });
    expect(activeMediaId(r, VARIANTS, { "Màu sắc": "Đen", "Kích cỡ": "40" }, "m-main")).toBe("m-den");
  });

  it("changes as soon as the colour does, before the size is picked", () => {
    // B04's rule: picking a colour changes the photo immediately.
    expect(activeMediaId(null, VARIANTS, { "Màu sắc": "Đen" }, "m-main")).toBe("m-den");
  });

  it("falls back to the main image rather than blanking the gallery", () => {
    const noMedia = VARIANTS.map((x) => ({ ...x, media_id: null }));
    expect(activeMediaId(null, noMedia, {}, "m-main")).toBe("m-main");
  });
});
