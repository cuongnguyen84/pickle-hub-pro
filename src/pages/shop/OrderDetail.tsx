// ============================================================================
// /shop/order/:code — B12, and B10 with it.
// ----------------------------------------------------------------------------
// B10 ("you've just ordered") is not a screen. It is this screen plus one
// block, switched on by `location.state.justPlaced` — one route, one chunk,
// one copy of the status logic. Pressing F5 loses the state and lands on B12,
// which is correct: a greeting is said once.
//
// The h1 is what the buyer has to DO next, not the status name. Every state
// keeps the shop's contact buttons: the platform has no internal messaging and
// no dispute process, so "talk to the seller" is the answer to everything this
// page cannot resolve.
//
// A code that does not exist and a code belonging to somebody else get the
// SAME sentence. Telling them apart tells a stranger which codes are real.
// ============================================================================

import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { AlertTriangle, ExternalLink, Loader2, Phone } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { ShopCartLink } from "@/components/shop/CartLink";
import { OrderMoneyRows } from "@/components/shop/OrderMoneyRows";
import { OrderStatusLine, type CancelActorKind } from "@/components/shop/OrderStatusLine";
import { OrderTimeline } from "@/components/shop/OrderTimeline";
import { useOrder, useOrderTransition } from "@/hooks/shop/useOrders";
import { usePublicShopPage } from "@/hooks/shop/usePublicShop";
import { useConfirm } from "@/hooks/useConfirm";
import { formatVnd } from "@/lib/shop/publicCatalog";
import { formatWhen } from "@/lib/shop/orderFormat";
import { shopReasonMessage } from "@/lib/shop/errors";
import { ORDER_H1_BUYER } from "@/lib/shop/orderState";
import {
  CONTACT_LABEL,
  contactHref,
  usableContacts,
  type PublicContact,
} from "@/lib/shop/contactCta";
import "@/styles/shop.css";

// EN: Order {code} · Shipping · Timeline · Seller · Items · Delivery address · Payment
const COPY = {
  title: "Đơn hàng",
  code: (c: string) => `Mã đơn ${c}`,
  shippingH: "Vận chuyển",
  timelineH: "Diễn biến",
  sellerH: "Người bán",
  itemsH: "Sản phẩm",
  addressH: "Địa chỉ nhận",
  paymentH: "Thanh toán",
  cancel: "Huỷ đơn",
  cancelBusy: "Đang huỷ…",
  received: "Tôi đã nhận hàng",
  receivedBusy: "Đang xác nhận…",
  retry: "Thử lại",
  loading: "Đang tải đơn hàng…",
  loadError: "Chưa tải được đơn hàng. Đơn của anh/chị vẫn còn nguyên.",
  // EN: We couldn't find this order. / The code may be wrong, or this order
  // doesn't belong to the account you're signed in with.
  notFound: "Không tìm thấy đơn này.",
  notFoundBody:
    "Có thể mã đơn không đúng, hoặc đơn này không thuộc tài khoản đang đăng nhập.",
  backToOrders: "Xem đơn của tôi",
  // EN: Order sent to the seller. Next is waiting for {shop} to confirm. You
  // pay on delivery — nothing to pay now.
  placedCod: (shop: string) =>
    `Đã gửi đơn tới người bán. Bước tiếp theo là chờ ${shop} xác nhận. Anh/chị trả tiền khi nhận hàng, không phải trả gì lúc này.`,
  // EN: Order sent to the seller. Message or call the shop for transfer
  // details — the buttons are under "Người bán". ThePickleHub holds no money.
  placedBank: (shop: string) =>
    `Đã gửi đơn tới người bán. Anh/chị nhắn hoặc gọi ${shop} để nhận thông tin chuyển khoản — nút ở mục Người bán bên dưới. ThePickleHub không nhận và không giữ tiền.`,
  // EN: ThePickleHub isn't connected to any courier… check the code yourself.
  trackingNote:
    "ThePickleHub chưa nối với đơn vị vận chuyển nên không theo dõi được tự động — anh/chị tra mã này trên trang của hãng.",
  noTracking: "Người bán chưa cung cấp mã vận đơn.",
  // EN: Pay on delivery.
  payCod: "Trả khi nhận hàng.",
  payBank:
    "Chuyển khoản trước. Anh/chị trao đổi trực tiếp với shop; ThePickleHub không nhận và không giữ tiền của đơn này.",
  noteLabel: "Ghi chú",
  confirmCancelTitle: "Huỷ đơn này?",
  confirmCancelBody:
    "Đơn sẽ bị huỷ và hàng được trả lại kho của shop. Không hoàn tác được.",
  confirmCancelYes: "Huỷ đơn",
  confirmCancelNo: "Giữ đơn",
  confirmReceivedTitle: "Xác nhận đã nhận hàng?",
  confirmReceivedBody: "Đơn sẽ chuyển sang trạng thái đã giao.",
  confirmReceivedYes: "Đã nhận hàng",
  confirmReceivedNo: "Chưa nhận",
};

