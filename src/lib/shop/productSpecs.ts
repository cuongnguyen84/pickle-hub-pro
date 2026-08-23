// ============================================================================
// Thông số kỹ thuật theo ngành hàng — TỪ ĐIỂN DUY NHẤT.
// ----------------------------------------------------------------------------
// Postgres chỉ giữ hình dạng (`products.specs` là object khoá → chuỗi, migration
// 20260823090000). Ô nào thuộc ngành hàng nào, gọi là gì, đơn vị gì — nằm ở
// đây, và ở đây thôi: biểu mẫu người bán, trang sản phẩm, bản xem trước và
// trang SSR cho bot đều đọc chung mảng này. Thêm một thông số = thêm một dòng,
// không cần migration.
//
// Vì sao chỉ có vợt: người mua vợt so sánh sáu thông số trước khi chọn, còn
// người mua bóng thì không. Một từ điển rỗng cho ngành hàng khác nghĩa là phần
// thông số không hiện ra — không phải một khối trống mời người bán bịa số.
//
// Giá trị luôn là CHUỖI, kể cả số. `weight_g` là "220", không phải 220 — số
// đến từ một ô input, và một cây vợt "khoảng 220-225" là câu trả lời thật của
// người bán hàng cũ.
// ============================================================================

export interface SpecField {
  /** Khoá lưu trong `products.specs`. snake_case, khớp CHECK trong Postgres. */
  key: string;
  label: string;
  labelEn: string;
  /** Hiện sau con số, cả trên biểu mẫu lẫn trang sản phẩm. */
  unit?: string;
  /** Có options = hộp chọn. Không có = ô gõ tự do. */
  options?: string[];
  /** Ô số: chỉ đổi bàn phím điện thoại và câu gợi ý, KHÔNG chặn lưu. Chặn ở
   *  client trong khi máy chủ vẫn nhận là nói dối người bán về luật thật. */
  numeric?: boolean;
  hint?: string;
  placeholder?: string;
}

/** Ngành hàng → các ô. `product_categories.slug` là khoá. */
export const SPEC_FIELDS: Record<string, SpecField[]> = {
  vot: [
    {
      key: "brand",
      label: "Thương hiệu",
      labelEn: "Brand",
      placeholder: "Joola, Selkirk, Nox, Six Zero…",
    },
    {
      key: "weight_g",
      label: "Trọng lượng",
      labelEn: "Weight",
      unit: "g",
      numeric: true,
      hint: "Vợt pickleball thường 190–250 g. Ghi số đo thật của cây đang bán.",
      placeholder: "220",
    },
    {
      key: "core_mm",
      label: "Độ dày lõi",
      labelEn: "Core thickness",
      unit: "mm",
      numeric: true,
      hint: "Phổ biến 13, 14 hoặc 16 mm. Lõi dày = kiểm soát, lõi mỏng = lực.",
      placeholder: "16",
    },
    {
      key: "face",
      label: "Chất liệu mặt",
      labelEn: "Face material",
      options: [
        "Carbon thô (raw carbon)",
        "Carbon T700",
        "Carbon T300",
        "Sợi thuỷ tinh (fiberglass)",
        "Composite",
        "Kevlar",
        "Gỗ",
      ],
    },
    {
      key: "shape",
      label: "Hình dáng",
      labelEn: "Shape",
      options: ["Thon dài (elongated)", "Tiêu chuẩn (standard)", "Bản rộng (widebody)"],
    },
    {
      key: "handle_mm",
      label: "Chiều dài cán",
      labelEn: "Handle length",
      unit: "mm",
      numeric: true,
      hint: "Cán dài hợp người quen tennis và cú hai tay.",
      placeholder: "140",
    },
    {
      key: "grip_mm",
      label: "Chu vi cán",
      labelEn: "Grip circumference",
      unit: "mm",
      numeric: true,
      hint: "Thường 105–110 mm.",
      placeholder: "107",
    },
    {
      key: "usap",
      label: "Chứng nhận USA Pickleball",
      labelEn: "USA Pickleball approved",
      options: ["Có", "Không", "Không rõ"],
    },
  ],
};

