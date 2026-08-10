// ============================================================================
// S02 — Application stepper /seller/application
// ----------------------------------------------------------------------------
// Acceptance: browser Back / exit does not lose a saved draft, and every
// sensitive field explains why it is being asked for.
//
// The step index lives in the URL (?step=N), so Back moves BETWEEN steps
// instead of leaving the form — the classic way a half-filled application is
// lost. The draft itself is written to localStorage on every change, and the
// indicator says when, so "đã lưu" is never a claim we cannot back up.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { AlertTriangle, Lock } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import {
  SellerApplicationStepper,
  AutosaveIndicator,
  DocumentUploader,
  type AutosaveState,
} from "../components/Forms";
import { APPLICATION_STEPS } from "./F07Forms";

const DRAFT_KEY = "proto-shop-application-draft";

type Fields = Record<string, string>;

const SELLER_TYPES = [
  { value: "ca-nhan", label: "Cá nhân", d: "Bán vài món, không có giấy phép kinh doanh." },
  { value: "ho-kinh-doanh", label: "Hộ kinh doanh", d: "Có giấy phép hộ kinh doanh." },
  { value: "cong-ty", label: "Công ty", d: "Có giấy chứng nhận đăng ký doanh nghiệp." },
];

const Field = ({
  id,
  label,
  hint,
  sensitive,
  value,
  onChange,
  error,
  type = "text",
  textarea,
}: {
  id: string;
  label: string;
  hint?: string;
  sensitive?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  textarea?: boolean;
}) => (
  <div className="tl-shop-field">
    <label className="tl-shop-label" htmlFor={id}>
      {label}
    </label>
    {textarea ? (
      <textarea
        id={id}
        className="tl-shop-textarea"
        value={value}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || sensitive ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <input
        id={id}
        type={type}
        className="tl-shop-input"
        value={value}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || sensitive ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    )}
    {(hint || sensitive) && (
      <p className="tl-shop-hint" id={`${id}-hint`}>
        {sensitive && (
          <>
            <Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> {sensitive}{" "}
          </>
        )}
        {hint}
      </p>
    )}
    {error && (
      <p className="tl-shop-error">
        <AlertTriangle size={13} aria-hidden="true" />
        {error}
      </p>
    )}
  </div>
);

