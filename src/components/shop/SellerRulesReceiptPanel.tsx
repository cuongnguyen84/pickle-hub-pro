// ============================================================================
// What this applicant agreed to — read-only, for the moderator.
// ----------------------------------------------------------------------------
// The question a moderator needs answered is "did they accept the version in
// force", not "have they ever accepted anything". Those differ, and the
// difference is the case worth rendering carefully: someone who signed v1 and
// never came back after v2 took effect has a signature, and it is not the one
// that counts. A green tick over it would be a lie the moderator then repeats.
//
// Nothing here can edit a receipt. There is no RPC that could, and no policy
// that would allow it — the panel is a window, not a form.
// ============================================================================

import { Check, Lock, ShieldAlert } from "lucide-react";
import { useSellerRulesReceipt } from "@/hooks/shop/useSellerRules";

const fmt = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN");
};

/** First and last six of the hash. Enough to compare two by eye; the full
 *  value is in the database for anyone who needs to check it properly. */
const shortHash = (h?: string | null) =>
  h && h.length > 16 ? `${h.slice(0, 6)}…${h.slice(-6)}` : (h ?? "—");

export function SellerRulesReceiptPanel({ applicationId }: { applicationId: string }) {
  const receipt = useSellerRulesReceipt(applicationId);

  if (receipt.isLoading) return null;

  if (receipt.isError) {
    return (
      <section aria-labelledby="a03-rules">
        <h2 className="tl-shop-h2" id="a03-rules">Chấp thuận quy chế</h2>
        <div className="tl-shop-notice tl-shop-notice--warn" role="status">
          <div>Chưa đọc được bằng chứng chấp thuận. Tải lại trang giúp em.</div>
        </div>
      </section>
    );
  }

  const view = receipt.data;

  return (
    <section aria-labelledby="a03-rules">
      <h2 className="tl-shop-h2" id="a03-rules">Chấp thuận quy chế</h2>

      {view?.accepted === true ? (
        <div className="tl-shop-card">
          <p style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6, fontWeight: 650 }}>
            <Check size={15} aria-hidden="true" /> Đã chấp thuận bản đang hiệu lực
          </p>
          <dl className="tl-shop-deflist">
            <div><dt>Văn bản</dt><dd>{view.title}</dd></div>
            <div><dt>Phiên bản</dt><dd>{view.version}</dd></div>
            <div><dt>Thời điểm</dt><dd>{fmt(view.accepted_at)}</dd></div>
            <div>
              <dt>Mã băm nội dung</dt>
              <dd><code style={{ fontSize: 12 }}>{shortHash(view.content_hash)}</code></dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="tl-shop-notice tl-shop-notice--warn" role="status">
          <div>
            <ShieldAlert size={14} aria-hidden="true" />{" "}
            {view?.reason === "stale_version" ? (
              <>
                <strong>Đã ký một bản CŨ.</strong> Người nộp chấp thuận bản{" "}
                {view.accepted_version} lúc {fmt(view.accepted_at)}, nhưng bản đang hiệu lực là{" "}
                {view.current_version}. Máy chủ sẽ từ chối hồ sơ cho tới khi họ đọc và đồng ý bản
                mới.
              </>
            ) : view?.reason === "no_effective_version" ? (
              <>
                <strong>Chưa có bản quy chế nào đang hiệu lực.</strong> Không ai gửi được hồ sơ
                cho tới khi một phiên bản được ban hành.
              </>
            ) : (
              <>
                <strong>Chưa có bằng chứng chấp thuận.</strong> Nếu hồ sơ này đã ở trạng thái đã
                gửi, hãy báo — máy chủ lẽ ra phải chặn nó.
              </>
            )}
          </div>
        </div>
      )}

      <p className="tl-shop-hint">
        <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Bằng chứng chấp thuận
        chỉ được ghi thêm — không ai sửa hay xoá được, kể cả từ màn hình này.
      </p>
    </section>
  );
}
