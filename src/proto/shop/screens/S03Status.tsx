// ============================================================================
// S03 — Application status
// ----------------------------------------------------------------------------
// Acceptance: every non-approved state includes the correct recovery or next
// step. So the state table below pairs each status with an action, and the
// component refuses to render a status without one — a missing next step is a
// build error, not a blank screen the user stares at.
// ============================================================================

import { Link, useLocation } from "react-router-dom";
import { Clock, Check, AlertTriangle, X, RotateCcw, FileText } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { APPLICATIONS, dmyhm, type ApplicationStatus } from "../fixtures";
import { REQUEST_TARGETS, applicationDeepLink } from "../application-fields";

interface StatusView {
  title: string;
  tone: "" | "--warn" | "--danger" | "--info";
  Icon: typeof Clock;
  body: string;
  /** Required. There is no status where the user should be left with nothing to do. */
  next: { label: string; to: string; primary?: boolean };
  secondary?: { label: string; to: string };
}

/** What the moderator ticked on this fixture application. */
const REQUESTED = REQUEST_TARGETS.filter((t) => ["f-doc", "f-phone"].includes(t.field));

const APPLICATION_STEP_LABEL = [
  "Loại người bán",
  "Danh tính",
  "Thông tin shop",
  "Địa chỉ",
  "Giấy tờ",
  "Xem lại & gửi",
];

const VIEWS: Record<ApplicationStatus, StatusView> = {
  draft: {
    title: "Hồ sơ đang là bản nháp",
    tone: "",
    Icon: FileText,
    body: "Anh/chị chưa gửi hồ sơ. Bản nháp vẫn còn nguyên, làm tiếp lúc nào cũng được.",
    next: { label: "Làm tiếp hồ sơ", to: "/proto/shop/seller/application?variant=restored", primary: true },
  },
  submitted: {
    title: "Đã gửi hồ sơ",
    tone: "--info",
    Icon: Check,
    body: "Hồ sơ đã vào hàng chờ. Chúng tôi chưa cam kết thời gian duyệt vì lượng hồ sơ còn ít và chưa đo được — anh/chị sẽ nhận thông báo ngay khi có kết quả.",
    next: { label: "Về trang Shop", to: "/proto/shop/home" },
    secondary: { label: "Rút hồ sơ", to: "?variant=withdrawn" },
  },
  under_review: {
    title: "Đang được xem",
    tone: "--info",
    Icon: Clock,
    body: "Quản trị viên đang xem hồ sơ của anh/chị. Nếu cần bổ sung, chúng tôi sẽ ghi rõ ở đây và gửi thông báo.",
    next: { label: "Về trang Shop", to: "/proto/shop/home" },
  },
  needs_changes: {
    title: "Cần sửa vài chỗ",
    tone: "--warn",
    Icon: AlertTriangle,
    body: "", // filled from the applicant-visible note
    next: { label: "Sửa và gửi lại", to: applicationDeepLink(REQUEST_TARGETS[7]), primary: true },
  },
  approved: {
    title: "Hồ sơ đã được duyệt",
    tone: "--info",
    Icon: Check,
    body: "Shop của anh/chị đã mở. Bước tiếp theo là đăng sản phẩm đầu tiên.",
    next: { label: "Vào Kênh người bán", to: "/proto/shop/seller", primary: true },
  },
  rejected: {
    title: "Hồ sơ chưa được duyệt",
    tone: "--danger",
    Icon: X,
    body: "",
    next: { label: "Nộp hồ sơ mới", to: "/proto/shop/seller/application?variant=pristine", primary: true },
    secondary: { label: "Liên hệ hỗ trợ", to: "/proto/shop/home" },
  },
  withdrawn: {
    title: "Anh/chị đã rút hồ sơ",
    tone: "",
    Icon: RotateCcw,
    body: "Hồ sơ đã đóng theo yêu cầu của anh/chị. Thông tin đã điền vẫn được giữ lại 30 ngày.",
    next: { label: "Nộp lại hồ sơ", to: "/proto/shop/seller/application?variant=restored", primary: true },
  },
};

