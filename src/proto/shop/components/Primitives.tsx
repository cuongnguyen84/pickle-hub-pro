// ============================================================================
// F04 — Product discovery primitives
// ----------------------------------------------------------------------------
// Honesty rules baked in, not left to each screen:
//   • No rating stars, no "đã bán N", no discount percentage — the prototype
//     has no data that could back them (board Rule 4).
//   • A "was" price only renders when the seller actually changed the price,
//     and it is labelled with WHEN, so it reads as price history rather than a
//     manufactured sale.
//   • Stock is only ever stated when the number is known. `stock: null` means
//     the seller does not track it → we say "Còn hàng", never a made-up count.
//   • Delivery says where it ships FROM. It never promises a delivery date,
//     because nothing in this system can know one.
// ============================================================================

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Heart, ShieldCheck, MapPin, RotateCcw } from "lucide-react";
import {
  type ProtoProduct,
  type ProtoShop,
  shopById,
  vnd,
  dmy,
} from "../fixtures";

// ─── Media placeholder ──────────────────────────────────────────────────────

export const ProductMedia = ({
  tone = "a",
  label,
  wide,
}: {
  tone?: string;
  label?: string;
  wide?: boolean;
}) => (
  <div className={`tl-shop-media tl-shop-media--${tone} ${wide ? "tl-shop-media--wide" : ""}`}>
    <span className="tl-shop-media-label">{label ?? "Ảnh sản phẩm"}</span>
  </div>
);

// ─── Price ──────────────────────────────────────────────────────────────────

export interface ProductPriceProps {
  vndAmount: number;
  /** Upper bound when variants span a range. */
  maxVnd?: number | null;
  /** Previous price the seller set, with the date they changed it. */
  previous?: { vndAmount: number; changedAt: string } | null;
  size?: "sm" | "lg";
}

export const ProductPrice = ({ vndAmount, maxVnd, previous, size = "sm" }: ProductPriceProps) => (
  <div>
    <span className={`tl-shop-price ${size === "lg" ? "tl-shop-price--lg" : ""}`}>
      {maxVnd && maxVnd !== vndAmount ? `${vnd(vndAmount)} – ${vnd(maxVnd)}` : vnd(vndAmount)}
    </span>
    {previous && (
      <div style={{ marginTop: 2 }}>
        <span className="tl-shop-price-was">{vnd(previous.vndAmount)}</span>{" "}
        <span className="tl-shop-price-note">
          người bán đổi giá {dmy(previous.changedAt)}
        </span>
      </div>
    )}
    {maxVnd && maxVnd !== vndAmount && (
      <div className="tl-shop-price-note">Giá thay đổi theo phiên bản</div>
    )}
  </div>
);

// ─── Seller identity + verification ─────────────────────────────────────────

const VERIFY_TEXT: Record<NonNullable<ProtoShop["verifiedMethod"]>, string> = {
  "giay-phep-kinh-doanh": "Đã đối chiếu giấy phép kinh doanh",
  "gap-truc-tiep": "Đã gặp trực tiếp người bán",
};

export const VerificationBadge = ({ shop }: { shop: ProtoShop }) => {
  if (!shop.verifiedMethod || !shop.verifiedAt) {
    return (
      <span className="tl-shop-pill tl-shop-pill--muted" title="Chưa xác minh danh tính người bán">
        Chưa xác minh
      </span>
    );
  }
  return (
    <span
      className="tl-shop-pill tl-shop-pill--info"
      title={`${VERIFY_TEXT[shop.verifiedMethod]} ngày ${dmy(shop.verifiedAt)}. Đây là xác minh danh tính người bán, không phải bảo đảm chất lượng hàng.`}
    >
      <ShieldCheck size={12} aria-hidden="true" />
      Đã xác minh {dmy(shop.verifiedAt)}
      <span className="tl-shop-sr">
        — {VERIFY_TEXT[shop.verifiedMethod]}. Đây là xác minh danh tính người bán, không phải
        bảo đảm chất lượng hàng.
      </span>
    </span>
  );
};

export const SellerIdentity = ({
  shop,
  linked = true,
  showBadge = false,
}: {
  shop: ProtoShop;
  linked?: boolean;
  showBadge?: boolean;
}) => {
  const inner = (
    <>
      <span className="tl-shop-seller-mark" aria-hidden="true">
        {shop.logoInitials}
      </span>
      <span className="tl-shop-seller-name">{shop.name}</span>
    </>
  );
  return (
    <span className="tl-shop-seller">
      {linked ? (
        <Link to={`/proto/shop/store/${shop.slug}`} className="tl-shop-seller" style={{ color: "inherit" }}>
          {inner}
        </Link>
      ) : (
        inner
      )}
      {showBadge && <VerificationBadge shop={shop} />}
      {shop.state === "suspended" && (
        <span className="tl-shop-pill tl-shop-pill--warn">Tạm ngưng bán</span>
      )}
    </span>
  );
};

