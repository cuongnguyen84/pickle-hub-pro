// ============================================================================
// What a buyer reads on a card, in words and numbers.
// ----------------------------------------------------------------------------
// Pure, because every one of these is a claim a buyer will act on: a price, a
// stock label, whether a shop has been checked. The rules are worth a test,
// and a test that has to mount a page to reach them will not be written.
//
// Nothing here invents optimism. There is no "chỉ còn 2 cái", no struck-out
// original price, no "bán chạy" — the data cannot support any of it, and a
// marketplace with three sellers that pretends otherwise burns the only thing
// it has.
// ============================================================================

import type { Availability, ProductCard } from "@/hooks/shop/usePublicShop";

/** VND, grouped, no decimals. An integer currency formatted as one. */
export const formatVnd = (n: number) => `${n.toLocaleString("vi-VN")}₫`;

/**
 * One price, or a range, or nothing.
 *
 * A range collapses to a single price when min and max agree, because
 * "1.500.000₫ – 1.500.000₫" reads as a mistake. Null prices mean the server
 * had no live variant to quote, which the caller renders as "chưa có giá"
 * rather than as 0₫.
 */
export function priceLabel(card: Pick<ProductCard, "price_min" | "price_max">): string | null {
  const { price_min: lo, price_max: hi } = card;
  if (lo == null || hi == null) return null;
  return lo === hi ? formatVnd(lo) : `${formatVnd(lo)} – ${formatVnd(hi)}`;
}

/**
 * The availability label.
 *
 * `unknown` is its own answer and must not be dressed up as either of the
 * others: the seller has not told us a number, and "còn hàng" would be a
 * promise nobody made. This mirrors the server's derivation exactly —
 * stock_on_hand IS NULL is not the same as 0.
 */
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: "Còn hàng",
  out_of_stock: "Hết hàng",
  unknown: "Liên hệ shop để hỏi số lượng",
};

export const availabilityLabel = (a: Availability | null): string =>
  a ? AVAILABILITY_LABEL[a] : AVAILABILITY_LABEL.unknown;

/** Whether the card should read as unavailable. `unknown` is not sold out. */
export const isSoldOut = (a: Availability | null) => a === "out_of_stock";

export const CONDITION_LABEL: Record<"new" | "used", string> = {
  new: "Mới",
  used: "Đã qua sử dụng",
};

/**
 * The public URL of an approved rendition.
 *
 * `public_path` is a key in the PUBLIC bucket, and it is the only kind of path
 * a buyer surface ever receives — P2b.3 made the draft path seller-only in the
 * projection itself. This throws on anything that looks like a signed URL or
 * an absolute link, so a future change that starts handing one over fails here
 * rather than in a viewer's browser.
 */
export function publicMediaUrl(base: string, publicPath: string): string {
  if (/^https?:|token=|\/object\/sign\//.test(publicPath)) {
    throw new Error(`public media path must be a bucket key, got: ${publicPath.slice(0, 40)}`);
  }
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/shop-product-media/${publicPath}`;
}

/** Cards are 4:3. Stated so the box is reserved before the image loads. */
export const CARD_ASPECT = 4 / 3;

/**
 * Height for a known width, so a card reserves its space and the grid does not
 * jump when photos arrive. Falls back to the card ratio when the server did
 * not record dimensions.
 */
export function mediaBox(
  width: number | null,
  height: number | null,
  renderWidth: number,
): { width: number; height: number } {
  const ratio = width && height ? width / height : CARD_ASPECT;
  return { width: renderWidth, height: Math.round(renderWidth / ratio) };
}

/**
 * A compact catalogue should say so rather than pad the page.
 *
 * `sparse` is not an error and not "no results" — it is a real, small
 * catalogue, and the copy for it should invite the buyer to look at all of it
 * rather than apologise.
 */
export type CatalogMood = "empty" | "sparse" | "normal";

export function catalogMood(total: number): CatalogMood {
  if (total === 0) return "empty";
  if (total < 12) return "sparse";
  return "normal";
}