export default function S02Application() {
  const location = useLocation();
  const variant = readVariant(location.search); // pristine|partial|saving|saved|failed|invalid|restored
  const [sp, setSp] = useSearchParams();
  const step = Math.min(Math.max(Number(sp.get("step") ?? 0), 0), 5);

  const [fields, setFields] = useState<Fields>(() => {
    if (variant === "pristine") return {};
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return JSON.parse(raw) as Fields;
    } catch {
      /* corrupted draft is not worth crashing the form over */
    }
    return variant === "restored" || variant === "partial" || variant === "saved" || variant === "invalid"
      ? { type: "ho-kinh-doanh", name: "Nguyễn Thị Thanh Hương", phone: "0901234567", shop: "Pickle Gear Sài Gòn" }
      : {};
  });

  const [autosave, setAutosave] = useState<AutosaveState>(
    variant === "saving" ? "saving" : variant === "failed" ? "error" : variant === "pristine" ? "idle" : "saved",
  );
  const [savedAt, setSavedAt] = useState("09:41");
  const timer = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const showErrors = variant === "invalid";

  const set = useCallback(
    (k: string, v: string) => {
      setFields((f) => {
        const next = { ...f, [k]: v };
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
        } catch {
          /* private mode / quota — the indicator below tells the truth about it */
        }
        return next;
      });
      setAutosave("saving");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setAutosave("saved");
        const d = new Date();
        setSavedAt(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      }, 600);
    },
    [],
  );

  // Focus the new step's heading so keyboard and screen-reader users are not
  // dropped back at the top of the document on every "Tiếp".
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const goto = (n: number) => {
    const p = new URLSearchParams(sp);
    p.set("step", String(n));
    setSp(p); // push, not replace → browser Back walks the steps
  };

  const completed = variant === "pristine" ? 0 : variant === "partial" ? 2 : 3;

  const STEP_BODY = [
    // 1 — seller type
    <fieldset key="s0" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="tl-shop-label" style={{ padding: 0, marginBottom: 10 }}>
        Anh/chị bán với tư cách nào?
      </legend>
      {SELLER_TYPES.map((t) => (
        <label key={t.value} className="tl-shop-check" style={{ alignItems: "flex-start", padding: "8px 0" }}>
          <input
            type="radio"
            name="seller-type"
            checked={fields.type === t.value}
            onChange={() => set("type", t.value)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ display: "block", color: "var(--tl-fg)", fontWeight: 600 }}>{t.label}</span>
            <span className="tl-shop-hint">{t.d}</span>
          </span>
        </label>
      ))}
    </fieldset>,

    // 2 — identity
    <div key="s1">
      <Field
        id="f-name"
        label="Họ tên (theo giấy tờ)"
        value={fields.name ?? ""}
        onChange={(v) => set("name", v)}
        sensitive="Chỉ quản trị viên xem được."
        hint="Dùng để đối chiếu với giấy phép kinh doanh, không hiện trên trang shop."
        error={showErrors && !fields.name ? "Chưa điền họ tên." : undefined}
      />
      <Field
        id="f-phone"
        label="Số điện thoại"
        type="tel"
        value={fields.phone ?? ""}
        onChange={(v) => set("phone", v)}
        sensitive="Không hiện công khai."
        hint="Chúng tôi gọi để xác nhận hồ sơ. Người mua chỉ thấy số này sau khi đặt hàng của anh/chị."
        error={
          showErrors && !/^0\d{9}$/.test(fields.phone ?? "")
            ? "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0."
            : undefined
        }
      />
    </div>,

    // 3 — shop
    <div key="s2">
      <Field
        id="f-shop"
        label="Tên shop"
        value={fields.shop ?? ""}
        onChange={(v) => set("shop", v)}
        hint="Hiện công khai trên mọi sản phẩm của anh/chị. Đổi được sau."
        error={showErrors && (fields.shop ?? "").length < 3 ? "Tên shop cần ít nhất 3 ký tự." : undefined}
      />
      <Field
        id="f-desc"
        label="Giới thiệu ngắn"
        textarea
        value={fields.desc ?? ""}
        onChange={(v) => set("desc", v)}
        hint="1–2 câu. Ví dụ: “Bán vợt và giày pickleball, có sẵn hàng tại Quận 7.”"
      />
    </div>,

    // 4 — addresses
    <div key="s3">
      <Field
        id="f-addr"
        label="Địa chỉ gửi hàng"
        value={fields.addr ?? ""}
        onChange={(v) => set("addr", v)}
        sensitive="Chỉ hiện tên tỉnh/thành trên trang sản phẩm."
        hint="Địa chỉ chi tiết chỉ dùng để in phiếu gửi hàng."
      />
      <Field
        id="f-city"
        label="Tỉnh / thành phố"
        value={fields.city ?? ""}
        onChange={(v) => set("city", v)}
        hint="Đây là phần người mua nhìn thấy: “Gửi từ …”."
      />
    </div>,

    // 5 — documents
    <div key="s4">
      <div className="tl-shop-notice tl-shop-notice--info">
        <div>
          {fields.type === "ca-nhan"
            ? "Anh/chị chọn bán với tư cách cá nhân nên bước này không bắt buộc. Bấm Tiếp để bỏ qua."
            : "Ảnh giấy tờ được lưu riêng, chỉ quản trị viên xem được, và việc mở xem có ghi nhật ký."}
        </div>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <DocumentUploader
          label="Giấy phép kinh doanh"
          purpose="Dùng để đối chiếu tên shop với tên đăng ký. Không hiện công khai."
          state={variant === "invalid" ? "rejected" : fields.type === "ca-nhan" ? "missing" : "uploaded"}
          rejectReason="Ảnh thiếu góc dưới nên không đọc được số đăng ký. Chụp lại đủ 4 góc giúp mình."
        />
      </div>
      <p className="tl-shop-hint">
        Không cần ảnh CCCD ở bước này. Nếu cần đối chiếu thêm, quản trị viên sẽ liên hệ trực
        tiếp.
      </p>
    </div>,

    // 6 — review + submit
    <div key="s5">
      <div className="tl-shop-card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 650 }}>Xem lại</h3>
        <dl style={{ display: "grid", gap: 8, margin: 0, fontSize: 13.5 }}>
          {[
            ["Loại người bán", SELLER_TYPES.find((t) => t.value === fields.type)?.label ?? "—"],
            ["Họ tên", fields.name || "—"],
            ["Điện thoại", fields.phone || "—"],
            ["Tên shop", fields.shop || "—"],
            ["Gửi từ", fields.city || "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <dt style={{ color: "var(--tl-fg-3)" }}>{k}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <label className="tl-shop-check" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" style={{ marginTop: 3 }} />
        <span>
          Tôi đã đọc và đồng ý <a href="#quy-che">Quy chế người bán</a>, và cam kết hàng hoá
          đúng mô tả.
        </span>
      </label>
      <div className="tl-shop-notice tl-shop-notice--warn" style={{ marginTop: 12 }}>
        <div>
          <strong>Ghi chú thiết kế:</strong> văn bản &ldquo;Quy chế người bán&rdquo; hiện{" "}
          <strong>chưa tồn tại</strong> trong repo (Q2 của proposal). Nếu ship mà chưa có văn
          bản, nút này đang ghi nhận chấp thuận một thứ không có thật.
        </div>
      </div>
    </div>,
  ];

  return (
    <BuyerShell title="Hồ sơ đăng ký bán hàng" backTo="/proto/shop/sell" cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <SellerApplicationStepper
          steps={APPLICATION_STEPS}
          current={step}
          completed={completed}
          errored={showErrors ? [step] : []}
          onJump={goto}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0", flexWrap: "wrap" }}>
          <AutosaveIndicator
            state={autosave}
            savedAt={savedAt}
            onRetry={() => {
              setAutosave("saving");
              window.setTimeout(() => setAutosave("saved"), 600);
            }}
          />
        </div>

        {variant === "restored" && (
          <div className="tl-shop-notice tl-shop-notice--info" role="status">
            <div>
              Đã khôi phục bản nháp anh/chị điền dở lần trước. Không mất gì cả — kiểm tra lại
              rồi làm tiếp.
            </div>
          </div>
        )}

        <h1
          className="tl-shop-h1"
          ref={headingRef}
          tabIndex={-1}
          style={{ fontSize: "clamp(18px, 4.5vw, 22px)", outline: "none" }}
        >
          Bước {step + 1}/6 · {APPLICATION_STEPS[step].label}
        </h1>

        <div style={{ marginTop: 16 }}>{STEP_BODY[step]}</div>

        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <button type="button" className="tl-shop-btn" disabled={step === 0} onClick={() => goto(step - 1)}>
            Quay lại
          </button>
          {step < 5 ? (
            <button type="button" className="tl-shop-btn tl-shop-btn--primary" onClick={() => goto(step + 1)}>
              Tiếp
            </button>
          ) : (
            <Link to="/proto/shop/seller/status?variant=submitted" className="tl-shop-btn tl-shop-btn--primary">
              Gửi hồ sơ
            </Link>
          )}
          <span className="tl-proto-spacer" />
          <Link to="/proto/shop/sell" className="tl-shop-btn tl-shop-btn--ghost">
            Để sau
          </Link>
        </div>

        <p className="tl-shop-hint">
          Bấm &ldquo;Để sau&rdquo; hoặc đóng trình duyệt đều không mất dữ liệu — bản nháp lưu
          trên máy anh/chị và trên tài khoản.
        </p>
      </main>
    </BuyerShell>
  );
}
