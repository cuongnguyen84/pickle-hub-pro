// ============================================================================
// /seller/settings — the shop's own profile (P2a step 3).
// ----------------------------------------------------------------------------
// Seller-side only. There is no public shop page yet (D3: P2b), so every
// "công khai" label here says what WILL be public rather than linking to it,
// and the contact preview says plainly that it is a preview.
//
// Three things the screen is honest about, because the alternative is a lie
// the seller only discovers later:
//   * the URL does not move when the name changes — that is a separate,
//     confirmed action;
//   * a contact channel the seller switched public is not public until an
//     admin approves it, so the badge says "chờ duyệt", not "công khai";
//   * a save that lost a race says so and keeps the seller's text, instead of
//     quietly winning or quietly losing.
//
// No fixture, no scenario, no simulated delay. Everything comes from the RPCs
// in migration 20260811180000.
// ============================================================================

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { DefList, ShopScrollShell, SellerShell } from "@/components/shop/ShopShell";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import {
  shopErrorMessage,
  useDeleteContact,
  useMyShopMembership,
  useShopCategories,
  useShopContacts,
  useShopProfile,
  useUpdateShopProfile,
  useUpdateShopSlug,
  useUpsertContact,
  type ProfilePatch,
} from "@/hooks/shop/useShopProfile";
import { SHOP_STATE_LABEL } from "@/lib/shop/applicationState";
import { VN_BANKS } from "@/lib/payment/banks";
import {
  CHANNEL_LABEL,
  CHANNEL_PLACEHOLDER,
  publicityLabel,
  validateChannel,
} from "@/lib/shop/contactChannels";
import type { ShopContactType, ShopRow } from "@/integrations/supabase/shop-schema";

// Shares its chunk with the product photo editor — one upload machine, two
// surfaces — and is fetched only when the seller opens this section.
const ShopProfileMediaSection = lazy(() =>
  import("@/components/shop/MediaEditor").then((m) => ({ default: m.ShopProfileMediaSection })),
);

type SaveState = "idle" | "saving" | "saved" | "error";

const FIELD_LABEL: Record<keyof ProfilePatch, string> = {
  name: "Tên shop",
  intro: "Giới thiệu",
  city: "Tỉnh/thành",
  region: "Khu vực hoạt động",
  primary_category_slug: "Ngành hàng chính",
  shipping_note: "Thông tin giao hàng",
  return_note: "Chính sách đổi trả",
  bank_code: "Ngân hàng",
  bank_account_number: "Số tài khoản",
  bank_account_name: "Chủ tài khoản",
};

const draftFromRow = (row: ShopRow): ProfilePatch => ({
  name: row.name,
  intro: row.intro ?? "",
  city: row.city ?? "",
  region: row.region ?? "",
  primary_category_slug: row.primary_category_slug ?? "",
  shipping_note: row.shipping_note ?? "",
  return_note: row.return_note ?? "",
  bank_code: row.bank_code ?? "",
  bank_account_number: row.bank_account_number ?? "",
  bank_account_name: row.bank_account_name ?? "",
});

