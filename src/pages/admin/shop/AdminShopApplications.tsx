// ============================================================================
// /admin/shop/applications — prototype A02 in production.
// ----------------------------------------------------------------------------
// Filters live in the URL so a moderator can bookmark "everything waiting on
// me" and hand a colleague a link to an exact working set.
//
// The signals column shows only facts derived from the row itself. There is no
// invented risk score: a number the system cannot justify is worse than no
// number, because a moderator will trust it.
// ============================================================================

import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminShopFrame } from "@/components/shop/ShopShell";
import { ErrorState, LoadingState } from "@/components/states/PageStates";
import { useUrlBackedState } from "@/hooks/useUrlBackedState";
import { useShopApplicationQueue } from "@/hooks/shop/useShopApplicationQueue";
import type { ShopApplicationRow } from "@/integrations/supabase/shop-schema";
import { APPLICATION_STATUS_LABEL, SELLER_TYPE_LABEL, type ApplicationStatus } from "@/lib/shop/applicationState";
import "@/styles/shop.css";

const FILTERS = ["all", "submitted", "under_review", "needs_changes", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

/** Facts derived from the row. Never a score. */
const signalsFor = (a: ShopApplicationRow): string[] => {
  const out: string[] = [];
  if (!a.phone) out.push("Thiếu số điện thoại");
  if (!a.city) out.push("Thiếu tỉnh/thành");
  if (a.requested_fields.length > 0) out.push(`Đã yêu cầu sửa ${a.requested_fields.length} ô`);
  return out;
};

export default function AdminShopApplications() {
  const [filter, setFilter] = useUrlBackedState<Filter>({
    param: "status",
    parse: (raw) => (FILTERS.includes(raw as Filter) ? (raw as Filter) : null),
    fallback: "submitted",
  });
  const queue = useShopApplicationQueue(filter === "all" ? "all" : (filter as ApplicationStatus));

  return (
    <AdminLayout>
      <DynamicMeta title="Hồ sơ đăng ký bán hàng" noindex />
      <div className="tl-shop">
        <h1 className="tl-shop-h1">Hàng đợi hồ sơ đăng ký</h1>
        <p className="tl-shop-sub">
          Bộ lọc nằm trong đường dẫn — đánh dấu trang hoặc gửi link cho người khác là ra đúng
          danh sách này.
        </p>

        <AdminShopFrame crumb="Hồ sơ đăng ký">
          <div className="tl-shop-cats" role="group" aria-label="Lọc theo trạng thái">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className="tl-shop-cat"
                aria-current={filter === f ? "page" : undefined}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "Tất cả" : APPLICATION_STATUS_LABEL[f as ApplicationStatus]}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            {queue.isLoading ? (
              <LoadingState />
            ) : queue.isError ? (
              <ErrorState onRetry={() => void queue.refetch()} />
            ) : (queue.data ?? []).length === 0 ? (
              <div className="tl-shop-empty">
                <p className="tl-shop-empty-title">Không có hồ sơ nào ở trạng thái này</p>
              </div>
            ) : (
              <div className="tl-shop-tablewrap" tabIndex={0}>
                <table className="tl-shop-table">
                  <caption className="tl-shop-sr">Hồ sơ đăng ký bán hàng</caption>
                  <thead>
                    <tr>
                      <th scope="col">Shop</th>
                      <th scope="col">Loại</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Dấu hiệu cần soi</th>
                      <th scope="col">Gửi lúc</th>
                      <th scope="col"><span className="tl-shop-sr">Hành động</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(queue.data ?? []).map((a) => {
                      const signals = signalsFor(a);
                      return (
                        <tr key={a.id}>
                          <th scope="row" style={{ fontWeight: 600 }}>{a.shop_name ?? "(chưa đặt tên)"}</th>
                          <td>{SELLER_TYPE_LABEL[a.seller_type ?? ""] ?? "—"}</td>
                          <td>
                            <span className={`tl-shop-pill ${
                              a.status === "needs_changes" || a.status === "rejected"
                                ? "tl-shop-pill--danger"
                                : a.status === "approved" ? "tl-shop-pill--ok" : "tl-shop-pill--muted"
                            }`}>
                              {APPLICATION_STATUS_LABEL[a.status]}
                            </span>
                          </td>
                          <td>
                            {signals.length === 0 ? (
                              <span style={{ color: "var(--tl-fg-4)" }}>—</span>
                            ) : (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {signals.map((s) => (
                                  <span key={s} className="tl-shop-pill tl-shop-pill--warn tl-shop-pill--wrap">
                                    <AlertTriangle size={11} aria-hidden="true" style={{ flex: "none" }} />
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                            {a.submitted_at ? new Date(a.submitted_at).toLocaleString("vi-VN") : "—"}
                          </td>
                          <td>
                            <Link to={`/admin/shop/applications/${a.id}`} className="tl-shop-btn tl-shop-btn--sm">
                              Xem
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="tl-shop-hint">
            Không có cột &ldquo;điểm rủi ro&rdquo;. Chỉ liệt kê dấu hiệu suy ra được từ chính hồ
            sơ — một con số tự chấm sẽ khiến người duyệt tin vào thứ không có cơ sở.
          </p>
        </AdminShopFrame>
      </div>
    </AdminLayout>
  );
}
