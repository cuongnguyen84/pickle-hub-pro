// ============================================================================
// A01 — Shop admin overview /admin/shop
// ----------------------------------------------------------------------------
// Queues, not dashboards. Each card answers "how many things are waiting on a
// human, and how old is the oldest one" — the second half is what tells an
// admin whether they are behind.
//
// Partial failure is a first-class state: if the dispute query dies, the other
// three queues still render and the broken one says so, instead of the whole
// page becoming an error.
// ============================================================================

import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Clock } from "lucide-react";
import { readScenario } from "../scenario";
import { AdminShopFrame } from "../components/Shells";
import { APPLICATION_QUEUE, DISPUTES, PRODUCTS, ORDERS, dmy } from "../fixtures";

interface Queue {
  key: string;
  label: string;
  to: string;
  count: number;
  oldest: string | null;
  urgent?: boolean;
}

export default function A01Overview() {
  const location = useLocation();
  const scenario = readScenario(location.search);
  const urgent = scenario === "unavailable"; // "urgent backlog"
  const healthy = scenario === "empty";
  const partial = scenario === "error";

  const queues: Queue[] = [
    {
      key: "apps",
      label: "Hồ sơ đăng ký chờ xem",
      to: "/proto/shop/admin/applications",
      count: healthy ? 0 : urgent ? 14 : APPLICATION_QUEUE.filter((a) => a.status === "submitted" || a.status === "under_review").length,
      oldest: healthy ? null : "2026-08-06",
      urgent,
    },
    {
      key: "products",
      label: "Sản phẩm bị báo cáo / chờ duyệt",
      to: "/proto/shop/admin/products",
      count: healthy ? 0 : PRODUCTS.filter((p) => p.status === "pending_review" || p.status === "restricted").length,
      oldest: healthy ? null : "2026-08-08",
    },
    {
      key: "pay",
      label: "Chuyển khoản chờ đối soát",
      to: "/proto/shop/admin/applications",
      count: healthy ? 0 : ORDERS.filter((o) => o.paymentMethod === "vietqr" && !o.paymentConfirmedAt && o.status === "cho-thanh-toan").length,
      oldest: healthy ? null : "2026-08-10",
      urgent,
    },
    {
      key: "disputes",
      label: "Khiếu nại chờ quản trị viên",
      to: "/proto/shop/admin/disputes",
      count: healthy ? 0 : DISPUTES.filter((d) => d.stage === "admin-xem-xet").length,
      oldest: healthy ? null : "2026-07-02",
    },
  ];

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">A01</p>
      <h1 className="tl-shop-h1">Quản trị Shop</h1>
      <p className="tl-shop-sub">
        Bốn hàng đợi. Con số là việc đang chờ người xử lý; ngày là việc cũ nhất chưa đụng tới.
      </p>

      <AdminShopFrame crumb="Tổng quan">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          {queues.map((q) => {
            if (partial && q.key === "disputes")
              return (
                <div key={q.key} className="tl-shop-card" style={{ borderColor: "color-mix(in srgb, var(--shop-danger) 45%, transparent)" }}>
                  <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>{q.label}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
                    <AlertTriangle size={18} aria-hidden="true" style={{ color: "var(--shop-danger)" }} />
                    <span style={{ fontSize: 14, color: "var(--shop-danger)" }}>Không tải được</span>
                  </div>
                  <p className="tl-shop-hint" style={{ marginTop: 0 }}>
                    Ba hàng đợi kia vẫn đúng. Chỉ mục này lỗi — đừng coi là &ldquo;không có
                    khiếu nại nào&rdquo;.
                  </p>
                  <button type="button" className="tl-shop-btn tl-shop-btn--sm" style={{ marginTop: 8 }}>
                    Tải lại mục này
                  </button>
                </div>
              );

            return (
              <Link
                key={q.key}
                to={q.to}
                className="tl-shop-card"
                style={{
                  display: "block",
                  color: "inherit",
                  borderColor: q.urgent && q.count > 5 ? "color-mix(in srgb, var(--shop-warning) 50%, transparent)" : undefined,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>{q.label}</div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: q.count === 0 ? "var(--shop-stock-ok)" : q.urgent && q.count > 5 ? "var(--shop-warning)" : "var(--tl-fg)",
                  }}
                >
                  {q.count}
                </div>
                {q.oldest ? (
                  <p className="tl-shop-hint" style={{ marginTop: 2 }}>
                    <Clock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Cũ nhất từ{" "}
                    {dmy(q.oldest)}
                  </p>
                ) : (
                  <p className="tl-shop-hint" style={{ marginTop: 2 }}>
                    Không còn việc chờ
                  </p>
                )}
              </Link>
            );
          })}
        </div>

        {urgent && (
          <div className="tl-shop-notice tl-shop-notice--warn" style={{ marginTop: 16 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <strong>Hồ sơ đang dồn.</strong> 14 hồ sơ chờ, cũ nhất 4 ngày. Người nộp không
              được hứa thời gian duyệt nên chưa vi phạm cam kết nào — nhưng 4 ngày im lặng là
              lý do người bán bỏ đi.
            </div>
          </div>
        )}

        {healthy && (
          <div className="tl-shop-notice tl-shop-notice--info" style={{ marginTop: 16 }}>
            <div>Không còn việc nào chờ. Bốn hàng đợi đều trống.</div>
          </div>
        )}
      </AdminShopFrame>
    </main>
  );
}
