// ============================================================================
// /admin/shop/products — prototype A04's queue, in production.
// ----------------------------------------------------------------------------
// Everything on this screen comes from product_moderation_queue(): the rows,
// the badge counts, and the "waiting" duration. Nothing is summed on the
// client — a screen that adds up the page it happens to be holding reports the
// page size and calls it the backlog.
//
// Filters live in the URL, so a moderator can bookmark "everything waiting on
// me" and hand a colleague a link to the exact working set. Paging is a
// cursor, kept in the URL too, because Back has to land where they were.
// ============================================================================

import { Link } from "react-router-dom";
import { AlertTriangle, ImageOff, RotateCcw } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminShopFrame } from "@/components/shop/ShopShell";
import { ErrorState, LoadingState } from "@/components/states/PageStates";
import { useUrlBackedState } from "@/hooks/useUrlBackedState";
import { useModerationQueue, type ModerationStatus, type QueueRow } from "@/hooks/shop/useProductModeration";
import { waitingLabel } from "@/lib/shop/moderationQueue";
import "@/styles/shop.css";

const TABS: { key: ModerationStatus; label: string }[] = [
  { key: "pending_review", label: "Chờ duyệt" },
  { key: "needs_changes", label: "Đã trả về" },
  { key: "approved", label: "Đã duyệt" },
  { key: "suspended", label: "Đã gỡ" },
  { key: "rejected", label: "Từ chối" },
];

const TAB_KEYS = TABS.map((t) => t.key);

/** Facts from the row. Never a score — a number the system cannot justify is
 *  worse than no number, because a moderator will trust it. */
function signalsFor(r: QueueRow): string[] {
  const out: string[] = [];
  if (r.media_total === 0) out.push("Chưa có ảnh");
  else if (r.media_verified < r.media_total) {
    out.push(`${r.media_total - r.media_verified}/${r.media_total} ảnh chưa xác minh`);
  }
  if (!r.category.slug) out.push("Chưa chọn ngành hàng");
  else if (!r.category.is_active) out.push("Ngành hàng đã tắt");
  if (r.shop.state !== "active") out.push(`Shop đang ${r.shop.state}`);
  if (r.times_returned > 0) out.push(`Đã trả về ${r.times_returned} lần`);
  return out;
}

export default function AdminShopProducts() {
  const [status, setStatus] = useUrlBackedState<ModerationStatus>({
    param: "status",
    parse: (raw) => (TAB_KEYS.includes(raw as ModerationStatus) ? (raw as ModerationStatus) : null),
    fallback: "pending_review",
  });
  // The cursor is (submitted_at, id). Both in the URL so Back returns to the
  // same page rather than the first one.
  const [cursorAt, setCursorAt] = useUrlBackedState<string>({
    param: "after", parse: (raw) => raw || null, fallback: "",
  });
  const [cursorId, setCursorId] = useUrlBackedState<string>({
    param: "after_id", parse: (raw) => raw || null, fallback: "",
  });

  const queue = useModerationQueue({
    status,
    cursorAt: cursorAt || null,
    cursorId: cursorId || null,
  });

  const page = queue.data;
  const rows = page?.rows ?? [];

  const goToStatus = (s: ModerationStatus) => {
    setCursorAt("");
    setCursorId("");
    setStatus(s);
  };

  return (
    <AdminLayout>
      <DynamicMeta title="Duyệt sản phẩm" noindex />
      <div className="tl-shop">
        <h1 className="tl-shop-h1">Hàng đợi duyệt sản phẩm</h1>
        <p className="tl-shop-sub">
          Bộ lọc và trang nằm trong đường dẫn — đánh dấu trang hoặc gửi link là ra đúng
          danh sách này.
        </p>

        <AdminShopFrame crumb="Duyệt sản phẩm">
          <div className="tl-shop-cats" role="group" aria-label="Lọc theo trạng thái">
            {TABS.map((t) => {
              const n = page?.counts?.[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  className="tl-shop-cat"
                  aria-current={status === t.key ? "page" : undefined}
                  onClick={() => goToStatus(t.key)}
                >
                  {t.label}
                  {typeof n === "number" && n > 0 && <span className="count">{n}</span>}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 16 }}>
            {queue.isLoading ? (
              <LoadingState />
            ) : queue.isError ? (
              // Error is not empty. A moderator told "không có sản phẩm nào"
              // when the request failed stops looking, and the queue silently
              // stops being worked.
              <ErrorState onRetry={() => void queue.refetch()} />
            ) : rows.length === 0 ? (
              <div className="tl-shop-empty">
                <p className="tl-shop-empty-title">
                  {cursorAt ? "Hết trang" : "Không có sản phẩm nào ở trạng thái này"}
                </p>
                {cursorAt && (
                  <button type="button" className="tl-shop-btn tl-shop-btn--sm"
                          onClick={() => { setCursorAt(""); setCursorId(""); }}>
                    Về đầu danh sách
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="tl-shop-tablewrap" tabIndex={0}>
                  <table className="tl-shop-table">
                    <caption className="tl-shop-sr">Sản phẩm chờ kiểm duyệt</caption>
                    <thead>
                      <tr>
                        <th scope="col">Sản phẩm</th>
                        <th scope="col">Shop</th>
                        <th scope="col">Ngành hàng</th>
                        <th scope="col">Chờ</th>
                        <th scope="col">Dấu hiệu cần soi</th>
                        <th scope="col"><span className="tl-shop-sr">Hành động</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const signals = signalsFor(r);
                        return (
                          <tr key={r.id}>
                            <th scope="row" style={{ fontWeight: 600 }}>
                              {r.title}
                              <span className="tl-shop-sr"> — {r.variant_count} phiên bản</span>
                            </th>
                            <td>{r.shop.name}</td>
                            <td>{r.category.name ?? "—"}</td>
                            <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                              {waitingLabel(r.waiting_seconds)}
                            </td>
                            <td>
                              {signals.length === 0 ? (
                                <span style={{ color: "var(--tl-fg-4)" }}>—</span>
                              ) : (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {signals.map((s) => (
                                    <span key={s} className="tl-shop-pill tl-shop-pill--warn tl-shop-pill--wrap">
                                      {s.includes("ảnh") ? (
                                        <ImageOff size={11} aria-hidden="true" style={{ flex: "none" }} />
                                      ) : s.includes("trả về") ? (
                                        <RotateCcw size={11} aria-hidden="true" style={{ flex: "none" }} />
                                      ) : (
                                        <AlertTriangle size={11} aria-hidden="true" style={{ flex: "none" }} />
                                      )}
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              <Link to={`/admin/shop/products/${r.id}`} className="tl-shop-btn tl-shop-btn--sm">
                                Xem
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {page?.has_more && (
                  <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="tl-shop-btn"
                      onClick={() => {
                        const last = rows[rows.length - 1];
                        setCursorAt(last.submitted_at ?? "");
                        setCursorId(last.id);
                      }}
                    >
                      Trang tiếp
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <p className="tl-shop-hint">
            Số trên mỗi thẻ do máy chủ đếm trên toàn bộ hàng đợi, không phải đếm những dòng
            đang hiện. Không có cột &ldquo;điểm rủi ro&rdquo;: chỉ những dấu hiệu suy ra được từ
            chính sản phẩm.
          </p>
        </AdminShopFrame>
      </div>
    </AdminLayout>
  );
}
