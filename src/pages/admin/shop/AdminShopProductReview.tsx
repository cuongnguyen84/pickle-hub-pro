// ============================================================================
// /admin/shop/products/:id — prototype A04's review screen, in production.
// ----------------------------------------------------------------------------
// The buyer preview is the FIRST thing on the page, not a link somebody has to
// remember to click. Plenty of bad listings look fine as a table of fields and
// give themselves away the moment you look at the product page — which is the
// only artefact a buyer will ever see.
//
// It is also the canonical projection, the same SQL the public PDP will read,
// so a moderator cannot approve one thing and publish another.
//
// Every decision states what happens after the click before the click. The
// three things that differ between decisions — does it stay visible, do the
// photos get revoked, what can the seller do next — are exactly what a
// moderator needs, and they are different enough per decision that one generic
// sentence would be a lie in four of the six cases.
// ============================================================================

import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Eye, Loader2, Lock } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminShopFrame, DefList } from "@/components/shop/ShopShell";
import { ErrorState, LoadingState } from "@/components/states/PageStates";
import {
  useDecideProduct,
  useModerationDetail,
} from "@/hooks/shop/useProductModeration";
import {
  DECISION_CONSEQUENCE,
  DECISION_LABEL,
  NEEDS_APPLICANT_NOTE,
  NEEDS_TARGETS,
  SECTION_TARGETS,
  decisionBlocker,
  emptyDraft,
  isTargetPicked,
  moderationErrorMessage,
  targetsPayload,
  toggleTarget,
  type Decision,
  type DecisionDraft,
} from "@/lib/shop/moderationDecision";
import { SECTION_LABEL, problemMessage, type SubmitProblem } from "@/lib/shop/submitProblems";
import "@/styles/shop.css";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  pending_review: "Chờ duyệt",
  needs_changes: "Cần sửa",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  suspended: "Đã gỡ",
  archived: "Đã lưu trữ",
};

