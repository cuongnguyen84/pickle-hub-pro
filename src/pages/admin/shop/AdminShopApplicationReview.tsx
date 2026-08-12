// ============================================================================
// /admin/shop/applications/:id — prototype A03 in production.
// ----------------------------------------------------------------------------
// Two properties this screen exists to protect:
//
//  1. Internal notes cannot be mistaken for applicant-visible feedback. The two
//     inputs differ in colour, border, icon AND label — enforced here, not
//     remembered per page.
//  2. "Yêu cầu sửa" must name the fields. A bare "sửa lại hồ sơ" makes the
//     applicant re-read six steps guessing; the server refuses it too
//     (requested_fields_required in shop_application_decide).
//
// The submit is sticky inside the form so a moderator on a phone does not have
// to scroll back past the evidence. One submit, never a duplicated bottom bar.
// ============================================================================

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Eye, Loader2, Lock } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminShopFrame, DefList } from "@/components/shop/ShopShell";
import { ErrorState, LoadingState } from "@/components/states/PageStates";
import {
  decisionErrorMessage,
  useDecideApplication,
  useShopApplication,
} from "@/hooks/shop/useShopApplicationQueue";
import { SellerRulesReceiptPanel } from "@/components/shop/SellerRulesReceiptPanel";
import { decisionBlocker, REQUEST_TARGETS, type Decision } from "@/lib/shop/applicationState";
import "@/styles/shop.css";

const CONSEQUENCE: Record<Decision, (n: number) => string> = {
  "request-changes": (n) =>
    `Người nộp nhận thông báo kèm ghi chú bên dưới và ${n} đường dẫn đi thẳng tới đúng ô cần sửa. Hồ sơ quay lại trạng thái “Cần sửa”.`,
  approve: () =>
    "Shop được tạo ở trạng thái chờ kích hoạt và người nộp trở thành chủ shop. Họ chưa đăng bán được cho tới khi hoàn tất bước tiếp theo.",
  reject: () =>
    "Hồ sơ đóng lại. Người nộp nhận đúng phần ghi chú bên dưới và vẫn nộp hồ sơ mới được.",
};

