// ============================================================================
// /seller/application/status — prototype S03 in production.
// ----------------------------------------------------------------------------
// Every non-approved status carries a concrete next step; the view type refuses
// to describe a status without one, so a blank dead-end is a build error rather
// than a screen a seller stares at.
//
// The applicant reads `applicant_note` only. `internal_note` is not merely
// unselected here — it does not exist on the view this page reads.
// ============================================================================

import { Link } from "react-router-dom";
import { AlertTriangle, Check, Clock, FileText, RotateCcw, X } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { ShopScrollShell, ShopHeader, DefList } from "@/components/shop/ShopShell";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import {
  useApplicationEvents,
  useMyApplication,
  useWithdrawApplication,
} from "@/hooks/shop/useSellerApplication";
import { applicationDeepLink, targetByField, type ApplicationStatus } from "@/lib/shop/applicationState";
import { shopErrorMessage } from "@/lib/shop/errors";

interface View {
  title: string;
  tone: "" | "--warn" | "--danger" | "--info";
  Icon: typeof Clock;
  body: string;
  /** Required — there is no status where the user is left with nothing to do. */
  next: { label: string; to: string; primary?: boolean };
}

const VIEWS: Record<ApplicationStatus, View> = {
  draft: {
    title: "Hồ sơ đang là bản nháp",
    tone: "", Icon: FileText,
    body: "Anh/chị chưa gửi hồ sơ. Bản nháp vẫn còn nguyên, làm tiếp lúc nào cũng được.",
    next: { label: "Làm tiếp hồ sơ", to: "/seller/application", primary: true },
  },
  submitted: {
    title: "Đã gửi hồ sơ",
    tone: "--info", Icon: Check,
    body: "Hồ sơ đã vào hàng chờ. Anh/chị sẽ nhận thông báo ngay khi có kết quả hoặc khi cần bổ sung thông tin.",
    next: { label: "Về trang chủ", to: "/" },
  },
  under_review: {
    title: "Đang được xem",
    tone: "--info", Icon: Clock,
    body: "Quản trị viên đang xem hồ sơ. Nếu cần bổ sung, chúng tôi sẽ ghi rõ ở đây và gửi thông báo.",
    next: { label: "Về trang chủ", to: "/" },
  },
  needs_changes: {
    title: "Cần sửa vài chỗ",
    tone: "--warn", Icon: AlertTriangle,
    body: "",
    next: { label: "Sửa và gửi lại", to: "/seller/application", primary: true },
  },
  approved: {
    title: "Hồ sơ đã được duyệt",
    tone: "--info", Icon: Check,
    body: "Shop của anh/chị đã mở. Bước tiếp theo là đăng sản phẩm đầu tiên.",
    next: { label: "Vào Kênh người bán", to: "/seller", primary: true },
  },
  rejected: {
    title: "Hồ sơ chưa được duyệt",
    tone: "--danger", Icon: X,
    body: "",
    next: { label: "Nộp hồ sơ mới", to: "/seller/application", primary: true },
  },
  withdrawn: {
    title: "Anh/chị đã rút hồ sơ",
    tone: "", Icon: RotateCcw,
    body: "Hồ sơ đã đóng theo yêu cầu của anh/chị.",
    next: { label: "Nộp lại hồ sơ", to: "/seller/application", primary: true },
  },
};

const EVENT_LABEL: Record<string, string> = {
  created: "Tạo hồ sơ",
  submitted: "Gửi hồ sơ",
  resubmitted: "Gửi lại sau khi sửa",
  withdrawn: "Rút hồ sơ",
  requested_changes: "Quản trị viên yêu cầu sửa",
  approved: "Được duyệt",
  rejected: "Bị từ chối",
};

