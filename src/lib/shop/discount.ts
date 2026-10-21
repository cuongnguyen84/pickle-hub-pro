// ============================================================================
// Giá gốc và % giảm — thuần, dùng chung cho form đơn, VariantEditor, card, PDP.
// ----------------------------------------------------------------------------
// Công thức là của shop_public_search (migration 20260829120000):
//   floor(100 - price * 100 / compare_at)
// Client tính lại cùng công thức để hint trong form và badge PDP KHÔNG lệch
// card; card thì không tự suy diễn — chỉ in số server trả.
// ============================================================================

/** Câu server cũng nói (constraint product_variants_compare_range). */
export const COMPARE_AT_NOT_ABOVE = "Giá gốc phải lớn hơn giá bán.";

const INT = /^[0-9]+$/;
const MAX_VND = 2_000_000_000;

/** % giảm nguyên, hoặc null khi không có giá gốc hợp lệ hoặc giảm chưa tới 1% (không bao giờ "-0%"). */
export function discountPct(price: number, compareAt: number | null | undefined): number | null {
  if (compareAt == null || !Number.isFinite(compareAt) || compareAt <= price || compareAt <= 0) return null;
  const pct = Math.floor(100 - (price * 100) / compareAt);
  return pct < 1 ? null : pct;
}

/**
 * Giá gốc suy ra từ % giảm seller nhập (import hàng loạt): price / (1 - pct/100),
 * làm tròn lên để luôn thoả CHECK compare_at > price. pct ngoài 1..90 → null.
 */
export function compareAtFromPct(price: number, pct: number | null | undefined): number | null {
  if (pct == null || !Number.isFinite(pct) || pct < 1 || pct > 90 || !(price > 0)) return null;
  const compareAt = Math.ceil((price * 100) / (100 - pct));
  return compareAt > price ? compareAt : null;
}

/** % giảm lớn nhất trong danh sách phiên bản (PDP chưa chọn phiên bản). */
export function maxDiscountPct(
  variants: { price_vnd: number; compare_at_price_vnd?: number | null }[],
): number | null {
  let max: number | null = null;
  for (const v of variants) {
    const pct = discountPct(v.price_vnd, v.compare_at_price_vnd);
    if (pct != null && (max == null || pct > max)) max = pct;
  }
  return max;
}

export type CompareAtParse =
  | { value: number | null; error: null }
  | { value: null; error: "non_numeric" | "too_large" };

/** "" → null (không có giá gốc). Chỉ nhận chữ số, cùng luật product_compare_at_vnd(). */
export function parseCompareAt(text: string): CompareAtParse {
  const t = text.trim();
  if (!t) return { value: null, error: null };
  if (!INT.test(t)) return { value: null, error: "non_numeric" };
  if (Number(t) > MAX_VND) return { value: null, error: "too_large" };
  return { value: Number(t), error: null };
}

/**
 * Lỗi hiển thị cho ô giá gốc, hoặc null. `nonNumeric` là câu theo ngữ cảnh
 * (form đơn nói "không dấu chấm", bảng phiên bản nói ngắn hơn). Giá bán chưa
 * hợp lệ thì chưa so sánh — ô giá bán tự báo lỗi của nó.
 */
export function compareAtError(compareText: string, priceText: string, nonNumeric: string): string | null {
  const parsed = parseCompareAt(compareText);
  if (parsed.error === "non_numeric") return nonNumeric;
  if (parsed.error === "too_large") return "Giá gốc vượt mức cho phép";
  if (parsed.value == null) return null;
  const price = priceText.trim();
  if (!INT.test(price)) return null;
  return parsed.value > Number(price) ? null : COMPARE_AT_NOT_ABOVE;
}
