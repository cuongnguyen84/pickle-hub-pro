// ============================================================================
// /seller/orders — S08.
// ----------------------------------------------------------------------------
// Same shape as /seller/products: a table on a desktop because a seller scans
// many rows, cards on a phone because a six-column table at 375px is sideways
// scrolling inside a management surface. `[data-desktop-only]` /
// `[data-mobile-only]` do the switching — an inline `display` beats the media
// query, which is how the card list once rendered underneath the table.
//
// The ORDER of the rows is the feature. It lives in lib/shop/sellerOrders.ts
// with a test, because sorting by order date — the obvious thing — buries the
// order that is two hours from its deadline under everything newer.
//
// `confirm_due_at` is shown ONLY on a pending order. Every row has one (it is
// NOT NULL with a 48h default), and nothing in the system acts on it: no job
// cancels, no admin steps in. The wording says so by saying nothing.
// ============================================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, Inbox, PackageOpen } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { ShopScrollShell, SellerShell } from "@/components/shop/ShopShell";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import { useMyShopMembership, useShopProfile } from "@/hooks/shop/useShopProfile";
import { useShopOrders, type OrderListRow } from "@/hooks/shop/useOrders";
import { shopErrorMessage } from "@/lib/shop/errors";
import { formatVnd } from "@/lib/shop/publicCatalog";
import { formatWhen } from "@/lib/shop/orderFormat";
import {
  SELLER_TABS,
  SELLER_TODO,
  inSellerTab,
  sellerDue,
  sellerDueLabel,
  sortSellerOrders,
  type SellerTab,
} from "@/lib/shop/sellerOrders";
import "@/styles/shop.css";

// EN: Orders · Needs you · Shipping · Done · All
const COPY = {
  title: "Đơn hàng",
  sub: "Đơn của shop, đơn cần anh/chị xử lý xếp lên đầu.",
  loading: "Đang tải danh sách đơn…",
  loadError: "Chưa tải được danh sách đơn.",
  loadErrorTail: "Đơn của shop không mất đi đâu cả.",
  retry: "Thử lại",
  // EN: This shop has paused selling so it takes no new orders. Orders you
  // already have are handled as normal.
  paused:
    "Shop đang tạm ngưng bán nên không nhận đơn mới. Đơn đang có vẫn xử lý bình thường.",
  // EN: The support role can only view orders. Only the owner or a manager
  // can act on them.
  supportOnly:
    "Vai trò support chỉ xem được đơn. Chủ shop hoặc quản lý mới xử lý đơn.",
  emptyTodoTitle: "Không có đơn nào đang chờ anh/chị",
  emptyTodoBody: "Đơn mới sẽ hiện ở đây kèm hạn phải trả lời.",
  emptyTabTitle: "Không có đơn nào ở mục này",
  emptyEverTitle: "Shop chưa có đơn hàng nào",
  emptyEverBody: "Khi có người đặt, đơn sẽ hiện ở đây.",
  open: "Mở đơn",
  colCode: "Mã đơn",
  colTodo: "Việc cần làm",
  colDue: "Hạn trả lời",
  colBuyer: "Khách",
  colTotal: "Tổng",
};

