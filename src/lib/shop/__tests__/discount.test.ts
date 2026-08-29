import { describe, expect, it } from "vitest";
import {
  COMPARE_AT_NOT_ABOVE,
  compareAtError,
  discountPct,
  maxDiscountPct,
  parseCompareAt,
} from "../discount";

describe("discountPct — cùng công thức floor với shop_public_search", () => {
  it("780000 / 1000000 → 22", () => {
    expect(discountPct(780000, 1000000)).toBe(22);
  });
  it("làm tròn XUỐNG, không lên", () => {
    // 100 - 66.67 = 33.33 → 33
    expect(discountPct(2000000, 3000000)).toBe(33);
  });
  it("null khi không có giá gốc, bằng hoặc thấp hơn giá bán", () => {
    expect(discountPct(1000, null)).toBeNull();
    expect(discountPct(1000, undefined)).toBeNull();
    expect(discountPct(1000, 1000)).toBeNull();
    expect(discountPct(1000, 999)).toBeNull();
    expect(discountPct(0, 0)).toBeNull();
  });
  it("giảm chưa tới 1% → null, không bao giờ -0%", () => {
    expect(discountPct(1_999_999, 2_000_000)).toBeNull();
  });
});

describe("maxDiscountPct", () => {
  it("lấy % lớn nhất, bỏ qua phiên bản không giảm", () => {
    expect(
      maxDiscountPct([
        { price_vnd: 900000, compare_at_price_vnd: 1000000 },
        { price_vnd: 700000, compare_at_price_vnd: 1000000 },
        { price_vnd: 500000 },
      ]),
    ).toBe(30);
  });
  it("null khi chỉ có phiên bản giảm chưa tới 1%", () => {
    expect(maxDiscountPct([{ price_vnd: 1_999_999, compare_at_price_vnd: 2_000_000 }])).toBeNull();
  });
  it("null khi không phiên bản nào giảm", () => {
    expect(maxDiscountPct([{ price_vnd: 1 }, { price_vnd: 2, compare_at_price_vnd: null }])).toBeNull();
  });
});

describe("parseCompareAt", () => {
  it("rỗng là null, không phải lỗi", () => {
    expect(parseCompareAt("")).toEqual({ value: null, error: null });
    expect(parseCompareAt("   ")).toEqual({ value: null, error: null });
  });
  it("số nguyên", () => {
    expect(parseCompareAt(" 1500000 ")).toEqual({ value: 1500000, error: null });
  });
  it("không phải số / có dấu chấm", () => {
    expect(parseCompareAt("1.500.000").error).toBe("non_numeric");
    expect(parseCompareAt("abc").error).toBe("non_numeric");
    expect(parseCompareAt("-5").error).toBe("non_numeric");
  });
  it("vượt trần", () => {
    expect(parseCompareAt("2000000001").error).toBe("too_large");
  });
});

describe("compareAtError", () => {
  const MSG = "Chỉ nhập số.";
  it("rỗng → không lỗi", () => {
    expect(compareAtError("", "1000", MSG)).toBeNull();
  });
  it("chữ → câu theo ngữ cảnh", () => {
    expect(compareAtError("abc", "1000", MSG)).toBe(MSG);
    expect(compareAtError("abc", "1000", "Chỉ nhập số, không dấu chấm.")).toBe("Chỉ nhập số, không dấu chấm.");
  });
  it("bằng hoặc thấp hơn giá bán", () => {
    expect(compareAtError("1000", "1000", MSG)).toBe(COMPARE_AT_NOT_ABOVE);
    expect(compareAtError("999", "1000", MSG)).toBe(COMPARE_AT_NOT_ABOVE);
  });
  it("lớn hơn giá bán → hợp lệ", () => {
    expect(compareAtError("1000000", "780000", MSG)).toBeNull();
  });
  it("giá bán chưa hợp lệ thì chưa so sánh", () => {
    expect(compareAtError("1000000", "", MSG)).toBeNull();
    expect(compareAtError("1000000", "x", MSG)).toBeNull();
  });
});
