// ============================================================================
// Submit problems → what the seller reads, and where the screen has to go.
// ----------------------------------------------------------------------------
// product_submit_preflight() returns problems as data: a code, the section to
// open, the field, and the variant or media it is about. This file turns that
// into Vietnamese and into a focus target, and nothing else — the RULES are in
// Postgres, and a client that invented its own would tell the seller a
// different story from the one the submit is about to enforce.
//
// Targets are NAMED, never a position. A DOM index is where a row is sitting
// right now; a moderator's "sửa ảnh thứ hai" written as an index points at a
// different photo the moment somebody reorders them.
// ============================================================================

/** The sections a problem can point at. Mirrors product_edit_sections(). */
export const EDIT_SECTIONS = [
  "basics",
  "category",
  "description",
  "variants",
  "price",
  "stock",
  "sku",
  "media",
  "variant_media",
  "shipping",
] as const;

export type EditSection = (typeof EDIT_SECTIONS)[number];

export interface SubmitProblem {
  code: string;
  section: EditSection;
  field?: string | null;
  variant_id?: string | null;
  media_id?: string | null;
  detail?: Record<string, unknown> | null;
}

/**
 * What each problem means, in the seller's language.
 *
 * One sentence saying what is missing, not what rule failed — "Chưa chọn ngành
 * hàng" is actionable; "category_missing" is a log line.
 */
const COPY: Record<string, string> = {
  shop_not_active: "Shop chưa ở trạng thái hoạt động nên chưa gửi duyệt được.",
  wrong_status: "Sản phẩm đang ở trạng thái không gửi duyệt được.",
  title_missing: "Chưa có tên sản phẩm, hoặc tên quá ngắn.",
  category_missing: "Chưa chọn ngành hàng.",
  description_missing: "Chưa có mô tả sản phẩm.",
  description_too_short:
    "Mô tả quá ngắn — viết ít nhất 40 ký tự về tình trạng thật của hàng. Thông số kỹ thuật đã có ô riêng.",
  option_graph_invalid: "Bộ tuỳ chọn chưa hợp lệ — kiểm tra lại nhóm và giá trị.",
  no_variant: "Sản phẩm chưa có phiên bản nào đang bán.",
  default_variant_broken: "Sản phẩm đơn phải có đúng một phiên bản.",
  orphan_default_variant: "Còn một phiên bản không mang tuỳ chọn nào.",
  price_missing: "Phiên bản này chưa có giá.",
  stock_negative: "Tồn kho của phiên bản này đang âm.",
  sku_duplicate: "Mã hàng này đã có phiên bản khác trong shop dùng.",
  variant_media_invalid: "Phiên bản này đang trỏ tới một ảnh không dùng được.",
  no_media: "Chưa có ảnh nào. Sản phẩm cần ít nhất một ảnh.",
  media_unverified: "Còn ảnh chưa tải xong. Chờ tải xong hoặc bỏ ảnh đó ra.",
  media_wrong_shop: "Có ảnh không thuộc shop này.",
};

export const problemMessage = (problem: SubmitProblem) =>
  COPY[problem.code] ?? "Còn một chỗ chưa hợp lệ.";

/** What the seller sees as the heading of each group in the checklist. */
export const SECTION_LABEL: Record<EditSection, string> = {
  basics: "Thông tin cơ bản",
  category: "Ngành hàng",
  description: "Mô tả",
  variants: "Phiên bản",
  price: "Giá",
  stock: "Tồn kho",
  sku: "Mã hàng",
  media: "Ảnh sản phẩm",
  variant_media: "Ảnh cho từng phiên bản",
  shipping: "Giao hàng & đổi trả",
};

/**
 * Where a section lives on the editor, and what has to be open for it to
 * exist at all.
 *
 * `lazySection` names the collapsed/lazy area the screen must mount before the
 * element is in the DOM — focusing a control inside a chunk that has not
 * loaded is a no-op that looks like a broken link.
 */
export interface FocusTarget {
  /** Element id to scroll to and focus. */
  elementId: string;
  /** Which lazily-mounted area has to be open first, if any. */
  lazySection?: "variants" | "media";
}

export function focusTargetFor(problem: SubmitProblem): FocusTarget {
  switch (problem.section) {
    case "basics":
      return { elementId: "p-title" };
    case "category":
      return { elementId: "p-cat" };
    case "description":
      return { elementId: "p-desc" };
    case "shipping":
      // Shipping and return notes are shop-level, on the settings screen. The
      // editor cannot focus them, so the checklist links out instead.
      return { elementId: "sec-shipping-note" };
    case "variants":
    case "price":
    case "stock":
    case "sku":
      // A variant problem points at that variant's row when we know which one,
      // and at the matrix otherwise. Both live behind the lazy editor.
      return {
        elementId: problem.variant_id ? `variant-${problem.variant_id}` : "sec-variants",
        lazySection: "variants",
      };
    case "media":
      return {
        elementId: problem.media_id ? `media-${problem.media_id}` : "sec-media",
        lazySection: "media",
      };
    case "variant_media":
      return {
        elementId: problem.variant_id ? `vm-${problem.variant_id}` : "sec-media",
        lazySection: "media",
      };
    default:
      return { elementId: "sec-basics" };
  }
}

/**
 * Problems grouped by section, in the order the sections appear on the screen.
 *
 * A flat list ordered by whatever SQL returned makes the seller jump up and
 * down the form; grouping means they fix one area at a time.
 */
export function groupProblems(problems: SubmitProblem[]) {
  const bySection = new Map<EditSection, SubmitProblem[]>();
  for (const problem of problems) {
    const list = bySection.get(problem.section) ?? [];
    list.push(problem);
    bySection.set(problem.section, list);
  }
  return EDIT_SECTIONS.filter((section) => bySection.has(section)).map((section) => ({
    section,
    label: SECTION_LABEL[section],
    problems: bySection.get(section)!,
  }));
}

/** The one the screen jumps to when the seller presses "Đi tới chỗ cần sửa" —
 *  the first in screen order, not the first the server happened to emit. */
export function firstProblem(problems: SubmitProblem[]): SubmitProblem | null {
  for (const section of EDIT_SECTIONS) {
    const found = problems.find((p) => p.section === section);
    if (found) return found;
  }
  return problems[0] ?? null;
}