export default function SellerOrders() {
  const membership = useMyShopMembership();
  const shopId = membership.data?.shop_id ?? null;
  const profile = useShopProfile(shopId);
  const list = useShopOrders(shopId);
  const [tab, setTab] = useState<SellerTab>("todo");

  // `support` sees everything and may press nothing. Rendering the buttons and
  // letting Postgres answer 42501 is four dead controls on every order.
  const canAct = membership.data?.role !== "support";

  const rows = useMemo(() => sortSellerOrders(list.data ?? []), [list.data]);
  const counts = useMemo(() => {
    const out = {} as Record<SellerTab, number>;
    for (const t of SELLER_TABS) out[t.key] = rows.filter((r) => inSellerTab(r.status, t.key)).length;
    return out;
  }, [rows]);
  const shown = useMemo(() => rows.filter((r) => inSellerTab(r.status, tab)), [rows, tab]);

  const shell = (children: React.ReactNode) => (
    <ShopScrollShell>
      <DynamicMeta title="Đơn hàng của shop" noindex />
      <SellerShell active="orders" title={COPY.title}>
        <main className="tl-shop-page">{children}</main>
      </SellerShell>
    </ShopScrollShell>
  );

  // Khung xương đúng hình trang: tiêu đề, dòng phụ, bốn chip trạng thái, ba
  // thẻ đơn — cùng khuôn với khối `list.isLoading` bên dưới.
  if (membership.isLoading || profile.isLoading) {
    return shell(
      <div aria-busy="true" aria-label={COPY.loading}>
        <span className="tl-shop-sk tl-shop-sk--title" />
        <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "65%" }} />
        <div className="tl-shop-cats">
          {SELLER_TABS.map((t) => (
            <span key={t.key} className="tl-shop-sk tl-shop-sk--chip" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <span key={i} className="tl-shop-sk tl-shop-sk--card" />
        ))}
      </div>,
    );
  }

  if (membership.isError || profile.isError) {
    return shell(
      <ShopErrorNotice
        title="Chưa tải được shop của anh/chị."
        onRetry={() => {
          void membership.refetch();
          void profile.refetch();
        }}
      />,
    );
  }

  if (!membership.data || !profile.data) {
    return shell(
      <>
        <h1 className="tl-shop-h1">Chưa có shop</h1>
        <p className="tl-shop-sub">
          Tài khoản này chưa thuộc shop nào. Nếu anh/chị vừa được duyệt, thử tải lại trang.
        </p>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="tl-shop-h1">{COPY.title}</h1>
      <p className="tl-shop-sub">{COPY.sub}</p>

      {!canAct && (
        <div className="tl-shop-notice tl-shop-notice--info" role="status">
          <span>{COPY.supportOnly}</span>
        </div>
      )}

      {profile.data.ordering_enabled === false && (
        <div className="tl-shop-notice tl-shop-notice--warn" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{COPY.paused}</span>
        </div>
      )}

      <section aria-labelledby="so-tabs">
        <h2 id="so-tabs" className="tl-shop-sr">Lọc theo trạng thái</h2>
        <div className="tl-shop-cats" role="tablist" aria-label="Lọc theo trạng thái đơn">
          {SELLER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              // R5 #2 — aria-selected keeps role="tab" legal; aria-current is
              // what shop.css paints. Without the second one all four chips
              // were the same grey and the filter looked broken.
              aria-selected={tab === t.key}
              aria-current={tab === t.key ? "page" : undefined}
              aria-controls="so-list"
              className="tl-shop-cat"
              onClick={() => setTab(t.key)}
            >
              {t.label} <span className="count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="so-list-h" id="so-list" style={{ marginTop: 18 }}>
        <h2 id="so-list-h" className="tl-shop-sr">Danh sách đơn</h2>

        {list.isLoading ? (
          <div aria-busy="true" aria-live="polite" aria-label={COPY.loading}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="tl-shop-sk tl-shop-sk--card" />
            ))}
          </div>
        ) : list.isError ? (
          <ShopErrorNotice
            title={COPY.loadError}
            body={`${shopErrorMessage(list.error)} ${COPY.loadErrorTail}`}
            retryLabel={COPY.retry}
            onRetry={() => void list.refetch()}
          />
        ) : rows.length === 0 ? (
          // Never sold anything, versus this tab is empty, versus this tab is
          // empty AND it is the one that matters. Three answers.
          <div className="tl-shop-empty">
            <PackageOpen size={28} aria-hidden="true" />
            <p className="tl-shop-empty-title">{COPY.emptyEverTitle}</p>
            <p>{COPY.emptyEverBody}</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="tl-shop-empty">
            <Inbox size={28} aria-hidden="true" />
            <p className="tl-shop-empty-title">
              {tab === "todo" ? COPY.emptyTodoTitle : COPY.emptyTabTitle}
            </p>
            {tab === "todo" && <p>{COPY.emptyTodoBody}</p>}
          </div>
        ) : (
          <OrderRows rows={shown} />
        )}
      </section>
    </>,
  );
}

