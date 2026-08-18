// ============================================================================
// /shop/cart — B08.
// ----------------------------------------------------------------------------
// One group per shop, and no "order everything" button anywhere: each shop
// ships its own parcel, charges its own delivery fee and runs its own returns,
// so one basket paying once would be a promise the platform cannot keep.
//
// Removing a line is UNDOable, so it does not ask. Ten seconds of "Hoàn tác" in
// a live region beats a modal on every tap — the opposite of cancelling an
// order, which is irreversible and therefore does ask.
//
// Never indexed: this page has a person's shopping in it.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShoppingBag, Trash2 } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { ShopCartLink } from "@/components/shop/CartLink";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import { useCartMutations, useCartView, CART_QTY_MAX } from "@/hooks/shop/useCart";
import { usePublicShopPage } from "@/hooks/shop/usePublicShop";
import { formatVnd, mediaBox, publicMediaUrl } from "@/lib/shop/publicCatalog";
import { cartLineProblem, optionSummary } from "@/lib/shop/orderFormat";
import { shopErrorMessage } from "@/lib/shop/errors";
import {
  CONTACT_LABEL,
  contactHref,
  usableContacts,
  type PublicContact,
} from "@/lib/shop/contactCta";
import type { CartGroup, CartLine } from "@/integrations/supabase/shop-schema";
import "@/styles/shop.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

// ─── Copy. EN in the comment above each block, per the spec's bilingual rule ──

// EN: Cart · Subtotal · Order from this shop · Remove · Undo
const COPY = {
  title: "Giỏ hàng",
  subtotal: "Tạm tính",
  checkoutShop: "Đặt hàng shop này",
  remove: "Bỏ",
  undo: "Hoàn tác",
  // EN: Your cart has items from {n} shops. Each shop ships on its own, so you
  // order and receive per shop — shipping is charged separately too.
  multiShop: (n: number) =>
    `Giỏ có sản phẩm của ${n} shop. Mỗi shop tự gửi hàng nên anh/chị đặt và nhận riêng từng shop — phí vận chuyển cũng tính riêng.`,
  // EN: Shipping ({fee}) is added at checkout. / This shop ships free.
  shipLater: (fee: number) =>
    `Chưa gồm phí vận chuyển (${formatVnd(fee)}), tính ở bước đặt hàng.`,
  shipFree: "Shop này miễn phí vận chuyển.",
  // EN: {n} item(s) need fixing before you can order.
  needsFix: (n: number) => `Còn ${n} món cần sửa trước khi đặt.`,
  // EN: Your cart is empty / Add something from the marketplace and come back.
  emptyTitle: "Giỏ hàng đang trống",
  emptyBody: "Thêm sản phẩm từ chợ rồi quay lại đây.",
  emptyCta: "Xem sản phẩm đang bán",
  // EN: We couldn't load your cart. Nothing you added has been lost.
  loadError: "Chưa tải được giỏ hàng. Sản phẩm anh/chị đã thêm vẫn còn.",
  retry: "Thử lại",
  loading: "Đang tải giỏ hàng…",
  // EN: This shop has paused selling. Your items stay in the cart; you can
  // order once the shop reopens.
  paused: "Shop đang tạm ngưng bán.",
  pausedCartKept: "Sản phẩm vẫn nằm trong giỏ, anh/chị đặt được khi shop mở lại.",
  // EN: Max 10 of any one item per order.
  qtyMax: `Mỗi phiên bản tối đa ${CART_QTY_MAX} cái trong một đơn.`,
};

/** How many lines in this shop's group the buyer has to fix first. One
 *  definition, read by the group footer AND by the sticky bar, so the two can
 *  never disagree about whether this shop can be ordered from. */
const groupBlocked = (g: CartGroup) => g.lines.filter((l) => cartLineProblem(l) !== null).length;

const groupPaused = (g: CartGroup) => !g.shop.ordering_enabled || g.shop.state !== "active";

/** The contact button for a paused shop, so "we can't sell you this today" is
 *  not a dead end. Its own component because it needs its own query and a
 *  hook cannot be called inside a map. */
function PausedShopContact({ shopSlug }: { shopSlug: string }) {
  const q = usePublicShopPage(shopSlug);
  const contacts = usableContacts(q.data?.contacts as PublicContact[] | undefined);
  const first = contacts[0];
  if (!first) return null;
  const href = contactHref(first);
  if (!href) return null;
  return (
    <a
      href={href}
      className="tl-shop-btn tl-shop-btn--primary"
      target={first.type === "phone" ? undefined : "_blank"}
      rel="noopener noreferrer nofollow"
    >
      {CONTACT_LABEL[first.type]}
    </a>
  );
}

