// ============================================================================
// B11 — Buyer orders list
// ----------------------------------------------------------------------------
// The action label on each row says what the BUYER does next, not what state
// the order is in. "Đang xử lý" tells a buyer nothing; "Người bán đang chuẩn bị
// hàng — chưa cần làm gì" does.
// ============================================================================

import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { readScenario } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductMedia, SellerIdentity } from "../components/Primitives";
import { EmptyState, ErrorState, LoadingLines } from "../components/States";
import { ORDERS, orderTotal, productById, shopById, vnd, dmy, type OrderStatus } from "../fixtures";

const NEXT_FOR_BUYER: Record<OrderStatus, { label: string; cta?: string }> = {
  "cho-thanh-toan": { label: "Anh/chị cần chuyển khoản", cta: "Xem thông tin chuyển khoản" },
  "dang-xu-ly": { label: "Người bán đang chuẩn bị hàng — chưa cần làm gì" },
  "dang-giao": { label: "Đang trên đường tới anh/chị", cta: "Xem mã vận đơn" },
  "da-giao": { label: "Đã giao", cta: "Viết đánh giá" },
  "da-huy": { label: "Đã huỷ" },
  "tra-hang": { label: "Yêu cầu trả hàng đang chờ người bán trả lời" },
  "khieu-nai": { label: "Khiếu nại đang được xử lý", cta: "Xem khiếu nại" },
  "da-hoan-tien": { label: "Đã hoàn tiền" },
};

const TABS: { key: string; label: string; match: (s: OrderStatus) => boolean }[] = [
  { key: "all", label: "Tất cả", match: () => true },
  { key: "dang-den", label: "Đang tới", match: (s) => ["cho-thanh-toan", "dang-xu-ly", "dang-giao"].includes(s) },
  { key: "xong", label: "Đã xong", match: (s) => ["da-giao", "da-huy", "da-hoan-tien"].includes(s) },
  { key: "ho-tro", label: "Đang hỗ trợ", match: (s) => ["tra-hang", "khieu-nai"].includes(s) },
];

export default function B11Orders() {
  const location = useLocation();
  const scenario = readScenario(location.search);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab)!;
    return ORDERS.filter(
      (o) =>
        t.match(o.status) &&
        (!q.trim() ||
          o.code.toLowerCase().includes(q.trim().toLowerCase()) ||
          shopById(o.shopId).name.toLowerCase().includes(q.trim().toLowerCase())),
    );
  }, [tab, q]);

  const visible = rows.slice(0, page * 4);

  const body = () => {
    if (scenario === "slow") return <LoadingLines rows={4} />;
    if (scenario === "error")
      return (
        <ErrorState
          what="Chưa tải được danh sách đơn."
          recovery="Đơn của anh/chị vẫn còn nguyên. Thử tải lại, hoặc mở đơn từ email xác nhận."
        />
      );
    if (scenario === "empty" || rows.length === 0)
      return (
        <EmptyState
          title={q ? `Không có đơn nào khớp “${q}”` : "Anh/chị chưa có đơn hàng nào"}
          action={
            <Link to="/proto/shop/home" className="tl-shop-btn tl-shop-btn--primary">
              Xem sản phẩm đang bán
            </Link>
          }
        />
      );

    return (
      <>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {visible.map((o) => {
            const shop = shopById(o.shopId);
            const first = productById(o.lines[0].productId);
            const next = NEXT_FOR_BUYER[o.status];
            return (
              <li key={o.code} className="tl-shop-card" style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 56, flex: "none" }}>
                  <ProductMedia tone={first.media[0]?.tone ?? "a"} label="" />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <SellerIdentity shop={shop} />
                  <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>
                    <Link to={`/proto/shop/order/${o.code}`} style={{ color: "inherit", fontWeight: 600 }}>
                      {first.title}
                    </Link>
                    {o.lines.length > 1 && (
                      <span style={{ color: "var(--tl-fg-3)" }}> +{o.lines.length - 1} món khác</span>
                    )}
                  </div>
                  <span className="tl-shop-hint" style={{ marginTop: 0 }}>
                    {o.code} · {dmy(o.placedAt)} · {vnd(orderTotal(o))}
                  </span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {/* A sentence, not a status chip — pills are nowrap and this
                        text is long enough to push the page sideways at 375px. */}
                    <span className="tl-shop-hint" style={{ marginTop: 0, color: "var(--tl-fg-2)" }}>
                      {next.label}
                    </span>
                    {next.cta && (
                      <Link to={`/proto/shop/order/${o.code}`} className="tl-shop-btn tl-shop-btn--sm">
                        {next.cta}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {visible.length < rows.length && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <button type="button" className="tl-shop-btn" onClick={() => setPage((p) => p + 1)}>
              Xem thêm ({rows.length - visible.length} đơn)
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <BuyerShell title="Đơn hàng của tôi" backTo="/proto/shop/home">
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">Đơn hàng của tôi</h1>

        <div className="tl-shop-searchfield" style={{ marginBottom: 14 }}>
          <label htmlFor="b11-q" className="tl-shop-sr">
            Tìm theo mã đơn hoặc tên shop
          </label>
          <Search size={17} aria-hidden="true" />
          <input
            id="b11-q"
            type="search"
            value={q}
            placeholder="Mã đơn hoặc tên shop"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

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
              {t.label} ({ORDERS.filter((o) => t.match(o.status)).length})
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>{body()}</div>
      </main>
    </BuyerShell>
  );
}