export default function AdminShopProductReview() {
  const { id } = useParams<{ id: string }>();
  const detail = useModerationDetail(id ?? null);
  const decide = useDecideProduct();

  const [draft, setDraft] = useState<DecisionDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Stable per ATTEMPT: a retry of the same click must reuse the token so the
  // server replays instead of writing a second decision.
  const tokenRef = useRef<string>(crypto.randomUUID());

  const row = detail.data;
  // Memoised separately: a fresh [] on every render would re-run the blocker
  // check each time and defeat the memo below.
  const allowed = useMemo(() => row?.allowed_decisions ?? [], [row?.allowed_decisions]);
  const blocker = useMemo(() => decisionBlocker(draft, allowed), [draft, allowed]);

  const set = <K extends keyof DecisionDraft>(k: K, v: DecisionDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    if (!row || blocker) return;
    setError(null);
    try {
      const res = await decide.mutateAsync({
        productId: row.id,
        decision: draft.decision!,
        expectedVersion: row.version,
        applicantNote: draft.applicantNote,
        internalNote: draft.internalNote,
        targets: targetsPayload(draft),
        clientToken: tokenRef.current,
      });
      if (!res.ok) {
        // Approve refused by the server preflight. Not an error — the list is
        // the answer, and the moderator now decides whether to request
        // changes instead.
        setError(
          "Chưa duyệt được: " +
            (res.problems ?? [])
              .map((p) => problemMessage(p as SubmitProblem))
              .join(" · "),
        );
        return;
      }
      setDone(res.status ?? null);
      // A new token for the next decision on this product; reusing the old one
      // would replay the decision that just succeeded.
      tokenRef.current = crypto.randomUUID();
      setDraft(emptyDraft());
    } catch (e) {
      setError(moderationErrorMessage(e));
    }
  };

  if (detail.isLoading) {
    return (
      <AdminLayout>
        <DynamicMeta title="Duyệt sản phẩm" noindex />
        <div className="tl-shop"><LoadingState /></div>
      </AdminLayout>
    );
  }
  if (detail.isError || !row) {
    return (
      <AdminLayout>
        <DynamicMeta title="Duyệt sản phẩm" noindex />
        <div className="tl-shop"><ErrorState onRetry={() => void detail.refetch()} /></div>
      </AdminLayout>
    );
  }

  const preview = row.buyer_preview as {
    title?: string; description?: string; slug?: string;
    variants?: { sku?: string | null; price_vnd?: number; availability?: string; option_values?: Record<string, string> | null }[];
    media?: unknown[];
  };
  const variants = preview.variants ?? [];

  return (
    <AdminLayout>
      <DynamicMeta title={`Duyệt: ${row.status}`} noindex />
      <div className="tl-shop">
        <h1 className="tl-shop-h1">{preview.title ?? "Sản phẩm"}</h1>
        <p className="tl-shop-sub">
          {/* A bare inline link is 17px tall. This is the only way back from a
              review, and a moderator hits it on a phone. */}
          <Link
            to="/admin/shop/products"
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 }}
          >
            ← Về hàng đợi
          </Link>
        </p>

        <AdminShopFrame crumb="Duyệt sản phẩm">
          {done && (
            <div className="tl-shop-notice tl-shop-notice--info" role="status">
              <div>
                <strong>Đã ghi nhận quyết định.</strong> Trạng thái mới:{" "}
                {STATUS_LABEL[done] ?? done}. Thao tác đã vào nhật ký quản trị.
              </div>
            </div>
          )}

          {/* ── What a buyer would see. First, on purpose. ── */}
          <section aria-labelledby="a04-preview">
            <h2 className="tl-shop-h2" id="a04-preview" style={{ marginTop: 0 }}>
              Người mua sẽ thấy gì
            </h2>
            <div className="tl-shop-card">
              <DefList
                rows={[
                  ["Tên", preview.title ?? "—"],
                  ["Đường dẫn", preview.slug ?? "—"],
                  ["Mô tả", preview.description ?? "—"],
                  ["Số ảnh", String((preview.media ?? []).length)],
                  ["Số phiên bản", String(variants.length)],
                ]}
              />
            </div>
            <p className="tl-shop-hint">
              Đây là kết quả của đúng phép chiếu mà trang sản phẩm công khai sẽ đọc — không
              phải bản dựng lại từ form, nên không thể duyệt một đằng đăng một nẻo.
            </p>
          </section>

          {/* ── The three ideas, kept apart. ── */}
          <section aria-labelledby="a04-state">
            <h2 className="tl-shop-h2" id="a04-state">Tình trạng</h2>
            <div className="tl-shop-card">
              <DefList
                rows={[
                  ["Trạng thái duyệt", STATUS_LABEL[row.status] ?? row.status],
                  ["Ảnh đã lên kho công khai", row.moderation_state.media_published ? "Rồi" : "Chưa"],
                  ["Đang hiển thị với người mua", row.moderation_state.publicly_visible ? "Có" : "Không"],
                  ["Bản (dùng để chống ghi đè)", String(row.version)],
                ]}
              />
            </div>
            <p className="tl-shop-hint">
              &ldquo;Đã duyệt&rdquo; và &ldquo;đang hiển thị&rdquo; là hai việc khác nhau: sau khi duyệt,
              ảnh còn phải được tải lên kho công khai thì người mua mới thấy.
            </p>
          </section>

          <section aria-labelledby="a04-shop">
            <h2 className="tl-shop-h2" id="a04-shop">Shop</h2>
            <div className="tl-shop-card">
              <DefList
                rows={[
                  ["Tên shop", row.shop.name],
                  ["Trạng thái shop", row.shop.state],
                  ["Khu vực", row.shop.region ?? "—"],
                  ["Đã xác minh", row.shop.verified ? "Rồi" : "Chưa"],
                  ["Ngành hàng", row.category ? `${row.category.name}${row.category.is_active ? "" : " (đã tắt)"}` : "—"],
                ]}
              />
            </div>
          </section>

          {variants.length > 0 && (
            <section aria-labelledby="a04-variants">
              <h2 className="tl-shop-h2" id="a04-variants">Phiên bản</h2>
              <div className="tl-shop-tablewrap" tabIndex={0}>
                <table className="tl-shop-table">
                  <caption className="tl-shop-sr">Phiên bản, giá và tình trạng hàng</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tuỳ chọn</th>
                      <th scope="col">Mã hàng</th>
                      <th scope="col">Giá</th>
                      <th scope="col">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={v.sku ?? i}>
                        <th scope="row">
                          {v.option_values
                            ? Object.entries(v.option_values).map(([k, val]) => `${k}: ${val}`).join(" · ")
                            : "Mặc định"}
                        </th>
                        <td>{v.sku ?? "—"}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>
                          {typeof v.price_vnd === "number" ? v.price_vnd.toLocaleString("vi-VN") + "₫" : "—"}
                        </td>
                        <td>{v.availability ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="tl-shop-hint">
                Cột tình trạng là nhãn máy chủ suy ra. Số tồn kho thật không đi vào phép chiếu
                này, kể cả ở màn quản trị.
              </p>
            </section>
          )}

          {row.preflight.length > 0 && (
            <section aria-labelledby="a04-preflight">
              <h2 className="tl-shop-h2" id="a04-preflight">Máy chủ đang chặn duyệt</h2>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7 }}>
                {row.preflight.map((p, i) => (
                  <li key={`${p.code}-${i}`}>
                    <strong>{SECTION_LABEL[p.section as keyof typeof SECTION_LABEL] ?? p.section}</strong>{" "}
                    — {problemMessage(p as SubmitProblem)}
                  </li>
                ))}
              </ul>
              <p className="tl-shop-hint">
                Bấm &ldquo;Duyệt&rdquo; lúc này sẽ bị máy chủ từ chối và trả về đúng danh sách trên.
              </p>
            </section>
          )}

          {row.history.length > 0 && (
            <section aria-labelledby="a04-history">
              <h2 className="tl-shop-h2" id="a04-history">Đã trao đổi những gì</h2>
              <ol className="tl-shop-timeline">
                {row.history.map((h) => (
                  <li key={h.id}>
                    <span className="tl-shop-eyebrow">
                      {new Date(h.created_at).toLocaleString("vi-VN")} · {DECISION_LABEL[h.decision as Decision] ?? h.decision}
                    </span>
                    {h.applicant_note && (
                      <div className="tl-shop-external" style={{ marginTop: 6 }}>
                        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{h.applicant_note}</p>
                        <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                          <Eye size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Người bán đọc được
                        </p>
                      </div>
                    )}
                    {h.internal_note && (
                      <div className="tl-shop-internal" style={{ marginTop: 6 }}>
                        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{h.internal_note}</p>
                        <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                          <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Nội bộ
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* ── Decision rail ── */}
          <section aria-labelledby="a04-decide">
            <h2 className="tl-shop-h2" id="a04-decide">Quyết định</h2>

            {allowed.length === 0 ? (
              <div className="tl-shop-notice tl-shop-notice--info">
                <div>
                  Sản phẩm đang ở trạng thái <strong>{STATUS_LABEL[row.status] ?? row.status}</strong>{" "}
                  — không còn việc gì để quyết ở đây.
                </div>
              </div>
            ) : (
              <form className="tl-shop-decision" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
                  <legend className="tl-shop-label" style={{ padding: 0 }}>Chọn một</legend>
                  {allowed.map((d) => (
                    <label key={d} className="tl-shop-check">
                      <input
                        type="radio"
                        name="decision"
                        checked={draft.decision === d}
                        onChange={() => set("decision", d)}
                        style={{ width: 18, height: 18 }}
                      />
                      {DECISION_LABEL[d]}
                    </label>
                  ))}
                </fieldset>

                {draft.decision && (
                  <div className="tl-shop-notice tl-shop-notice--info">
                    <div><strong>Sau khi bấm:</strong> {DECISION_CONSEQUENCE[draft.decision]}</div>
                  </div>
                )}

                {draft.decision && NEEDS_TARGETS.includes(draft.decision) && (
                  <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
                    <legend className="tl-shop-label" style={{ padding: 0 }}>
                      Cần sửa ở đâu? (bắt buộc)
                    </legend>
                    <p className="tl-shop-hint" style={{ marginTop: 0, marginBottom: 8 }}>
                      Mỗi mục đã chọn thành một đường dẫn đưa người bán tới đúng phần đó trong
                      trình sửa. Chọn theo TÊN phần, không theo thứ tự — người bán kéo thả lại
                      ảnh là số thứ tự trỏ sang ảnh khác.
                    </p>
                    <div style={{ display: "grid", gap: 2 }}>
                      {SECTION_TARGETS.map((t) => (
                        <label key={t.section} className="tl-shop-check">
                          <input
                            type="checkbox"
                            checked={isTargetPicked(draft.targets, t)}
                            onChange={() => set("targets", toggleTarget(draft.targets, t))}
                          />
                          {SECTION_LABEL[t.section]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                {draft.decision && NEEDS_APPLICANT_NOTE.includes(draft.decision) && (
                  <label className="tl-shop-field">
                    <span className="tl-shop-label">Lời nhắn cho người bán</span>
                    <div className="tl-shop-external">
                      <textarea
                        className="tl-shop-textarea"
                        value={draft.applicantNote}
                        onChange={(e) => set("applicantNote", e.target.value)}
                        placeholder="Người bán đọc nguyên văn đoạn này."
                      />
                      <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                        <Eye size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Người bán{" "}
                        <strong>đọc được</strong> đoạn này.
                      </p>
                    </div>
                  </label>
                )}

                <label className="tl-shop-field">
                  <span className="tl-shop-label">Ghi chú nội bộ</span>
                  <div className="tl-shop-internal">
                    <textarea
                      className="tl-shop-textarea"
                      value={draft.internalNote}
                      onChange={(e) => set("internalNote", e.target.value)}
                      placeholder="Chỉ quản trị viên đọc được."
                    />
                    <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                      <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} />{" "}
                      <strong>Không</strong> gửi cho người bán, không vào thông báo, không vào nhật ký.
                    </p>
                  </div>
                </label>

                <label className="tl-shop-check" style={{ marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={draft.confirmed}
                    onChange={(e) => set("confirmed", e.target.checked)}
                  />
                  Tôi đã xem lại bản người mua sẽ thấy
                </label>

                {(blocker || error) && (
                  <p className="tl-shop-error" role="alert">
                    <AlertTriangle size={13} aria-hidden="true" />
                    {error ?? blocker}
                  </p>
                )}

                <div className="tl-shop-decision-actions">
                  <button
                    type="submit"
                    className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
                    disabled={!!blocker || decide.isPending}
                  >
                    {decide.isPending ? (
                      <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Đang gửi…</>
                    ) : "Gửi quyết định"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </AdminShopFrame>
      </div>
    </AdminLayout>
  );
}