export default function SellerApplicationStatus() {
  const app = useMyApplication();
  const events = useApplicationEvents(app.data?.id ?? null);
  const withdraw = useWithdrawApplication();

  // Khung xương đúng hình trang: thẻ trạng thái lớn, một nút, rồi dòng thời
  // gian của hồ sơ. Header có nút Quay lại hiện ngay từ đầu.
  if (app.isLoading) {
    return (
      <ShopScrollShell>
        <ShopHeader title="Hồ sơ đăng ký" backTo="/shop/sell" />
        <main className="tl-shop-page tl-shop-page--narrow" aria-busy="true" aria-label="Đang tải hồ sơ đăng ký">
          <span className="tl-shop-sk tl-shop-sk--title" />
          <span className="tl-shop-sk tl-shop-sk--card" />
          <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "45%" }} />
          <span className="tl-shop-sk tl-shop-sk--card" />
        </main>
      </ShopScrollShell>
    );
  }

  if (app.isError) {
    return (
      <ShopScrollShell>
        <ShopHeader title="Hồ sơ đăng ký" backTo="/shop/sell" />
        <main className="tl-shop-page tl-shop-page--narrow">
          <ShopErrorNotice
            title="Chưa tải được hồ sơ đăng ký."
            onRetry={() => void app.refetch()}
          />
        </main>
      </ShopScrollShell>
    );
  }

  if (!app.data) {
    return (
      <ShopScrollShell>
        <ShopHeader title="Hồ sơ đăng ký" backTo="/shop/sell" />
        <main className="tl-shop-page tl-shop-page--narrow">
          <FileText size={28} aria-hidden="true" style={{ color: "var(--tl-fg-3)", marginBottom: 10 }} />
          <h1 className="tl-shop-h1">Anh/chị chưa có hồ sơ nào</h1>
          <Link to="/seller/application" className="tl-shop-btn tl-shop-btn--primary">
            Bắt đầu đăng ký
          </Link>
        </main>
      </ShopScrollShell>
    );
  }

  const row = app.data;
  const view = VIEWS[row.status];
  const { Icon } = view;
  const canWithdraw = !["approved", "rejected", "withdrawn"].includes(row.status);

  return (
    <ShopScrollShell>
      <DynamicMeta title="Trạng thái hồ sơ đăng ký bán hàng" noindex />
      <ShopHeader title="Hồ sơ đăng ký" backTo="/shop/sell" />
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">{view.title}</h1>
        <p className="tl-shop-sub">
          {row.submitted_at
            ? `Gửi lúc ${new Date(row.submitted_at).toLocaleString("vi-VN")}`
            : "Chưa gửi"}{" "}
          · Shop dự kiến: {row.shop_name ?? "—"}
        </p>

        <div className={`tl-shop-notice tl-shop-notice${view.tone}`}>
          <Icon size={16} aria-hidden="true" />
          <div>{view.body || row.applicant_note}</div>
        </div>

        {row.status === "needs_changes" && row.requested_fields.length > 0 && (
          <section aria-labelledby="s03-todo">
            <h2 className="tl-shop-h2" id="s03-todo">
              Cần sửa {row.requested_fields.length} chỗ
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {row.requested_fields.map((field) => {
                const t = targetByField(field);
                return (
                  <li key={field} className="tl-shop-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontWeight: 650, fontSize: 14 }}>{t?.label ?? field}</div>
                      {t && <p className="tl-shop-hint" style={{ marginTop: 3 }}>Bước {t.step + 1}</p>}
                    </div>
                    <Link to={applicationDeepLink(field)} className="tl-shop-btn tl-shop-btn--sm">
                      Đi tới ô này
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {events.data && events.data.length > 0 && (
          <section aria-labelledby="s03-history">
            <h2 className="tl-shop-h2" id="s03-history">Diễn biến</h2>
            <ol className="tl-shop-timeline">
              {events.data.map((e, i) => (
                <li key={e.id} className={i === events.data!.length - 1 ? "is-current" : "is-done"}>
                  <div className="tl-shop-timeline-when">
                    {new Date(e.created_at).toLocaleString("vi-VN")}
                  </div>
                  <div className="tl-shop-timeline-what">{EVENT_LABEL[e.event] ?? e.event}</div>
                  {e.note && <p className="tl-shop-hint" style={{ marginTop: 4 }}>{e.note}</p>}
                </li>
              ))}
              {/* The step that has not happened yet — a dashed ghost, no SLA.
                  Spec đặt "trên cùng"; timeline này chạy cũ→mới nên bước kế
                  tiếp đứng CUỐI danh sách để giữ đúng dòng thời gian. */}
              {(row.status === "submitted" || row.status === "under_review") && (
                <li className="is-next">
                  <div className="tl-shop-timeline-what">
                    Quản trị viên xem hồ sơ và trả lời tại đây
                  </div>
                </li>
              )}
            </ol>
          </section>
        )}

        <section aria-labelledby="s03-summary">
          <h2 className="tl-shop-h2" id="s03-summary">Thông tin đã gửi</h2>
          <div className="tl-shop-card">
            <DefList
              rows={[
                ["Tên shop", row.shop_name ?? "—"],
                ["Loại người bán", row.seller_type ?? "—"],
                ["Gửi từ", row.city ?? "—"],
              ]}
            />
          </div>
        </section>

        {withdraw.isError && (
          <div className="tl-shop-notice tl-shop-notice--danger" role="alert" style={{ marginTop: 26, marginBottom: 0 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{shopErrorMessage(withdraw.error)}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: withdraw.isError ? 12 : 26, flexWrap: "wrap" }}>
          <Link to={view.next.to} className={`tl-shop-btn ${view.next.primary ? "tl-shop-btn--primary" : ""}`}>
            {view.next.label}
          </Link>
          {canWithdraw && (
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--ghost"
              disabled={withdraw.isPending}
              aria-busy={withdraw.isPending || undefined}
              onClick={() => withdraw.mutate()}
            >
              {withdraw.isPending ? "Đang rút…" : "Rút hồ sơ"}
            </button>
          )}
        </div>

        {row.status !== "draft" && (
          <div className="tl-shop-card" style={{ marginTop: 26, fontSize: 13.5, lineHeight: 1.6 }}>
            <strong>Cần hỏi nhanh?</strong> Hồ sơ do người thật xem — nhắn Zalo cho ThePickleHub,
            kèm tên shop dự kiến.
          </div>
        )}
      </main>
    </ShopScrollShell>
  );
}
