// ============================================================================
// /shop/checkout/:shopSlug — B09.
// ----------------------------------------------------------------------------
// One shop, one order, one column at every width. The buyer scrolls straight
// through: address, payment, what they are buying, the shop's own policy, the
// total, the button. No sticky summary — at 760px there is nothing to stick.
//
// Three things here are load-bearing and easy to get wrong:
//
//   · the idempotency token is minted ONCE per shop per checkout and kept in
//     sessionStorage, so an F5 half way through replays the same token and
//     shop_order_create returns the FIRST order instead of making a second.
//   · the order button never re-enables itself. It comes back only when the
//     server answered — with an error. A button that reopens on a timeout is
//     how a buyer creates two orders.
//   · price / shipping / stock drift is NOT a toast. It is an alert that says
//     which line and from what to what, it updates the numbers on screen, and
//     it puts the button back to "not pressed yet" so the buyer confirms the
//     new total themselves.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, ShoppingBag } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { ShopCartLink } from "@/components/shop/CartLink";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import { OrderMoneyRows } from "@/components/shop/OrderMoneyRows";
import { cartGroupFor, useCartView } from "@/hooks/shop/useCart";
import { useLastShippingAddress, useOrderCreate } from "@/hooks/shop/useOrders";
import { usePublicShopPage } from "@/hooks/shop/usePublicShop";
import { formatVnd } from "@/lib/shop/publicCatalog";
import { optionSummary } from "@/lib/shop/orderFormat";
import { shopErrorDetail, shopErrorReason, shopReasonMessage } from "@/lib/shop/errors";
import {
  CONTACT_LABEL,
  contactHref,
  usableContacts,
  type PublicContact,
} from "@/lib/shop/contactCta";
import type { PaymentMethod } from "@/integrations/supabase/shop-schema";
import "@/styles/shop.css";

// EN: Place order · Delivery address · Payment · Check this over · Shop policy
const COPY = {
  title: "Đặt hàng",
  // EN: This order only contains items from {shop}. Anything from another shop
  // stays in your cart.
  sub: (shop: string) =>
    `Đơn này chỉ gồm sản phẩm của ${shop}. Sản phẩm của shop khác trong giỏ vẫn nằm nguyên ở đó.`,
  addressH: "1. Địa chỉ nhận hàng",
  paymentH: "2. Thanh toán",
  reviewH: "3. Kiểm tra lại",
  policyH: "4. Chính sách của shop",
  totalH: "Tổng cộng",
  name: "Họ tên người nhận",
  phone: "Số điện thoại",
  address: "Địa chỉ nhận hàng",
  note: "Ghi chú cho người giao (không bắt buộc)",
  // EN: Include house number, street, ward, district and province. The seller
  // copies this line straight onto the parcel.
  addressHint:
    "Ghi đủ số nhà, đường, phường/xã, quận/huyện, tỉnh/thành. Người bán chép đúng dòng này sang phiếu gửi hàng.",
  addressPlaceholder:
    "Số 12 ngõ 5 Trần Duy Hưng, phường Trung Hoà, quận Cầu Giấy, Hà Nội",
  // EN: Pay on delivery (COD) / Bank transfer first — the shop will send details
  // R5 (cắt chữ): mỗi radio còn ĐÚNG một dòng. Câu "ThePickleHub không nhận
  // tiền, không giữ tiền" chỉ nói một lần, ngay cạnh nút đặt đơn.
  codLabel: "Trả khi nhận hàng (COD)",
  codHint: "Anh/chị trả tiền trực tiếp cho người giao.",
  bankLabel: "Chuyển khoản trước — shop sẽ gửi thông tin",
  bankHint: "Đặt xong, anh/chị nhắn Zalo hoặc gọi shop để nhận thông tin chuyển khoản.",
  // EN: This fee applies to every province… no promised delivery date.
  // R5 (cắt chữ): hai đoạn gộp một, không mất thông tin nào.
  shipEveryProvince:
    "Phí này áp dụng mọi tỉnh thành. ThePickleHub không thu thêm phí nào và chưa nối với đơn vị vận chuyển, nên người bán sẽ đưa mã vận đơn để anh/chị tự tra.",
  // EN: Pressing "Order" sends a request to {shop}. They confirm before shipping.
  submitNote: (shop: string) =>
    `Bấm “Đặt đơn” là gửi yêu cầu tới ${shop}. Người bán xác nhận rồi mới gửi hàng. ThePickleHub không nhận tiền và không giữ tiền của đơn này.`,
  submit: "Đặt đơn",
  submitBusy: "Đang gửi đơn…",
  submitRetry: "Thử lại",
  backToCart: "Về giỏ hàng",
  loading: "Đang tải đơn hàng…",
  // EN: Nothing from this shop is in your cart any more.
  emptyGroup: "Không còn món nào của shop này trong giỏ.",
  loadError: "Chưa tải được giỏ hàng. Sản phẩm anh/chị đã thêm vẫn còn.",
  retry: "Thử lại",
  paused: "Shop đang tạm ngưng bán.",
  pausedCartKept: "Sản phẩm vẫn nằm trong giỏ, anh/chị đặt được khi shop mở lại.",
  // EN: The order wasn't created. The connection dropped. No order exists yet…
  network:
    "Chưa tạo được đơn. Mất kết nối lúc gửi. Chưa có đơn nào được tạo, và giỏ hàng của anh/chị vẫn nguyên. Bấm lại để thử tiếp.",
  errName: "Nhập họ tên người nhận.",
  errPhone:
    "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0. Người bán cần số này để gọi khi giao hàng.",
  errAddress:
    "Ghi đủ số nhà, đường, phường/xã, quận/huyện và tỉnh/thành để người bán gửi được hàng.",
  // EN: Fix the delivery details above before ordering.
  errBlocked: "Điền đủ và đúng thông tin nhận hàng ở trên rồi mới đặt được.",
};

