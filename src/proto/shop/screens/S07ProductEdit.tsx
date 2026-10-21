// ============================================================================
// S07 — Edit product /seller/products/:id/edit
// ----------------------------------------------------------------------------
// Acceptance: no newer server edit is silently overwritten, and destructive
// impact is explained.
//
// The conflict state therefore shows BOTH versions side by side with the field
// that differs, and the primary button is "Xem bản mới" — not "Ghi đè". Archive
// spells out what happens to the open orders that already reference the item.
// ============================================================================

import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { AlertTriangle, GitCompare } from "lucide-react";
import { readVariant } from "../scenario";
import { SellerShell } from "../components/Shells";
import { ProductMedia } from "../components/Primitives";
import { AutosaveIndicator, ListingStatusBadge, VariantMatrix } from "../components/Forms";
import { productById, ORDERS, vnd, dmyhm } from "../fixtures";

type State = "active" | "pending" | "requested" | "conflict" | "open-orders";

export default function S07ProductEdit() {
  const { id } = useParams();
  const location = useLocation();
  const state = (readVariant(location.search) || "active") as State;
  const [archiveOpen, setArchiveOpen] = useState(false);

  const product = productById(
    state === "requested" ? "p-8" : state === "pending" ? "p-7" : (id ?? "p-2"),
  );
  const openOrders = ORDERS.filter(
    (o) =>
      o.lines.some((l) => l.productId === product.id) &&
      !["da-giao", "da-huy", "da-hoan-tien"].includes(o.status),
  );

  return (
    <SellerShell active="products" title="Sửa sản phẩm">
      <div className="tl-shop-page tl-shop-page--narrow">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <ListingStatusBadge status={product.status} withHint />
          <span className="tl-proto-spacer" />
          <AutosaveIndicator state="saved" savedAt="09:41" />
        </div>

        <h1 className="tl-shop-h1" style={{ fontSize: "clamp(18px, 4.5vw, 22px)" }}>
          {product.title}
        </h1>

        {/* ── Moderation feedback ─────────────────────────────────────── */}
        {state === "requested" && product.moderationNote && (
          <div className="tl-shop-notice tl-shop-notice--danger">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <strong>Quản trị viên yêu cầu sửa:</strong>
              <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>{product.moderationNote}</p>
              <p className="tl-shop-hint" style={{ marginTop: 8 }}>
                Sản phẩm đang ẩn khỏi trang mua hàng cho tới khi anh/chị gửi lại và được duyệt.
              </p>
            </div>
          </div>
        )}

        {state === "pending" && (
          <div className="tl-shop-notice tl-shop-notice--warn">
            <div>
              <strong>Sản phẩm đang chờ duyệt.</strong> Anh/chị vẫn sửa được; mọi thay đổi sẽ
              được xem cùng lúc. Người mua chưa nhìn thấy sản phẩm này.
            </div>
          </div>
        )}

        {/* ── Version conflict ────────────────────────────────────────── */}
        {state === "conflict" && (
          <div className="tl-shop-notice tl-shop-notice--danger">
            <GitCompare size={16} aria-hidden="true" />
            <div style={{ width: "100%" }}>
              <strong>Sản phẩm này vừa được sửa ở nơi khác.</strong>
              <p style={{ margin: "6px 0 12px", lineHeight: 1.55 }}>
                Một phiên đăng nhập khác đã lưu bản mới hơn lúc {dmyhm("2026-08-10T08:52:00+07:00")}.
                Nội dung anh/chị vừa gõ <strong>không bị mất</strong> — xem khác nhau chỗ nào rồi
                quyết định.
              </p>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  marginBottom: 12,
                }}
              >
                <div className="tl-shop-card">
                  <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 6 }}>
                    Bản trên máy chủ
                  </p>
                  <div style={{ fontSize: 13.5 }}>Giá: {vnd(1_390_000)}</div>
                  <div style={{ fontSize: 13.5 }}>Tồn kho Trắng/41: 5</div>
                </div>
                <div className="tl-shop-card" style={{ borderColor: "var(--tl-green)" }}>
                  <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 6 }}>
                    Bản anh/chị đang sửa
                  </p>
                  <div style={{ fontSize: 13.5 }}>Giá: {vnd(1_290_000)}</div>
                  <div style={{ fontSize: 13.5 }}>Tồn kho Trắng/41: 2</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="tl-shop-btn tl-shop-btn--primary">
                  Xem bản mới trước
                </button>
                <button type="button" className="tl-shop-btn tl-shop-btn--danger">
                  Ghi đè bằng bản của tôi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Open orders warning ─────────────────────────────────────── */}
        {(state === "open-orders" || openOrders.length > 0) && (
          <div className="tl-shop-notice tl-shop-notice--warn">
            <div>
              <strong>
                {openOrders.length} đơn hàng chưa xong đang gắn với sản phẩm này.
              </strong>{" "}
              Sửa giá hoặc mô tả <em>không</em> làm đổi đơn cũ — đơn giữ nguyên giá lúc đặt.
              Nhưng ngừng bán thì phải xử lý xong các đơn đó trước.
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {openOrders.map((o) => (
                  <li key={o.code}>
                    <Link to={`/proto/shop/seller/orders/${o.code}`}>{o.code}</Link> · {o.status}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <section aria-labelledby="s07-basic">
          <h2 className="tl-shop-h2" id="s07-basic">
            Thông tin cơ bản
          </h2>
          <label className="tl-shop-field">
            <span className="tl-shop-label">Tên sản phẩm</span>
            <input className="tl-shop-input" defaultValue={product.title} />
          </label>
          <label className="tl-shop-field">
            <span className="tl-shop-label">Mô tả</span>
            <textarea className="tl-shop-textarea" defaultValue={product.description} />
          </label>
        </section>

        <section aria-labelledby="s07-media">
          <h2 className="tl-shop-h2" id="s07-media">
            Ảnh
          </h2>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
            {product.media.map((m, i) => (
              <ProductMedia key={m.label} tone={m.tone} label={i === 0 ? `${m.label} · bìa` : m.label} />
            ))}
          </div>
        </section>

        <section aria-labelledby="s07-price">
          <h2 className="tl-shop-h2" id="s07-price">
            Giá &amp; tồn kho
          </h2>
          <VariantMatrix product={product} onBulk={() => {}} />
        </section>

        <section aria-labelledby="s07-danger">
          <h2 className="tl-shop-h2" id="s07-danger">
            Ngừng bán
          </h2>
          {!archiveOpen ? (
            <button type="button" className="tl-shop-btn tl-shop-btn--danger" onClick={() => setArchiveOpen(true)}>
              Ngừng bán sản phẩm này
            </button>
          ) : (
            <div className="tl-shop-notice tl-shop-notice--danger">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Ngừng bán sẽ làm những việc sau:</strong>
                <ul style={{ margin: "8px 0", paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Gỡ sản phẩm khỏi trang mua hàng và khỏi tìm kiếm ngay lập tức.</li>
                  <li>
                    Giữ nguyên {openOrders.length} đơn chưa xong — anh/chị vẫn phải gửi hàng
                    hoặc huỷ đơn đúng quy trình.
                  </li>
                  <li>
                    Người mua đã lưu sản phẩm sẽ thấy dòng &ldquo;Người bán đã gỡ sản
                    phẩm&rdquo;.
                  </li>
                  <li>Không xoá dữ liệu — bật bán lại được bất cứ lúc nào.</li>
                </ul>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="tl-shop-btn tl-shop-btn--danger">
                    Vẫn ngừng bán
                  </button>
                  <button type="button" className="tl-shop-btn" onClick={() => setArchiveOpen(false)}>
                    Huỷ
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <button type="button" className="tl-shop-btn tl-shop-btn--primary" disabled={state === "conflict"}>
            {product.status === "needs_changes" ? "Gửi lại để duyệt" : "Lưu thay đổi"}
          </button>
          <Link to="/proto/shop/seller/products" className="tl-shop-btn tl-shop-btn--ghost">
            Về danh sách
          </Link>
        </div>
      </div>
    </SellerShell>
  );
}