export default function SellerShopSettings() {
  const membership = useMyShopMembership();
  const shopId = membership.data?.shop_id ?? null;
  const canEdit = membership.data?.role === "owner" || membership.data?.role === "manager";

  const profile = useShopProfile(shopId);
  const contacts = useShopContacts(shopId);
  const categories = useShopCategories();

  const updateProfile = useUpdateShopProfile(shopId);
  const updateSlug = useUpdateShopSlug(shopId);
  const upsertContact = useUpsertContact(shopId);
  const deleteContact = useDeleteContact(shopId);

  const [draft, setDraft] = useState<ProfilePatch | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Partial<Record<keyof ProfilePatch, string>>>({});
  const firstErrorRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  const row = profile.data ?? null;

  // Seed the form once. Re-seeding on every refetch would throw away whatever
  // the seller was typing when a background query settled.
  useEffect(() => {
    if (row && draft === null) setDraft(draftFromRow(row));
  }, [row, draft]);

  const dirty = useMemo(() => {
    if (!row || !draft) return false;
    const base = draftFromRow(row);
    return (Object.keys(base) as (keyof ProfilePatch)[]).some((k) => (base[k] ?? "") !== (draft[k] ?? ""));
  }, [row, draft]);

  // A seller who closes the tab mid-edit loses the text; say so first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const shellWrap = (children: React.ReactNode) => (
    <ShopScrollShell>
      <DynamicMeta title="Cài đặt shop" noindex />
      <SellerShell active="settings" title="Cài đặt shop">
        <main className="tl-shop-page tl-shop-page--narrow">{children}</main>
      </SellerShell>
    </ShopScrollShell>
  );

  // Khung xương đúng hình trang: tiêu đề, dòng phụ, rồi các thẻ nhóm trường
  // (thông tin shop, kênh liên hệ, vận chuyển, đổi trả).
  if (membership.isLoading || profile.isLoading) {
    return shellWrap(
      <div aria-busy="true" aria-label="Đang tải cài đặt shop">
        <span className="tl-shop-sk tl-shop-sk--title" />
        <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "70%" }} />
        <span className="tl-shop-sk tl-shop-sk--card" />
        <span className="tl-shop-sk tl-shop-sk--card" />
        <span className="tl-shop-sk tl-shop-sk--card" />
      </div>,
    );
  }

  if (membership.isError || profile.isError) {
    return shellWrap(
      <ShopErrorNotice
        title="Chưa tải được cài đặt shop."
        onRetry={() => {
          void membership.refetch();
          void profile.refetch();
        }}
      />,
    );
  }

  if (!membership.data || !row) {
    return shellWrap(
      <>
        <h1 className="tl-shop-h1">Chưa có shop</h1>
        <p className="tl-shop-sub">
          Tài khoản này chưa thuộc shop nào. Nếu anh/chị vừa được duyệt, thử tải lại trang.
        </p>
      </>,
    );
  }

  const setField = (key: keyof ProfilePatch, value: string) => {
    setDraft((d) => ({ ...(d ?? {}), [key]: value }));
    setSaveState("idle");
    setFieldError((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (d: ProfilePatch) => {
    const errors: Partial<Record<keyof ProfilePatch, string>> = {};
    const name = (d.name ?? "").trim();
    if (name.length < 3 || name.length > 120) errors.name = "Tên shop cần từ 3 đến 120 ký tự";
    if ((d.intro ?? "").length > 1000) errors.intro = "Giới thiệu tối đa 1000 ký tự";
    if ((d.shipping_note ?? "").length > 600) errors.shipping_note = "Tối đa 600 ký tự";
    if ((d.return_note ?? "").length > 600) errors.return_note = "Tối đa 600 ký tự";
    const region = (d.region ?? "").trim();
    if (region && (region.length < 2 || region.length > 80)) errors.region = "Khu vực cần từ 2 đến 80 ký tự";

    // The bank trio, checked here as ONE thing rather than three. The CHECK
    // constraint refuses a partial set with a 23514 and no field name, so a
    // seller who fills two of three would otherwise get "không lưu được" with
    // nothing pointing at the empty box.
    const bankCode = (d.bank_code ?? "").trim();
    // Whitespace is stripped, not rejected: every banking app prints an
    // account number in groups, and telling a seller their own account is
    // invalid because they pasted it faithfully is the wrong answer.
    const bankNo = (d.bank_account_number ?? "").replace(/\s/g, "");
    const bankName = (d.bank_account_name ?? "").trim();
    const filled = [bankCode, bankNo, bankName].filter(Boolean).length;
    if (filled > 0 && filled < 3) {
      const missing =
        !bankCode ? "bank_code" : !bankNo ? "bank_account_number" : "bank_account_name";
      errors[missing as keyof ProfilePatch] =
        "Điền đủ cả ba ô thì người mua mới quét được QR — thiếu một ô là QR hỏng";
    }
    if (bankNo && !/^[0-9]{6,20}$/.test(bankNo)) {
      errors.bank_account_number = "Số tài khoản chỉ gồm chữ số, 6–20 số";
    }
    if (bankName && (bankName.length < 2 || bankName.length > 100)) {
      errors.bank_account_name = "Tên chủ tài khoản cần từ 2 đến 100 ký tự";
    }
    return errors;
  };

  const onSave = async () => {
    if (!draft || !row) return;
    const errors = validate(draft);
    setFieldError(errors);
    if (Object.keys(errors).length > 0) {
      // Focus the first thing that is wrong, not the top of the form.
      firstErrorRef.current?.focus();
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      await updateProfile.mutateAsync({ expectedVersion: row.version, patch: draft });
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(shopErrorMessage(error));
    }
  };

  const readOnlyNote = !canEdit && (
    <div className="tl-shop-notice tl-shop-notice--info" role="status">
      Vai trò <strong>{membership.data.role}</strong> chỉ xem được cài đặt shop. Chủ shop hoặc
      quản lý mới sửa được.
    </div>
  );

  return shellWrap(
    <>
      <h1 className="tl-shop-h1">Cài đặt shop</h1>
      <p className="tl-shop-sub">
        Thông tin ở đây sẽ hiện trên trang shop công khai khi trang đó mở (chưa mở trong giai đoạn
        này). Chưa có gì ở đây được công bố ra ngoài.
      </p>

      {readOnlyNote}

      {/* ── Public information ───────────────────────────────────────────── */}
      <section aria-labelledby="sec-info">
        <h2 id="sec-info" className="tl-shop-h2">Thông tin công khai</h2>

        <Field
          id="shop-name"
          label={FIELD_LABEL.name}
          error={fieldError.name}
          hint="Đổi tên KHÔNG đổi đường dẫn shop."
        >
          <input
            id="shop-name"
            className="tl-shop-input"
            value={draft?.name ?? ""}
            maxLength={120}
            disabled={!canEdit}
            aria-invalid={!!fieldError.name}
            ref={fieldError.name ? (firstErrorRef as React.Ref<HTMLInputElement>) : undefined}
            onChange={(e) => setField("name", e.target.value)}
          />
        </Field>

        <Field id="shop-intro" label={FIELD_LABEL.intro} error={fieldError.intro}>
          <textarea
            id="shop-intro"
            className="tl-shop-textarea"
            rows={4}
            maxLength={1000}
            disabled={!canEdit}
            value={draft?.intro ?? ""}
            aria-invalid={!!fieldError.intro}
            onChange={(e) => setField("intro", e.target.value)}
          />
        </Field>

        <Field id="shop-category" label={FIELD_LABEL.primary_category_slug}>
          <select
            id="shop-category"
            className="tl-shop-select"
            disabled={!canEdit}
            value={draft?.primary_category_slug ?? ""}
            onChange={(e) => setField("primary_category_slug", e.target.value)}
          >
            <option value="">— Chưa chọn —</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.slug} value={c.slug}>{c.name_vi}</option>
            ))}
          </select>
        </Field>

        <Field id="shop-city" label={FIELD_LABEL.city}>
          <input
            id="shop-city"
            className="tl-shop-input"
            value={draft?.city ?? ""}
            disabled={!canEdit}
            onChange={(e) => setField("city", e.target.value)}
          />
        </Field>

        <Field
          id="shop-region"
          label={FIELD_LABEL.region}
          error={fieldError.region}
          hint="Khu vực anh/chị nhận giao hàng. Không phải địa chỉ nhà."
        >
          <input
            id="shop-region"
            className="tl-shop-input"
            value={draft?.region ?? ""}
            disabled={!canEdit}
            aria-invalid={!!fieldError.region}
            onChange={(e) => setField("region", e.target.value)}
          />
        </Field>
      </section>

      {/* ── Shipping / returns ───────────────────────────────────────────── */}
      <section aria-labelledby="sec-ship">
        <h2 id="sec-ship" className="tl-shop-h2">Giao hàng & đổi trả</h2>
        <Field id="shop-ship" label={FIELD_LABEL.shipping_note} error={fieldError.shipping_note}>
          <textarea
            id="shop-ship"
            className="tl-shop-textarea"
            rows={3}
            maxLength={600}
            disabled={!canEdit}
            value={draft?.shipping_note ?? ""}
            onChange={(e) => setField("shipping_note", e.target.value)}
          />
        </Field>
        <Field id="shop-return" label={FIELD_LABEL.return_note} error={fieldError.return_note}>
          <textarea
            id="shop-return"
            className="tl-shop-textarea"
            rows={3}
            maxLength={600}
            disabled={!canEdit}
            value={draft?.return_note ?? ""}
            onChange={(e) => setField("return_note", e.target.value)}
          />
        </Field>
      </section>

      {/* ── Bank transfer (P4b) ──────────────────────────────────────────── */}
      <section aria-labelledby="sec-bank">
        <h2 id="sec-bank" className="tl-shop-h2">Tài khoản nhận chuyển khoản</h2>
        <p className="tl-shop-hint" style={{ marginTop: 0 }}>
          Điền đủ ba ô thì người mua chọn “chuyển khoản” sẽ thấy mã QR quét là
          chuyển được ngay. Tiền vào thẳng tài khoản anh/chị — ThePickleHub
          không nhận, không giữ và không đối soát. Để trống cả ba thì người mua
          vẫn đặt được, chỉ là phải liên hệ shop để xin số tài khoản.
        </p>
        <Field id="shop-bank-code" label={FIELD_LABEL.bank_code} error={fieldError.bank_code}>
          <select
            id="shop-bank-code"
            className="tl-shop-input"
            disabled={!canEdit}
            value={draft?.bank_code ?? ""}
            onChange={(e) => setField("bank_code", e.target.value)}
          >
            <option value="">— Chưa chọn —</option>
            {VN_BANKS.map((b) => (
              <option key={b.code} value={b.code}>{b.shortName}</option>
            ))}
          </select>
        </Field>
        <Field
          id="shop-bank-no"
          label={FIELD_LABEL.bank_account_number}
          error={fieldError.bank_account_number}
        >
          <input
            id="shop-bank-no"
            className="tl-shop-input"
            inputMode="numeric"
            autoComplete="off"
            maxLength={30}
            disabled={!canEdit}
            value={draft?.bank_account_number ?? ""}
            onChange={(e) => setField("bank_account_number", e.target.value)}
          />
        </Field>
        <Field
          id="shop-bank-name"
          label={FIELD_LABEL.bank_account_name}
          error={fieldError.bank_account_name}
        >
          <input
            id="shop-bank-name"
            className="tl-shop-input"
            autoComplete="off"
            maxLength={100}
            disabled={!canEdit}
            value={draft?.bank_account_name ?? ""}
            onChange={(e) => setField("bank_account_name", e.target.value)}
          />
          <p className="tl-shop-hint">
            Viết hoa không dấu, đúng như ngân hàng in — ví dụ NGUYEN VAN CUONG.
          </p>
        </Field>
      </section>

      {canEdit && (
        <SaveBar
          dirty={dirty}
          state={saveState}
          error={saveError}
          onSave={() => void onSave()}
          onReload={() => {
            setDraft(null);
            void profile.refetch();
          }}
        />
      )}

      {/* ── Logo & cover ─────────────────────────────────────────────────── */}
      {/* Behind a disclosure, so the uploader chunk is fetched when the seller
          asks for it rather than on every visit to Cài đặt. */}
      <details onToggle={(e) => setMediaOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="tl-shop-btn" style={{ cursor: "pointer", marginBottom: 12 }}>
          Logo &amp; ảnh bìa
        </summary>
        {mediaOpen && (
          <Suspense fallback={<p className="tl-shop-hint">Đang mở phần ảnh…</p>}>
            <ShopProfileMediaSection
              shopId={row.id}
              shopState={row.state}
              disabled={!canEdit}
              onChanged={() => {}}
            />
          </Suspense>
        )}
      </details>

      {/* ── Slug ─────────────────────────────────────────────────────────── */}
      <SlugSection
        slug={row.slug}
        canEdit={canEdit}
        onSubmit={async (next) => await updateSlug.mutateAsync(next)}
      />

      {/* ── Contact channels ─────────────────────────────────────────────── */}
      <ContactSection
        canEdit={canEdit}
        rows={contacts.data ?? []}
        loading={contacts.isLoading}
        onSave={async (input) => await upsertContact.mutateAsync(input)}
        onDelete={async (id) => await deleteContact.mutateAsync(id)}
      />

      {/* ── Read-only status ─────────────────────────────────────────────── */}
      <section aria-labelledby="sec-status">
        <h2 id="sec-status" className="tl-shop-h2">Trạng thái</h2>
        <DefList
          rows={[
            ["Trạng thái shop", SHOP_STATE_LABEL[row.state] ?? row.state],
            [
              "Xác minh",
              row.verified_at
                ? `Đã xác minh (${row.verified_method === "gap-truc-tiep" ? "gặp trực tiếp" : "giấy phép kinh doanh"})`
                : "Chưa xác minh",
            ],
          ]}
        />
        <p className="tl-shop-hint">
          Trạng thái và xác minh do quản trị viên đặt. Đây không phải cam kết chất lượng.
        </p>
      </section>
    </>,
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="tl-shop-field">
      <label className="tl-shop-label" htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="tl-shop-hint">{hint}</p>}
      {/* The message sits next to the field, not in a toast that scrolls away. */}
      {error && (
        <p className="tl-shop-error" role="alert">{error}</p>
      )}
    </div>
  );
}

