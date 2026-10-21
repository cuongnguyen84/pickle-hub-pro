// ============================================================================
// S08 — Seller orders /seller/orders
// ----------------------------------------------------------------------------
// Attention-first: orders with a deadline the seller owes come before
// everything else, overdue ones first. Sorting by date would bury the one order
// that is about to auto-cancel.
// ============================================================================

import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Clock, AlertTriangle } from "lucide-react";
import { readScenario } from "../scenario";
import { SellerShell } from "../components/Shells";
import { EmptyState, ErrorState, LoadingLines } from "../components/States";
import { ORDERS, orderTotal, untilDeadline, dmyhm, vnd, type OrderStatus } from "../fixtures";

const STATUS_LABEL: Record<OrderStatus, string> = {
  "cho-thanh-toan": "Chờ chuyển khoản",
  "dang-xu-ly": "Đang xử lý",
  "dang-giao": "Đang giao",
  "da-giao": "Đã giao",
  "da-huy": "Đã huỷ",
  "tra-hang": "Trả hàng",
  "khieu-nai": "Khiếu nại",
  "da-hoan-tien": "Đã hoàn tiền",
};

const TABS: { key: string; label: string; match: (s: OrderStatus) => boolean }[] = [
  { key: "can-xu-ly", label: "Cần xử lý", match: (s) => ["dang-xu-ly", "tra-hang", "khieu-nai", "cho-thanh-toan"].includes(s) },
  { key: "dong-goi", label: "Đang giao", match: (s) => s === "dang-giao" },
  { key: "xong", label: "Đã xong", match: (s) => ["da-giao", "da-huy", "da-hoan-tien"].includes(s) },
  { key: "tat-ca", label: "Tất cả", match: () => true },
];

export default function S08Orders() {
  const location = useLocation();
  const scenario = readScenario(location.search);
  const [tab, setTab] = useState("can-xu-ly");

  const mine = useMemo(() => ORDERS.filter((o) => o.shopId === "shop-1"), []);
  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab)!;
    return mine
      .filter((o) => t.match(o.status))
      .slice()
      .sort((a, b) => {
        // Deadline first, overdue at the very top.
        const da = a.sellerDeadline ? new Date(a.sellerDeadline).getTime() : Infinity;
        const db = b.sellerDeadline ? new Date(b.sellerDeadline).getTime() : Infinity;
        return da - db;
      });
  }, [mine, tab]);

  const attention = mine.filter((o) => o.sellerDeadline).length;

  const body = () => {
    if (scenario === "slow") return <LoadingLines rows={4} />;
    if (scenario === "error")
      return (
        <ErrorState
          what="Chưa tải được danh sách đơn."
          recovery="Nếu có đơn sắp quá hạn, anh/chị vẫn mở được bằng mã đơn trong thông báo."
        />
      );
    if (scenario === "empty" || rows.length === 0)
      return (
        <EmptyState title={tab === "can-xu-ly" ? "Không có đơn nào đang chờ anh/chị" : "Không có đơn nào ở mục này"}>
          Đơn mới sẽ hiện ở đây kèm hạn phải trả lời.
        </EmptyState>
      );

    return (
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {rows.map((o) => {
          const d = o.sellerDeadline ? untilDeadline(o.sellerDeadline) : null;
          return (
            <li
              key={o.code}
              className="tl-shop-card"
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                borderColor: d?.overdue
                  ? "color-mix(in srgb, var(--shop-danger) 50%, transparent)"
                  : undefined,
              }}
            >
              {d && (
                <AlertTriangle
                  size={16}
                  aria-hidden="true"
                  style={{ flex: "none", color: d.overdue ? "var(--shop-danger)" : "var(--shop-warning)" }}
                />
              )}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 650, fontSize: 14 }}>
                  <Link to={`/proto/shop/seller/orders/${o.code}`} style={{ color: "inherit" }}>
                    {o.code}
                  </Link>{" "}
                  <span className="tl-shop-pill tl-shop-pill--muted">{STATUS_LABEL[o.status]}</span>
                </div>
                <p className="tl-shop-hint" style={{ marginTop: 4 }}>
                  {dmyhm(o.placedAt)} · {o.lines.length} món · {vnd(orderTotal(o))} ·{" "}
                  {o.paymentMethod === "cod" ? "COD" : o.paymentConfirmedAt ? "VietQR đã xác nhận" : "VietQR chờ đối soát"}
                </p>
                {d && (
                  <p
                    className="tl-shop-hint"
                    style={{ marginTop: 4, color: d.overdue ? "var(--shop-danger)" : "var(--shop-warning)" }}
                  >
                    <Clock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Hạn trả lời{" "}
                    {d.text}
                  </p>
                )}
              </div>
              <Link to={`/proto/shop/seller/orders/${o.code}`} className="tl-shop-btn tl-shop-btn--sm">
                {o.status === "dang-xu-ly" ? "Xác nhận & đóng gói" : "Mở đơn"}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <SellerShell active="orders" title="Đơn hàng" badges={{ orders: attention }}>
      <div className="tl-shop-page">
        <h1 className="tl-shop-sr">Đơn hàng của shop</h1>

        <div className="tl-shop-cats" role="tablist" aria-label="Lọc đơn hàng">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className="tl-shop-cat"
              aria-current={tab === t.key ? "page" : undefined}
              onClick={() => setTab(t.key)}
            >
              {t.label} ({mine.filter((o) => t.match(o.status)).length})
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>{body()}</div>
      </div>
    </SellerShell>
  );
}
