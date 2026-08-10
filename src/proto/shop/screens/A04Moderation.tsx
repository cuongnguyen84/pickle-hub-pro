// ============================================================================
// A04 — Product moderation /admin/shop/products
// ----------------------------------------------------------------------------
// A moderator decides from the buyer's view first, then the structured data.
// So the buyer preview is the left column, not a link the moderator has to
// remember to open — most bad listings look fine in a data table and obviously
// wrong on the product page.
//
// Removing a product with open orders spells out what happens to those orders.
// ============================================================================

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Flag, Eye } from "lucide-react";
import { readVariant } from "../scenario";
import { AdminShopFrame } from "../components/Shells";
import { ProductMedia, ProductPrice, SellerIdentity } from "../components/Primitives";
import { ListingStatusBadge, ModerationDecisionForm } from "../components/Forms";
import { ORDERS, PRODUCTS, productById, shopById } from "../fixtures";

type State = "first" | "reported" | "counterfeit" | "requested" | "remove-open-orders";

const CASE: Record<State, { productId: string; flags: string[]; note?: string }> = {
  first: { productId: "p-7", flags: [] },
  reported: { productId: "p-9", flags: ["1 người mua báo cáo: “nghi hàng nhái”"] },
  counterfeit: {
    productId: "p-9",
    flags: ["1 người mua báo cáo: “nghi hàng nhái”", "Tiêu đề nhắc tên giải quốc tế"],
    note: "Áo in logo giải mà shop không có quyền sử dụng.",
  },
  requested: { productId: "p-8", flags: [] },
  "remove-open-orders": { productId: "p-2", flags: ["2 người mua báo cáo: “ảnh khác hàng thật”"] },
};

export default function A04Moderation() {
  const location = useLocation();
  const state = (readVariant(location.search) || "reported") as State;
  const c = CASE[state];
  const product = productById(c.productId);
  const shop = shopById(product.shopId);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const openOrders = ORDERS.filter(
    (o) => o.lines.some((l) => l.productId === product.id) && !["da-giao", "da-huy", "da-hoan-tien"].includes(o.status),
  );
  const shopHistory = PRODUCTS.filter((p) => p.shopId === shop.id);

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">A04</p>
      <h1 className="tl-shop-h1">Kiểm duyệt sản phẩm</h1>
      <p className="tl-shop-sub">Xem như người mua trước, rồi mới đọc dữ liệu.</p>

      <AdminShopFrame crumb={`Sản phẩm · ${product.title.slice(0, 28)}…`}>
        {c.flags.length > 0 && (
          <div className="tl-shop-notice tl-shop-notice--warn">
            <Flag size={16} aria-hidden="true" />
            <div>
              <strong>Bị báo cáo:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {c.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {c.note && <p style={{ margin: "8px 0 0" }}>{c.note}</p>}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
          {/* ── Buyer preview ─────────────────────────────────────────── */}
          <section aria-labelledby="a04-preview">
            <h2 className="tl-shop-h2" id="a04-preview" style={{ marginTop: 0 }}>
              <Eye size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Người mua nhìn thấy
            </h2>
            <div className="tl-shop-card">
              <ProductMedia tone={product.media[0]?.tone ?? "a"} label={product.media[0]?.label ?? "Chưa có ảnh"} />
              <h3 style={{ fontSize: 15, fontWeight: 650, lineHeight: 1.35, margin: "12px 0 8px" }}>{product.title}</h3>
              <ProductPrice vndAmount={product.priceVnd} maxVnd={product.priceMaxVnd} />
              <div style={{ marginTop: 10 }}>
                <SellerIdentity shop={shop} linked={false} showBadge />
              </div>
              <p style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.6, color: "var(--tl-fg-2)" }}>
                {product.description || "Người bán chưa viết mô tả."}
              </p>
            </div>
          </section>

          {/* ── Structured data ───────────────────────────────────────── */}
          <section aria-labelledby="a04-data">
            <h2 className="tl-shop-h2" id="a04-data" style={{ marginTop: 0 }}>
              Dữ liệu
            </h2>
            <div className="tl-shop-card">
              <div style={{ marginBottom: 10 }}>
                <ListingStatusBadge status={product.status} withHint />
              </div>
              <table className="tl-shop-specs">
                <tbody>
                  <tr>
                    <th scope="row">Danh mục</th>
                    <td>{product.category}</td>
                  </tr>
                  <tr>
                    <th scope="row">Tình trạng</th>
                    <td>{product.condition === "moi" ? "Mới" : "Đã qua sử dụng"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Số phiên bản</th>
                    <td>{product.variants.length}</td>
                  </tr>
                  {product.attributes.map((a) => (
                    <tr key={a.label}>
                      <th scope="row">{a.label}</th>
                      <td>{a.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="tl-shop-h2">Lịch sử shop</h2>
            <div className="tl-shop-card" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              <div>
                {shop.name} · mở {shop.openedAt.split("-").reverse().join("/")} ·{" "}
                {shopHistory.length} sản phẩm từng đăng
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["active", "needs_changes", "restricted", "archived"] as const).map((st) => {
                  const n = shopHistory.filter((p) => p.status === st).length;
                  if (!n) return null;
                  return (
                    <span key={st} className="tl-shop-pill tl-shop-pill--muted">
                      {n} {st}
                    </span>
                  );
                })}
              </div>
              {shop.state === "suspended" && (
                <p className="tl-shop-hint" style={{ color: "var(--shop-warning)" }}>
                  Shop này đang bị tạm ngưng.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ── Decision ───────────────────────────────────────────────── */}
        <section aria-labelledby="a04-decide" style={{ marginTop: 24 }}>
          <h2 className="tl-shop-h2" id="a04-decide">
            Quyết định
          </h2>

          {state === "remove-open-orders" && (
            <>
              {!confirmRemove ? (
                <button type="button" className="tl-shop-btn tl-shop-btn--danger" onClick={() => setConfirmRemove(true)}>
                  Gỡ sản phẩm khỏi trang mua hàng
                </button>
              ) : (
                <div className="tl-shop-notice tl-shop-notice--danger">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <div>
                    <strong>Gỡ sản phẩm này sẽ:</strong>
                    <ul style={{ margin: "8px 0", paddingLeft: 18, lineHeight: 1.6 }}>
                      <li>Ẩn khỏi trang mua hàng và tìm kiếm ngay.</li>
                      <li>
                        <strong>Không huỷ</strong> {openOrders.length} đơn đang chạy:{" "}
                        {openOrders.map((o) => o.code).join(", ")}. Người bán vẫn phải giao hoặc
                        huỷ từng đơn theo quy trình.
                      </li>
                      <li>Gửi thông báo cho người bán kèm đúng ghi chú bên dưới.</li>
                      <li>Không xoá dữ liệu — khôi phục được.</li>
                    </ul>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" className="tl-shop-btn tl-shop-btn--danger">
                        Vẫn gỡ
                      </button>
                      <button type="button" className="tl-shop-btn" onClick={() => setConfirmRemove(false)}>
                        Huỷ
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ height: 16 }} />
            </>
          )}

          <ModerationDecisionForm />
        </section>

        <nav aria-label="Bản mẫu · tình huống" style={{ marginTop: 26 }}>
          <div className="tl-shop-cats">
            {(Object.keys(CASE) as State[]).map((k) => (
              <Link key={k} to={`?variant=${k}`} className="tl-shop-cat" aria-current={state === k ? "page" : undefined}>
                {k}
              </Link>
            ))}
          </div>
        </nav>
      </AdminShopFrame>
    </main>
  );
}
