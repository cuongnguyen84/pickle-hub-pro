// ============================================================================
// A05 — Dispute resolution /admin/shop/disputes
// ----------------------------------------------------------------------------
// Acceptance: the outcome preview lists refund, return, inventory and
// notification effects BEFORE the final action.
//
// So choosing an outcome renders a consequence table computed from the order,
// not a generic "are you sure". The neutral-facts block comes first and is
// deliberately free of either party's wording.
// ============================================================================

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Scale, AlertTriangle, Clock, Lock, Eye } from "lucide-react";
import { readVariant } from "../scenario";
import { AdminShopFrame } from "../components/Shells";
import { EvidenceViewer } from "../components/Forms";
import { Row } from "../components/Primitives";
import {
  DISPUTES,
  disputeById,
  orderByCode,
  orderTotal,
  productById,
  shopById,
  untilDeadline,
  vnd,
  dmyhm,
} from "../fixtures";

type Outcome = "hoan-toan-bo" | "hoan-mot-phan" | "tra-hang-hoan-tien" | "giu-nguyen";

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: "hoan-toan-bo", label: "Hoàn toàn bộ cho người mua" },
  { key: "hoan-mot-phan", label: "Hoàn một phần" },
  { key: "tra-hang-hoan-tien", label: "Người mua gửi trả, sau đó hoàn tiền" },
  { key: "giu-nguyen", label: "Giữ nguyên đơn hàng" },
];

const WHO = { buyer: "Người mua", seller: "Người bán", admin: "Quản trị viên" } as const;

