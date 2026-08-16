// ============================================================================
// One product, as a buyer sees it in a list.
// ----------------------------------------------------------------------------
// The whole card is one link. Nothing interactive is nested inside it: no
// save, no add-to-cart, no shop link — partly because P2b has no cart to add
// to, and partly because a button inside a link is a keyboard trap and an
// ambiguous tap target.
//
// Every claim comes from the server. There is no struck-out original price,
// no "chỉ còn 2", no badge the data cannot support.
// ============================================================================

import { Link } from "react-router-dom";
import { BadgeCheck, ImageOff } from "lucide-react";
import type { ProductCard as Card } from "@/hooks/shop/usePublicShop";
import {
  CONDITION_LABEL,
  availabilityLabel,
  isSoldOut,
  mediaBox,
  priceLabel,
  publicMediaUrl,
} from "@/lib/shop/publicCatalog";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

/** Rendered width used to reserve the image box. The CSS scales it; the point
 *  of the attributes is that the browser knows the RATIO before bytes land. */
const BOX_W = 400;

export function ProductCard({ card, eager = false }: { card: Card; eager?: boolean }) {
  const price = priceLabel(card);
  const soldOut = isSoldOut(card.availability);
  const box = mediaBox(card.cover?.width ?? null, card.cover?.height ?? null, BOX_W);

  return (
    <Link to={`/shop/product/${card.slug}`} className="tl-pcard" aria-label={card.title}>
      <div className="tl-pcard-media" style={{ aspectRatio: `${box.width} / ${box.height}` }}>
        {card.cover ? (
          <img
            src={publicMediaUrl(SUPABASE_URL, card.cover.public_path)}
            alt={card.cover.alt_text ?? ""}
            width={box.width}
            height={box.height}
            // Above-the-fold cards load eagerly; the rest wait. `decoding
            // async` keeps a slow decode off the main thread while scrolling.
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <div className="tl-pcard-noimg" aria-hidden="true">
            <ImageOff size={20} />
            <span>Chưa có ảnh</span>
          </div>
        )}
        {soldOut && <span className="tl-pcard-flag">Hết hàng</span>}
      </div>

      <div className="tl-pcard-body">
        <p className="tl-pcard-title">{card.title}</p>

        <p className="tl-pcard-price">
          {price ?? <span className="tl-pcard-noprice">Chưa có giá</span>}
        </p>

        <p className="tl-pcard-meta">
          <span>{CONDITION_LABEL[card.condition]}</span>
          <span aria-hidden="true"> · </span>
          <span className={soldOut ? "tl-pcard-out" : undefined}>
            {availabilityLabel(card.availability)}
          </span>
        </p>

        <p className="tl-pcard-shop">
          {card.shop.name}
          {card.shop.verified && (
            <>
              {" "}
              <BadgeCheck size={13} aria-hidden="true" className="tl-pcard-verified" />
              <span className="tl-shop-sr">shop đã được ThePickleHub xác minh</span>
            </>
          )}
        </p>
      </div>
    </Link>
  );
}

/** Same box as a card, so a grid does not reflow when the real ones arrive. */
export function ProductCardSkeleton() {
  return (
    <div className="tl-pcard tl-pcard--skeleton" aria-hidden="true">
      <div className="tl-pcard-media" style={{ aspectRatio: "4 / 3" }} />
      <div className="tl-pcard-body">
        <span className="tl-pcard-sk-line" style={{ width: "85%" }} />
        <span className="tl-pcard-sk-line" style={{ width: "45%" }} />
        <span className="tl-pcard-sk-line" style={{ width: "60%" }} />
      </div>
    </div>
  );
}
