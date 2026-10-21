// ============================================================================
// /admin/shop/contacts — approving where a buyer gets sent.
// ----------------------------------------------------------------------------
// Approving a contact channel is approving a destination. The screen shows the
// NORMALISED value — the server-derived string that will actually become the
// link — next to what the seller typed, because those two differing is the
// interesting case, and the link a buyer follows is built from the former.
//
// The screen never decides a URL is safe. shop_contact_decide re-runs the
// seller's own normaliser over the stored bytes at decision time and refuses
// anything that does not survive it, so a row edited around the RPC cannot be
// approved by a moderator who saw a tidy-looking string in a table.
// ============================================================================

import { useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Eye, Loader2, Lock } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminShopFrame, DefList } from "@/components/shop/ShopShell";
import { ErrorState, LoadingState } from "@/components/states/PageStates";
import { useUrlBackedState } from "@/hooks/useUrlBackedState";
import {
  useContactQueue,
  useDecideContact,
  type ContactQueueRow,
  type ContactState,
} from "@/hooks/shop/useProductModeration";
import { moderationErrorMessage } from "@/lib/shop/moderationDecision";
import "@/styles/shop.css";

const STATES: { key: ContactState; label: string }[] = [
  { key: "pending_review", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Từ chối" },
  { key: "disabled", label: "Đã tắt" },
  { key: "draft", label: "Nháp" },
];
const STATE_KEYS = STATES.map((s) => s.key);

const TYPE_LABEL: Record<string, string> = {
  phone: "Điện thoại",
  zalo: "Zalo",
  messenger: "Messenger",
};

type ContactDecision = "approve" | "reject" | "disable";

const CONSEQUENCE: Record<ContactDecision, string> = {
  approve:
    "Kênh này hiện trên trang shop và trang sản phẩm — nhưng chỉ khi người bán đã bật công khai " +
    "và shop đang hoạt động. Người mua bấm vào sẽ rời ThePickleHub.",
  reject:
    "Kênh không hiện ở đâu cả. Người bán đọc được lý do và có thể sửa rồi gửi lại.",
  disable:
    "Kênh bị tắt và biến mất khỏi mọi trang công khai ngay. Người bán đọc được lý do.",
};

function Row({ row, onDone }: { row: ContactQueueRow; onDone: () => void }) {
  const decideContact = useDecideContact();
  const [decision, setDecision] = useState<ContactDecision | null>(null);
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string>(crypto.randomUUID());

  const needsReason = decision === "reject" || decision === "disable";
  const blocker = !decision
    ? "Chọn một quyết định."
    : needsReason && note.trim() === ""
      ? "Cần lý do gửi người bán."
      : null;

  const submit = async () => {
    if (blocker) return;
    setError(null);
    try {
      await decideContact.mutateAsync({
        channelId: row.id,
        decision: decision!,
        expectedVersion: row.version,
        note,
        internalNote,
        clientToken: tokenRef.current,
      });
      tokenRef.current = crypto.randomUUID();
      setDecision(null);
      setNote("");
      setInternalNote("");
      onDone();
    } catch (e) {
      setError(moderationErrorMessage(e));
    }
  };

  return (
    <li className="tl-shop-card" style={{ marginBottom: 14 }}>
      <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 6 }}>
        {row.shop.name} · {TYPE_LABEL[row.type] ?? row.type}
        {!row.is_public && " · người bán CHƯA bật công khai"}
      </p>

      <DefList
        rows={[
          ["Điểm đến thật", row.value_normalized],
          ["Nhãn người bán đặt", row.display_label ?? "—"],
          ["Cập nhật", new Date(row.updated_at).toLocaleString("vi-VN")],
        ]}
      />
      <p className="tl-shop-hint">
        <ExternalLink size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Người mua bấm
        vào sẽ rời ThePickleHub và tới đúng địa chỉ ở dòng đầu.
      </p>

      <form
        className="tl-shop-decision"
        style={{ marginTop: 12 }}
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
          <legend className="tl-shop-label" style={{ padding: 0 }}>Quyết định</legend>
          {(["approve", "reject", "disable"] as ContactDecision[]).map((d) => (
            <label key={d} className="tl-shop-check">
              <input
                type="radio"
                name={`contact-${row.id}`}
                checked={decision === d}
                onChange={() => setDecision(d)}
                style={{ width: 18, height: 18 }}
              />
              {d === "approve" ? "Duyệt" : d === "reject" ? "Từ chối" : "Tắt kênh"}
            </label>
          ))}
        </fieldset>

        {decision && (
          <div className="tl-shop-notice tl-shop-notice--info">
            <div><strong>Sau khi bấm:</strong> {CONSEQUENCE[decision]}</div>
          </div>
        )}

        {needsReason && (
          <label className="tl-shop-field">
            <span className="tl-shop-label">Lý do gửi người bán</span>
            <div className="tl-shop-external">
              <textarea
                className="tl-shop-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Người bán đọc nguyên văn đoạn này."
              />
              <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                <Eye size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Người bán đọc được.
              </p>
            </div>
          </label>
        )}

        <label className="tl-shop-field">
          <span className="tl-shop-label">Ghi chú nội bộ</span>
          <div className="tl-shop-internal">
            <textarea
              className="tl-shop-textarea"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Chỉ quản trị viên đọc được."
            />
            <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
              <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Không gửi cho người bán.
            </p>
          </div>
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
            disabled={!!blocker || decideContact.isPending}
          >
            {decideContact.isPending ? (
              <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Đang gửi…</>
            ) : "Gửi quyết định"}
          </button>
        </div>
      </form>
    </li>
  );
}

export default function AdminShopContacts() {
  const [state, setState] = useUrlBackedState<ContactState>({
    param: "state",
    parse: (raw) => (STATE_KEYS.includes(raw as ContactState) ? (raw as ContactState) : null),
    fallback: "pending_review",
  });
  const queue = useContactQueue(state);
  const rows = queue.data ?? [];

  return (
    <AdminLayout>
      <DynamicMeta title="Duyệt kênh liên hệ" noindex />
      <div className="tl-shop">
        <h1 className="tl-shop-h1">Kênh liên hệ của shop</h1>
        <p className="tl-shop-sub">
          Duyệt một kênh là duyệt một nơi người mua sẽ được đưa tới.
        </p>

        <AdminShopFrame crumb="Kênh liên hệ">
          <div className="tl-shop-cats" role="group" aria-label="Lọc theo trạng thái">
            {STATES.map((s) => (
              <button
                key={s.key}
                type="button"
                className="tl-shop-cat"
                aria-current={state === s.key ? "page" : undefined}
                onClick={() => setState(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            {queue.isLoading ? (
              <LoadingState />
            ) : queue.isError ? (
              <ErrorState onRetry={() => void queue.refetch()} />
            ) : rows.length === 0 ? (
              <div className="tl-shop-empty">
                <p className="tl-shop-empty-title">Không có kênh nào ở trạng thái này</p>
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {rows.map((r) => (
                  <Row key={r.id} row={r} onDone={() => void queue.refetch()} />
                ))}
              </ul>
            )}
          </div>

          <p className="tl-shop-hint">
            Màn này không tự kết luận một liên kết là an toàn. Máy chủ chuẩn hoá lại đúng giá trị
            đang nằm trong CSDL vào lúc duyệt và từ chối bất cứ thứ gì không qua được — nên một
            dòng bị sửa vòng qua RPC không thể được duyệt chỉ vì trông gọn gàng ở đây.
          </p>
        </AdminShopFrame>
      </div>
    </AdminLayout>
  );
}
