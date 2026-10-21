// ============================================================================
// S04 — Seller dashboard /seller
// ----------------------------------------------------------------------------
// Acceptance: no vanity chart; every metric opens the operational list it
// summarises. So each stat is a <Link>, and there is no revenue sparkline —
// a seller with 3 orders learns nothing from a chart, and a chart is the most
// expensive way to say "you have 3 orders".
//
// The attention queue is first because it is the only part of this page that
// costs the seller money if ignored.
// ============================================================================

import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Package, ClipboardList, Clock } from "lucide-react";
import { readScenario } from "../scenario";
import { SellerShell } from "../components/Shells";
import { ListingStatusBadge } from "../components/Forms";
import { ErrorState, EmptyState, LoadingLines } from "../components/States";
import { ORDERS, PRODUCTS, orderTotal, untilDeadline, dmy, vnd } from "../fixtures";

const Stat = ({
  to,
  label,
  value,
  tone,
}: {
  to: string;
  label: string;
  value: string;
  tone?: "warn" | "danger";
}) => (
  <Link
    to={to}
    className="tl-shop-card"
    style={{ display: "block", color: "inherit", minWidth: 0 }}
  >
    <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>{label}</div>
    <div
      style={{
        fontSize: 24,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        color: tone === "danger" ? "var(--shop-danger)" : tone === "warn" ? "var(--shop-warning)" : "var(--tl-fg)",
      }}
    >
      {value}
    </div>
    <div className="tl-shop-hint" style={{ marginTop: 2 }}>
      Bấm để mở danh sách
    </div>
  </Link>
);

