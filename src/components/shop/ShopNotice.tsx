// ============================================================================
// The Shop's one error surface.
// ----------------------------------------------------------------------------
// R5 audit #7/#8. Before this file the Shop had three different ways to say
// "the request failed": `tl-shop-notice--danger` on the buyer pages, the
// dashed `tl-shop-empty` frame in the catalogue grid (which reads exactly like
// "there is nothing here"), and `ErrorState` — a component from the shadcn
// side of the house, with its own frame, its own button and generic i18n copy.
//
// The rule the whole Shop follows now:
//
//   dashed frame  = there is nothing here (tl-shop-empty)
//   red stripe    = the request failed    (this component)
//
// Nothing else belongs in here. It is deliberately NOT in ShopShell.tsx: that
// module carries SellerShell and AdminShopFrame, so a buyer page importing the
// error notice from there would drag the seller nav into the shopper's chunk.
// ============================================================================

import { AlertTriangle } from "lucide-react";

// EN: We couldn't load this. · Nothing of yours is lost — this load failed,
// not your data. · Try again
const COPY = {
  title: "Chưa tải được dữ liệu.",
  body: "Không có gì của anh/chị bị mất — chỉ là lần tải này hỏng.",
  retry: "Thử lại",
};

export function ShopErrorNotice({
  title = COPY.title,
  body = COPY.body,
  retryLabel = COPY.retry,
  onRetry,
}: {
  title?: string;
  /** One reassuring sentence. Pass `null` when the title already says it. */
  body?: string | null;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {body ? <> {body}</> : null}
        {onRetry && (
          <div style={{ marginTop: 10 }}>
            <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={onRetry}>
              {retryLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