export default function Cart() {
  const q = useCartView();
  const { setQty, remove, restore } = useCartMutations();

  // Optimistic surfaces. `hidden` drops a removed line the instant it is
  // tapped; `pendingQty` keeps the number the buyer chose on screen while the
  // write is in flight, instead of snapping back and then forward again.
  const [hidden, setHidden] = useState<string[]>([]);
  const [pendingQty, setPendingQty] = useState<Record<string, number>>({});
  const [lineError, setLineError] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<{ variantId: string; qty: number; title: string } | null>(null);
  const undoTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
  }, []);

  const groups = useMemo(
    () =>
      (q.data ?? [])
        .map((g) => ({ ...g, lines: g.lines.filter((l) => !hidden.includes(l.cart_item_id)) }))
        .filter((g) => g.lines.length > 0),
    [q.data, hidden],
  );

  // R5 #10 — the sticky order bar, the same mechanism as the product page.
  // Two shops × three lines at 375px puts the FIRST "Đặt hàng shop này" below
  // the fold on arrival; the bar carries that one shop's button until its real
  // button is on screen, and never shows two at once.
  const firstOrderable = groups.find((g) => !groupPaused(g) && groupBlocked(g) === 0) ?? null;
  const [footNode, setFootNode] = useState<HTMLDivElement | null>(null);
  const [footOffScreen, setFootOffScreen] = useState(false);
  useEffect(() => {
    if (!footNode || typeof IntersectionObserver === "undefined") {
      setFootOffScreen(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setFootOffScreen(!entry.isIntersecting),
      { rootMargin: "-8px 0px 0px 0px" },
    );
    io.observe(footNode);
    return () => io.disconnect();
  }, [footNode]);

  const armUndo = (line: CartLine) => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    setUndo({
      variantId: line.variant_id,
      qty: line.qty,
      title: line.product_title ?? "Sản phẩm",
    });
    undoTimer.current = window.setTimeout(() => setUndo(null), 10_000);
  };

  const onRemove = async (line: CartLine) => {
    setHidden((h) => [...h, line.cart_item_id]);
    armUndo(line);
    try {
      await remove.mutateAsync({ cartItemId: line.cart_item_id });
    } catch (err) {
      setHidden((h) => h.filter((id) => id !== line.cart_item_id));
      setUndo(null);
      setLineError((e) => ({ ...e, [line.cart_item_id]: shopErrorMessage(err) }));
    }
  };

  const onUndo = async () => {
    if (!undo) return;
    const snapshot = undo;
    setUndo(null);
    try {
      await restore.mutateAsync({ variantId: snapshot.variantId, qty: snapshot.qty });
      setHidden([]);
    } catch (err) {
      setLineError((e) => ({ ...e, [snapshot.variantId]: shopErrorMessage(err) }));
    }
  };

  const onQty = async (line: CartLine, next: number) => {
    if (next < 1 || next > CART_QTY_MAX) return;
    setPendingQty((p) => ({ ...p, [line.cart_item_id]: next }));
    setLineError((e) => ({ ...e, [line.cart_item_id]: "" }));
    try {
      await setQty.mutateAsync({ cartItemId: line.cart_item_id, qty: next });
    } catch (err) {
      setLineError((e) => ({ ...e, [line.cart_item_id]: shopErrorMessage(err) }));
    } finally {
      setPendingQty((p) => {
        const { [line.cart_item_id]: _drop, ...rest } = p;
        return rest;
      });
    }
  };

  const topline = (
    <div className="tl-shop-topline">
      {/* R5 #14 — the last crumb WAS the <h1>, 4px below it. */}
      <nav aria-label="Đường dẫn" className="tl-shop-crumbs">
        <Link to="/shop" className="tl-crumb">Chợ</Link>
      </nav>
      <ShopCartLink />
    </div>
  );

  return (
    <TheLineLayout title={COPY.title}>
      <DynamicMeta title={COPY.title} noindex />
      <main className="tl-shop">
        <div
          className={
            firstOrderable
              ? "tl-shop-page tl-shop-page--narrow tl-shop-has-buybar"
              : "tl-shop-page tl-shop-page--narrow"
          }
        >
          {topline}
          <h1 className="tl-shop-h1">{COPY.title}</h1>

          {groups.length > 1 && <p className="tl-shop-sub">{COPY.multiShop(groups.length)}</p>}

          {/* Always in the DOM: a live region mounted with its message is a
              live region most screen readers never announce. */}
          <div role="status" aria-live="polite">
            {undo && (
              <div className="tl-shop-notice">
                <span>Đã bỏ “{undo.title}” khỏi giỏ.</span>
                <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={onUndo}>
                  {COPY.undo}
                </button>
              </div>
            )}
          </div>

          {/* R5 #6 — the shape of a cart line (thumbnail + two text rows), and
              no "Đang tải…" sentence: aria-busy + aria-label already say it,
              and the sentence was the only thing four screens had in common. */}
          {q.isPending && (
            <div aria-busy="true" aria-label={COPY.loading}>
              {[0, 1, 2].map((i) => (
                <div className="tl-shop-line" key={i}>
                  <div className="tl-shop-line-media">
                    <span className="tl-shop-sk" style={{ display: "block", aspectRatio: "1 / 1", borderRadius: 8 }} />
                  </div>
                  <div className="tl-shop-line-body">
                    <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "70%" }} />
                    <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "35%" }} />
                    <span className="tl-shop-sk" style={{ display: "block", height: 44, width: 132, borderRadius: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {q.isError && (
            <ShopErrorNotice title={COPY.loadError} body={null} onRetry={() => void q.refetch()} />
          )}

          {!q.isPending && !q.isError && groups.length === 0 && (
            <div className="tl-shop-empty">
              <ShoppingBag size={28} aria-hidden="true" />
              <p className="tl-shop-empty-title">{COPY.emptyTitle}</p>
              <p>{COPY.emptyBody}</p>
              <Link to="/shop" className="tl-shop-btn tl-shop-btn--primary">{COPY.emptyCta}</Link>
            </div>
          )}

          {groups.map((g) => {
            const paused = groupPaused(g);
            const problems = groupBlocked(g);
            const subtotal = g.lines.reduce(
              (sum, l) => sum + l.unit_price_vnd * (pendingQty[l.cart_item_id] ?? l.qty),
              0,
            );
            const headId = `cart-shop-${g.shop.slug}`;
            return (
              <section key={g.shop.slug} className="tl-shop-sellergroup" aria-labelledby={headId}>
                <div className="tl-shop-sellergroup-head">
                  <h2 id={headId} className="tl-shop-h2" style={{ margin: 0, fontSize: 15 }}>
                    <Link to={`/shop/store/${g.shop.slug}`} className="tl-crumb">{g.shop.name}</Link>
                  </h2>
                </div>

                {paused && (
                  <div className="tl-shop-sellergroup-body">
                    <div className="tl-shop-notice tl-shop-notice--warn">
                      <AlertTriangle size={16} aria-hidden="true" />
                      <div>
                        <strong>{COPY.paused}</strong> {COPY.pausedCartKept}
                      </div>
                    </div>
                  </div>
                )}

                <div className="tl-shop-sellergroup-body">
                  {g.lines.map((line) => {
                    // "out of stock" and "not enough left" arrive under the SAME
                    // reason; only the numbers tell them apart, so the sentence is
                    // chosen in orderFormat.ts, not here.
                    const problem = cartLineProblem(line);
                    const shownQty = pendingQty[line.cart_item_id] ?? line.qty;
                    const busy = pendingQty[line.cart_item_id] !== undefined;
                    const title = line.product_title ?? "Sản phẩm không còn hiển thị";
                    const box = mediaBox(line.cover?.width ?? null, line.cover?.height ?? null, 68);
                    const err = lineError[line.cart_item_id];
                    return (
                      <div className="tl-shop-line" key={line.cart_item_id}>
                        <div className="tl-shop-line-media">
                          {line.cover?.public_path ? (
                            <img
                              src={publicMediaUrl(SUPABASE_URL, line.cover.public_path)}
                              alt={line.cover.alt_text ?? ""}
                              width={box.width}
                              height={box.height}
                              loading="lazy"
                              decoding="async"
                              style={{ width: "100%", height: "auto", borderRadius: 8 }}
                            />
                          ) : (
                            <div
                              className="tl-pcard-noimg"
                              style={{ aspectRatio: "1 / 1", borderRadius: 8 }}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="tl-shop-line-body">
                          <p className="tl-shop-line-title">
                            {line.product_slug ? (
                              <Link to={`/shop/product/${line.product_slug}`} className="tl-crumb">
                                {title}
                              </Link>
                            ) : (
                              title
                            )}
                          </p>
                          {optionSummary(line.option_values) && (
                            <p className="tl-shop-hint" style={{ margin: 0 }}>
                              {optionSummary(line.option_values)}
                            </p>
                          )}
                          <p className="tl-shop-price" style={{ margin: 0 }}>
                            {formatVnd(line.unit_price_vnd * shownQty)}
                          </p>

                          {problem && (
                            <p className="tl-shop-error">
                              <AlertTriangle size={14} aria-hidden="true" />
                              <span>{problem}</span>
                            </p>
                          )}
                          {err && (
                            <p className="tl-shop-error" role="alert">
                              <AlertTriangle size={14} aria-hidden="true" />
                              <span>{err}</span>
                            </p>
                          )}

                          {/* R5 #17 — three 44px controls wrapped to two rows
                              at 375px. The stepper stays, "Bỏ" shrinks and
                              moves right (chốt: giữ icon + chữ, không icon
                              only), and "Xem sản phẩm" goes: the title above
                              is already a link to the same page. */}
                          <div className="tl-shop-line-actions">
                            <span className="tl-shop-qty" aria-busy={busy || undefined}>
                              <button
                                type="button"
                                aria-label={`Giảm số lượng — ${title}`}
                                disabled={busy || shownQty <= 1}
                                onClick={() => void onQty(line, shownQty - 1)}
                              >
                                −
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                readOnly
                                value={shownQty}
                                aria-label={`Số lượng — ${title}`}
                              />
                              <button
                                type="button"
                                aria-label={`Tăng số lượng — ${title}`}
                                disabled={busy || shownQty >= CART_QTY_MAX}
                                onClick={() => void onQty(line, shownQty + 1)}
                              >
                                +
                              </button>
                            </span>
                            <button
                              type="button"
                              className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
                              aria-label={`Bỏ ${title} khỏi giỏ`}
                              onClick={() => void onRemove(line)}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              {COPY.remove}
                            </button>
                          </div>
                          {shownQty >= CART_QTY_MAX && (
                            <p className="tl-shop-hint" style={{ margin: 0 }}>{COPY.qtyMax}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="tl-shop-sellergroup-foot"
                  ref={g.shop.slug === firstOrderable?.shop.slug ? setFootNode : undefined}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tl-shop-row">
                      <span>{COPY.subtotal}</span>
                      <span>{formatVnd(subtotal)}</span>
                    </div>
                    <p className="tl-shop-hint" style={{ margin: 0 }}>
                      {g.shop.shipping_fee_vnd > 0
                        ? COPY.shipLater(g.shop.shipping_fee_vnd)
                        : COPY.shipFree}
                    </p>
                  </div>

                  {paused ? (
                    <PausedShopContact shopSlug={g.shop.slug} />
                  ) : problems > 0 ? (
                    <div>
                      <button
                        type="button"
                        className="tl-shop-btn tl-shop-btn--primary"
                        disabled
                        aria-describedby={`cart-block-${g.shop.slug}`}
                      >
                        {COPY.checkoutShop}
                      </button>
                      <p id={`cart-block-${g.shop.slug}`} className="tl-shop-hint" style={{ margin: 0 }}>
                        {COPY.needsFix(problems)}
                      </p>
                    </div>
                  ) : (
                    <Link
                      to={`/shop/checkout/${g.shop.slug}`}
                      className="tl-shop-btn tl-shop-btn--primary"
                    >
                      {COPY.checkoutShop}
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* R5 #10 — one shop's button, and only while its real button is off
            screen. The bar names the shop, because with two groups "Đặt hàng
            shop này" on its own would be a button pointing at nothing. */}
        {firstOrderable && (
          <div
            className="tl-shop-buybar"
            data-shown={footOffScreen ? "true" : "false"}
            aria-hidden={footOffScreen ? undefined : true}
          >
            <div style={{ minWidth: 0 }}>
              <p className="tl-shop-buybar-price">
                {formatVnd(
                  firstOrderable.lines.reduce(
                    (sum, l) => sum + l.unit_price_vnd * (pendingQty[l.cart_item_id] ?? l.qty),
                    0,
                  ),
                )}
              </p>
              <p className="tl-shop-buybar-sub">{firstOrderable.shop.name}</p>
            </div>
            <Link
              to={`/shop/checkout/${firstOrderable.shop.slug}`}
              className="tl-shop-btn tl-shop-btn--primary"
              tabIndex={footOffScreen ? undefined : -1}
            >
              {COPY.checkoutShop}
            </Link>
          </div>
        )}
      </main>
    </TheLineLayout>
  );
}