export default function S03Status() {
  const location = useLocation();
  const status = (readVariant(location.search) || "submitted") as ApplicationStatus;
  const app = APPLICATIONS[status] ?? APPLICATIONS.submitted;
  const view = VIEWS[status] ?? VIEWS.submitted;
  const { Icon } = view;

  return (
    <BuyerShell title="Hồ sơ đăng ký" backTo="/proto/shop/sell" cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">{view.title}</h1>
        <p className="tl-shop-sub">
          {app.submittedAt ? `Gửi lúc ${dmyhm(app.submittedAt)}` : "Chưa gửi"} · Shop dự kiến:{" "}
          {app.shopName}
        </p>

        <div className={`tl-shop-notice tl-shop-notice${view.tone}`}>
          <Icon size={16} aria-hidden="true" />
          <div>{view.body || app.applicantNote}</div>
        </div>

        {/* The applicant only ever sees applicantNote. internalNote exists on the
            same record and is deliberately never referenced on this screen. */}
        {app.applicantNote && view.body && (
          <div className="tl-shop-external" style={{ marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{app.applicantNote}</p>
          </div>
        )}

        {/* What the moderator actually ticked. Each row links straight to the
            field so the applicant never hunts through six steps. */}
        {status === "needs_changes" && (
          <section aria-labelledby="s03-todo">
            <h2 className="tl-shop-h2" id="s03-todo">
              Cần sửa {REQUESTED.length} chỗ
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {REQUESTED.map((t) => (
                <li
                  key={t.field}
                  className="tl-shop-card"
                  style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
                >
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{t.label}</div>
                    <p className="tl-shop-hint" style={{ marginTop: 3 }}>
                      Bước {t.step + 1} · {APPLICATION_STEP_LABEL[t.step]}
                    </p>
                  </div>
                  <Link to={applicationDeepLink(t)} className="tl-shop-btn tl-shop-btn--sm">
                    Đi tới ô này
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {app.documents.length > 0 && (
          <section aria-labelledby="s03-docs">
            <h2 className="tl-shop-h2" id="s03-docs">
              Giấy tờ đã nộp
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {app.documents.map((d) => (
                <li
                  key={d.label}
                  className="tl-shop-card"
                  style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
                >
                  <span style={{ fontSize: 13.5 }}>{d.label}</span>
                  <span className="tl-proto-spacer" />
                  <span
                    className={`tl-shop-pill ${
                      d.state === "uploaded"
                        ? "tl-shop-pill--ok"
                        : d.state === "rejected"
                          ? "tl-shop-pill--danger"
                          : "tl-shop-pill--muted"
                    }`}
                  >
                    {d.state === "uploaded" ? "Đã nhận" : d.state === "rejected" ? "Cần chụp lại" : "Chưa nộp"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
          <Link
            to={view.next.to}
            className={`tl-shop-btn ${view.next.primary ? "tl-shop-btn--primary" : ""}`}
          >
            {view.next.label}
          </Link>
          {view.secondary && (
            <Link to={view.secondary.to} className="tl-shop-btn tl-shop-btn--ghost">
              {view.secondary.label}
            </Link>
          )}
        </div>

        <nav aria-label="Xem các trạng thái khác" style={{ marginTop: 32 }}>
          <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 8 }}>
            Bản mẫu · 7 trạng thái
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(VIEWS) as ApplicationStatus[]).map((k) => (
              <Link
                key={k}
                to={`?variant=${k}`}
                className={`tl-shop-btn tl-shop-btn--sm ${k === status ? "tl-shop-btn--primary" : ""}`}
              >
                {k}
              </Link>
            ))}
          </div>
        </nav>
      </main>
    </BuyerShell>
  );
}