function SaveBar({
  dirty,
  state,
  error,
  onSave,
  onReload,
}: {
  dirty: boolean;
  state: SaveState;
  error: string | null;
  onSave: () => void;
  onReload: () => void;
}) {
  return (
    <div className="tl-shop-decision-actions">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--primary"
          onClick={onSave}
          // Disabled while in flight so a double tap cannot send it twice.
          disabled={state === "saving" || !dirty}
        >
          {state === "saving" ? "Đang lưu…" : "Lưu thay đổi"}
        </button>

        {/* Say which of the four things is true, never a generic tick. */}
        {state === "saved" && !dirty && (
          <span className="tl-shop-pill tl-shop-pill--ok" role="status">
            <Check size={14} aria-hidden="true" /> Đã lưu
          </span>
        )}
        {dirty && state !== "saving" && state !== "error" && (
          <span className="tl-shop-pill tl-shop-pill--warn" role="status">Chưa lưu</span>
        )}
        {state === "error" && (
          <span className="tl-shop-pill tl-shop-pill--danger" role="status">Chưa lưu được</span>
        )}
      </div>

      {state === "error" && error && (
        <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={onSave}>
            Thử lại
          </button>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost" onClick={onReload}>
            Tải lại bản mới nhất
          </button>
        </div>
      )}
    </div>
  );
}