// ─── Stock ──────────────────────────────────────────────────────────────────

export const StockStatus = ({ stock }: { stock: number | null }) => {
  if (stock === null) return <span className="tl-shop-pill tl-shop-pill--ok">Còn hàng</span>;
  if (stock <= 0) return <span className="tl-shop-pill tl-shop-pill--muted">Hết hàng</span>;
  if (stock <= 3)
    return <span className="tl-shop-pill tl-shop-pill--warn">Chỉ còn {stock} sản phẩm</span>;
  return <span className="tl-shop-pill tl-shop-pill--ok">Còn hàng</span>;
};

// ─── Delivery + return summary ──────────────────────────────────────────────

export const DeliverySummary = ({ product }: { product: ProtoProduct }) => (
  <div className="tl-shop-deliv">
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <MapPin size={13} aria-hidden="true" />
      Gửi từ {product.shippingFromCity}
    </span>
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <RotateCcw size={13} aria-hidden="true" />
      {product.returnWindow
        ? `Đổi trả trong ${product.returnWindow}`
        : "Người bán không nhận đổi trả"}
    </span>
  </div>
);

// ─── Wishlist control ───────────────────────────────────────────────────────

export const WishlistButton = ({
  saved,
  onToggle,
  productTitle,
}: {
  saved: boolean;
  onToggle?: () => void;
  productTitle: string;
}) => (
  <button
    type="button"
    className="tl-shop-wish"
    aria-pressed={saved}
    aria-label={saved ? `Bỏ lưu ${productTitle}` : `Lưu ${productTitle}`}
    onClick={onToggle}
  >
    <Heart size={18} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
  </button>
);

// ─── Category shortcut ──────────────────────────────────────────────────────

export const CategoryShortcut = ({
  slug,
  name,
  current,
}: {
  slug: string;
  name: string;
  current?: boolean;
}) => (
  <Link
    to={`/proto/shop/category/${slug}`}
    className="tl-shop-cat"
    aria-current={current ? "page" : undefined}
  >
    {name}
  </Link>
);

// ─── Product card ───────────────────────────────────────────────────────────

export interface ProductCardProps {
  product: ProtoProduct;
  saved?: boolean;
  onToggleSave?: () => void;
  /** Overrides the derived state, used by the F04 state matrix. */
  forceUnavailable?: boolean;
  previousPrice?: { vndAmount: number; changedAt: string } | null;
  showSeller?: boolean;
}

export const ProductCard = ({
  product,
  saved = false,
  onToggleSave,
  forceUnavailable,
  previousPrice = null,
  showSeller = true,
}: ProductCardProps) => {
  const shop = shopById(product.shopId);
  const totalStock = product.variants.reduce(
    (n, v) => (v.stock === null ? n + 1 : n + v.stock),
    0,
  );
  const soldOut = forceUnavailable ?? totalStock <= 0;
  const shopDown = shop.state !== "active";

  return (
    <article className={`tl-shop-pcard ${soldOut || shopDown ? "tl-shop-pcard--muted" : ""}`}>
      <ProductMedia tone={product.media[0]?.tone ?? "a"} label={product.media[0]?.label} />
      {onToggleSave && (
        <WishlistButton saved={saved} onToggle={onToggleSave} productTitle={product.title} />
      )}
      <h3 className="tl-shop-pcard-title">
        <Link to={`/proto/shop/product/${product.slug}`} style={{ color: "inherit" }}>
          {product.title}
        </Link>
      </h3>
      <ProductPrice
        vndAmount={product.priceVnd}
        maxVnd={product.priceMaxVnd}
        previous={previousPrice}
      />
      <div className="tl-shop-pcard-foot">
        {product.condition === "da-qua-su-dung" && (
          <span className="tl-shop-pill tl-shop-pill--used">Đã qua sử dụng</span>
        )}
        {shopDown ? (
          <span className="tl-shop-pill tl-shop-pill--warn">Người bán tạm ngưng</span>
        ) : soldOut ? (
          <span className="tl-shop-pill tl-shop-pill--muted">Hết hàng</span>
        ) : null}
      </div>
      {showSeller && <SellerIdentity shop={shop} />}
    </article>
  );
};

// ─── Small shared bits ──────────────────────────────────────────────────────

export const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "7px 0", fontSize: 13.5 }}>
    <span style={{ color: "var(--tl-fg-3)" }}>{label}</span>
    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{children}</span>
  </div>
);