interface Form {
  name: string;
  phone: string;
  address: string;
  note: string;
}

const problems = (f: Form) => ({
  name: f.name.trim().length < 2 ? COPY.errName : "",
  phone: /^0\d{9}$/.test(f.phone.trim()) ? "" : COPY.errPhone,
  address: f.address.trim().length < 12 ? COPY.errAddress : "",
});

/**
 * One token per shop per checkout, held in sessionStorage.
 *
 * useRef would lose it on the F5 this is meant to survive; localStorage would
 * keep it after the tab is closed and replay a week-old order. sessionStorage
 * is exactly the lifetime of "this buyer, this attempt".
 */
function checkoutToken(shopSlug: string): string {
  const key = `shop.checkout.token.${shopSlug}`;
  try {
    const held = window.sessionStorage.getItem(key);
    if (held) return held;
    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    // Private mode with storage disabled: a per-mount token still protects the
    // double tap, which is the common case.
    return crypto.randomUUID();
  }
}

const clearCheckoutToken = (shopSlug: string) => {
  try {
    window.sessionStorage.removeItem(`shop.checkout.token.${shopSlug}`);
  } catch {
    /* nothing to clear */
  }
};

export default function Checkout() {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const navigate = useNavigate();
  const cart = useCartView();
  const shopQ = usePublicShopPage(shopSlug ?? null);
  const lastAddress = useLastShippingAddress();
  const create = useOrderCreate();

  const group = cartGroupFor(cart.data, shopSlug);
  const [form, setForm] = useState<Form>({ name: "", phone: "", address: "", note: "" });
  const [touched, setTouched] = useState<Record<keyof Form, boolean>>({
    name: false, phone: false, address: false, note: false,
  });
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [alertText, setAlertText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);

  // R5 #9 — sticky order bar, the ProductDetail mechanism reused verbatim:
  // the node is state (not a ref) so the effect re-runs exactly when the
  // button mounts or unmounts.
  const [submitNode, setSubmitNode] = useState<HTMLDivElement | null>(null);
  const [submitOffScreen, setSubmitOffScreen] = useState(false);
  useEffect(() => {
    if (!submitNode || typeof IntersectionObserver === "undefined") {
      setSubmitOffScreen(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setSubmitOffScreen(!entry.isIntersecting),
      { rootMargin: "-8px 0px 0px 0px" },
    );
    io.observe(submitNode);
    return () => io.disconnect();
  }, [submitNode]);

  const errors = problems(form);
  // Only a mistake the buyer has already been TOLD about disables the button.
  // Disabling it on an untouched empty form is a dead control on arrival with
  // nothing on screen explaining why; pressing it instead marks every field
  // touched and moves focus to the first problem.
  const blocked = !!(
    (touched.name && errors.name) ||
    (touched.phone && errors.phone) ||
    (touched.address && errors.address)
  );

  const paused = !!group && (!group.shop.ordering_enabled || group.shop.state !== "active");
  const itemsTotal = useMemo(
    () => (group?.lines ?? []).reduce((s, l) => s + l.line_total_vnd, 0),
    [group],
  );
  const shippingFee = group?.shop.shipping_fee_vnd ?? 0;
  const total = itemsTotal + shippingFee;
  const itemCount = (group?.lines ?? []).reduce((s, l) => s + l.qty, 0);

  // A shop that pauses selling while the buyer is filling the form must not be
  // left with a live button.
  useEffect(() => {
    if (paused) setAlertText(null);
  }, [paused]);

  // Prefill from the last order, EMPTY FIELDS ONLY. It arrives after first
  // paint, so a buyer who started typing before it landed must not have their
  // half-typed address replaced under the cursor. Nothing is marked touched:
  // a field the buyer has not looked at yet should not be showing an error.
  const prefill = lastAddress.data;
  useEffect(() => {
    if (!prefill) return;
    setForm((f) => ({
      ...f,
      name: f.name || prefill.recipient_name,
      phone: f.phone || prefill.recipient_phone,
      address: f.address || prefill.shipping_address,
    }));
  }, [prefill]);

  const titleOfVariant = (variantId: unknown) =>
    (group?.lines ?? []).find((l) => l.variant_id === variantId)?.product_title ?? "Món này";

  const onSubmit = async () => {
    if (!group || !shopSlug) return;
    setTouched({ name: true, phone: true, address: true, note: true });
    if (errors.name) return nameRef.current?.focus();
    if (errors.phone) return phoneRef.current?.focus();
    if (errors.address) return addressRef.current?.focus();

    setAlertText(null);
    setFailed(false);
    try {
      const order = await create.mutateAsync({
        clientToken: checkoutToken(shopSlug),
        paymentMethod: payment,
        recipientName: form.name.trim(),
        recipientPhone: form.phone.trim(),
        shippingAddress: form.address.trim(),
        deliveryNote: form.note.trim() || null,
        expectedShippingFeeVnd: shippingFee,
        items: group.lines.map((l) => ({
          variant_id: l.variant_id,
          qty: l.qty,
          expected_unit_price_vnd: l.unit_price_vnd,
        })),
      });
      // Cleared even on a replay: the token did its job either way, and
      // keeping it would replay this same order from the next checkout.
      clearCheckoutToken(shopSlug);
      navigate(`/shop/order/${order.code}`, { replace: true, state: { justPlaced: true } });
    } catch (err) {
      const reason = shopErrorReason(err);
      const detail = shopErrorDetail(err) ?? {};
      if (reason === "price_changed") {
        setAlertText(
          `Giá vừa thay đổi trong lúc anh/chị điền. ${titleOfVariant(detail.variant_id)}: từ ` +
            `${formatVnd(Number(detail.expected))} thành ${formatVnd(Number(detail.current))}. ` +
            "Tổng bên dưới đã tính lại — xem lại rồi bấm đặt lần nữa.",
        );
        void cart.refetch();
      } else if (reason === "shipping_fee_changed") {
        setAlertText(
          `Phí vận chuyển vừa thay đổi: từ ${formatVnd(Number(detail.expected))} thành ` +
            `${formatVnd(Number(detail.current))}. Tổng đã tính lại — xem lại rồi bấm đặt lần nữa.`,
        );
        void cart.refetch();
      } else if (reason === "insufficient_stock") {
        setAlertText(
          `${titleOfVariant(detail.variant_id)} vừa hết hàng. Về giỏ để bỏ món này ra rồi ` +
            "đặt phần còn lại.",
        );
        void cart.refetch();
      } else if (reason) {
        setAlertText(shopReasonMessage(err));
        void cart.refetch();
      } else {
        setAlertText(COPY.network);
      }
      setFailed(true);
    }
  };

  const contacts = usableContacts(shopQ.data?.contacts as PublicContact[] | undefined);
  const shopName = group?.shop.name ?? shopQ.data?.shop?.name ?? "shop";
  const busy = create.isPending;
  const buttonLabel = busy
    ? COPY.submitBusy
    : `${failed ? COPY.submitRetry : COPY.submit} · ${formatVnd(total)}`;

  const topline = (
    <div className="tl-shop-topline">
      <nav aria-label="Đường dẫn" className="tl-shop-sub tl-shop-crumbs">
        <Link to="/shop/cart" className="tl-crumb">Giỏ hàng</Link>
        <span aria-hidden="true" className="tl-crumb-sep">/</span>
        <span aria-current="page" className="tl-crumb-current">{COPY.title}</span>
      </nav>
      <ShopCartLink />
    </div>
  );

  const shell = (children: React.ReactNode, sticky?: React.ReactNode) => (
    <TheLineLayout title={COPY.title}>
      <DynamicMeta title={COPY.title} noindex />
      <main className="tl-shop">
        <div
          className={
            sticky
              ? "tl-shop-page tl-shop-page--narrow tl-shop-has-buybar"
              : "tl-shop-page tl-shop-page--narrow"
          }
        >
          {topline}
          {children}
        </div>
        {sticky}
      </main>
    </TheLineLayout>
  );

  if (cart.isPending) {
    // R5 #6 — the shape of this form: three fields and the total card.
    return shell(
      <div aria-busy="true" aria-label={COPY.loading}>
        <h1 className="tl-shop-h1">{COPY.title}</h1>
        <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "30%" }} />
        <span className="tl-shop-sk tl-shop-sk--card" style={{ height: 44 }} />
        <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "30%" }} />
        <span className="tl-shop-sk tl-shop-sk--card" style={{ height: 44 }} />
        <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "40%" }} />
        <span className="tl-shop-sk tl-shop-sk--card" style={{ height: 96 }} />
        <span className="tl-shop-sk tl-shop-sk--card" style={{ height: 120 }} />
      </div>,
    );
  }

  if (cart.isError) {
    return shell(
      <>
        <h1 className="tl-shop-h1">{COPY.title}</h1>
        <ShopErrorNotice title={COPY.loadError} body={null} onRetry={() => void cart.refetch()} />
      </>,
    );
  }

  if (!group || group.lines.length === 0) {
    return shell(
      <>
        <h1 className="tl-shop-h1">{COPY.title}</h1>
        <div className="tl-shop-empty">
          <ShoppingBag size={28} aria-hidden="true" />
          <p className="tl-shop-empty-title">{COPY.emptyGroup}</p>
          <Link to="/shop/cart" className="tl-shop-btn tl-shop-btn--primary">{COPY.backToCart}</Link>
        </div>
      </>,
    );
  }

  if (paused) {
    // No form at all, and no disabled button: there is nothing the buyer could
    // do with either. The way out is the shop's own phone number.
    return shell(
      <>
        <h1 className="tl-shop-h1">{COPY.title}</h1>
        <div className="tl-shop-notice">
          <div>
            <strong>{COPY.paused}</strong> {COPY.pausedCartKept}
          </div>
        </div>
        {/* Secondary, not primary: green means "this buys something", and on a
            paused shop nothing on this screen does. The product page and the
            cart already say it the same way. Contact still reads first because
            "quay lại giỏ" drops to ghost below it — three weights, one rule. */}
        <div className="tl-shop-contactrow">
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
                {CONTACT_LABEL[c.type]}
              </a>
            ) : null;
          })}
          <Link to="/shop/cart" className="tl-shop-btn tl-shop-btn--ghost">
            {COPY.backToCart}
          </Link>
        </div>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="tl-shop-h1">{COPY.title}</h1>
      <p className="tl-shop-sub">{COPY.sub(shopName)}</p>

      {alertText && (
        <div className="tl-shop-notice tl-shop-notice--warn" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>{alertText}</div>
        </div>
      )}

      <section aria-labelledby="co-address" className="tl-shop-section">
        <h2 className="tl-shop-h2" id="co-address">{COPY.addressH}</h2>

        <div className="tl-shop-field">
          <label className="tl-shop-label" htmlFor="co-name">{COPY.name}</label>
          <input
            id="co-name"
            ref={nameRef}
            className="tl-shop-input"
            autoComplete="name"
            value={form.name}
            aria-invalid={touched.name && !!errors.name}
            aria-describedby={touched.name && errors.name ? "co-name-err" : undefined}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          />
          {touched.name && errors.name && (
            <p className="tl-shop-error" id="co-name-err">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{errors.name}</span>
            </p>
          )}
        </div>

        <div className="tl-shop-field">
          <label className="tl-shop-label" htmlFor="co-phone">{COPY.phone}</label>
          <input
            id="co-phone"
            ref={phoneRef}
            className="tl-shop-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            aria-invalid={touched.phone && !!errors.phone}
            aria-describedby={touched.phone && errors.phone ? "co-phone-err" : undefined}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          />
          {touched.phone && errors.phone && (
            <p className="tl-shop-error" id="co-phone-err">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{errors.phone}</span>
            </p>
          )}
        </div>

        <div className="tl-shop-field">
          <label className="tl-shop-label" htmlFor="co-address-input">{COPY.address}</label>
          <textarea
            id="co-address-input"
            ref={addressRef}
            className="tl-shop-textarea"
            rows={3}
            maxLength={300}
            autoComplete="street-address"
            placeholder={COPY.addressPlaceholder}
            value={form.address}
            aria-invalid={touched.address && !!errors.address}
            aria-describedby={
              touched.address && errors.address ? "co-address-err" : "co-address-hint"
            }
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, address: true }))}
          />
          {touched.address && errors.address ? (
            <p className="tl-shop-error" id="co-address-err">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{errors.address}</span>
            </p>
          ) : (
            <p className="tl-shop-hint" id="co-address-hint">{COPY.addressHint}</p>
          )}
        </div>

        <div className="tl-shop-field">
          <label className="tl-shop-label" htmlFor="co-note">{COPY.note}</label>
          <textarea
            id="co-note"
            className="tl-shop-textarea"
            rows={2}
            maxLength={200}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
      </section>

      <section aria-labelledby="co-pay" className="tl-shop-section">
        <h2 className="tl-shop-h2" id="co-pay">{COPY.paymentH}</h2>
        <fieldset className="tl-shop-fieldset">
          <legend className="tl-shop-sr">{COPY.paymentH}</legend>
          <label className="tl-shop-check">
            <input
              type="radio"
              name="payment"
              value="cod"
              checked={payment === "cod"}
              onChange={() => setPayment("cod")}
            />
            <span>{COPY.codLabel}</span>
          </label>
          <p className="tl-shop-hint">{COPY.codHint}</p>
          <label className="tl-shop-check">
            <input
              type="radio"
              name="payment"
              value="bank_transfer"
              checked={payment === "bank_transfer"}
              onChange={() => setPayment("bank_transfer")}
            />
            <span>{COPY.bankLabel}</span>
          </label>
          <p className="tl-shop-hint">{COPY.bankHint}</p>
        </fieldset>
      </section>

      <section aria-labelledby="co-review" className="tl-shop-section">
        <h2 className="tl-shop-h2" id="co-review">{COPY.reviewH}</h2>
        <ul className="tl-shop-plainlist">
          {group.lines.map((l) => (
            <li className="tl-shop-line" key={l.cart_item_id}>
              <div className="tl-shop-line-body">
                <p className="tl-shop-line-title">{l.product_title ?? "Sản phẩm"}</p>
                {optionSummary(l.option_values) && (
                  <p className="tl-shop-hint tl-shop-flush">
                    {optionSummary(l.option_values)}
                  </p>
                )}
                <div className="tl-shop-row">
                  <span>SL {l.qty}</span>
                  <span>{formatVnd(l.line_total_vnd)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {(shopQ.data?.shop?.shipping_note || shopQ.data?.shop?.return_note) && (
        <section aria-labelledby="co-policy" className="tl-shop-section">
          <h2 className="tl-shop-h2" id="co-policy">{COPY.policyH}</h2>
          <dl className="tl-shop-deflist">
            {shopQ.data?.shop?.shipping_note && (
              <div>
                <dt>Gửi hàng</dt>
                <dd>{shopQ.data.shop.shipping_note}</dd>
              </div>
            )}
            {shopQ.data?.shop?.return_note && (
              <div>
                <dt>Đổi trả</dt>
                <dd>{shopQ.data.shop.return_note}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section aria-labelledby="co-total" className="tl-shop-section">
        <h2 className="tl-shop-h2" id="co-total">{COPY.totalH}</h2>
        <div className="tl-shop-card">
          <OrderMoneyRows
            itemsTotalVnd={itemsTotal}
            shippingFeeVnd={shippingFee}
            totalVnd={total}
            itemCount={itemCount}
          />
          <p className="tl-shop-hint tl-shop-flush-b">{COPY.shipEveryProvince}</p>
        </div>

        <div ref={setSubmitNode}>
          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
            style={{ marginTop: 16 }}
            disabled={busy || blocked}
            aria-busy={busy || undefined}
            aria-describedby={blocked ? "co-blocked" : "co-submit-note"}
            onClick={() => void onSubmit()}
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {buttonLabel}
          </button>
          {blocked && (
            <p className="tl-shop-hint" id="co-blocked">{COPY.errBlocked}</p>
          )}
          <p className="tl-shop-hint" id="co-submit-note">{COPY.submitNote(shopName)}</p>
        </div>
      </section>
    </>,
    // R5 #9 — the same sticky bar as the product page. "Đặt đơn" sat about
    // three and a half screens down at 375px; the bar carries it until the
    // real button is on screen, and never shows two live buttons at once.
    <div
      className="tl-shop-buybar"
      data-shown={submitOffScreen ? "true" : "false"}
      aria-hidden={submitOffScreen ? undefined : true}
    >
      <div>
        <p className="tl-shop-buybar-price">{formatVnd(total)}</p>
        <p className="tl-shop-buybar-sub">{shopName}</p>
      </div>
      <button
        type="button"
        className="tl-shop-btn tl-shop-btn--primary"
        disabled={busy}
        aria-busy={busy || undefined}
        tabIndex={submitOffScreen ? undefined : -1}
        // Thiếu thông tin nhận hàng thì đưa người mua lên đúng ô phải điền,
        // thay vì để họ bấm một nút xám không giải thích được ở đây.
        onClick={() => void onSubmit()}
      >
        {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {busy ? COPY.submitBusy : failed ? COPY.submitRetry : COPY.submit}
      </button>
    </div>,
  );
}
