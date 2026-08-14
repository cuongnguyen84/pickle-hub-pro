// ============================================================================
// A02 — Application queue /admin/shop/applications
// ----------------------------------------------------------------------------
// Filters live in the URL so a moderator can bookmark "everything waiting on
// me" and share a link to an exact working set with a colleague.
//
// The "risk signals" column shows only facts derived from the submission
// (missing document, name mismatch, resubmission) — never a made-up score.
// ============================================================================

import { useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { readScenario } from "../scenario";
import { AdminShopFrame } from "../components/Shells";
import { EmptyState, ErrorState, LoadingLines } from "../components/States";
import { APPLICATION_QUEUE, dmyhm, type ApplicationStatus } from "../fixtures";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "Nháp",
  submitted: "Đã gửi",
  under_review: "Đang xem",
  needs_changes: "Chờ sửa",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  withdrawn: "Đã rút",
};

const TYPE_LABEL: Record<string, string> = {
  "ca-nhan": "Cá nhân",
  "ho-kinh-doanh": "Hộ kinh doanh",
  "cong-ty": "Công ty",
};

/** Only signals we can derive from the record itself. No invented risk score. */
const signalsFor = (a: (typeof APPLICATION_QUEUE)[number]) => {
  const out: string[] = [];
  const missing = a.documents.filter((d) => d.state === "missing").length;
  const rejected = a.documents.filter((d) => d.state === "rejected").length;
  if (a.completedSteps < 6) out.push(`Thiếu ${6 - a.completedSteps} bước`);
  if (missing) out.push(`Thiếu ${missing} giấy tờ`);
  if (rejected) out.push(`${rejected} giấy tờ bị trả lại`);
  if (a.internalNote.includes("khác tên")) out.push("Tên GPKD khác tên shop");
  return out;
};

export default function A02Queue() {
  const location = useLocation();
  const scenario = readScenario(location.search);
  const [sp, setSp] = useSearchParams();
  const status = sp.get("status") ?? "all";

  const rows = useMemo(
    () => (status === "all" ? APPLICATION_QUEUE : APPLICATION_QUEUE.filter((a) => a.status === status)),
    [status],
  );

  const setStatus = (v: string) => {
    const p = new URLSearchParams(sp);
    if (v === "all") p.delete("status");
    else p.set("status", v);
    setSp(p);
  };

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">A02</p>
      <h1 className="tl-shop-h1">Hàng đợi hồ sơ đăng ký</h1>
      <p className="tl-shop-sub">
        Bộ lọc nằm trong đường dẫn — đánh dấu trang hoặc gửi link cho người khác là ra đúng
        danh sách này.
      </p>

      <AdminShopFrame crumb="Hồ sơ đăng ký">
        <div className="tl-shop-cats" role="group" aria-label="Lọc theo trạng thái">
          {(["all", ...Object.keys(STATUS_LABEL)] as string[]).map((k) => (
            <button
              key={k}
              type="button"
              className="tl-shop-cat"
              aria-current={status === k ? "page" : undefined}
              onClick={() => setStatus(k)}
            >
              {k === "all" ? "Tất cả" : STATUS_LABEL[k as ApplicationStatus]} (
              {k === "all"
                ? APPLICATION_QUEUE.length
                : APPLICATION_QUEUE.filter((a) => a.status === k).length}
              )
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {scenario === "slow" ? (
            <LoadingLines rows={4} />
          ) : scenario === "error" ? (
            <ErrorState
              what="Chưa tải được hàng đợi hồ sơ."
              recovery="Bộ lọc vẫn nằm trên đường dẫn, bấm Thử lại là chạy tiếp."
            />
          ) : rows.length === 0 ? (
            <EmptyState title="Không có hồ sơ nào ở trạng thái này" />
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
                    <th scope="col">
                      <span className="tl-shop-sr">Hành động</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const signals = signalsFor(a);
                    return (
                      <tr key={a.id}>
                        <th scope="row" style={{ fontWeight: 600 }}>
                          {a.shopName}
                        </th>
                        <td>{TYPE_LABEL[a.sellerType]}</td>
                        <td>
                          <span
                            className={`tl-shop-pill ${
                              a.status === "needs_changes" || a.status === "rejected"
                                ? "tl-shop-pill--danger"
                                : a.status === "approved"
                                  ? "tl-shop-pill--ok"
                                  : "tl-shop-pill--muted"
                            }`}
                          >
                            {STATUS_LABEL[a.status]}
                          </span>
                        </td>
                        <td>
                          {signals.length === 0 ? (
                            <span style={{ color: "var(--tl-fg-4)" }}>—</span>
                          ) : (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {signals.map((sg) => (
                                <span key={sg} className="tl-shop-pill tl-shop-pill--warn tl-shop-pill--wrap">
                                  <AlertTriangle size={11} aria-hidden="true" style={{ flex: "none" }} />
                                  {sg}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                          {a.submittedAt ? dmyhm(a.submittedAt) : "—"}
                        </td>
                        <td>
                          <Link
                            to={`/proto/shop/admin/applications/${a.id}`}
                            className="tl-shop-btn tl-shop-btn--sm"
                          >
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
    </main>
  );
}