export default function A05Disputes() {
  const location = useLocation();
  const dispute = disputeById(readVariant(location.search) || "dis-1");
  const order = orderByCode(dispute.orderCode);
  const shop = shopById(order.shopId);
  const total = orderTotal(order);

  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [partial, setPartial] = useState(110_000);
  const [internal, setInternal] = useState("");
  const [visible, setVisible] = useState("");
  const [confirm, setConfirm] = useState(false);

  const deadline = dispute.deadline ? untilDeadline(dispute.deadline) : null;

  /** Effects computed from the order, not written as generic warning copy. */
  const effects = (o: Outcome) => {
    const refund =
      o === "hoan-toan-bo" || o === "tra-hang-hoan-tien"
        ? total
        : o === "hoan-mot-phan"
          ? partial
          : 0;
    return [
      ["Hoàn tiền", refund ? `${vnd(refund)} về người mua` : "Không hoàn"],
      [
        "Trả hàng",
        o === "tra-hang-hoan-tien"
          ? "Người mua phải gửi trả trong 7 ngày; hoàn tiền sau khi người bán xác nhận đã nhận"
          : "Người mua giữ hàng",
      ],
      [
        "Tồn kho",
        o === "tra-hang-hoan-tien"
          ? "Cộng lại tồn kho khi người bán xác nhận nhận hàng"
          : "Không đổi tồn kho",
      ],
      [
        "Thông báo",
        `Người mua và ${shop.name} đều nhận thông báo kèm đúng phần “Lý do gửi hai bên”. Ghi chú nội bộ KHÔNG gửi.`,
      ],
      ["Nhật ký", "Ghi vào audit_logs kèm tài khoản quản trị viên và dấu thời gian."],
    ] as const;
  };

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">A05</p>
      <h1 className="tl-shop-h1">Xử lý khiếu nại</h1>
      <p className="tl-shop-sub">
        Đơn {order.code} · {shop.name} · {dispute.reason}
      </p>

      <AdminShopFrame crumb={`Khiếu nại · ${order.code}`}>
        {deadline && (
          <div className={`tl-shop-notice ${deadline.overdue ? "tl-shop-notice--danger" : "tl-shop-notice--warn"}`}>
            <Clock size={16} aria-hidden="true" />
            <div>
              Đang chờ {dispute.stage === "cho-nguoi-ban" ? "người bán" : "người mua"} — hạn{" "}
              <strong>{deadline.text}</strong>.
            </div>
          </div>
        )}

        {/* ── Neutral facts ──────────────────────────────────────────── */}
        <section aria-labelledby="a05-facts">
          <h2 className="tl-shop-h2" id="a05-facts" style={{ marginTop: 0 }}>
            Dữ kiện
          </h2>
          <p className="tl-shop-hint" style={{ marginTop: -6, marginBottom: 12 }}>
            Lấy thẳng từ đơn hàng, không dùng lời của bên nào.
          </p>
          <div className="tl-shop-card">
            <Row label="Đặt lúc">{dmyhm(order.placedAt)}</Row>
            <Row label="Thanh toán">
              {order.paymentMethod === "cod"
                ? "COD"
                : order.paymentConfirmedAt
                  ? `VietQR, xác nhận ${dmyhm(order.paymentConfirmedAt)}`
                  : "VietQR, chưa xác nhận"}
            </Row>
            <Row label="Giá trị đơn">{vnd(total)}</Row>
            <Row label="Sản phẩm">
              {order.lines.map((l) => productById(l.productId).title).join(", ")}
            </Row>
            <Row label="Phiên bản ghi trên đơn">
              {order.lines
                .map((l) => {
                  const p = productById(l.productId);
                  const v = p.variants.find((x) => x.id === l.variantId);
                  return v?.values.length ? `${v.values.join("/")} (${v.sku})` : v?.sku || "—";
                })
                .join(", ")}
            </Row>
            <Row label="Mở khiếu nại">{dmyhm(dispute.openedAt)}</Row>
          </div>
        </section>

        {/* ── Claims + evidence ──────────────────────────────────────── */}
        <section aria-labelledby="a05-claims">
          <h2 className="tl-shop-h2" id="a05-claims">
            Trình bày của hai bên
          </h2>
          <ol className="tl-shop-timeline">
            {dispute.entries.map((e, i) => (
              <li key={`${e.at}-${i}`} className={i === dispute.entries.length - 1 ? "is-current" : "is-done"}>
                <div className="tl-shop-timeline-when">{dmyhm(e.at)}</div>
                <div style={{ fontWeight: 650, fontSize: 13, color: "var(--tl-fg-2)" }}>{WHO[e.by]}</div>
                <p style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>{e.text}</p>
                {e.evidence && (
                  <div style={{ marginTop: 10 }}>
                    <EvidenceViewer items={e.evidence.map((label) => ({ label }))} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* ── Decision ───────────────────────────────────────────────── */}
        <section aria-labelledby="a05-decide">
          <h2 className="tl-shop-h2" id="a05-decide">
            Quyết định
          </h2>

          <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
            <legend className="tl-shop-label" style={{ padding: 0 }}>
              Kết quả
            </legend>
            <div style={{ display: "grid", gap: 2 }}>
              {OUTCOMES.map((o) => (
                <label key={o.key} className="tl-shop-check">
                  <input
                    type="radio"
                    name="outcome"
                    checked={outcome === o.key}
                    onChange={() => setOutcome(o.key)}
                    style={{ width: 18, height: 18 }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>

          {outcome === "hoan-mot-phan" && (
            <label className="tl-shop-field">
              <span className="tl-shop-label">Số tiền hoàn (₫)</span>
              <input
                className="tl-shop-input"
                inputMode="numeric"
                value={partial}
                onChange={(e) => setPartial(Number(e.target.value.replace(/\D/g, "")) || 0)}
                style={{ maxWidth: 200 }}
              />
              <span className="tl-shop-hint">
                Tối đa {vnd(total)}. Hiển thị cho hai bên là {vnd(partial)}.
              </span>
            </label>
          )}

          {/* ── Consequence preview ─────────────────────────────────── */}
          {outcome && (
            <div className="tl-shop-notice tl-shop-notice--info" style={{ display: "block" }}>
              <p style={{ margin: "0 0 10px", display: "flex", gap: 8, alignItems: "center" }}>
                <Scale size={16} aria-hidden="true" />
                <strong>Bấm xác nhận sẽ tạo ra những hệ quả sau:</strong>
              </p>
              <div className="tl-shop-tablewrap" tabIndex={0} style={{ background: "var(--tl-bg-elev)" }}>
                <table className="tl-shop-table">
                  <tbody>
                    {effects(outcome).map(([k, v]) => (
                      <tr key={k}>
                        <th scope="row" style={{ width: "30%", color: "var(--tl-fg-3)", fontWeight: 500 }}>
                          {k}
                        </th>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <label className="tl-shop-field">
            <span className="tl-shop-label">Lý do gửi hai bên (bắt buộc)</span>
            <div className="tl-shop-external">
              <textarea
                className="tl-shop-textarea"
                value={visible}
                onChange={(e) => setVisible(e.target.value)}
                aria-invalid={outcome && visible.trim().length < 10 ? true : undefined}
                placeholder="Cả người mua và người bán đọc nguyên văn đoạn này."
              />
              <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                <Eye size={11} aria-hidden="true" style={{ verticalAlign: -1 }} />{" "}
                <strong>Cả hai bên</strong> đọc được.
              </p>
            </div>
            {outcome && visible.trim().length < 10 && (
              <span className="tl-shop-error">
                <AlertTriangle size={13} aria-hidden="true" />
                Viết rõ căn cứ. Đây là thứ duy nhất hai bên nhận được để hiểu vì sao.
              </span>
            )}
          </label>

          <label className="tl-shop-field">
            <span className="tl-shop-label">Ghi chú nội bộ</span>
            <div className="tl-shop-internal">
              <textarea
                className="tl-shop-textarea"
                value={internal}
                onChange={(e) => setInternal(e.target.value)}
                placeholder="Chỉ quản trị viên đọc được."
              />
              <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Không gửi cho
                bên nào.
              </p>
            </div>
          </label>

          <label className="tl-shop-check" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            Tôi đã đọc bằng chứng của cả hai bên và bảng hệ quả ở trên
          </label>

          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
            disabled={!outcome || visible.trim().length < 10 || !confirm}
          >
            Xác nhận kết quả
          </button>
        </section>

        <nav aria-label="Bản mẫu · tình huống" style={{ marginTop: 26 }}>
          <div className="tl-shop-cats">
            {DISPUTES.map((d) => (
              <Link
                key={d.id}
                to={`?variant=${d.id}`}
                className="tl-shop-cat"
                aria-current={d.id === dispute.id ? "page" : undefined}
              >
                {d.reason}
              </Link>
            ))}
          </div>
        </nav>
      </AdminShopFrame>
    </main>
  );
}
