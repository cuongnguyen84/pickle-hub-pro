// ============================================================================
// One product, as a buyer sees it in a list.
// ----------------------------------------------------------------------------
// The whole card is one link. Nothing interactive is nested inside it: no
// save, no add-to-cart, no shop link — partly because P2b has no cart to add
// to, and partly because a button inside a link is a keyboard trap and an
// ambiguous tap target. The round "→" is a decorative span, not a control;
// the action it suggests is the card's own navigation.
//
// Every claim comes from the server. There is no struck-out original price,
// no "chỉ còn 2", no badge the data cannot support. "Còn hàng" is not printed
// either: in-stock is the default state of a shop, only "Hết hàng" is news.
// ============================================================================

import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, ImageOff } from "lucide-react";
import type { ProductCard as Card } from "@/hooks/shop/usePublicShop";
import {
  CONDITION_LABEL,
  isSoldOut,
  mediaBox,
  priceLabel,
  publicMediaUrl,
} from "@/lib/shop/publicCatalog";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

/** Rendered width used to reserve the image box. The CSS crops to 1:1; the
 *  attributes still let the browser start layout before bytes land. */
const BOX_W = 400;

export function ProductCard({ card, eager = false }: { card: Card; eager?: boolean }) {
  const price = priceLabel(card);
  const soldOut = isSoldOut(card.availability);
  const box = mediaBox(card.cover?.width ?? null, card.cover?.height ?? null, BOX_W);

  // R4: no aria-label on the link — it would OVERRIDE the accessible name and
  // hide the price/shop from screen readers. The name is the full text content.
  return (
    <Link to={`/shop/product/${card.slug}`} className="tl-pcard">
      <span className="tl-pcard-media">
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
          <span className="tl-pcard-noimg" aria-hidden="true">
            <ImageOff size={20} />
            <span>Chưa có ảnh</span>
          </span>
        )}
        {soldOut && <span className="tl-pcard-flag">Hết hàng</span>}
      </span>

      <span className="tl-pcard-body">
        <span className="tl-pcard-title">{card.title}</span>

        <span className="tl-pcard-meta">
          {card.condition === "used" && <span>{CONDITION_LABEL.used} ·</span>}
          <span className="tl-pcard-shopname">{card.shop.name}</span>
          {card.shop.verified && (
            <>
              <BadgeCheck size={13} aria-hidden="true" className="tl-pcard-verified" />
              <span className="tl-shop-sr">shop đã được ThePickleHub xác minh</span>
            </>
          )}
        </span>

        <span className="tl-pcard-foot">
          <span className="tl-pcard-price">
            {price ?? <span className="tl-pcard-noprice">Chưa có giá</span>}
          </span>
          <span className="tl-pcard-go" aria-hidden="true">
            <ArrowRight size={16} />
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Same box as a card, so a grid does not reflow when the real ones arrive. */
export function ProductCardSkeleton() {
  return (
    <div className="tl-pcard tl-pcard--skeleton" aria-hidden="true">
      <div className="tl-pcard-media" />
      <div className="tl-pcard-body">
        <span className="tl-pcard-sk-line" style={{ width: "85%" }} />
        <span className="tl-pcard-sk-line" style={{ width: "60%" }} />
        <div className="tl-pcard-foot">
          <span className="tl-pcard-sk-line" style={{ width: 60, height: 16 }} />
          <span className="tl-pcard-sk-circle" />
        </div>
      </div>
    </div>
  );
}