export default function AdminShopApplicationReview() {
  const { id } = useParams();
  const app = useShopApplication(id ?? null);
  const decide = useDecideApplication();

  const [decision, setDecision] = useState<Decision | "">("");
  const [applicantNote, setApplicantNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const blocker = decisionBlocker({ decision, applicantNote, requestedFields: picked });

  if (app.isLoading) return <AdminLayout><LoadingState /></AdminLayout>;
  if (app.isError) return <AdminLayout><ErrorState onRetry={() => void app.refetch()} /></AdminLayout>;
  if (!app.data) {
    return (
      <AdminLayout>
        <div className="tl-shop">
          <div className="tl-shop-empty">
            <p className="tl-shop-empty-title">Không tìm thấy hồ sơ này</p>
            <Link to="/admin/shop/applications" className="tl-shop-btn">Về hàng đợi</Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const row = app.data;

  const submit = async () => {
    setError(null);
    if (blocker || !confirm || !decision) return;
    try {
      await decide.mutateAsync({
        applicationId: row.id,
        decision,
        applicantNote,
        internalNote,
        requestedFields: decision === "request-changes" ? picked : [],
      });
      setDone(true);
    } catch (err) {
      setError(decisionErrorMessage(err));
    }
  };

  return (
    <AdminLayout>
      <DynamicMeta title={`Xét hồ sơ ${row.shop_name ?? ""}`} noindex />
      <div className="tl-shop">
        <h1 className="tl-shop-h1">Xét hồ sơ: {row.shop_name ?? "(chưa đặt tên)"}</h1>
        <p className="tl-shop-sub">
          <Link to="/admin/shop/applications" className="tl-shop-back">← Về hàng đợi</Link>
        </p>

        <AdminShopFrame crumb={`Hồ sơ · ${row.shop_name ?? ""}`}>
          {done && (
            <div className="tl-shop-notice tl-shop-notice--info" role="status">
              <div>
                <strong>Đã ghi nhận quyết định.</strong> Người nộp nhận thông báo kèm đúng phần
                ghi chú anh gửi họ. Thao tác đã vào nhật ký quản trị.
              </div>
            </div>
          )}

          <section aria-labelledby="a03-snap">
            <h2 className="tl-shop-h2" id="a03-snap" style={{ marginTop: 0 }}>Người nộp</h2>
            <div className="tl-shop-card">
              <DefList
                rows={[
                  ["Tên shop", row.shop_name ?? "—"],
                  ["Loại người bán", row.seller_type ?? "—"],
                  ["Họ tên", row.full_name ?? "—"],
                  ["Điện thoại", row.phone ?? "—"],
                  ["Gửi từ", row.city ?? "—"],
                  ["Trạng thái", row.status],
                ]}
              />
            </div>
            <p className="tl-shop-hint">
              <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Số điện thoại
              chỉ hiện ở màn quản trị này, không đi vào thông báo, log hay URL.
            </p>
          </section>

          <SellerRulesReceiptPanel applicationId={row.id} />

          {row.internal_note && (
            <section aria-labelledby="a03-notes">
              <h2 className="tl-shop-h2" id="a03-notes">Ghi chú đã có</h2>
              <div className="tl-shop-internal">
                <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 6 }}>
                  <Lock size={10} aria-hidden="true" style={{ verticalAlign: -1 }} /> Nội bộ · người nộp KHÔNG đọc được
                </p>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{row.internal_note}</p>
              </div>
            </section>
          )}

          <section aria-labelledby="a03-decide">
            <h2 className="tl-shop-h2" id="a03-decide">Quyết định</h2>
            <form
              className="tl-shop-decision"
              onSubmit={(e) => { e.preventDefault(); void submit(); }}
            >
              <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
                <legend className="tl-shop-label" style={{ padding: 0 }}>Quyết định</legend>
                {(["request-changes", "approve", "reject"] as Decision[]).map((d) => (
                  <label key={d} className="tl-shop-check">
                    <input type="radio" name="decision" checked={decision === d}
                           onChange={() => setDecision(d)} style={{ width: 18, height: 18 }} />
                    {d === "request-changes" ? "Yêu cầu sửa" : d === "approve" ? "Duyệt" : "Từ chối"}
                  </label>
                ))}
              </fieldset>

              {decision && (
                <div className="tl-shop-notice tl-shop-notice--info">
                  <div><strong>Sau khi bấm:</strong> {CONSEQUENCE[decision](picked.length)}</div>
                </div>
              )}

              {decision === "request-changes" && (
                <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
                  <legend className="tl-shop-label" style={{ padding: 0 }}>Cần sửa những ô nào? (bắt buộc)</legend>
                  <p className="tl-shop-hint" style={{ marginTop: 0, marginBottom: 8 }}>
                    Mỗi ô đã tick thành một đường dẫn đưa người nộp tới đúng chỗ đó.
                  </p>
                  <div style={{ display: "grid", gap: 2 }}>
                    {REQUEST_TARGETS.map((t) => (
                      <label key={t.field} className="tl-shop-check">
                        <input
                          type="checkbox"
                          checked={picked.includes(t.field)}
                          onChange={() =>
                            setPicked((ps) => ps.includes(t.field) ? ps.filter((x) => x !== t.field) : [...ps, t.field])
                          }
                        />
                        {t.label}
                        <span className="count">bước {t.step + 1}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <label className="tl-shop-field">
                <span className="tl-shop-label">Ghi chú gửi người nộp</span>
                <div className="tl-shop-external">
                  <textarea className="tl-shop-textarea" value={applicantNote}
                            onChange={(e) => setApplicantNote(e.target.value)}
                            placeholder="Người nộp sẽ đọc nguyên văn đoạn này." />
                  <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                    <Eye size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Người nộp{" "}
                    <strong>đọc được</strong> đoạn này.
                  </p>
                </div>
              </label>

              <label className="tl-shop-field">
                <span className="tl-shop-label">Ghi chú nội bộ</span>
                <div className="tl-shop-internal">
                  <textarea className="tl-shop-textarea" value={internalNote}
                            onChange={(e) => setInternalNote(e.target.value)}
                            placeholder="Chỉ quản trị viên đọc được." />
                  <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                    <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} />{" "}
                    <strong>Không</strong> gửi cho người nộp.
                  </p>
                </div>
              </label>

              <label className="tl-shop-check" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                Tôi đã đọc lại hồ sơ và ghi chú ở trên
              </label>

              {(blocker || error) && (
                <p className="tl-shop-error" role="alert">
                  <AlertTriangle size={13} aria-hidden="true" />
                  {error ?? blocker}
                </p>
              )}

              <div className="tl-shop-decision-actions">
                <button type="submit" className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
                        disabled={!!blocker || !confirm || decide.isPending || done}>
                  {decide.isPending ? (
                    <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Đang gửi…</>
                  ) : "Gửi quyết định"}
                </button>
              </div>
            </form>
          </section>
        </AdminShopFrame>
      </div>
    </AdminLayout>
  );
}
