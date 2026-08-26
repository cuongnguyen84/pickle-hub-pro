/**
 * The product_update payload — and the two bugs that shaped it.
 *
 * **Bug 1.** product_update REFUSES a `_variant` payload for a product that has
 * an option matrix, because the matrix is the only place price and stock may be
 * edited. The form sent one anyway, from the hidden single-product fields, so
 * saving a multi-variant product ALWAYS failed: a seller could not change the
 * name of a product that had colours, and the error pointed them at a table
 * they had not touched. Fixed by skipping the variant when `multiVariant`.
 *
 * **Bug 2 — the one this file used to guarantee.** That guard was one case too
 * narrow. The simple price/stock inputs render only when `isNew`; on the EDIT
 * screen they do not exist, single variant or six. But `buildUpdatePayload` was
 * reached ONLY from the edit screen, and it sent `variant` whenever
 * `!multiVariant` — so every save of a single-variant product wrote
 * `draft.price_vnd`, seeded from the row at page load, unchangeable and
 * invisible, over whatever the matrix had just saved.
 *
 * A real seller lost a real price change to this twice on 2026-08-18: they set
 * 2 500 000 in the matrix, saved it, then pressed save/publish and got
 * 2 900 000 back. `products.version` climbed 5 → 18 while `price_vnd` never
 * moved — the signature of a write that keeps re-writing the same stale number.
 * The old test suite was green throughout, because it asserted that the
 * single-variant case SENDS the price. It was pinning the bug.
 *
 * So the contract is now flat: this payload is TEXT ONLY. Price and stock reach
 * the server through the matrix (product_variants_reconcile) or, for a brand
 * new product, through product_create. Never through here.
 */
import { describe, expect, it } from "vitest";
import { buildUpdatePayload } from "../productState";

const draft = {
  title: "  Giày pickleball Court Pro  ",
  description: "Mô tả sản phẩm.",
  category_slug: "giay",
  condition: "new" as const,
  // What the hidden single-product fields still hold on an existing product:
  // whatever they were seeded with at page load. This is what must not travel.
  price_vnd: "1290000",
  stock_on_hand: "3",
};

describe("the payload never carries money", () => {
  const payload = buildUpdatePayload(draft);

  it("sends no variant at all", () => {
    expect("variant" in payload).toBe(false);
  });

  it("sends no price and no stock anywhere in it, by any key, at any depth", () => {
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain("1290000");
    expect(serialised).not.toContain("price");
    expect(serialised).not.toContain("stock");
  });

  it("does not send an empty variant object either", () => {
    // `variant: {}` would still be a _variant payload to the RPC — a different
    // spelling of the same bug.
    expect((payload as { variant?: unknown }).variant).toBeUndefined();
  });

  it("ignores the price the draft is still holding, whatever it says", () => {
    // The draft keeps price_vnd because the CREATE screen needs it. Reaching
    // this function means the product already exists, so the number is stale
    // by construction — and a payload that carried it would overwrite the
    // matrix with it.
    // Gán ra biến trước: kiểm tra thuộc tính thừa của TypeScript chỉ áp cho
    // object literal viết thẳng vào lời gọi, mà ở đây điều cần dựng lại chính
    // là một draft MANG THEO giá — đúng thứ màn hình thật vẫn cầm.
    const stillHoldsAPrice = { ...draft, price_vnd: "2500000", stock_on_hand: "99" };
    const changed = buildUpdatePayload(stillHoldsAPrice);
    expect(JSON.stringify(changed)).not.toContain("2500000");
    expect(JSON.stringify(changed)).not.toContain("99");
    expect(changed).toEqual(payload);
  });
});

describe("the text half, which is all of it", () => {
  it("sends every text field the seller edited", () => {
    expect(buildUpdatePayload(draft).patch).toEqual({
      title: "Giày pickleball Court Pro",
      description: "Mô tả sản phẩm.",
      category_slug: "giay",
      condition: "new",
      // Luôn có mặt, kể cả rỗng: gửi thiếu khoá `specs` nghĩa là "đừng đụng
      // tới thông số", và người bán xoá hết thông số sẽ không xoá được gì.
      specs: {},
    });
  });

  it("trims the title but leaves the description as typed", () => {
    // A description is prose: trailing blank lines are the seller's choice.
    const withSpace = buildUpdatePayload({ ...draft, description: "Dòng 1\n\n" });
    expect(withSpace.patch.title).toBe("Giày pickleball Court Pro");
    expect(withSpace.patch.description).toBe("Dòng 1\n\n");
  });

  it("is pure: the same draft twice gives the same payload", () => {
    // A save retry must send exactly what the first attempt did.
    expect(buildUpdatePayload(draft)).toEqual(buildUpdatePayload(draft));
  });

  it("does not mutate the draft it was given", () => {
    const before = JSON.stringify(draft);
    buildUpdatePayload(draft);
    expect(JSON.stringify(draft)).toBe(before);
  });
});
