// ============================================================================
// /seller/application — production seller application (prototype S02).
// ----------------------------------------------------------------------------
// Behaviour the approved prototype pinned, all preserved here:
//   * step index in the URL, so browser Back walks steps instead of leaving
//     the form — the classic way a half-filled application is lost
//   * local draft autosave via the repo's useAutosaveDraft (UX-04) PLUS a
//     server draft row, so a device change does not lose the work
//   * Đang lưu / Đã lưu HH:MM / Chưa lưu được — never a green tick for a write
//     that did not happen
//   * inline errors next to the field; the stepper is only a summary
//   * "Tiếp" and "Gửi hồ sơ" focus AND scroll to the first bad field
//   * ?focus=<field> from an admin change-request opens the right step with
//     that field focused and a banner saying who asked and for what
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, Loader2, Lock } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { ShopScrollShell, ShopHeader } from "@/components/shop/ShopShell";
import {
  SellerRulesAcceptance,
  type SellerRulesState,
} from "@/components/shop/SellerRulesAcceptance";
import { ErrorState, LoadingState } from "@/components/states/PageStates";
import { useAutosaveDraft } from "@/hooks/useAutosaveDraft";
import {
  applicationErrorMessage,
  useMyApplication,
  useSaveApplicationDraft,
  useShopPilotAccess,
  useSubmitApplication,
} from "@/hooks/shop/useSellerApplication";
import {
  APPLICATION_RULES,
  canEdit,
  failingRules,
  failingSteps,
  targetByField,
  type ApplicationDraft,
} from "@/lib/shop/applicationState";

const STEPS = [
  { key: "loai", label: "Loại người bán" },
  { key: "danh-tinh", label: "Danh tính" },
  { key: "shop", label: "Thông tin shop" },
  { key: "dia-chi", label: "Địa chỉ" },
  { key: "giay-to", label: "Giấy tờ" },
  { key: "gui", label: "Xem lại & gửi" },
];

const SELLER_TYPES = [
  { value: "ca-nhan", label: "Cá nhân", d: "Bán vài món, không có giấy phép kinh doanh." },
  { value: "ho-kinh-doanh", label: "Hộ kinh doanh", d: "Có giấy phép hộ kinh doanh." },
  { value: "cong-ty", label: "Công ty", d: "Có giấy chứng nhận đăng ký doanh nghiệp." },
];

/** Move focus AND scroll — a focused input below the fold is not a fix. */
const focusField = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  (el as HTMLElement).focus({ preventScroll: true });
};

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