/** Số ô và độ dài mà Postgres chấp nhận (products_specs_shape). Client không
 *  được chặt hơn — chỉ dùng để cắt bớt trước khi gửi. */
export const SPEC_MAX_FIELDS = 24;
export const SPEC_VALUE_MAX = 120;

export type Specs = Record<string, string>;

export const specFieldsFor = (categorySlug: string | null | undefined): SpecField[] =>
  SPEC_FIELDS[categorySlug ?? ""] ?? [];

/**
 * Dạng chuẩn để lưu và để so sánh: bỏ ô trống, cắt khoảng trắng, cắt độ dài,
 * khoá sắp theo alphabet.
 *
 * Sắp khoá không phải để đẹp: cờ "còn thay đổi chưa lưu" so hai payload bằng
 * JSON.stringify, và hai object cùng nội dung khác thứ tự khoá cho ra hai
 * chuỗi khác nhau — nút Lưu sẽ sáng vĩnh viễn với một biểu mẫu không có gì để
 * lưu. Đúng họ với lỗi dirty-vĩnh-viễn đã sửa ở buildUpdatePayload.
 */
export function cleanSpecs(input: Specs | null | undefined): Specs {
  if (!input) return {};
  const out: Specs = {};
  for (const key of Object.keys(input).sort()) {
    const value = (input[key] ?? "").trim().slice(0, SPEC_VALUE_MAX);
    if (value) out[key] = value;
    if (Object.keys(out).length >= SPEC_MAX_FIELDS) break;
  }
  return out;
}

export const specsEqual = (a: Specs | null | undefined, b: Specs | null | undefined) =>
  JSON.stringify(cleanSpecs(a)) === JSON.stringify(cleanSpecs(b));

export interface SpecRow {
  key: string;
  label: string;
  /** Đã kèm đơn vị. "220 g", không phải "220". */
  value: string;
}

/**
 * Các dòng để hiển thị, THEO THỨ TỰ TỪ ĐIỂN — không theo thứ tự khoá trong
 * JSON. Người mua đọc trọng lượng trước chu vi cán, và thứ tự đó phải giống
 * nhau ở mọi sản phẩm thì mới so sánh được hai cây vợt.
 *
 * Khoá lạ (ngành hàng đổi sau khi đã nhập, hoặc một ô bị gỡ khỏi từ điển) vẫn
 * hiện, xếp cuối, với chính khoá làm nhãn — dữ liệu người bán đã nhập không bị
 * một lần sửa từ điển làm biến mất khỏi trang.
 */
export function specRows(
  categorySlug: string | null | undefined,
  specs: Specs | null | undefined,
  lang: "vi" | "en" = "vi",
): SpecRow[] {
  const clean = cleanSpecs(specs);
  const fields = specFieldsFor(categorySlug);
  // Ngành hàng không có từ điển thì không hiện gì — kể cả khi hàng còn giữ
  // thông số cũ. Người bán đổi ngành hàng từ Vợt sang Giày không làm trang
  // sản phẩm hiện ra dòng "weight_g: 220"; dữ liệu vẫn nằm nguyên trong bảng,
  // đổi ngành hàng về là hiện lại.
  if (fields.length === 0) return [];
  const known = new Set(fields.map((f) => f.key));
  const rows: SpecRow[] = [];

  for (const field of fields) {
    const value = clean[field.key];
    if (!value) continue;
    rows.push({
      key: field.key,
      label: lang === "en" ? field.labelEn : field.label,
      value: field.unit ? `${value} ${field.unit}` : value,
    });
  }
  for (const key of Object.keys(clean)) {
    if (known.has(key)) continue;
    rows.push({ key, label: key, value: clean[key] });
  }
  return rows;
}

/** Một dòng tóm tắt cho bảng so sánh xung đột phiên bản. */
export const specSummary = (categorySlug: string | null | undefined, specs: Specs) => {
  const rows = specRows(categorySlug, specs);
  return rows.length === 0 ? "" : rows.map((r) => `${r.label}: ${r.value}`).join(" · ");
};
