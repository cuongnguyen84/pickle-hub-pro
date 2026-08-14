/**
 * The product_update payload — and the bug it was built to lock down.
 *
 * product_update REFUSES a `_variant` payload for a product that has an option
 * matrix, because the matrix is the only place price and stock may be edited.
 * The form sent one anyway, from the hidden single-product fields, so saving a
 * multi-variant product ALWAYS failed: a seller could not change the name of a
 * product that had colours, and the error pointed them at a table they had not
 * touched.
 *
 * Proven at the RPC before the fix — `22023: sản phẩm này có nhiều phiên bản`,
 * and the title unchanged. These assertions are the layer where the bug lived,
 * and the storage integration re-proves it end to end.
 */
import { describe, expect, it } from "vitest";
import { buildUpdatePayload } from "../productState";

const draft = {
  title: "  Giày pickleball Court Pro  ",
  description: "Mô tả sản phẩm.",
  category_slug: "giay",
  condition: "new" as const,
  // What the hidden single-product fields still hold on a multi-variant
  // product: whatever they were seeded with. This is what must not travel.
  price_vnd: "1290000",
  stock_on_hand: "3",
};

describe("multi-variant: the matrix is not touched", () => {
  const payload = buildUpdatePayload(draft, true);

  it("sends no variant at all", () => {
    expect(payload.variant).toBeUndefined();
    expect("variant" in payload).toBe(false);
  });

  it("sends no price and no stock anywhere in the payload", () => {
    // The strongest form of the assertion: the numbers are simply not there,
    // by any key, at any depth.
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain("1290000");
    expect(serialised).not.toContain("price_vnd");
    expect(serialised).not.toContain("stock_on_hand");
  });

  it("does not send an empty variant object either", () => {
    // `variant: {}` would still be a _variant payload to the RPC, and would
    // still be refused — a different spelling of the same bug.
    expect(payload.variant).not.toEqual({});
  });

  it("still sends every text field the seller edited", () => {
    expect(payload.patch).toEqual({
      title: "Giày pickleball Court Pro",
      description: "Mô tả sản phẩm.",
      category_slug: "giay",
      condition: "new",
    });
  });

  it("trims the title but leaves the description as typed", () => {
    // A description is prose: trailing blank lines are the seller's choice.
    const withSpace = buildUpdatePayload({ ...draft, description: "Dòng 1\n\n" }, true);
    expect(withSpace.patch.title).toBe("Giày pickleball Court Pro");
    expect(withSpace.patch.description).toBe("Dòng 1\n\n");
  });
});

describe("single-variant: the default variant still travels", () => {
  const payload = buildUpdatePayload(draft, false);

  it("sends the price and stock the seller typed", () => {
    expect(payload.variant).toEqual({ price_vnd: "1290000", stock_on_hand: "3" });
  });

  it("trims them, because a stray space is not a number", () => {
    const spaced = buildUpdatePayload({ ...draft, price_vnd: " 990000 ", stock_on_hand: " 5 " }, false);
    expect(spaced.variant).toEqual({ price_vnd: "990000", stock_on_hand: "5" });
  });

  it("keeps an empty stock empty rather than inventing a zero", () => {
    // "" means "not counted"; 0 means "sold out". Collapsing them would change
    // what the seller said.
    const untracked = buildUpdatePayload({ ...draft, stock_on_hand: "" }, false);
    expect(untracked.variant?.stock_on_hand).toBe("");
  });

  it("sends the same patch as the multi-variant case", () => {
    expect(payload.patch).toEqual(buildUpdatePayload(draft, true).patch);
  });
});

describe("switching modes changes only the variant half", () => {
  it("single → multi drops the variant and nothing else", () => {
    const single = buildUpdatePayload(draft, false);
    const multi = buildUpdatePayload(draft, true);
    expect(multi.patch).toEqual(single.patch);
    expect(single.variant).toBeDefined();
    expect(multi.variant).toBeUndefined();
  });

  it("multi → single restores it from what the form holds", () => {
    expect(buildUpdatePayload(draft, false).variant).toEqual({
      price_vnd: "1290000",
      stock_on_hand: "3",
    });
  });

  it("is pure: the same draft twice gives the same payload", () => {
    // A save retry must send exactly what the first attempt did.
    expect(buildUpdatePayload(draft, true)).toEqual(buildUpdatePayload(draft, true));
    expect(buildUpdatePayload(draft, false)).toEqual(buildUpdatePayload(draft, false));
  });

  it("does not mutate the draft it was given", () => {
    const before = JSON.stringify(draft);
    buildUpdatePayload(draft, true);
    buildUpdatePayload(draft, false);
    expect(JSON.stringify(draft)).toBe(before);
  });
});