export default function S04Dashboard() {
  const location = useLocation();
  const scenario = readScenario(location.search);

  const myShop = "shop-1";
  const orders = ORDERS.filter((o) => o.shopId === myShop);
  const products = PRODUCTS.filter((p) => p.shopId === myShop);
  const needsAction = orders.filter((o) => o.sellerDeadline);
  const listingIssues = products.filter((p) => p.status === "needs_changes" || p.status === "restricted");
  const isNewShop = scenario === "empty";

  if (scenario === "error")
    return (
      <SellerShell active="dashboard" title="Tổng quan">
        <div className="tl-shop-page">
          <ErrorState
            what="Chưa tải được số liệu shop."
            recovery="Đơn hàng của anh/chị không bị ảnh hưởng — vào thẳng mục Đơn hàng ở cột bên trái."
          />
        </div>
      </SellerShell>
    );

  if (scenario === "slow")
    return (
      <SellerShell active="dashboard" title="Tổng quan">
        <div className="tl-shop-page">
          <LoadingLines rows={5} />
        </div>
      </SellerShell>
    );

  return (
    <SellerShell
      active="dashboard"
      title="Tổng quan"
      badges={{ orders: needsAction.length, products: listingIssues.length }}
    >
      <div className="tl-shop-page">
        {isNewShop ? (
          <>
            <h1 className="tl-shop-h1">Shop đã mở. Còn 3 việc.</h1>
            <p className="tl-shop-sub">
              Làm xong 3 việc này là sản phẩm đầu tiên của anh/chị lên trang mua hàng.
            </p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {[
                { t: "Đăng sản phẩm đầu tiên", d: "Tên, giá, 1–3 ảnh là đủ.", to: "/proto/shop/seller/products/new", done: false },
                { t: "Viết chính sách đổi trả", d: "Người mua thấy ngay trên trang sản phẩm.", to: "/proto/shop/seller/settings", done: false },
                { t: "Kiểm tra địa chỉ gửi hàng", d: "Dùng để in phiếu gửi.", to: "/proto/shop/seller/settings", done: true },
              ].map((s, i) => (
                <li key={s.t} className="tl-shop-card" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span className="tl-shop-step-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{s.t}</div>
                    <p className="tl-shop-hint" style={{ marginTop: 3 }}>
                      {s.d}
                    </p>
                  </div>
                  {s.done ? (
                    <span className="tl-shop-pill tl-shop-pill--ok">Xong</span>
                  ) : (
                    <Link to={s.to} className="tl-shop-btn tl-shop-btn--sm">
                      Làm
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <h1 className="tl-shop-sr">Tổng quan shop</h1>

            {/* ── Attention queue, first ─────────────────────────────────── */}
            <section aria-labelledby="s04-attn">
              <h2 className="tl-shop-h2" id="s04-attn" style={{ marginTop: 0 }}>
                Cần anh/chị xử lý
              </h2>
              {needsAction.length === 0 ? (
                <EmptyState title="Không có việc nào đang chờ">
                  Đơn mới sẽ hiện ở đây kèm hạn phải trả lời.
                </EmptyState>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                  {needsAction.map((o) => {
                    const d = untilDeadline(o.sellerDeadline!);
                    return (
                      <li
                        key={o.code}
                        className="tl-shop-card"
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          flexWrap: "wrap",
                          borderColor: d.overdue ? "color-mix(in srgb, var(--shop-danger) 45%, transparent)" : undefined,
                        }}
                      >
                        <AlertTriangle
                          size={16}
                          aria-hidden="true"
                          style={{ flex: "none", color: d.overdue ? "var(--shop-danger)" : "var(--shop-warning)" }}
                        />
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontWeight: 650, fontSize: 14 }}>
                            {o.status === "tra-hang" ? "Yêu cầu trả hàng" : "Đơn chờ xác nhận"} · {o.code}
                          </div>
                          <p className="tl-shop-hint" style={{ marginTop: 3 }}>
                            <Clock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> {d.text} ·{" "}
                            {vnd(orderTotal(o))}
                          </p>
                        </div>
                        <Link to={`/proto/shop/seller/orders/${o.code}`} className="tl-shop-btn tl-shop-btn--sm">
                          Mở đơn
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── Stats: every one is a link ─────────────────────────────── */}
            <section aria-labelledby="s04-stats">
              <h2 className="tl-shop-h2" id="s04-stats">
                Số liệu
              </h2>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <Stat
                  to="/proto/shop/seller/orders"
                  label="Đơn cần xử lý"
                  value={String(needsAction.length)}
                  tone={needsAction.length ? "warn" : undefined}
                />
                <Stat to="/proto/shop/seller/orders" label="Đơn 30 ngày qua" value={String(orders.length)} />
                <Stat
                  to="/proto/shop/seller/products"
                  label="Sản phẩm đang bán"
                  value={String(products.filter((p) => p.status === "active").length)}
                />
                <Stat
                  to="/proto/shop/seller/products"
                  label="Sản phẩm cần sửa"
                  value={String(listingIssues.length)}
                  tone={listingIssues.length ? "danger" : undefined}
                />
              </div>
              <p className="tl-shop-hint">
                Không có biểu đồ doanh thu. Với vài chục đơn, danh sách đơn nói được nhiều hơn
                đường kẻ.
              </p>
            </section>

            {/* ── Recent orders ─────────────────────────────────────────── */}
            <section aria-labelledby="s04-recent">
              <h2 className="tl-shop-h2" id="s04-recent">
                Đơn gần đây
              </h2>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {orders.slice(0, 4).map((o) => (
                  <li key={o.code} className="tl-shop-line" style={{ alignItems: "center" }}>
                    <ClipboardList size={16} aria-hidden="true" style={{ color: "var(--tl-fg-3)", flex: "none" }} />
                    <div className="tl-shop-line-body">
                      <p className="tl-shop-line-title">
                        <Link to={`/proto/shop/seller/orders/${o.code}`} style={{ color: "inherit" }}>
                          {o.code}
                        </Link>
                      </p>
                      <span className="tl-shop-hint" style={{ marginTop: 0 }}>
                        {dmy(o.placedAt)} · {vnd(orderTotal(o))} · {o.paymentMethod === "cod" ? "COD" : "VietQR"}
                      </span>
                    </div>
                    <span className="tl-shop-pill tl-shop-pill--muted">{o.status}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Listing issues ────────────────────────────────────────── */}
            <section aria-labelledby="s04-listings">
              <h2 className="tl-shop-h2" id="s04-listings">
                Sản phẩm có vấn đề
              </h2>
              {listingIssues.length === 0 ? (
                <EmptyState title="Không có sản phẩm nào bị đánh dấu" />
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                  {listingIssues.map((p) => (
                    <li key={p.id} className="tl-shop-card" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <Package size={16} aria-hidden="true" style={{ color: "var(--tl-fg-3)", flex: "none", marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontWeight: 650, fontSize: 14 }}>{p.title}</div>
                        <p className="tl-shop-hint" style={{ marginTop: 4 }}>
                          {p.moderationNote}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <ListingStatusBadge status={p.status} />
                        <Link to={`/proto/shop/seller/products/${p.id}/edit`} className="tl-shop-btn tl-shop-btn--sm">
                          Sửa
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </SellerShell>
  );
}
