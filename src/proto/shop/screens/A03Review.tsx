// ============================================================================
// A03 — Application review /admin/shop/applications/:id
// ----------------------------------------------------------------------------
// Acceptance: internal notes cannot be confused with applicant-visible
// feedback, and decision consequences are explicit.
//
// Both live in ModerationDecisionForm (F07) so this is enforced by the
// component, not by this page remembering to label things. The one thing added
// here is the resubmission diff: on a second submission the moderator must be
// able to see what actually changed, or they re-read the whole file every time.
// ============================================================================

import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Lock, Eye, History } from "lucide-react";
import { readVariant } from "../scenario";
import { AdminShopFrame } from "../components/Shells";
import { EvidenceViewer, ModerationDecisionForm, type Decision } from "../components/Forms";
import { APPLICATION_QUEUE, APPLICATIONS, dmyhm } from "../fixtures";

type Phase = "idle" | "busy" | "error" | "done";

export default function A03Review() {
  const { id } = useParams();
  const location = useLocation();
  const variant = readVariant(location.search);
  const [phase, setPhase] = useState<Phase>(variant === "busy" ? "busy" : variant === "error" ? "error" : "idle");
  const [decision, setDecision] = useState<Decision | null>(null);

  const app =
    APPLICATION_QUEUE.find((a) => a.id === id) ??
    APPLICATIONS[(variant as keyof typeof APPLICATIONS) ?? "under_review"] ??
    APPLICATIONS.under_review;

  const isResubmission = app.status === "needs_changes";

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">A03</p>
      <h1 className="tl-shop-h1">Xét hồ sơ: {app.shopName}</h1>
      <p className="tl-shop-sub">
        Gửi lúc {app.submittedAt ? dmyhm(app.submittedAt) : "—"} ·{" "}
        <Link to="/proto/shop/admin/applications">Về hàng đợi</Link>
      </p>

      <AdminShopFrame crumb={`Hồ sơ · ${app.shopName}`}>
        {phase === "done" && (
          <div className="tl-shop-notice tl-shop-notice--info" role="status">
            <div>
              <strong>Đã ghi nhận quyết định.</strong> Người nộp nhận thông báo kèm đúng phần
              ghi chú anh gửi họ. Toàn bộ thao tác vào nhật ký quản trị.
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr", alignItems: "start" }}>
          {/* ── Applicant snapshot ─────────────────────────────────────── */}
          <section aria-labelledby="a03-snap">
            <h2 className="tl-shop-h2" id="a03-snap" style={{ marginTop: 0 }}>
              Người nộp
            </h2>
            <div className="tl-shop-card">
              <dl style={{ display: "grid", gap: 8, margin: 0, fontSize: 13.5 }}>
                {[
                  ["Tên shop", app.shopName],
                  ["Loại", app.sellerType],
                  ["Bước hoàn tất", `${app.completedSteps}/6`],
                  ["Trạng thái", app.status],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <dt style={{ color: "var(--tl-fg-3)" }}>{k}</dt>
                    <dd style={{ margin: 0, textAlign: "right" }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* ── Evidence ───────────────────────────────────────────────── */}
          <section aria-labelledby="a03-evi">
            <h2 className="tl-shop-h2" id="a03-evi">
              Giấy tờ
            </h2>
            <EvidenceViewer
              sensitive
              items={app.documents.map((d) => ({ label: d.label, tone: d.state === "rejected" ? "c" : "b" }))}
            />
            <p className="tl-shop-hint">
              <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Mỗi lần mở
              giấy tờ được ghi vào <code>audit_logs</code> kèm tài khoản quản trị viên.
            </p>
          </section>

          {/* ── Resubmission diff ──────────────────────────────────────── */}
          {isResubmission && (
            <section aria-labelledby="a03-diff">
              <h2 className="tl-shop-h2" id="a03-diff">
                Lần nộp này đổi gì
              </h2>
              <div className="tl-shop-card">
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, fontSize: 13.5 }}>
                  <li style={{ display: "flex", gap: 10 }}>
                    <History size={15} aria-hidden="true" style={{ flex: "none", marginTop: 2, color: "var(--tl-fg-3)" }} />
                    <span>
                      <strong>Giấy phép hộ kinh doanh</strong> — đã thay ảnh mới (bản cũ bị trả
                      lại vì thiếu góc dưới).
                    </span>
                  </li>
                  <li style={{ display: "flex", gap: 10 }}>
                    <History size={15} aria-hidden="true" style={{ flex: "none", marginTop: 2, color: "var(--tl-fg-3)" }} />
                    <span>
                      <strong>Tên shop</strong> — không đổi.
                    </span>
                  </li>
                </ul>
                <p className="tl-shop-hint">
                  Chỉ hiện những trường thật sự đổi, để không phải đọc lại cả hồ sơ mỗi lần họ
                  nộp lại.
                </p>
              </div>
            </section>
          )}

          {/* ── Notes ─────────────────────────────────────────────────── */}
          <section aria-labelledby="a03-notes">
            <h2 className="tl-shop-h2" id="a03-notes">
              Ghi chú đã có
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              {app.internalNote && (
                <div className="tl-shop-internal">
                  <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 6 }}>
                    <Lock size={10} aria-hidden="true" style={{ verticalAlign: -1 }} /> Nội bộ · người nộp KHÔNG đọc được
                  </p>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{app.internalNote}</p>
                </div>
              )}
              {app.applicantNote && (
                <div className="tl-shop-external">
                  <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 6 }}>
                    <Eye size={10} aria-hidden="true" style={{ verticalAlign: -1 }} /> Người nộp đọc được
                  </p>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{app.applicantNote}</p>
                </div>
              )}
              {!app.internalNote && !app.applicantNote && (
                <p className="tl-shop-hint" style={{ marginTop: 0 }}>
                  Chưa có ghi chú nào.
                </p>
              )}
            </div>
          </section>

          {/* ── Audit trail ───────────────────────────────────────────── */}
          <section aria-labelledby="a03-audit">
            <h2 className="tl-shop-h2" id="a03-audit">
              Nhật ký
            </h2>
            <ol className="tl-shop-timeline">
              {[
                { at: app.submittedAt ?? "2026-08-07T09:05:00+07:00", what: "Người nộp gửi hồ sơ" },
                { at: "2026-08-07T10:12:00+07:00", what: "thecuong@gmail.com mở giấy tờ" },
                { at: "2026-08-07T10:20:00+07:00", what: "thecuong@gmail.com thêm ghi chú nội bộ" },
              ].map((e, i, arr) => (
                <li key={e.at} className={i === arr.length - 1 ? "is-current" : "is-done"}>
                  <div className="tl-shop-timeline-when">{dmyhm(e.at)}</div>
                  <div className="tl-shop-timeline-what">{e.what}</div>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Decision rail ─────────────────────────────────────────── */}
          <section aria-labelledby="a03-decide">
            <h2 className="tl-shop-h2" id="a03-decide">
              Quyết định
            </h2>
            <ModerationDecisionForm
              busy={phase === "busy" ? (decision ?? "approve") : null}
              error={
                phase === "error"
                  ? "Chưa gửi được quyết định. Mất kết nối tới máy chủ — ghi chú anh vừa gõ vẫn còn ở trên, bấm lại để thử tiếp. Người nộp CHƯA nhận được gì."
                  : undefined
              }
              onSubmit={(d) => {
                setDecision(d);
                setPhase("busy");
                window.setTimeout(() => setPhase("done"), 700);
              }}
            />
          </section>
        </div>

        <nav aria-label="Bản mẫu · trạng thái" style={{ marginTop: 26 }}>
          <div className="tl-shop-cats">
            {["under_review", "needs_changes", "rejected", "busy", "error"].map((k) => (
              <Link key={k} to={`?variant=${k}`} className="tl-shop-cat" aria-current={variant === k ? "page" : undefined}>
                {k}
              </Link>
            ))}
          </div>
        </nav>
      </AdminShopFrame>
    </main>
  );
}