function SlugSection({
  slug,
  canEdit,
  onSubmit,
}: {
  slug: string;
  canEdit: boolean;
  onSubmit: (next: string) => Promise<string>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValue(slug), [slug]);

  return (
    <section aria-labelledby="sec-slug">
      <h2 id="sec-slug" className="tl-shop-h2">Đường dẫn shop</h2>
      <p className="tl-shop-hint">
        Địa chỉ trang shop của anh/chị: <code>/{slug}</code>. Đổi tên shop không đổi đường dẫn —
        đường dẫn chỉ đổi khi anh/chị bấm đổi ở đây.
      </p>

      {!editing ? (
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--sm"
          disabled={!canEdit}
          onClick={() => setEditing(true)}
        >
          Đổi đường dẫn
        </button>
      ) : (
        <>
          <div className="tl-shop-notice tl-shop-notice--warn" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              Ai đang giữ liên kết cũ sẽ không mở được nữa. Hệ thống chưa có chuyển hướng tự động
              từ đường dẫn cũ.
            </span>
          </div>
          <Field id="shop-slug" label="Đường dẫn mới" error={error ?? undefined}>
            <input
              id="shop-slug"
              className="tl-shop-input"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-invalid={!!error}
            />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--sm"
              disabled={busy || value.trim() === slug}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onSubmit(value);
                  setEditing(false);
                } catch (e) {
                  setError(shopErrorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Đang đổi…" : "Xác nhận đổi"}
            </button>
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
              onClick={() => {
                setEditing(false);
                setValue(slug);
                setError(null);
              }}
            >
              Huỷ
            </button>
          </div>
        </>
      )}
    </section>
  );
}

const CHANNEL_TYPES: ShopContactType[] = ["zalo", "messenger", "phone"];

function ContactSection({
  canEdit,
  rows,
  loading,
  onSave,
  onDelete,
}: {
  canEdit: boolean;
  rows: Array<{
    id: string;
    type: ShopContactType;
    value_raw: string;
    value_normalized: string;
    is_public: boolean;
    state: string;
    review_note: string | null;
  }>;
  loading: boolean;
  onSave: (input: {
    id?: string;
    type: ShopContactType;
    value: string;
    isPublic: boolean;
  }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [type, setType] = useState<ShopContactType>("zalo");
  const [value, setValue] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = value.trim() ? validateChannel(type, value) : null;

  return (
    <section aria-labelledby="sec-contact">
      <h2 id="sec-contact" className="tl-shop-h2">Kênh liên hệ công khai</h2>
      <p className="tl-shop-hint">
        Người mua sẽ thấy đúng những kênh anh/chị bật công khai và quản trị viên đã duyệt.
        Email và số điện thoại đăng nhập <strong>không bao giờ</strong> tự hiện ra ngoài.
      </p>

      {loading ? (
        <p className="tl-shop-hint">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="tl-shop-hint">Chưa có kênh nào. Thêm một kênh để người mua liên hệ được.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((row) => {
            const badge = publicityLabel(row);
            return (
              <li key={row.id} className="tl-shop-card" style={{ marginBottom: 10 }}>
                <p style={{ fontWeight: 600 }}>{CHANNEL_LABEL[row.type]}</p>
                <p className="tl-shop-hint">{row.value_raw}</p>
                <p className="tl-shop-hint">
                  Sẽ mở: <code>{row.value_normalized}</code>
                </p>
                <span
                  className={
                    badge.tone === "ok"
                      ? "tl-shop-pill tl-shop-pill--ok"
                      : badge.tone === "warn"
                        ? "tl-shop-pill tl-shop-pill--warn"
                        : "tl-shop-pill tl-shop-pill--muted"
                  }
                >
                  {badge.text}
                </span>
                {row.review_note && (
                  <p className="tl-shop-error" role="status">{row.review_note}</p>
                )}
                {canEdit && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="tl-shop-btn tl-shop-btn--sm"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onSave({
                            id: row.id,
                            type: row.type,
                            value: row.value_raw,
                            isPublic: !row.is_public,
                          });
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {row.is_public ? "Tắt công khai" : "Bật công khai"}
                    </button>
                    <button
                      type="button"
                      className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--danger"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onDelete(row.id);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Xoá
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div className="tl-shop-card" style={{ marginTop: 14 }}>
          <Field id="contact-type" label="Loại kênh">
            <select
              id="contact-type"
              className="tl-shop-select"
              value={type}
              onChange={(e) => setType(e.target.value as ShopContactType)}
            >
              {CHANNEL_TYPES.map((t) => (
                <option key={t} value={t}>{CHANNEL_LABEL[t]}</option>
              ))}
            </select>
          </Field>

          <Field
            id="contact-value"
            label={CHANNEL_LABEL[type]}
            error={error ?? (preview && !preview.ok ? preview.error : undefined)}
            hint={CHANNEL_PLACEHOLDER[type]}
          >
            <input
              id="contact-value"
              className="tl-shop-input"
              value={value}
              placeholder={CHANNEL_PLACEHOLDER[type]}
              aria-invalid={!!(preview && !preview.ok)}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
          </Field>

          {preview?.ok && (
            <p className="tl-shop-hint">
              Xem trước — người mua sẽ mở: <code>{preview.normalized}</code>. Đây chỉ là xem
              trước; trang shop công khai chưa mở.
            </p>
          )}

          <label className="tl-shop-check">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>Cho phép hiện kênh này ra ngoài (vẫn cần quản trị viên duyệt)</span>
          </label>

          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--primary"
            disabled={busy || !preview?.ok}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSave({ type, value, isPublic });
                setValue("");
              } catch (e) {
                setError(shopErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus size={16} aria-hidden="true" /> Thêm kênh
          </button>
        </div>
      )}
    </section>
  );
}