export default function SellerApplication() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const step = Math.min(Math.max(Number(sp.get("step") ?? 0), 0), STEPS.length - 1);
  const focusTarget = sp.get("focus");

  const pilot = useShopPilotAccess();
  const remote = useMyApplication();
  const saveDraft = useSaveApplicationDraft();
  const submit = useSubmitApplication();

  const [fields, setFields] = useState<ApplicationDraft>({});
  const [attempted, setAttempted] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Whether the SERVER has recorded acceptance of the seller-rules version in
  // force. Not authorization — shop_application_submit() re-checks it — but the
  // difference between offering a button that works and one that refuses.
  const [rules, setRules] = useState<SellerRulesState>({ ready: false, version: null });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hydrated = useRef(false);

  // Local draft (UX-04 convention) is the belt; the server row is the braces.
  // The local copy is what survives a reload before the first server write
  // lands, and what tells the truth when the network is down.
  const local = useAutosaveDraft<ApplicationDraft>({
    key: "draft:seller-application",
    value: fields,
    enabled: hydrated.current,
  });

  // Hydrate once: server row wins when it exists, local draft fills the gap.
  useEffect(() => {
    if (hydrated.current || remote.isLoading) return;
    const server = remote.data;
    if (server) {
      setFields({
        seller_type: server.seller_type,
        full_name: server.full_name,
        phone: server.phone,
        shop_name: server.shop_name,
        shop_intro: server.shop_intro,
        pickup_address: server.pickup_address,
        city: server.city,
      });
    } else if (local.initial) {
      setFields(local.initial);
    }
    hydrated.current = true;
  }, [remote.isLoading, remote.data, local.initial]);

  const broken = useMemo(() => failingRules(fields), [fields]);
  const errorFor = (id: string) => {
    const r = broken.find((x) => x.field === id);
    return r && attempted.includes(r.step) ? r.message : undefined;
  };
  const erroredSteps = failingSteps(fields).filter((n) => attempted.includes(n));

  const gotoStep = useCallback(
    (n: number) => {
      const p = new URLSearchParams(sp);
      p.set("step", String(n));
      p.delete("focus");
      setSp(p); // push, so Back walks the steps
    },
    [sp, setSp],
  );

  // Focus the step heading, unless a moderator deep-linked a specific field.
  useEffect(() => {
    if (!focusTarget) {
      headingRef.current?.focus();
      return undefined;
    }
    const id = window.setTimeout(() => focusField(focusTarget), 60);
    return () => window.clearTimeout(id);
  }, [step, focusTarget]);

  const persist = (next: ApplicationDraft) => {
    setFields(next);
    saveDraft.mutate({ ...next, id: remote.data?.id });
  };
  const set = (k: keyof ApplicationDraft, v: string) => persist({ ...fields, [k]: v });

  const passStep = (n: number) => {
    const bad = broken.filter((r) => r.step === n);
    if (bad.length === 0) return true;
    setAttempted((a) => (a.includes(n) ? a : [...a, n]));
    window.setTimeout(() => focusField(bad[0].field), 0);
    return false;
  };

  const onSubmit = async () => {
    setSubmitError(null);
    if (broken.length > 0) {
      setAttempted(failingSteps(fields));
      const first = broken[0];
      if (first.step !== step) gotoStep(first.step);
      window.setTimeout(() => focusField(first.field), 80);
      return;
    }
    if (!rules.ready) {
      setSubmitError(
        "Anh/chị cần đọc và đồng ý Quy chế người bán ở bước cuối trước khi gửi hồ sơ.",
      );
      gotoStep(STEPS.length - 1);
      return;
    }
    try {
      await saveDraft.mutateAsync({ ...fields, id: remote.data?.id });
      // The version travels with the submit so the server can refuse a form
      // that was open across a version change.
      await submit.mutateAsync(rules.version);
      local.clear();
      navigate("/seller/application/status");
    } catch (err) {
      setSubmitError(applicationErrorMessage(err));
    }
  };

  if (pilot.isLoading || remote.isLoading) return <LoadingState fullScreen />;

  if (pilot.isError || remote.isError) {
    return (
      <ShopScrollShell>
        <ShopHeader title="Hồ sơ đăng ký bán hàng" backTo="/shop/sell" />
        <main className="tl-shop-page tl-shop-page--narrow">
          <ErrorState
            onRetry={() => {
              void pilot.refetch();
              void remote.refetch();
            }}
          />
          <p className="tl-shop-hint">
            Bản nháp của anh/chị không mất đi đâu cả — nó vẫn nằm trên máy và trên tài khoản.
          </p>
        </main>
      </ShopScrollShell>
    );
  }

  if (!pilot.data) {
    return (
      <ShopScrollShell>
        <ShopHeader title="Hồ sơ đăng ký bán hàng" backTo="/" />
        <main className="tl-shop-page tl-shop-page--narrow">
          <h1 className="tl-shop-h1">Shop đang chạy thử nghiệm kín</h1>
          <p className="tl-shop-sub">
            Tài khoản của anh/chị chưa nằm trong nhóm thử nghiệm nên chưa mở hồ sơ được. Nếu
            anh/chị muốn tham gia, nhắn cho ThePickleHub.
          </p>
          <Link to="/" className="tl-shop-btn">
            Về trang chủ
          </Link>
        </main>
      </ShopScrollShell>
    );
  }

  const status = remote.data?.status ?? "draft";
  const readOnly = !canEdit(status);
  const requested = remote.data?.requested_fields ?? [];

  if (readOnly) {
    return (
      <ShopScrollShell>
        <ShopHeader title="Hồ sơ đăng ký bán hàng" backTo="/shop/sell" />
        <main className="tl-shop-page tl-shop-page--narrow">
          <h1 className="tl-shop-h1">Hồ sơ đang được xử lý</h1>
          <p className="tl-shop-sub">Hồ sơ ở trạng thái này không sửa được nữa.</p>
          <Link to="/seller/application/status" className="tl-shop-btn tl-shop-btn--primary">
            Xem trạng thái hồ sơ
          </Link>
        </main>
      </ShopScrollShell>
    );
  }

  const StepBody = () => {
    switch (step) {
      case 0:
        return (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="tl-shop-label" style={{ padding: 0, marginBottom: 10 }}>
              Anh/chị bán với tư cách nào?
            </legend>
            <span id="f-type" tabIndex={-1} style={{ outline: "none" }} />
            {SELLER_TYPES.map((t) => (
              <label key={t.value} className="tl-shop-check" style={{ alignItems: "flex-start", padding: "8px 0" }}>
                <input
                  type="radio"
                  name="seller-type"
                  checked={fields.seller_type === t.value}
                  onChange={() => set("seller_type", t.value)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ display: "block", color: "var(--tl-fg)", fontWeight: 600 }}>{t.label}</span>
                  <span className="tl-shop-hint">{t.d}</span>
                </span>
              </label>
            ))}
            {errorFor("f-type") && (
              <p className="tl-shop-error">
                <AlertTriangle size={13} aria-hidden="true" />
                {errorFor("f-type")}
              </p>
            )}
          </fieldset>
        );
      case 1:
        return (
          <>
            <Field
              id="f-name"
              label="Họ tên (theo giấy tờ)"
              value={fields.full_name ?? ""}
              onChange={(v) => set("full_name", v)}
              sensitive="Chỉ quản trị viên xem được."
              hint="Không hiện trên trang shop."
              error={errorFor("f-name")}
            />
            <Field
              id="f-phone"
              label="Số điện thoại"
              type="tel"
              value={fields.phone ?? ""}
              onChange={(v) => set("phone", v)}
              sensitive="Không hiện công khai."
              hint="Chúng tôi gọi để xác nhận hồ sơ. Người mua chỉ thấy số này sau khi đặt hàng của anh/chị."
              error={errorFor("f-phone")}
            />
          </>
        );
      case 2:
        return (
          <>
            <Field
              id="f-shop"
              label="Tên shop"
              value={fields.shop_name ?? ""}
              onChange={(v) => set("shop_name", v)}
              hint="Hiện công khai trên mọi sản phẩm của anh/chị. Đổi được sau."
              error={errorFor("f-shop")}
            />
            <Field
              id="f-desc"
              label="Giới thiệu ngắn"
              textarea
              value={fields.shop_intro ?? ""}
              onChange={(v) => set("shop_intro", v)}
              hint="1–2 câu. Ví dụ: “Bán vợt và giày pickleball, có sẵn hàng tại Quận 7.”"
            />
          </>
        );
      case 3:
        return (
          <>
            <Field
              id="f-addr"
              label="Địa chỉ gửi hàng"
              value={fields.pickup_address ?? ""}
              onChange={(v) => set("pickup_address", v)}
              sensitive="Chỉ hiện tên tỉnh/thành trên trang sản phẩm."
              hint="Địa chỉ chi tiết chỉ dùng để in phiếu gửi hàng."
            />
            <Field
              id="f-city"
              label="Tỉnh / thành phố"
              value={fields.city ?? ""}
              onChange={(v) => set("city", v)}
              hint="Đây là phần người mua nhìn thấy: “Gửi từ …”."
              error={errorFor("f-city")}
            />
          </>
        );
      case 4:
        return (
          <div className="tl-shop-notice tl-shop-notice--info">
            <div>
              <strong>Giai đoạn thử nghiệm không thu giấy tờ.</strong> Nếu cần đối chiếu thêm,
              quản trị viên sẽ liên hệ trực tiếp qua số điện thoại anh/chị đã điền. Bấm Tiếp để
              sang bước cuối.
            </div>
          </div>
        );
      default:
        return (
          <>
            <div className="tl-shop-card" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 650 }}>Xem lại</h2>
              <dl className="tl-shop-deflist">
                {[
                  ["Loại người bán", SELLER_TYPES.find((t) => t.value === fields.seller_type)?.label ?? "—"],
                  ["Họ tên", fields.full_name || "—"],
                  ["Điện thoại", fields.phone || "—"],
                  ["Tên shop", fields.shop_name || "—"],
                  ["Gửi từ", fields.city || "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <SellerRulesAcceptance
              applicationId={remote.data?.id ?? null}
              onChange={setRules}
            />
          </>
        );
    }
  };

  return (
    <ShopScrollShell>
      <DynamicMeta title="Hồ sơ đăng ký bán hàng" noindex />
      <ShopHeader title="Hồ sơ đăng ký bán hàng" backTo="/shop/sell" />
      <main className="tl-shop-page tl-shop-page--narrow">
        <nav className="tl-shop-stepper" aria-label="Các bước hồ sơ đăng ký">
          {STEPS.map((s, i) => {
            const done = i < step && !erroredSteps.includes(i);
            const isErr = erroredSteps.includes(i);
            return (
              <button
                key={s.key}
                type="button"
                className={`tl-shop-step ${done ? "is-done" : ""} ${isErr ? "is-error" : ""}`}
                aria-current={i === step ? "step" : undefined}
                onClick={() => gotoStep(i)}
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

        <div
          className={`tl-shop-autosave ${saveDraft.isError || local.saveFailed ? "is-error" : saveDraft.isSuccess ? "is-saved" : ""}`}
          role="status"
          aria-live="polite"
          style={{ margin: "16px 0" }}
        >
          {saveDraft.isPending ? (
            <>
              <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Đang lưu…
            </>
          ) : saveDraft.isError || local.saveFailed ? (
            <>
              <AlertTriangle size={13} aria-hidden="true" /> Chưa lưu được lên máy chủ — bản nháp
              vẫn nằm trên máy anh/chị.
            </>
          ) : local.lastSavedAt || saveDraft.isSuccess ? (
            <>
              <Check size={13} aria-hidden="true" /> Đã lưu nháp
              {local.lastSavedAt
                ? ` lúc ${new Date(local.lastSavedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </>
          ) : (
            <>Chưa có thay đổi nào cần lưu</>
          )}
        </div>

        {focusTarget && targetByField(focusTarget) && (
          <div className="tl-shop-notice tl-shop-notice--warn" role="status">
            <div>
              Quản trị viên yêu cầu sửa ô <strong>{targetByField(focusTarget)!.label}</strong> — đã
              đưa anh/chị tới đúng chỗ. Sửa xong bấm Tiếp cho tới bước cuối rồi gửi lại.
            </div>
          </div>
        )}

        {status === "needs_changes" && requested.length > 0 && !focusTarget && (
          <div className="tl-shop-notice tl-shop-notice--warn">
            <div>
              <strong>Cần sửa {requested.length} chỗ.</strong>{" "}
              {remote.data?.applicant_note}
            </div>
          </div>
        )}

        <h1
          className="tl-shop-h1"
          ref={headingRef}
          tabIndex={-1}
          style={{ fontSize: "clamp(18px, 4.5vw, 22px)", outline: "none" }}
        >
          Bước {step + 1}/{STEPS.length} · {STEPS[step].label}
        </h1>

        <div style={{ marginTop: 16 }}>
          <StepBody />
        </div>

        {submitError && (
          <div className="tl-shop-notice tl-shop-notice--danger" role="alert" style={{ marginTop: 16 }}>
            <div>{submitError}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <button type="button" className="tl-shop-btn" disabled={step === 0} onClick={() => gotoStep(step - 1)}>
            Quay lại
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--primary"
              onClick={() => {
                if (passStep(step)) gotoStep(step + 1);
              }}
            >
              Tiếp
            </button>
          ) : (
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--primary"
              // Locked until the server has the signature. The submit RPC
              // refuses anyway; this is so nobody is invited to press it.
              disabled={submit.isPending || !rules.ready}
              onClick={() => void onSubmit()}
            >
              {submit.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Đang gửi…
                </>
              ) : (
                "Gửi hồ sơ"
              )}
            </button>
          )}
          <span className="tl-proto-spacer" />
          <Link to="/shop/sell" className="tl-shop-btn tl-shop-btn--ghost">
            Để sau
          </Link>
        </div>

        <p className="tl-shop-hint">
          Bấm &ldquo;Để sau&rdquo; hoặc đóng trình duyệt đều không mất dữ liệu — bản nháp lưu cả
          trên máy anh/chị lẫn trên tài khoản.
          {APPLICATION_RULES.length > 0 && ""}
        </p>
      </main>
    </ShopScrollShell>
  );
}