export default function OrderDetail() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const justPlaced = (location.state as { justPlaced?: boolean } | null)?.justPlaced === true;
  const q = useOrder(code ?? null);
  const transition = useOrderTransition();
  const confirm = useConfirm();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"cancel" | "deliver" | null>(null);

  const order = q.data ?? null;
  const shopQ = usePublicShopPage(order?.shop?.slug ?? null);
  const contacts = usableContacts(shopQ.data?.contacts as PublicContact[] | undefined);

  const cancelEvent = [...(order?.events ?? [])].reverse().find((e) => e.action === "cancel");
  const cancelledBy = (cancelEvent?.metadata?.actor_kind as CancelActorKind | undefined) ?? null;

  const run = async (action: "cancel" | "deliver") => {
    if (!order) return;
    const ok = await confirm(
      action === "cancel"
        ? {
            title: COPY.confirmCancelTitle,
            description: COPY.confirmCancelBody,
            confirmText: COPY.confirmCancelYes,
            cancelText: COPY.confirmCancelNo,
            destructive: true,
          }
        : {
            title: COPY.confirmReceivedTitle,
            description: COPY.confirmReceivedBody,
            confirmText: COPY.confirmReceivedYes,
            cancelText: COPY.confirmReceivedNo,
          },
    );
    if (!ok) return;
    setActionError(null);
    setPendingAction(action);
    try {
      await transition.mutateAsync({
        orderId: order.id,
        action,
        expectedStatus: order.status,
      });
    } catch (err) {
      setActionError(shopReasonMessage(err));
      // Somebody else moved the order. Show them the row as it is now.
      void q.refetch();
    } finally {
      setPendingAction(null);
    }
  };

  const topline = (
    <div className="tl-shop-topline">
      <nav aria-label="Đường dẫn" className="tl-shop-sub tl-shop-crumbs">
        <Link to="/shop" className="tl-crumb">Chợ</Link>
        <span aria-hidden="true" className="tl-crumb-sep">/</span>
        <span aria-current="page" className="tl-crumb-current">{COPY.title}</span>
      </nav>
      <ShopCartLink />
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <TheLineLayout title={COPY.title}>
      <DynamicMeta title={COPY.title} noindex />
      <main className="tl-shop">
        <div className="tl-shop-page tl-shop-page--narrow">
          {topline}
          {children}
        </div>
      </main>
    </TheLineLayout>
  );

  if (q.isPending) {
    return shell(
      <div aria-busy="true">
        <p className="tl-shop-hint">{COPY.loading}</p>
        <div className="tl-shop-sk" style={{ height: 32, marginBottom: 12 }} />
        <div className="tl-shop-sk" style={{ height: 100, marginBottom: 12 }} />
        <div className="tl-shop-sk" style={{ height: 100, marginBottom: 12 }} />
        <div className="tl-shop-sk" style={{ height: 100 }} />
      </div>,
    );
  }

  if (q.isError) {
    return shell(
      <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
        <AlertTriangle size={16} aria-hidden="true" />
        <div>
          <p style={{ margin: 0 }}>{COPY.loadError}</p>
          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--sm"
            onClick={() => void q.refetch()}
          >
            {COPY.retry}
          </button>
        </div>
      </div>,
    );
  }

  if (!order) {
    return shell(
      <div className="tl-shop-empty">
        <p className="tl-shop-empty-title">{COPY.notFound}</p>
        <p>{COPY.notFoundBody}</p>
        <Link to="/shop/orders" className="tl-shop-btn tl-shop-btn--primary">{COPY.backToOrders}</Link>
      </div>,
    );
  }

  const shopName = order.shop?.name ?? "Người bán";
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
  const busyCancel = pendingAction === "cancel";
  const busyDeliver = pendingAction === "deliver";

  return shell(
    <>
      {justPlaced && (
        <div className="tl-shop-notice tl-shop-notice--info">
          <div>
            {order.payment_method === "cod"
              ? COPY.placedCod(shopName)
              : COPY.placedBank(shopName)}
          </div>
        </div>
      )}

      <p className="tl-shop-eyebrow">{COPY.code(order.code)}</p>
      <h1 className="tl-shop-h1">{ORDER_H1_BUYER[order.status]}</h1>

      <OrderStatusLine
        status={order.status}
        cancelledBy={cancelledBy}
        cancelReason={order.cancel_reason}
        cancelledAt={cancelEvent?.created_at ?? null}
        shopName={shopName}
      />

      {actionError && (
        <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>{actionError}</div>
        </div>
      )}

      {(order.status === "pending" || order.status === "shipped") && (
        <div className="tl-shop-cta-row">
          {order.status === "pending" && (
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--danger"
              disabled={busyCancel}
              aria-busy={busyCancel || undefined}
              onClick={() => void run("cancel")}
            >
              {busyCancel && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {busyCancel ? COPY.cancelBusy : actionError ? COPY.retry : COPY.cancel}
            </button>
          )}
          {order.status === "shipped" && (
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--primary"
              disabled={busyDeliver}
              aria-busy={busyDeliver || undefined}
              onClick={() => void run("deliver")}
            >
              {busyDeliver && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {busyDeliver ? COPY.receivedBusy : actionError ? COPY.retry : COPY.received}
            </button>
          )}
        </div>
      )}

      <section aria-labelledby="ord-ship">
        <h2 className="tl-shop-h2" id="ord-ship">{COPY.shippingH}</h2>
        {order.tracking_code ? (
          <>
            <p style={{ margin: 0 }}>
              <strong>{order.tracking_code}</strong>
            </p>
            <p className="tl-shop-hint">{COPY.trackingNote}</p>
          </>
        ) : (
          <p className="tl-shop-hint" style={{ marginTop: 0 }}>{COPY.noTracking}</p>
        )}
      </section>

      <section aria-labelledby="ord-timeline">
        <h2 className="tl-shop-h2" id="ord-timeline">{COPY.timelineH}</h2>
        <OrderTimeline events={order.events} shopName={shopName} />
      </section>

      <section aria-labelledby="ord-seller">
        <h2 className="tl-shop-h2" id="ord-seller">{COPY.sellerH}</h2>
        <p style={{ margin: "0 0 8px" }}>
          {order.shop?.slug ? (
            <Link to={`/shop/store/${order.shop.slug}`} className="tl-crumb">{shopName}</Link>
          ) : (
            shopName
          )}
        </p>
        <div className="tl-shop-cta-row">
          {contacts.map((c) => {
            const href = contactHref(c);
            return href ? (
              <a
                key={c.id}
                href={href}
                className="tl-shop-btn"
                target={c.type === "phone" ? undefined : "_blank"}
                rel="noopener noreferrer nofollow"
              >
                {c.type === "phone" ? (
                  <Phone size={15} aria-hidden="true" />
                ) : (
                  <ExternalLink size={15} aria-hidden="true" />
                )}
                {CONTACT_LABEL[c.type]}
              </a>
            ) : null;
          })}
        </div>
      </section>

      <section aria-labelledby="ord-items">
        <h2 className="tl-shop-h2" id="ord-items">{COPY.itemsH}</h2>
        <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0 }}>
          {order.items.map((i) => (
            <li className="tl-shop-line" key={i.id}>
              <div className="tl-shop-line-body">
                <p className="tl-shop-line-title">{i.product_title}</p>
                {i.variant_label && (
                  <p className="tl-shop-hint" style={{ margin: 0 }}>{i.variant_label}</p>
                )}
                <div className="tl-shop-row">
                  <span>SL {i.qty}</span>
                  <span>{formatVnd(i.line_total_vnd)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <OrderMoneyRows
          itemsTotalVnd={order.items_total_vnd}
          shippingFeeVnd={order.shipping_fee_vnd}
          totalVnd={order.total_vnd}
          itemCount={itemCount}
        />
      </section>

      <section aria-labelledby="ord-address">
        <h2 className="tl-shop-h2" id="ord-address">{COPY.addressH}</h2>
        <p style={{ margin: 0 }}>{order.recipient_name}</p>
        <p style={{ margin: 0 }}>{order.recipient_phone}</p>
        <p style={{ margin: 0 }}>{order.shipping_address}</p>
        {order.delivery_note && (
          <p className="tl-shop-hint">{COPY.noteLabel}: {order.delivery_note}</p>
        )}
      </section>

      <section aria-labelledby="ord-pay">
        <h2 className="tl-shop-h2" id="ord-pay">{COPY.paymentH}</h2>
        <p style={{ margin: 0 }}>
          {order.payment_method === "cod" ? <strong>{COPY.payCod}</strong> : COPY.payBank}
        </p>
        <p className="tl-shop-hint">Đặt lúc {formatWhen(order.created_at)}</p>
      </section>
    </>,
  );
}
