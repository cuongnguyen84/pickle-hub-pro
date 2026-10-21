/**
 * The three claims the order screens make about a number.
 *
 * `shippingLabel` is here because "0₫" and "—" both shipped in the prototype
 * and both mean something the shop did not say: one invents a charge, the
 * other invents an unknown. `telHref` is here because the href is built from
 * text a buyer typed, so the ONE thing it must never do is produce a link for
 * something that is not a phone number.
 */
import { describe, expect, it } from "vitest";
import { cartLineProblem, formatWhen, optionSummary, shippingLabel, telHref } from "../orderFormat";
import { formatVnd } from "../publicCatalog";

describe("shippingLabel", () => {
  it("says free rather than zero", () => {
    expect(shippingLabel(0)).toBe("Miễn phí");
  });

  it("formats a real fee the same way every other price is formatted", () => {
    expect(shippingLabel(30000)).toBe(formatVnd(30000));
    expect(shippingLabel(30000)).toBe("30.000₫");
  });

  it("never renders the two banned values", () => {
    for (const fee of [0, 1, 1000, 30000, 1_500_000]) {
      const out = shippingLabel(fee);
      expect(out).not.toBe("0₫");
      expect(out).not.toBe("—");
    }
  });
});

describe("telHref", () => {
  it("links a local 10-digit number", () => {
    expect(telHref("0912345678")).toBe("tel:0912345678");
  });

  it("refuses anything the order table would refuse", () => {
    expect(telHref("+84912345678")).toBeNull();
    expect(telHref("091234567")).toBeNull();
    expect(telHref("09123456789")).toBeNull();
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref(undefined)).toBeNull();
    expect(telHref("0912 345 678")).toBeNull();
    expect(telHref("gọi em nhé")).toBeNull();
  });

  it("tolerates the spaces a paste leaves around a good number", () => {
    expect(telHref("  0912345678 ")).toBe("tel:0912345678");
  });
});

describe("formatWhen", () => {
  it("is dd/MM HH:mm and nothing longer", () => {
    expect(formatWhen("2026-08-18T09:05:00")).toBe("18/08 09:05");
  });

  it("answers empty for a missing or unusable timestamp", () => {
    expect(formatWhen(null)).toBe("");
    expect(formatWhen("")).toBe("");
    expect(formatWhen("not a date")).toBe("");
  });
});

describe("optionSummary", () => {
  it("joins the option map in a stable order", () => {
    expect(optionSummary({ "Cỡ cán": "4", "Màu": "Đen" })).toBe("Cỡ cán: 4 · Màu: Đen");
  });

  it("is empty when there are no options", () => {
    expect(optionSummary(null)).toBe("");
    expect(optionSummary({})).toBe("");
  });
});

describe("cartLineProblem", () => {
  const line = (over: Partial<Parameters<typeof cartLineProblem>[0]> = {}) => ({
    qty: 1,
    stock_on_hand: 5,
    unavailable_reason: null as string | null,
    ...over,
  });

  it("says nothing about a line that can be bought", () => {
    expect(cartLineProblem(line())).toBeNull();
  });

  it("says how many are left when the shop has SOME, just not eight", () => {
    expect(
      cartLineProblem(line({ qty: 8, stock_on_hand: 4, unavailable_reason: "out_of_stock" })),
    ).toBe("Chỉ còn 4 cái. Giảm số lượng để đặt tiếp.");
  });

  it("only says sold out when the count really is zero", () => {
    expect(
      cartLineProblem(line({ qty: 1, stock_on_hand: 0, unavailable_reason: "out_of_stock" })),
    ).toContain("vừa hết hàng");
  });

  it("does not claim a count the shop does not keep", () => {
    // stock_on_hand NULL = this shop does not count this variant. There is no
    // number to print, so the generic sentence is the honest one.
    expect(
      cartLineProblem(line({ qty: 3, stock_on_hand: null, unavailable_reason: "out_of_stock" })),
    ).toContain("vừa hết hàng");
  });

  it("keeps the other two reasons distinct", () => {
    const retired = cartLineProblem(line({ unavailable_reason: "variant_retired" }));
    const gone = cartLineProblem(line({ unavailable_reason: "product_unavailable" }));
    expect(retired).toContain("ngừng bán");
    expect(gone).toContain("gỡ sản phẩm");
    expect(retired).not.toBe(gone);
  });

  it("leaves the group-level reasons to the group notice", () => {
    expect(cartLineProblem(line({ unavailable_reason: "shop_inactive" }))).toBeNull();
    expect(cartLineProblem(line({ unavailable_reason: "ordering_disabled" }))).toBeNull();
  });
});
