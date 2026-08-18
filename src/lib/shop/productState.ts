// ============================================================================
// Product state → what the seller is told, and what they are allowed to do.
// ----------------------------------------------------------------------------
// One table, derived from the same status the database enforces, so a screen
// cannot invent a permission by rendering a button. product_status_is_editable()
// in migration 20260811200000 is the authority; canEditContent() mirrors it,
// and the test asserts the two lists are the same set.
//
// Pure functions, no React, no Supabase — so the rules are testable without a
// browser and without a database, and the pages have nothing to decide.
// ============================================================================

import type { ProductStatus, SellerProductRow } from "@/integrations/supabase/shop-schema";

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Nháp",
  pending_review: "Chờ duyệt",
  needs_changes: "Cần sửa",
  approved: "Đang bán",
  rejected: "Bị từ chối",
  suspended: "Bị gỡ",
  archived: "Ngừng bán",
};

/** What the status MEANS for the buyer-facing side of the product, said in the
 *  seller's terms. A badge that only names the state leaves them guessing
 *  whether anybody can see it. */
export const PRODUCT_STATUS_HINT: Record<ProductStatus, string> = {
  draft: "Chưa đăng bán. Người mua chưa thấy.",
  pending_review: "Đang chờ quản trị viên xem. Người mua chưa thấy.",
  needs_changes: "Quản trị viên yêu cầu sửa. Người mua chưa thấy.",
  approved: "Đang bán. Người mua thấy sản phẩm này.",
  rejected: "Bị từ chối. Người mua không thấy.",
  suspended: "Quản trị viên đã gỡ. Chỉ quản trị viên mở lại được.",
  archived: "Đã ngừng bán. Người mua không thấy, bật lại được.",
};

export const PRODUCT_STATUS_TONE: Record<ProductStatus, "ok" | "warn" | "danger" | "muted"> = {
  draft: "muted",
  pending_review: "warn",
  needs_changes: "danger",
  approved: "ok",
  rejected: "danger",
  suspended: "danger",
  archived: "muted",
};

/** The order the filter chips appear in — action first, mirroring the default
 *  sort so the chip a seller reaches for is the one already applied. */
export const PRODUCT_STATUS_ORDER: ProductStatus[] = [
  "needs_changes",
  "rejected",
  "draft",
  "pending_review",
  "approved",
  "archived",
];

/**
 * Mirrors product_status_is_editable(). Kept deliberately narrow:
 *
 *   pending_review is NOT editable, because a moderator is looking at the row
 *   and a decision must land on the thing that was actually reviewed. The
 *   seller withdraws first — that is a different, explicit action.
 *
 *   approved is NOT editable here either. An approved product that can change
 *   its description without re-review is an approval that means nothing; the
 *   re-submit flow is step 7.
 */
export const canEditContent = (status: ProductStatus) =>
  status === "draft" || status === "needs_changes";

export const canArchive = (status: ProductStatus) => status !== "archived";
export const canUnarchive = (status: ProductStatus) => status === "archived";

/** Changing the URL is only offered where the content is editable — and it is
 *  the database, not this line, that refuses elsewhere. */
export const canEditSlug = (status: ProductStatus) => canEditContent(status);

/** What the seller should do next, in one sentence, or null when the ball is
 *  not in their court. */
export function nextActionFor(product: {
  status: ProductStatus;
  applicant_note: string | null;
  mediaCount: number;
}): string | null {
  switch (product.status) {
    case "needs_changes":
      return product.applicant_note
        ? "Sửa theo yêu cầu rồi gửi lại."
        : "Quản trị viên yêu cầu sửa. Mở sản phẩm để xem chi tiết.";
    case "rejected":
      return "Đọc lý do từ chối. Sửa được thì sửa rồi gửi lại.";
    case "draft":
      // Honest about the actual blocker: submit-for-review demands a photo and
      // the upload screen is step 6, so "gửi duyệt" is not available yet and
      // saying so beats a disabled button with no explanation.
      return product.mediaCount === 0
        ? "Còn thiếu ảnh. Màn hình tải ảnh mở ở bản cập nhật tới."
        : "Hoàn tất rồi thì gửi duyệt.";
    case "pending_review":
      return null;
    case "approved":
      return "Bật bán để người mua thấy sản phẩm.";
    case "archived":
      return "Bật bán lại bất cứ lúc nào.";
    default:
      return null;
  }
}

/** VND, grouped the Vietnamese way, with the symbol the seller writes. */
export const vnd = (amount: number) => `${amount.toLocaleString("vi-VN")}₫`;

/**
 * The price a list row shows.
 *
 * Always from the variants, never from the product — the product row does not
 * carry a price, deliberately (P2a.1). A range when they differ, because one
 * number out of six is the wrong number five times.
 */
export function priceSummary(variants: { price_vnd: number }[]): string {
  if (variants.length === 0) return "Chưa có giá";
  const prices = variants.map((v) => v.price_vnd);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? vnd(min) : `${vnd(min)} – ${vnd(max)}`;
}

/**
 * The stock a list row shows.
 *
 * NULL stock is "not counted", which is a real answer and not zero. A product
 * where some variants count and some do not says so rather than adding a
 * number that is missing part of itself.
 */
