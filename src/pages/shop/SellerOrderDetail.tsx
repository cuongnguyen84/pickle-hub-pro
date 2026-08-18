// ============================================================================
// /seller/orders/:code — S09.
// ----------------------------------------------------------------------------
// Routed by CODE, not id: the seller reads the code off a message from the
// buyer, and an id in the address bar is a thing nobody can check.
//
// "Việc cần làm" is the FIRST block on the page. A seller opens this screen to
// do one thing; making them scroll past the address and the line items to find
// the button is how an order sits unconfirmed for a day.
//
// Every transition sends `_expected_status` = the status this page is SHOWING.
// Postgres refuses with PT409 / stale_status when the row has moved on, which
// is the whole guard against the seller confirming an order the buyer just
// cancelled. That refusal is not an error message and a shrug: the page
// reloads and says what happened.
//
// Refusing an order REQUIRES a reason, and useConfirm() cannot collect one —
// it has no input. So refusing opens a field, not a dialog.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Loader2,
  Phone,
} from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { ShopScrollShell, SellerShell } from "@/components/shop/ShopShell";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import { OrderMoneyRows } from "@/components/shop/OrderMoneyRows";
import { OrderStatusLine, type CancelActorKind } from "@/components/shop/OrderStatusLine";
import { OrderTimeline } from "@/components/shop/OrderTimeline";
import { OrderPaymentCard } from "@/components/shop/OrderPaymentCard";
import { useMyShopMembership, useShopProfile } from "@/hooks/shop/useShopProfile";
import { useOrder, useOrderTransition } from "@/hooks/shop/useOrders";
import { useConfirmPayment, useOrderPaymentInfo } from "@/hooks/shop/useOrderPayment";
import { shopErrorReason, shopReasonMessage } from "@/lib/shop/errors";
import { formatVnd } from "@/lib/shop/publicCatalog";
import { addressForClipboard, formatWhen, telHref } from "@/lib/shop/orderFormat";
import { PAYMENT_METHOD_LABEL } from "@/lib/shop/orderState";
import { SELLER_TODO, sellerDue, sellerDueLabel } from "@/lib/shop/sellerOrders";
import type { OrderAction, OrderStatus } from "@/integrations/supabase/shop-schema";
import "@/styles/shop.css";

