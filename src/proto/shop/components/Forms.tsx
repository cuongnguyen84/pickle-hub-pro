// ============================================================================
// F07 — Seller / admin form primitives
// ----------------------------------------------------------------------------
// Two rules that show up in every component here:
//   • Nothing claims to be saved unless it says WHEN it was saved.
//   • Anything an admin writes is explicitly labelled internal or
//     applicant-visible, in the component itself — not left to the page to
//     remember. Getting that wrong leaks a moderator's private note to a user.
// ============================================================================

import { useState, type ReactNode } from "react";
import {
  Check,
  AlertTriangle,
  Loader2,
  FileText,
  Upload,
  RotateCw,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import type { ProductStatus, ProtoProduct } from "../fixtures";
import { vnd } from "../fixtures";
import { ProductMedia } from "./Primitives";

// ─── Stepper ────────────────────────────────────────────────────────────────

export interface StepDef {
  key: string;
  label: string;
}

export const SellerApplicationStepper = ({
  steps,
  current,
  completed,
  errored = [],
  onJump,
}: {
  steps: StepDef[];
  current: number;
  completed: number;
  errored?: number[];
  onJump?: (i: number) => void;
}) => (
  <nav className="tl-shop-stepper" aria-label="Các bước hồ sơ đăng ký">
    {steps.map((s, i) => {
      const done = i < completed;
      const isErr = errored.includes(i);
      return (
        <button
          key={s.key}
          type="button"
          className={`tl-shop-step ${done ? "is-done" : ""} ${isErr ? "is-error" : ""}`}
          aria-current={i === current ? "step" : undefined}
          onClick={() => onJump?.(i)}
        >
          <span className="tl-shop-step-n" aria-hidden="true">
            {isErr ? "!" : done ? <Check size={12} /> : i + 1}
          </span>
          <span>
            {s.label}
            <span className="tl-shop-sr">
              {isErr ? " — có lỗi cần sửa" : done ? " — đã xong" : " — chưa xong"}
            </span>
          </span>
        </button>
      );
    })}
  </nav>
);

// ─── Autosave indicator ─────────────────────────────────────────────────────

export type AutosaveState = "idle" | "saving" | "saved" | "error";

export const AutosaveIndicator = ({
  state,
  savedAt,
  onRetry,
}: {
  state: AutosaveState;
  savedAt?: string;
  onRetry?: () => void;
}) => (
  <div
    className={`tl-shop-autosave ${state === "error" ? "is-error" : state === "saved" ? "is-saved" : ""}`}
    role="status"
    aria-live="polite"
  >
    {state === "saving" && (
      <>
        <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Đang lưu…
      </>
    )}
    {state === "saved" && (
      <>
        <Check size={13} aria-hidden="true" /> Đã lưu nháp lúc {savedAt}
      </>
    )}
    {state === "error" && (
      <>
        <AlertTriangle size={13} aria-hidden="true" /> Chưa lưu được — bản nháp vẫn nằm trên
        máy anh/chị.
        {onRetry && (
          <button type="button" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </>
    )}
    {state === "idle" && <>Chưa có thay đổi nào cần lưu</>}
  </div>
);

// ─── Document uploader ──────────────────────────────────────────────────────

export type UploadState = "missing" | "uploading" | "uploaded" | "rejected";

export const DocumentUploader = ({
  label,
  purpose,
  state,
  progress = 0,
  rejectReason,
  onAction,
}: {
  label: string;
  /** Why this file is being asked for. Never omit — an unexplained ID upload
   *  is the single most common reason a Vietnamese seller abandons the form. */
  purpose: string;
  state: UploadState;
  progress?: number;
  rejectReason?: string;
  onAction?: () => void;
}) => (
  <div
    className={`tl-shop-upload ${state === "rejected" ? "is-rejected" : ""} ${state === "uploaded" ? "is-uploaded" : ""}`}
  >
    <div className="tl-shop-upload-thumb" aria-hidden="true">
      {state === "uploaded" ? <FileText size={22} /> : <Upload size={22} />}
    </div>
    <div className="tl-shop-upload-body">
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--tl-fg)" }}>{label}</div>
      <p className="tl-shop-hint" style={{ marginTop: 3 }}>
        {purpose}
      </p>
      {state === "uploading" && (
        <div
          className="tl-shop-progress"
          role="progressbar"
          aria-label={`Tiến độ tải ${label}`}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${progress}%` }} />
        </div>
      )}
      {state === "rejected" && (
        <p className="tl-shop-error" style={{ marginTop: 6 }}>
          <AlertTriangle size={13} aria-hidden="true" />
          {rejectReason}
        </p>
      )}
    </div>
    <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={onAction}>
      {state === "missing" ? "Chọn ảnh" : state === "rejected" ? "Chụp lại" : "Đổi ảnh"}
    </button>
  </div>
);

// ─── Listing status badge ───────────────────────────────────────────────────

const STATUS_META: Record<ProductStatus, { label: string; cls: string; hint: string }> = {
  draft: { label: "Nháp", cls: "tl-shop-pill--muted", hint: "Chỉ mình anh/chị thấy" },
  pending_review: { label: "Chờ duyệt", cls: "tl-shop-pill--warn", hint: "Đang chờ quản trị viên xem" },
  active: { label: "Đang bán", cls: "tl-shop-pill--ok", hint: "Người mua thấy sản phẩm này" },
  needs_changes: { label: "Cần sửa", cls: "tl-shop-pill--danger", hint: "Có yêu cầu chỉnh sửa" },
  restricted: { label: "Bị hạn chế", cls: "tl-shop-pill--danger", hint: "Đã ẩn khỏi trang mua hàng" },
  archived: { label: "Ngừng bán", cls: "tl-shop-pill--muted", hint: "Anh/chị đã cất đi" },
};

export const ListingStatusBadge = ({ status, withHint }: { status: ProductStatus; withHint?: boolean }) => {
  const m = STATUS_META[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span className={`tl-shop-pill ${m.cls}`}>{m.label}</span>
      {withHint && <span className="tl-shop-hint" style={{ marginTop: 0 }}>{m.hint}</span>}
    </span>
  );
};

export const listingStatusLabel = (s: ProductStatus) => STATUS_META[s].label;

// ─── Variant matrix (desktop table + mobile cards) ──────────────────────────

export const VariantMatrix = ({
  product,
  onBulk,
}: {
  product: ProtoProduct;
  onBulk?: () => void;
}) => (
  <div>
    {onBulk && (
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={onBulk}>
          Đặt giá hàng loạt
        </button>
        <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={onBulk}>
          Đặt tồn kho hàng loạt
        </button>
      </div>
    )}

    {/* Desktop */}
    <div className="tl-shop-tablewrap" tabIndex={0} data-desktop-only>
      <table className="tl-shop-table">
        <caption className="tl-shop-sr">Bảng phiên bản: giá, mã hàng và tồn kho</caption>
        <thead>
          <tr>
            {product.optionNames.map((n) => (
              <th key={n} scope="col">
                {n}
              </th>
            ))}
            <th scope="col">Mã hàng (SKU)</th>
            <th scope="col">Giá</th>
            <th scope="col">Tồn kho</th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((v) => (
            <tr key={v.id}>
              {v.values.map((val, i) => (
                <td key={i}>{val}</td>
              ))}
              <td>
                <input className="tl-shop-input" defaultValue={v.sku} aria-label={`Mã hàng ${v.values.join(" ")}`} />
              </td>
              <td>
                <input
                  className="tl-shop-input"
                  inputMode="numeric"
                  defaultValue={v.priceVnd}
                  aria-label={`Giá ${v.values.join(" ")}`}
                />
              </td>
              <td>
                <input
                  className="tl-shop-input"
                  inputMode="numeric"
                  defaultValue={v.stock ?? ""}
                  placeholder="không theo dõi"
                  aria-label={`Tồn kho ${v.values.join(" ")}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Mobile — a table this wide is unusable at 375px, so each variant is a card. */}
    <div className="tl-shop-varcards" data-mobile-only>
      {product.variants.map((v) => (
        <div key={v.id} className="tl-shop-varcard">
          <div style={{ fontWeight: 650, fontSize: 13.5, marginBottom: 10 }}>
            {v.values.length ? v.values.join(" · ") : "Phiên bản duy nhất"}
          </div>
          <label className="tl-shop-field" style={{ marginBottom: 10 }}>
            <span className="tl-shop-label">Mã hàng (SKU)</span>
            <input className="tl-shop-input" defaultValue={v.sku} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              <span className="tl-shop-label">Giá</span>
              <input className="tl-shop-input" inputMode="numeric" defaultValue={v.priceVnd} />
            </label>
            <label>
              <span className="tl-shop-label">Tồn kho</span>
              <input
                className="tl-shop-input"
                inputMode="numeric"
                defaultValue={v.stock ?? ""}
                placeholder="không theo dõi"
              />
            </label>
          </div>
          <p className="tl-shop-hint">Đang bán: {vnd(v.priceVnd)}</p>
        </div>
      ))}
    </div>
  </div>
);

// ─── Evidence viewer ────────────────────────────────────────────────────────

export const EvidenceViewer = ({
  items,
  sensitive,
}: {
  items: { label: string; tone?: string }[];
  /** Sensitive evidence (ID documents) stays blurred until explicitly revealed. */
  sensitive?: boolean;
}) => {
  const [shown, setShown] = useState(!sensitive);
  return (
    <div>
      {sensitive && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setShown((s) => !s)}>
            {shown ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            {shown ? "Ẩn giấy tờ" : "Hiện giấy tờ"}
          </button>
          <span className="tl-shop-hint" style={{ marginTop: 0 }}>
            Mở giấy tờ được ghi vào nhật ký. Không chụp màn hình, không tải về máy.
          </span>
        </div>
      )}
      <div className="tl-shop-evidence">
        {items.map((it) => (
          <div key={it.label} className="tl-shop-evidence-item">
            <div style={{ filter: shown ? "none" : "blur(10px)" }}>
              <ProductMedia tone={it.tone ?? "b"} label={shown ? it.label : "••••"} />
            </div>
            <div className="tl-shop-evidence-cap">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Moderation decision form ───────────────────────────────────────────────

export type Decision = "request-changes" | "approve" | "reject";

export const ModerationDecisionForm = ({
  onSubmit,
  busy,
  error,
}: {
  onSubmit?: (d: Decision) => void;
  busy?: Decision | null;
  error?: string;
}) => {
  const [decision, setDecision] = useState<Decision | "">("");
  const [applicantNote, setApplicantNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [confirm, setConfirm] = useState(false);

  const needsNote = decision === "request-changes" || decision === "reject";
  const noteMissing = needsNote && applicantNote.trim().length < 10;

  const consequence: Record<Decision, string> = {
    "request-changes":
      "Người nộp nhận thông báo kèm đúng phần ghi chú bên dưới. Hồ sơ quay lại trạng thái “Cần sửa”, họ nộp lại được.",
    approve:
      "Shop được tạo ở trạng thái chờ kích hoạt. Người bán chưa đăng bán được cho tới khi họ đăng nhập và đồng ý quy chế.",
    reject:
      "Hồ sơ đóng lại. Người nộp nhận đúng phần ghi chú bên dưới và vẫn nộp hồ sơ mới được.",
  };

  return (
    <form
      className="tl-shop-decision"
      onSubmit={(e) => {
        e.preventDefault();
        if (decision && !noteMissing && confirm) onSubmit?.(decision);
      }}
    >
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
        <legend className="tl-shop-label" style={{ padding: 0 }}>
          Quyết định
        </legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(["request-changes", "approve", "reject"] as Decision[]).map((d) => (
            <label key={d} className="tl-shop-check">
              <input
                type="radio"
                name="decision"
                value={d}
                checked={decision === d}
                onChange={() => setDecision(d)}
                style={{ width: 18, height: 18 }}
              />
              {d === "request-changes" ? "Yêu cầu sửa" : d === "approve" ? "Duyệt" : "Từ chối"}
            </label>
          ))}
        </div>
      </fieldset>

      {decision && (
        <div className="tl-shop-notice tl-shop-notice--info">
          <div>
            <strong>Sau khi bấm:</strong> {consequence[decision]}
          </div>
        </div>
      )}

      <label className="tl-shop-field">
        <span className="tl-shop-label">Ghi chú gửi người nộp {needsNote && "(bắt buộc)"}</span>
        <div className="tl-shop-external">
          <textarea
            className="tl-shop-textarea"
            value={applicantNote}
            onChange={(e) => setApplicantNote(e.target.value)}
            aria-invalid={noteMissing || undefined}
            placeholder="Người nộp sẽ đọc nguyên văn đoạn này."
          />
          <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
            <Eye size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> Người nộp{" "}
            <strong>đọc được</strong> đoạn này.
          </p>
        </div>
        {noteMissing && (
          <p className="tl-shop-error">
            <AlertTriangle size={13} aria-hidden="true" />
            Viết rõ cần sửa gì — người nộp chỉ nhận đúng đoạn này, không có gì khác.
          </p>
        )}
      </label>

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
            <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> <strong>Không</strong>{" "}
            gửi cho người nộp. Lưu vào nhật ký quản trị.
          </p>
        </div>
      </label>

      <label className="tl-shop-check" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
        Tôi đã đọc lại hồ sơ và ghi chú ở trên
      </label>

      {error && (
        <div className="tl-shop-notice tl-shop-notice--danger">
          <div>{error}</div>
        </div>
      )}

      <button
        type="submit"
        className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
        disabled={!decision || noteMissing || !confirm || !!busy}
      >
        {busy ? (
          <>
            <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Đang gửi…
          </>
        ) : (
          "Gửi quyết định"
        )}
      </button>
    </form>
  );
};

export const Retry = ({ onClick, children }: { onClick?: () => void; children: ReactNode }) => (
  <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={onClick}>
    <RotateCw size={14} aria-hidden="true" />
    {children}
  </button>
);