export function stockSummary(variants: { stock_on_hand: number | null }[]): string {
  if (variants.length === 0) return "—";
  const counted = variants.filter((v) => v.stock_on_hand !== null);
  if (counted.length === 0) return "Không đếm";
  const total = counted.reduce((n, v) => n + (v.stock_on_hand ?? 0), 0);
  if (counted.length < variants.length) return `${total} (một số phiên bản không đếm)`;
  return total === 0 ? "Hết hàng" : String(total);
}

/** Everything a list row needs, derived once so the card and the table row
 *  cannot disagree about the same product. */
export function summarise(row: SellerProductRow) {
  // Retired variants keep their SKU and their ledger but are off the shelf, so
  // they must not appear in a price range or a stock total — a shop that
  // retired its expensive size would otherwise still advertise that price.
  const variants = (row.product_variants ?? []).filter((v) => v.retired_at == null);
  const mediaCount = (row.product_media ?? []).length;
  return {
    price: priceSummary(variants),
    stock: stockSummary(variants),
    variantCount: variants.length,
    mediaCount,
    statusLabel: PRODUCT_STATUS_LABEL[row.status],
    statusTone: PRODUCT_STATUS_TONE[row.status],
    nextAction: nextActionFor({
      status: row.status,
      applicant_note: row.applicant_note,
      mediaCount,
    }),
    canEdit: canEditContent(row.status),
    canArchive: canArchive(row.status),
    canUnarchive: canUnarchive(row.status),
  };
}

// ─── Client-side validation, mirroring the SQL ──────────────────────────────
// Never stricter than Postgres: a client stricter than the server blocks a
// value the database would have taken, and the seller has no way to find out
// they were wrong.

export interface DraftErrors {
  title?: string;
  category_slug?: string;
  description?: string;
  price_vnd?: string;
  stock_on_hand?: string;
}

export function validateDraft(draft: {
  title: string;
  description: string;
  category_slug: string;
  price_vnd: string;
  stock_on_hand: string;
}): DraftErrors {
  const errors: DraftErrors = {};

  const title = draft.title.trim();
  if (title.length < 3 || title.length > 140) errors.title = "Tên sản phẩm cần từ 3 đến 140 ký tự";
  if (draft.description.length > 4000) errors.description = "Mô tả tối đa 4000 ký tự";

  // Required by product_submit_for_review, so asking for it at save time is
  // not the client inventing a rule — it is telling the seller now instead of
  // at the end.
  if (!draft.category_slug) errors.category_slug = "Chọn ngành hàng cho sản phẩm";

  const price = draft.price_vnd.trim();
  if (!price) {
    errors.price_vnd = "Nhập giá bán";
  } else if (!/^[0-9]+$/.test(price)) {
    errors.price_vnd = "Giá phải là số nguyên tiền đồng, không dấu chấm hay dấu phẩy";
  } else if (Number(price) > 2_000_000_000) {
    errors.price_vnd = "Giá vượt mức cho phép";
  }

  const stock = draft.stock_on_hand.trim();
  if (stock && !/^[0-9]+$/.test(stock)) {
    errors.stock_on_hand = "Tồn kho phải là số nguyên không âm, để trống nếu không đếm";
  } else if (stock && Number(stock) > 1_000_000) {
    errors.stock_on_hand = "Tồn kho vượt mức cho phép";
  }

  return errors;
}

/** The order the form focuses errors in — top of the form downward, not the
 *  order the object happens to enumerate. */
export const DRAFT_FIELD_ORDER: (keyof DraftErrors)[] = [
  "category_slug",
  "title",
  "description",
  "price_vnd",
  "stock_on_hand",
];

// ─── The product_update payload ─────────────────────────────────────────────

export interface UpdatePayload {
  patch: {
    title: string;
    description: string;
    category_slug: string;
    condition: "new" | "used";
  };
  /** Absent means "do not touch the default variant". The RPC turns it into
   *  `_variant: null`, which is the contract for leaving the matrix alone. */
  variant?: { price_vnd: string; stock_on_hand: string };
}

/**
 * What the main form sends when the seller saves.
 *
 * The variant half is the whole point. product_update REFUSES a `_variant`
 * payload for a product that has an option matrix — correctly, because the
 * matrix is the only place those numbers may be edited — so a form that always
 * sent it made every save of a multi-variant product fail with "sản phẩm này có
 * nhiều phiên bản". The seller could not change the NAME of a product that had
 * colours, and the error pointed them at a table they had not touched.
 *
 * The hidden single-product price and stock fields still hold whatever they
 * were seeded with, which is what makes this dangerous rather than merely
 * broken: if the RPC had accepted the payload it would have collapsed a
 * six-row matrix onto one price.
 *
 * A pure function so the shape can be asserted without a browser, a network or
 * a database — the layer where this bug lived.
 */
export function buildUpdatePayload(
  draft: {
    title: string;
    description: string;
    category_slug: string;
    condition: "new" | "used";
    price_vnd: string;
    stock_on_hand: string;
  },
  multiVariant: boolean,
): UpdatePayload {
  const patch = {
    title: draft.title.trim(),
    description: draft.description,
    category_slug: draft.category_slug,
    condition: draft.condition,
  };
  if (multiVariant) return { patch };
  return {
    patch,
    variant: { price_vnd: draft.price_vnd.trim(), stock_on_hand: draft.stock_on_hand.trim() },
  };
}
