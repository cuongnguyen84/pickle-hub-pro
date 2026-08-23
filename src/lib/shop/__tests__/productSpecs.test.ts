// Thông số kỹ thuật: ba thứ có thể hỏng ở đây và cả ba đều hỏng CÂM —
// một ô trống lưu thành chuỗi rỗng rồi hiện ra dòng "Trọng lượng: ", một thứ
// tự khoá khác nhau làm nút Lưu sáng vĩnh viễn, và một thông số của người bán
// biến mất khỏi trang chỉ vì từ điển đổi.

import { describe, expect, it } from "vitest";
import {
  SPEC_VALUE_MAX,
  cleanSpecs,
  specFieldsFor,
  specRows,
  specSummary,
  specsEqual,
} from "@/lib/shop/productSpecs";
import { buildUpdatePayload } from "@/lib/shop/productState";

describe("cleanSpecs", () => {
  it("bỏ ô trống và cắt khoảng trắng", () => {
    expect(cleanSpecs({ weight_g: " 220 ", core_mm: "", face: "   " })).toEqual({ weight_g: "220" });
  });

  it("sắp khoá theo alphabet nên hai bản cùng nội dung cho ra cùng một chuỗi JSON", () => {
    const a = cleanSpecs({ weight_g: "220", brand: "Joola" });
    const b = cleanSpecs({ brand: "Joola", weight_g: "220" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.keys(a)).toEqual(["brand", "weight_g"]);
  });

  it("cắt giá trị dài hơn ngưỡng Postgres chấp nhận", () => {
    const long = "x".repeat(SPEC_VALUE_MAX + 50);
    expect(cleanSpecs({ brand: long }).brand).toHaveLength(SPEC_VALUE_MAX);
  });

  it("null/undefined là một object rỗng, không phải một lần ném lỗi", () => {
    expect(cleanSpecs(null)).toEqual({});
    expect(cleanSpecs(undefined)).toEqual({});
  });
});

describe("specsEqual", () => {
  it("không phụ thuộc thứ tự khoá hay khoảng trắng", () => {
    expect(specsEqual({ a: "1", b: "2" }, { b: "2", a: " 1 " })).toBe(true);
  });

  it("một ô bị xoá là KHÁC — nếu không lần lưu đó không bao giờ gửi đi", () => {
    expect(specsEqual({ a: "1", b: "2" }, { a: "1" })).toBe(false);
  });

  it('coi "" và không có ô là một', () => {
    expect(specsEqual({ a: "1", b: "" }, { a: "1" })).toBe(true);
  });
});

describe("specRows", () => {
  it("theo thứ tự từ điển, không theo thứ tự khoá trong JSON", () => {
    const rows = specRows("vot", { weight_g: "220", brand: "Joola" });
    expect(rows.map((r) => r.key)).toEqual(["brand", "weight_g"]);
  });

  it("kèm đơn vị vào giá trị", () => {
    expect(specRows("vot", { weight_g: "220" })[0].value).toBe("220 g");
  });

  it("giữ khoá lạ, xếp cuối — dữ liệu người bán không mất vì một lần sửa từ điển", () => {
    const rows = specRows("vot", { weight_g: "220", swing_weight: "112" });
    expect(rows.map((r) => r.key)).toEqual(["weight_g", "swing_weight"]);
    expect(rows[1].label).toBe("swing_weight");
  });

  it("nhãn tiếng Anh cho trang SSR bản EN", () => {
    expect(specRows("vot", { weight_g: "220" }, "en")[0].label).toBe("Weight");
  });

  it("ngành hàng không có từ điển thì không có dòng nào để hiện", () => {
    expect(specFieldsFor("bong")).toEqual([]);
    expect(specRows("bong", {})).toEqual([]);
    expect(specRows(null, {})).toEqual([]);
  });

  it("đổi ngành hàng sang loại không có từ điển thì GIẤU, không hiện khoá thô", () => {
    // Dữ liệu vẫn nằm trong bảng — đổi ngành hàng về Vợt là hiện lại.
    expect(specRows("giay", { weight_g: "220" })).toEqual([]);
    expect(specRows("vot", { weight_g: "220" })).toHaveLength(1);
  });
});

describe("payload gửi lên product_update", () => {
  it("mang specs ở dạng chuẩn, nên cờ 'chưa lưu' không bật vì thứ tự khoá", () => {
    const base = { title: "Vợt", description: "…", category_slug: "vot", condition: "new" as const };
    const a = buildUpdatePayload({ ...base, specs: { weight_g: "220", brand: "Joola" } });
    const b = buildUpdatePayload({ ...base, specs: { brand: "Joola", weight_g: " 220" } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("sản phẩm chưa khai thông số vẫn gửi một object rỗng, không phải undefined", () => {
    const payload = buildUpdatePayload({
      title: "Vợt",
      description: "…",
      category_slug: "vot",
      condition: "new",
    });
    expect(payload.patch.specs).toEqual({});
  });
});

describe("specSummary", () => {
  it("một dòng cho bảng so sánh xung đột", () => {
    expect(specSummary("vot", { weight_g: "220", brand: "Joola" })).toBe(
      "Thương hiệu: Joola · Trọng lượng: 220 g",
    );
  });

  it("không có thông số thì là chuỗi rỗng, để hai bản cùng rỗng không bị coi là khác nhau", () => {
    expect(specSummary("vot", {})).toBe("");
  });
});