// EN: Order · What to do · Delivery address · Items · Payment · Timeline
const COPY = {
  pageTitle: "Chi tiết đơn",
  h1: (code: string) => `Đơn ${code}`,
  placedAt: (when: string, pay: string) => `Đặt lúc ${when} · ${pay}`,
  todoH: "Việc cần làm",
  addressH: "Địa chỉ giao",
  itemsH: "Sản phẩm",
  paymentH: "Thanh toán",
  timelineH: "Diễn biến",
  loading: "Đang tải đơn hàng…",
  loadError: "Chưa tải được đơn hàng. Đơn của shop vẫn còn nguyên.",
  retry: "Thử lại",
  notFound: "Không tìm thấy đơn này.",
  backToList: "Về danh sách đơn",

  confirm: "Xác nhận đơn",
  confirmBusy: "Đang xác nhận…",
  reject: "Từ chối đơn",
  ship: "Đã gửi hàng",
  shipBusy: "Đang ghi nhận…",
  cancel: "Huỷ đơn",
  deliver: "Ghi nhận đã giao",
  deliverBusy: "Đang ghi nhận…",
  // EN: The order also moves to delivered when the buyer presses "I've
  // received it".
  deliverNote:
    "Đơn cũng tự chuyển sang đã giao khi người mua bấm “Tôi đã nhận hàng”.",
  finished: "Đơn đã kết thúc. Không còn thao tác nào.",

  trackingLabel: "Mã vận đơn",
  // EN: If you have a code, put it in so the buyer can track it. You can send
  // without one.
  trackingHint:
    "Có mã thì nhập để người mua tự tra. Không có cũng gửi được.",

  reasonLabel: "Lý do",
  reasonSend: "Gửi từ chối",
  reasonSendCancel: "Gửi huỷ đơn",
  reasonBusy: "Đang gửi…",
  reasonBack: "Quay lại",
  reasonBlocked: "Nhập lý do để người mua biết vì sao.",
  reasonSeen: "Người mua sẽ đọc đúng câu này.",

  call: "Gọi người mua",
  copy: "Sao chép địa chỉ giao",
  copied: "Đã sao chép",
  copyFailed:
    "Trình duyệt không cho sao chép tự động. Anh/chị bôi đen phần địa chỉ ở trên rồi copy tay.",
  // EN: This phone number is only visible to the shop because there is a real
  // order behind it.
  phonePrivacy: "Số điện thoại này chỉ hiện với shop vì có đơn hàng thật.",
  noteLabel: "Ghi chú của người mua",

  payCod:
    "Trả khi nhận hàng. Anh/chị thu tiền trực tiếp; ThePickleHub không giữ tiền của đơn này.",
  // P4b — the account number is no longer something the seller sends by hand:
  // the buyer sees a QR built from the shop's own bank fields. What has NOT
  // changed is who holds the money, and that sentence stays.
  payBank:
    "Người mua chọn chuyển khoản trước và thấy mã QR dựng từ tài khoản của shop. Tiền đi thẳng vào tài khoản anh/chị — ThePickleHub không nhận, không giữ và không đối soát khoản nào.",

  // EN: This order was just updated somewhere else — the buyer may have
  // cancelled. The page has reloaded.
  stale:
    "Đơn vừa được cập nhật ở nơi khác — có thể người mua vừa huỷ. Trang đã tải lại.",
  supportOnly:
    "Vai trò support chỉ xem được đơn. Chủ shop hoặc quản lý mới xử lý đơn.",
};

type Pending = OrderAction | null;

