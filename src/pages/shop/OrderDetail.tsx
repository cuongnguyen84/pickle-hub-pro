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

import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { AlertTriangle, ExternalLink, Loader2, PackageX, Phone } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { ShopCartLink } from "@/components/shop/CartLink";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import { OrderMoneyRows } from "@/components/shop/OrderMoneyRows";
import { OrderStatusLine, type CancelActorKind } from "@/components/shop/OrderStatusLine";
import { OrderTimeline } from "@/components/shop/OrderTimeline";
import { OrderPaymentCard } from "@/components/shop/OrderPaymentCard";
import { useOrder, useOrderTransition } from "@/hooks/shop/useOrders";
import { useClaimPayment, useOrderPaymentInfo, useSePayCheckout } from "@/hooks/shop/useOrderPayment";
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
  placedSePay:
    "Đã gửi đơn tới người bán. Quét mã bên dưới để thanh toán ngay; hệ thống sẽ tự xác nhận khi tiền về.",
  // EN: ThePickleHub isn't connected to any courier… check the code yourself.
  trackingNote:
    "ThePickleHub chưa nối với đơn vị vận chuyển nên không theo dõi được tự động — anh/chị tra mã này trên trang của hãng.",
  noTracking: "Người bán chưa cung cấp mã vận đơn.",
  // EN: Pay on delivery.
  payCod: "Trả khi nhận hàng.",
  payBank:
    "Chuyển khoản trước. Anh/chị trao đổi trực tiếp với shop; ThePickleHub không nhận và không giữ tiền của đơn này.",
  paySePay: "Chuyển khoản bằng mã QR; hệ thống tự động đối soát.",
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
  returnH: "Cần đổi hoặc trả hàng?",
  returnBody:
    "Anh/chị liên hệ trực tiếp với shop qua Zalo để trao đổi về tình trạng sản phẩm và cách xử lý.",
  returnZalo: "Liên hệ Zalo của shop",
  returnNoZalo:
    "Shop chưa có Zalo được duyệt. Anh/chị dùng kênh liên hệ ở mục Người bán bên dưới.",
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
  // Only asked for when it can matter. A COD order has nothing to show, and
  // the RPC would answer `bank: null` after a round trip nobody reads.
  const paymentQ = useOrderPaymentInfo(code ?? null, order?.payment_method === "bank_transfer");
  const claim = useClaimPayment();
  const sepay = useSePayCheckout();
  const shopQ = usePublicShopPage(order?.shop?.slug ?? null);
  const contacts = usableContacts(shopQ.data?.contacts as PublicContact[] | undefined);
  const zalo = contacts.find((contact) => contact.type === "zalo") ?? null;
  const zaloHref = zalo ? contactHref(zalo) : null;

  // A bank-transfer buyer already chose to pay at checkout. As soon as the
  // order and its party-scoped payment projection arrive, prepare the inline
  // QR without asking for a second confirmation click.
  useEffect(() => {
    if (
      order?.payment_method === "bank_transfer"
      && paymentQ.data?.gateway?.enabled
      && !paymentQ.data.confirmed_at
      && sepay.isIdle
    ) {
      sepay.mutate(order.code);
    }
  }, [order?.code, order?.payment_method, paymentQ.data?.confirmed_at, paymentQ.data?.gateway?.enabled, sepay.isIdle, sepay.mutate]);

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
      {/* The <h1> here is what the buyer has to DO, not "Đơn hàng", so this
          last crumb is not a duplicate and stays. */}
      <nav aria-label="Đường dẫn" className="tl-shop-crumbs">
        <Link to="/shop/orders" className="tl-crumb">Đơn của tôi</Link>
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
    // R5 #6 — the shape of this page: code line, h1, status line, three cards.
    return shell(
      <div aria-busy="true" aria-label={COPY.loading}>
        <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "35%" }} />
        <span className="tl-shop-sk tl-shop-sk--title" />
        <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "60%" }} />
        <span className="tl-shop-sk tl-shop-sk--card" />
        <span className="tl-shop-sk tl-shop-sk--card" />
        <span className="tl-shop-sk tl-shop-sk--card" />
      </div>,
    );
  }

  if (q.isError) {
    return shell(
      <ShopErrorNotice title={COPY.loadError} body={null} onRetry={() => void q.refetch()} />,
    );
  }

  if (!order) {
    return shell(
      <div className="tl-shop-empty">
        <PackageX size={28} aria-hidden="true" />
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
              : paymentQ.data?.gateway?.enabled ? COPY.placedSePay : COPY.placedBank(shopName)}
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

      {order.status === "delivered" && (
        <section className="tl-shop-card" aria-labelledby="ord-return-help">
          <h2 className="tl-shop-h2" id="ord-return-help">{COPY.returnH}</h2>
          <p className="tl-shop-flush-t">{COPY.returnBody}</p>
          {zaloHref ? (
            <div className="tl-shop-cta-row">
              <a
                href={zaloHref}
                className="tl-shop-btn tl-shop-btn--primary"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                <ExternalLink size={15} aria-hidden="true" />
                {COPY.returnZalo}
              </a>
            </div>
          ) : (
            <p className="tl-shop-hint">{COPY.returnNoZalo}</p>
          )}
        </section>
      )}

      {paymentQ.data && (
        <OrderPaymentCard
          info={paymentQ.data}
          side="buyer"
          cancelled={order.status === "cancelled"}
          onMark={() => claim.mutateAsync(order.code)}
          onGatewayCheckout={() => sepay.mutateAsync(order.code)}
          gatewayPayment={sepay.data}
          gatewayLoading={sepay.isPending}
          gatewayFailed={sepay.isError}
        />
      )}

      <section aria-labelledby="ord-ship">
        <h2 className="tl-shop-h2" id="ord-ship">{COPY.shippingH}</h2>
        {order.tracking_code ? (
          <>
            <p className="tl-shop-flush">
              <strong>{order.tracking_code}</strong>
            </p>
            <p className="tl-shop-hint">{COPY.trackingNote}</p>
          </>
        ) : (
          <p className="tl-shop-hint tl-shop-flush-t">{COPY.noTracking}</p>
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
        <ul className="tl-shop-plainlist" style={{ marginBottom: 12 }}>
          {order.items.map((i) => (
            <li className="tl-shop-line" key={i.id}>
              <div className="tl-shop-line-body">
                <p className="tl-shop-line-title">{i.product_title}</p>
                {i.variant_label && (
                  <p className="tl-shop-hint tl-shop-flush">{i.variant_label}</p>
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
        <p className="tl-shop-flush">{order.recipient_name}</p>
        <p className="tl-shop-flush">{order.recipient_phone}</p>
        <p className="tl-shop-flush">{order.shipping_address}</p>
        {order.delivery_note && (
          <p className="tl-shop-hint">{COPY.noteLabel}: {order.delivery_note}</p>
        )}
      </section>

      <section aria-labelledby="ord-pay">
        <h2 className="tl-shop-h2" id="ord-pay">{COPY.paymentH}</h2>
        <p className="tl-shop-flush">
          {order.payment_method === "cod"
            ? <strong>{COPY.payCod}</strong>
            : paymentQ.data?.gateway?.enabled ? COPY.paySePay : COPY.payBank}
        </p>
        <p className="tl-shop-hint">Đặt lúc {formatWhen(order.created_at)}</p>
      </section>
    </>,
  );
}