// ─── The two renderings of one list ─────────────────────────────────────────

function OrderRows({ rows }: { rows: OrderListRow[] }) {
  // Read once for the whole render: two rows compared against two different
  // "now"s can disagree about which of them is overdue.
  const now = Date.now();
  return (
    <>
      <p className="tl-shop-count" role="status">{rows.length} đơn</p>

      <div className="tl-shop-tablewrap" tabIndex={0} data-desktop-only style={{ marginTop: 10 }}>
        <table className="tl-shop-table">
          <caption className="tl-shop-sr">Đơn hàng của shop</caption>
          <thead>
            <tr>
              <th scope="col">{COPY.colCode}</th>
              <th scope="col">{COPY.colTodo}</th>
              <th scope="col">{COPY.colDue}</th>
              <th scope="col">{COPY.colBuyer}</th>
              <th scope="col">{COPY.colTotal}</th>
              <th scope="col"><span className="tl-shop-sr">Hành động</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <OrderTableRow key={row.id} row={row} now={now} />
            ))}
          </tbody>
        </table>
      </div>

      {/* No inline `display` on either block: [data-mobile-only] is what
          switches them, and an inline rule wins over the media query. */}
      <ul data-mobile-only style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
        {rows.map((row) => (
          <OrderCard key={row.id} row={row} now={now} />
        ))}
      </ul>
    </>
  );
}

/** The deadline line. Icon AND colour AND words — the colour alone would say
 *  nothing to a third of the people reading it. */
function DueLine({ row, now }: { row: OrderListRow; now: number }) {
  const due = sellerDue(row, now);
  if (due.kind === "none") return <span className="tl-shop-hint" style={{ margin: 0 }}>—</span>;
  const overdue = due.kind === "overdue";
  return (
    <span
      className={overdue ? "tl-shop-overdue" : "tl-shop-hint"}
      style={{ margin: 0, color: overdue ? "var(--shop-danger)" : "var(--shop-warning)" }}
    >
      {overdue ? <AlertTriangle size={16} aria-hidden="true" /> : <Clock size={11} aria-hidden="true" />}
      {" "}
      {sellerDueLabel(due)}
    </span>
  );
}

function OrderTableRow({ row, now }: { row: OrderListRow; now: number }) {
  return (
    <tr>
      <th scope="row" style={{ fontWeight: 550, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {row.code}
        <span className="tl-shop-hint" style={{ marginTop: 2 }}>{formatWhen(row.created_at)}</span>
      </th>
      <td>{SELLER_TODO[row.status]}</td>
      <td><DueLine row={row} now={now} /></td>
      <td>{row.recipient_name}</td>
      <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formatVnd(row.total_vnd)}</td>
      <td>
        <Link to={`/seller/orders/${row.code}`} className="tl-shop-btn tl-shop-btn--sm">
          {COPY.open}
        </Link>
      </td>
    </tr>
  );
}

function OrderCard({ row, now }: { row: OrderListRow; now: number }) {
  const overdue = sellerDue(row, now).kind === "overdue";
  return (
    <li
      className={`tl-shop-card${overdue ? " tl-shop-overdue" : ""}`}
      style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}
    >
      {/* One interactive element per card, and it is the code. */}
      <Link
        to={`/seller/orders/${row.code}`}
        aria-label={`${COPY.open} ${row.code}`}
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "inherit",
          display: "flex",
          alignItems: "center",
          minHeight: 44,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {row.code}
      </Link>
      <div style={{ fontSize: 13 }}>{SELLER_TODO[row.status]}</div>
      <DueLine row={row} now={now} />
      <div className="tl-shop-hint" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>
        {row.recipient_name} · {formatVnd(row.total_vnd)} · {formatWhen(row.created_at)}
      </div>
    </li>
  );
}