export default function SellerOrderDetail() {
  const { code } = useParams<{ code: string }>();
  const membership = useMyShopMembership();
  const profile = useShopProfile(membership.data?.shop_id ?? null);
  const q = useOrder(code ?? null);
  const transition = useOrderTransition();
  const paymentQ = useOrderPaymentInfo(
    code ?? null,
    q.data?.payment_method === "bank_transfer",
  );
  const confirmPayment = useConfirmPayment();

  const [pending, setPending] = useState<Pending>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);
  const [reasonFor, setReasonFor] = useState<"reject" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [tracking, setTracking] = useState("");
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    // Focus lands in the box the seller has to fill, not on the button they
    // cannot press yet.
    if (reasonFor) reasonRef.current?.focus();
  }, [reasonFor]);

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
  }, []);

  const order = q.data ?? null;
  const canAct = membership.data?.role !== "support";
  // The order is readable by every party, so a buyer who also sells would
  // otherwise reach their own PURCHASE through the seller route.
  const mine = !!order && !!profile.data && order.shop?.slug === profile.data.slug;

  const shell = (children: React.ReactNode) => (
    <ShopScrollShell>
      <DynamicMeta title={COPY.pageTitle} noindex />
      <SellerShell active="orders" title={COPY.pageTitle}>
        <main className="tl-shop-page tl-shop-page--narrow">{children}</main>
      </SellerShell>
    </ShopScrollShell>
  );

  // Khung xương đúng hình trang: mã đơn, tiêu đề, dòng trạng thái, rồi các thẻ
  // (hành động, hàng hoá, người nhận, nhật ký).
  if (membership.isLoading || profile.isLoading || q.isPending) {
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

  if (membership.isError || profile.isError) {
    return shell(
      <ShopErrorNotice
        title="Chưa tải được shop của anh/chị."
        onRetry={() => void membership.refetch()}
      />,
    );
  }

  if (q.isError) {
    return shell(
      <ShopErrorNotice
        title={COPY.loadError}
        body={null}
        retryLabel={COPY.retry}
        onRetry={() => void q.refetch()}
      />,
    );
  }

  // A code that does not exist and a code belonging to another shop get the
  // SAME sentence. Telling them apart tells a competitor which codes are real.
  if (!order || !mine) {
    return shell(
      <div className="tl-shop-empty">
        <p className="tl-shop-empty-title">{COPY.notFound}</p>
        <Link to="/seller/orders" className="tl-shop-btn tl-shop-btn--primary">{COPY.backToList}</Link>
      </div>,
    );
  }

  const status: OrderStatus = order.status;
  const due = sellerDue(order, Date.now());
  const cancelEvent = [...order.events].reverse().find((e) => e.action === "cancel");
  const cancelledBy = (cancelEvent?.metadata?.actor_kind as CancelActorKind | undefined) ?? null;

  const run = async (action: OrderAction, extra?: { reason?: string; tracking?: string }) => {
    setActionError(null);
    setStaleNotice(false);
    setPending(action);
    try {
      await transition.mutateAsync({
        orderId: order.id,
        action,
        // What the SCREEN is showing, which is the whole point of the guard.
        expectedStatus: status,
        reason: extra?.reason ?? null,
        trackingCode: extra?.tracking?.trim() || null,
      });
      setReasonFor(null);
      setReason("");
      setTracking("");
    } catch (err) {
      if (shopErrorReason(err) === "stale_status") {
        setStaleNotice(true);
        setReasonFor(null);
      } else {
        setActionError(shopReasonMessage(err));
      }
      // Either way the row on screen is not the row in the database.
      void q.refetch();
    } finally {
      setPending(null);
    }
  };

  const onCopy = async () => {
    const text = addressForClipboard(order);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("done");
      copyTimer.current = window.setTimeout(() => setCopied("idle"), 2000);
    } catch {
      // Permissions policy, an insecure origin, or a browser that refuses
      // outside a user gesture it recognises. Say what to do instead.
      setCopied("failed");
    }
  };

  const tel = telHref(order.recipient_phone);
  const busy = (action: OrderAction) => pending === action;
  const anyBusy = pending !== null;

  return shell(
    <>
      {/* Chốt 8: seller screens keep their own nav instead of a breadcrumb —
          but the way back must not be 10px uppercase mono. .tl-shop-back is
          the control the review screens already use. */}
      <Link to="/seller/orders" className="tl-shop-back">
        <ChevronLeft size={16} aria-hidden="true" />
        {COPY.backToList}
      </Link>
      <h1 className="tl-shop-h1">{COPY.h1(order.code)}</h1>
      <p className="tl-shop-sub">
        {COPY.placedAt(formatWhen(order.created_at), PAYMENT_METHOD_LABEL[order.payment_method])}
      </p>

      {status === "pending" && due.kind !== "none" && (
        <p
          className={due.kind === "overdue" ? "tl-shop-overdue" : "tl-shop-hint"}
          style={{ color: due.kind === "overdue" ? "var(--shop-danger)" : "var(--shop-warning)" }}
        >
          {due.kind === "overdue" ? (
            <AlertTriangle size={16} aria-hidden="true" />
          ) : (
            <Clock size={11} aria-hidden="true" />
          )}{" "}
          {sellerDueLabel(due)}
        </p>
      )}

      {status === "cancelled" && (
        <OrderStatusLine
          status="cancelled"
          side="seller"
          cancelledBy={cancelledBy}
          cancelReason={order.cancel_reason}
          cancelledAt={cancelEvent?.created_at ?? null}
        />
      )}

      {/* ── 1. What to do ──────────────────────────────────────────────── */}
      <section aria-labelledby="sod-todo">
        <h2 className="tl-shop-h2" id="sod-todo">{COPY.todoH}</h2>
        <p style={{ marginTop: 0 }}>{SELLER_TODO[status]}</p>

        {staleNotice && (
          <div className="tl-shop-notice tl-shop-notice--warn" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>{COPY.stale}</div>
          </div>
        )}

        {actionError && (
          <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>{actionError}</div>
          </div>
        )}

        {!canAct ? (
          <div className="tl-shop-notice tl-shop-notice--info" role="status">
            <span>{COPY.supportOnly}</span>
          </div>
        ) : reasonFor ? (
          <ReasonForm
            kind={reasonFor}
            reason={reason}
            onReason={setReason}
            busy={busy("cancel")}
            textareaRef={reasonRef}
            onSend={() => void run("cancel", { reason: reason.trim() })}
            onBack={() => {
              setReasonFor(null);
              setReason("");
            }}
          />
        ) : status === "pending" ? (
          <div className="tl-shop-cta-row">
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--primary"
              disabled={anyBusy}
              aria-busy={busy("confirm") || undefined}
              onClick={() => void run("confirm")}
            >
              {busy("confirm") && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {busy("confirm") ? COPY.confirmBusy : actionError ? COPY.retry : COPY.confirm}
            </button>
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--danger"
              disabled={anyBusy}
              onClick={() => setReasonFor("reject")}
            >
              {COPY.reject}
            </button>
          </div>
        ) : status === "confirmed" ? (
          <>
            <div className="tl-shop-field">
              <label className="tl-shop-label" htmlFor="sod-tracking">{COPY.trackingLabel}</label>
              <input
                id="sod-tracking"
                className="tl-shop-input"
                value={tracking}
                maxLength={64}
                aria-describedby="sod-tracking-hint"
                onChange={(e) => setTracking(e.target.value)}
              />
              <p className="tl-shop-hint" id="sod-tracking-hint">{COPY.trackingHint}</p>
            </div>
            <div className="tl-shop-cta-row">
              <button
                type="button"
                className="tl-shop-btn tl-shop-btn--primary"
                disabled={anyBusy}
                aria-busy={busy("ship") || undefined}
                onClick={() => void run("ship", { tracking })}
              >
                {busy("ship") && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {busy("ship") ? COPY.shipBusy : actionError ? COPY.retry : COPY.ship}
              </button>
              <button
                type="button"
                className="tl-shop-btn tl-shop-btn--danger"
                disabled={anyBusy}
                onClick={() => setReasonFor("cancel")}
              >
                {COPY.cancel}
              </button>
            </div>
          </>
        ) : status === "shipped" ? (
          <>
            <div className="tl-shop-cta-row">
              <button
                type="button"
                className="tl-shop-btn tl-shop-btn--primary"
                disabled={anyBusy}
                aria-busy={busy("deliver") || undefined}
                onClick={() => void run("deliver")}
              >
                {busy("deliver") && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {busy("deliver") ? COPY.deliverBusy : actionError ? COPY.retry : COPY.deliver}
              </button>
            </div>
            <p className="tl-shop-hint">{COPY.deliverNote}</p>
          </>
        ) : (
          <div className="tl-shop-notice">
            <span>{COPY.finished}</span>
          </div>
        )}
      </section>

      {/* ── 2. Where it goes ───────────────────────────────────────────── */}
      <section aria-labelledby="sod-address">
        <h2 className="tl-shop-h2" id="sod-address">{COPY.addressH}</h2>
        <p style={{ margin: 0 }}>{order.recipient_name}</p>
        <p style={{ margin: 0 }}>{order.recipient_phone}</p>
        <p style={{ margin: 0 }}>{order.shipping_address}</p>
        {order.delivery_note && (
          <p className="tl-shop-hint">{COPY.noteLabel}: {order.delivery_note}</p>
        )}

        <div className="tl-shop-cta-row" style={{ marginTop: 10 }}>
          {/* A number the CHECK would have refused never becomes an href: a
              dead tel: link is worse than printing the digits. */}
          {tel && (
            <a href={tel} className="tl-shop-btn tl-shop-btn--sm">
              <Phone size={15} aria-hidden="true" />
              {COPY.call}
            </a>
          )}
          <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => void onCopy()}>
            {copied === "done" ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copied === "done" ? COPY.copied : COPY.copy}
          </button>
        </div>
        {/* The label change is visual; this is the same news for a screen
            reader. Always mounted — a live region that appears with its
            message is one most readers never announce. */}
        <div role="status" aria-live="polite" className="tl-shop-sr">
          {copied === "done" ? COPY.copied : ""}
        </div>
        {copied === "failed" && (
          <p className="tl-shop-hint" style={{ color: "var(--shop-danger)" }}>{COPY.copyFailed}</p>
        )}
        <p className="tl-shop-hint">{COPY.phonePrivacy}</p>
      </section>

      {/* ── 3. What is in the parcel ───────────────────────────────────── */}
      <section aria-labelledby="sod-items">
        <h2 className="tl-shop-h2" id="sod-items">{COPY.itemsH}</h2>
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
          itemCount={order.items.reduce((s, i) => s + i.qty, 0)}
        />
      </section>

      {/* ── 4. Who holds the money (nobody here) ───────────────────────── */}
      <section aria-labelledby="sod-pay">
        <h2 className="tl-shop-h2" id="sod-pay">{COPY.paymentH}</h2>
        <p style={{ marginTop: 0 }}>
          {order.payment_method === "cod" ? COPY.payCod : COPY.payBank}
        </p>
      </section>

      {/* `support` reads this screen and moves nothing on it — money included.
          The server refuses them too; this only keeps the button off a screen
          where pressing it could not work. */}
      {paymentQ.data && canAct && (
        <OrderPaymentCard
          info={paymentQ.data}
          side="seller"
          cancelled={order.status === "cancelled"}
          onMark={() => confirmPayment.mutateAsync(order.code)}
        />
      )}

      <section aria-labelledby="sod-timeline">
        <h2 className="tl-shop-h2" id="sod-timeline">{COPY.timelineH}</h2>
        <OrderTimeline events={order.events} shopName={profile.data?.name ?? "Shop"} />
      </section>
    </>,
  );
}

/**
 * The reason field, for the two refusals that require one.
 *
 * Not useConfirm(): that dialog has a title, a body and two buttons, and no
 * way to type. The server refuses a seller-side cancel without `_reason`
 * (22023), so a confirm dialog here would be a dead end with an error at the
 * end of it.
 */
function ReasonForm({
  kind,
  reason,
  onReason,
  busy,
  textareaRef,
  onSend,
  onBack,
}: {
  kind: "reject" | "cancel";
  reason: string;
  onReason: (v: string) => void;
  busy: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onSend: () => void;
  onBack: () => void;
}) {
  const empty = reason.trim().length === 0;
  return (
    <div className="tl-shop-field">
      <label className="tl-shop-label" htmlFor="sod-reason">{COPY.reasonLabel}</label>
      <textarea
        id="sod-reason"
        ref={textareaRef}
        className="tl-shop-textarea"
        rows={3}
        maxLength={300}
        value={reason}
        aria-describedby="sod-reason-seen"
        onChange={(e) => onReason(e.target.value)}
      />
      <p className="tl-shop-hint" id="sod-reason-seen">{COPY.reasonSeen}</p>
      <div className="tl-shop-cta-row">
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--danger"
          disabled={empty || busy}
          aria-busy={busy || undefined}
          aria-describedby={empty ? "sod-reason-blocked" : undefined}
          onClick={onSend}
        >
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {busy ? COPY.reasonBusy : kind === "reject" ? COPY.reasonSend : COPY.reasonSendCancel}
        </button>
        <button type="button" className="tl-shop-btn" disabled={busy} onClick={onBack}>
          {COPY.reasonBack}
        </button>
      </div>
      {/* A disabled button always says why, next to itself. Never a title. */}
      {empty && (
        <p className="tl-shop-hint" id="sod-reason-blocked" style={{ margin: 0 }}>
          {COPY.reasonBlocked}
        </p>
      )}
    </div>
  );
}
