// ============================================================================
// /seller/products/new and /seller/products/:id/edit (P2a step 4).
// ----------------------------------------------------------------------------
// One component for both, because the two screens differ in three places and
// agree everywhere else. Two files would mean two copies of the autosave, the
// validation and the conflict handling, and the copy that drifts is always the
// one that stops protecting the seller.
//
// What this screen refuses to lie about:
//
//   * A new product is NOT saved to the server while you type. Autosaving a
//     create would mint a product per keystroke; the draft is kept locally and
//     restored on reload, and "Lưu nháp" is what creates it. The create carries
//     a token minted once and reused across retries, so a double tap or a
//     timeout the browser never saw the answer to returns the SAME product.
//
//   * A save that lost a race says so and keeps the seller's text. It never
//     picks a winner: the two versions are shown side by side and the seller
//     chooses. "Giữ bản của tôi" re-reads the server version first and then
//     writes on top of it, so the overwrite is deliberate and current.
//
//   * A local draft that disagrees with the server is not silently applied.
//     The screen says both exist and asks.
//
//   * Photos are step 6. There is no upload control here, real or fake, and
//     the review requirement (at least one photo) is stated rather than hidden
//     behind a disabled button.
//
// Step 5 added the variant matrix, in its own lazily-loaded chunk. Once a
// product has option groups the matrix owns price and stock, and the simple
// fields disappear — two places to edit the same number is two numbers.
// ============================================================================

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check, GitCompare, ImageOff } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { ShopScrollShell, SellerShell } from "@/components/shop/ShopShell";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import { useMyShopMembership, useShopCategories, useShopProfile } from "@/hooks/shop/useShopProfile";
import {
  useArchiveProduct,
  useCreateProduct,
  useSellerProduct,
  useUpdateProduct,
  useUpdateProductSlug,
  type ProductDraft,
} from "@/hooks/shop/useSellerProducts";
import { isConflict, shopErrorMessage } from "@/lib/shop/errors";
import {
  DRAFT_FIELD_ORDER,
  PRODUCT_STATUS_HINT,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  canArchive,
  canEditContent,
  canEditSlug,
  buildUpdatePayload,
  canUnarchive,
  validateDraft,
  vnd,
  type DraftErrors,
} from "@/lib/shop/productState";
import { useReconcileVariants } from "@/hooks/shop/useProductVariants";
import {
  useProductPreview,
  useSubmitPreflight,
  useSubmitProduct,
  useWithdrawSubmission,
  useEditAgain,
} from "@/hooks/shop/useProductSubmit";
import {
  firstProblem,
  focusTargetFor,
  groupProblems,
  problemMessage,
} from "@/lib/shop/submitProblems";
import type { VariantRow } from "@/lib/shop/variantMatrix";
import { SECTION_LABEL, type SubmitProblem } from "@/lib/shop/submitProblems";
import type { ProductRow } from "@/integrations/supabase/shop-schema";

// Its own chunk: a seller editing a simple product never downloads the matrix.
const VariantEditor = lazy(() => import("@/components/shop/VariantEditor"));
// Same chunk as the shop logo/cover editor: one upload machine, two surfaces.
const ProductMediaSection = lazy(() =>
  import("@/components/shop/MediaEditor").then((m) => ({ default: m.ProductMediaSection })),
);
// Its own chunk, fetched when the seller asks to see the product as a buyer.
const ProductPreview = lazy(() => import("@/components/shop/ProductPreview"));

type SaveState = "idle" | "saving" | "saved" | "error";

const EMPTY_DRAFT: ProductDraft = {
  title: "",
  description: "",
  category_slug: "",
  condition: "new",
  price_vnd: "",
  stock_on_hand: "",
};

/** Local draft envelope. `basedOnVersion` is what makes recovery honest: a
 *  draft written against version 4 is not a draft of version 7, and the screen
 *  has to say so rather than reapply it. */
interface StoredDraft {
  draft: ProductDraft;
  basedOnVersion: number | null;
  clientToken: string;
  savedAt: number;
}

const storageKey = (shopId: string, productId: string | null) =>
  `tph:shop:product-draft:${shopId}:${productId ?? "new"}`;

const readStored = (key: string): StoredDraft | null => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    // A corrupt or unavailable store must not take the editor down with it.
    return null;
  }
};

const writeStored = (key: string, value: StoredDraft) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode, quota — the server copy is still the real one */
  }
};

const clearStored = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

const newToken = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const sameDraft = (a: ProductDraft, b: ProductDraft) =>
  (Object.keys(EMPTY_DRAFT) as (keyof ProductDraft)[]).every((k) => a[k] === b[k]);

export default function SellerProductForm() {
  const { id } = useParams<{ id: string }>();
  const productId = id ?? null;
  const isNew = !productId;
  const navigate = useNavigate();

  const membership = useMyShopMembership();
  const shopId = membership.data?.shop_id ?? null;
  const isManager = membership.data?.role === "owner" || membership.data?.role === "manager";

  const profile = useShopProfile(shopId);
  const categories = useShopCategories();
  const product = useSellerProduct(productId);

  const create = useCreateProduct(shopId);
  const update = useUpdateProduct(productId);
  const updateSlug = useUpdateProductSlug(productId);
  const archive = useArchiveProduct();
  const reconcile = useReconcileVariants(productId);
  const preflight = useSubmitPreflight(productId, !isNew);
  const submit = useSubmitProduct(productId);
  const withdraw = useWithdrawSubmission(productId);
  const editAgain = useEditAgain(productId);
  const [showPreview, setShowPreview] = useState(false);
  const preview = useProductPreview(productId, showPreview);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Bảng phiên bản có nút lưu RIÊNG và RPC riêng (product_variants_reconcile),
  // nên nút đăng bán không lưu hộ được — nó chỉ có thể từ chối đăng. Giá của
  // một sản phẩm đã tồn tại sống trong bảng này, không phải ở ô giá đơn giản.
  const [variantsDirty, setVariantsDirty] = useState(false);
  const submitTokenRef = useRef<string>(newToken());

  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ProductDraft | null>(null);
  const [recovery, setRecovery] = useState<StoredDraft | null>(null);
  const tokenRef = useRef<string>(newToken());
  const fieldRefs = useRef<Partial<Record<keyof DraftErrors, HTMLElement | null>>>({});

  const row = product.data ?? null;
  const shopState = profile.data?.state ?? null;
  const shopBlocked = !!shopState && shopState !== "active";
  const key = shopId ? storageKey(shopId, productId) : null;

  /** The server's current answer as a form draft. */
  const serverDraft = useMemo<ProductDraft | null>(() => {
    if (!row) return null;
    const variant = row.variants[0];
    return {
      title: row.title,
      description: row.description ?? "",
      category_slug: row.category_slug ?? "",
      condition: row.condition,
      price_vnd: variant ? String(variant.price_vnd) : "",
      stock_on_hand: variant && variant.stock_on_hand !== null ? String(variant.stock_on_hand) : "",
    };
  }, [row]);

  /** True once the product carries option groups: the matrix owns price and
   *  stock from then on, and the simple fields would be a second, disagreeing
   *  place to edit the same numbers. */
  const multiVariant = (row?.option_groups?.length ?? 0) > 0;

  /** Server variants in the shape the editor works in. Retired rows are gone
   *  from this list — they keep their history but are not on the shelf. */
  const variantRows = useMemo<VariantRow[]>(
    () =>
      (row?.variants ?? []).map((v) => ({
        id: v.id,
        optionValues: v.option_values ?? {},
        priceVnd: String(v.price_vnd),
        stockOnHand: v.stock_on_hand === null ? "" : String(v.stock_on_hand),
        sku: v.sku ?? "",
      })),
    [row],
  );

  // ── Seed, and offer recovery rather than taking it ────────────────────────
  useEffect(() => {
    if (!key || draft !== null) return;

    const stored = readStored(key);

    if (isNew) {
      if (stored) {
        // Reusing the SAME token is what makes the reload safe: if the create
        // did land before the tab died, "Lưu nháp" returns that product rather
        // than making a second one.
        tokenRef.current = stored.clientToken;
        setDraft(stored.draft);
      } else {
        setDraft(EMPTY_DRAFT);
      }
      return;
    }

    if (!serverDraft) return;

    if (stored && !sameDraft(stored.draft, serverDraft)) {
      // Two candidates and no way to know which the seller wants. Show the
      // server copy, keep the local one, and ask.
      setDraft(serverDraft);
      setRecovery(stored);
    } else {
      if (stored) clearStored(key);
      setDraft(serverDraft);
    }
  }, [key, draft, isNew, serverDraft]);

  const dirty = useMemo(
    () => !!draft && !!serverDraft && !sameDraft(draft, serverDraft),
    [draft, serverDraft],
  );
  const dirtyNew = useMemo(() => !!draft && isNew && !sameDraft(draft, EMPTY_DRAFT), [draft, isNew]);

  // Persist locally on every change. This is the thing that survives a closed
  // tab, a crashed browser and a dead battery.
  useEffect(() => {
    if (!key || !draft) return;
    if (!dirty && !dirtyNew) return;
    writeStored(key, {
      draft,
      basedOnVersion: row?.version ?? null,
      clientToken: tokenRef.current,
      savedAt: Date.now(),
    });
  }, [key, draft, dirty, dirtyNew, row?.version]);

  useEffect(() => {
    if (!dirty && !dirtyNew) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, dirtyNew]);

  const setField = (field: keyof ProductDraft, value: string) => {
    setDraft((d) => ({ ...(d ?? EMPTY_DRAFT), [field]: value }));
    setSaveState("idle");
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const focusFirstError = (found: DraftErrors) => {
    const first = DRAFT_FIELD_ORDER.find((f) => found[f]);
    if (first) fieldRefs.current[first]?.focus();
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  /**
   * Trả về HÀNG ĐÃ LƯU, hoặc null nếu không lưu được.
   *
   * Trước đây trả void, và "Đăng bán" vì thế không có cách nào biết bản nháp
   * đã kịp lên máy chủ chưa — xem chỗ gọi nó ở nút đăng bán.
   */
  const save = useCallback(async (): Promise<ProductRow | null> => {
    if (!draft || !shopId) return null;
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).some((k) => found[k as keyof DraftErrors])) {
      focusFirstError(found);
      return null;
    }

    setSaveState("saving");
    setSaveError(null);
    try {
      if (isNew) {
        const created = await create.mutateAsync({ clientToken: tokenRef.current, draft });
        if (key) clearStored(key);
        setSaveState("saved");
        // Straight to the edit route: the product now has an id, and staying
        // on /new with a saved product is how a second one gets made.
        navigate(`/seller/products/${(created as ProductRow).id}/edit`, { replace: true });
        return created as ProductRow;
      }

      if (!row) {
        // Reachable: the product query can settle to null between the click and
        // here. Returning while the state still said "saving" left the button
        // disabled and the label on "Đang lưu…" with nothing in flight.
        setSaveState("error");
        setSaveError("Không tìm thấy sản phẩm. Tải lại trang giúp em.");
        return null;
      }

      // TEXT ONLY. Giá và tồn kho của một sản phẩm ĐÃ TỒN TẠI thuộc về bảng
      // phiên bản — ô giá đơn giản chỉ hiện khi TẠO MỚI, nên gửi kèm nó ở đây
      // là gửi một con số người bán không nhìn thấy và không sửa được. Đó đúng
      // là con số đã đè mất hai lần sửa giá thật ngày 18/08.
      const saved = await update.mutateAsync({
        expectedVersion: row.version,
        ...buildUpdatePayload(draft),
      });
      if (key) clearStored(key);
      setSaveState("saved");
      void preflight.refetch();
      return saved as ProductRow;
    } catch (error) {
      setSaveState("error");
      setSaveError(shopErrorMessage(error));
      if (isConflict(error) && draft) setConflict(draft);
      return null;
    }
  }, [draft, shopId, isNew, create, key, navigate, row, update, preflight]);

  const shell = (children: React.ReactNode) => (
    <ShopScrollShell>
      <DynamicMeta title={isNew ? "Thêm sản phẩm" : "Sửa sản phẩm"} noindex />
      <SellerShell active="products" title={isNew ? "Thêm sản phẩm" : "Sửa sản phẩm"}>
        <main className="tl-shop-page tl-shop-page--narrow">{children}</main>
      </SellerShell>
    </ShopScrollShell>
  );

  // Khung xương đúng hình biểu mẫu: tiêu đề, rồi bốn khối trường (thông tin,
  // ảnh, phân loại/giá, mô tả) — không phải một vòng xoay giữa màn hình.
  if (membership.isLoading || profile.isLoading || (productId && product.isLoading)) {
    return shell(
      <div aria-busy="true" aria-label="Đang tải biểu mẫu sản phẩm">
        <span className="tl-shop-sk tl-shop-sk--title" />
        <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "55%" }} />
        <span className="tl-shop-sk tl-shop-sk--card" />
        <span className="tl-shop-sk tl-shop-sk--card" />
        <span className="tl-shop-sk tl-shop-sk--card" />
        <span className="tl-shop-sk tl-shop-sk--card" />
      </div>,
    );
  }

  if (membership.isError || profile.isError || product.isError) {
    return shell(
      <ShopErrorNotice
        title="Chưa tải được sản phẩm này."
        onRetry={() => {
          void membership.refetch();
          void profile.refetch();
          void product.refetch();
        }}
      />,
    );
  }

  if (!membership.data) {
    return shell(
      <>
        <h1 className="tl-shop-h1">Chưa có shop</h1>
        <p className="tl-shop-sub">Tài khoản này chưa thuộc shop nào.</p>
      </>,
    );
  }

  if (productId && !row) {
    return shell(
      <>
        <h1 className="tl-shop-h1">Không tìm thấy sản phẩm</h1>
        <p className="tl-shop-sub">
          Sản phẩm này không còn, hoặc không thuộc shop của anh/chị.{" "}
          <Link to="/seller/products">Về danh sách sản phẩm</Link>
        </p>
      </>,
    );
  }

  const status = row?.status ?? "draft";
  // Three separate reasons the form may be read-only, and the seller is told
  // which one applies — "không sửa được" alone sends them to check their login.
  const editable = isManager && !shopBlocked && (isNew || canEditContent(status));

  return shell(
    <>
      <h1 className="tl-shop-h1" style={{ fontSize: "clamp(18px, 4.5vw, 22px)" }}>
        {isNew ? "Thêm sản phẩm" : row!.title}
      </h1>

      {!isNew && (
        <p className="tl-shop-sub" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className={`tl-shop-pill tl-shop-pill--${PRODUCT_STATUS_TONE[status]}`}>
            {PRODUCT_STATUS_LABEL[status]}
          </span>
          <span>{PRODUCT_STATUS_HINT[status]}</span>
        </p>
      )}

      {!isManager && (
        <div className="tl-shop-notice tl-shop-notice--info" role="status">
          Vai trò <strong>{membership.data.role}</strong> chỉ xem được sản phẩm. Chủ shop hoặc quản
          lý mới sửa được.
        </div>
      )}

      {shopBlocked && (
        <div className="tl-shop-notice tl-shop-notice--warn" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Shop đang ở trạng thái {shopState} nên chưa đăng hoặc sửa sản phẩm được.</span>
        </div>
      )}

      {isManager && !shopBlocked && !isNew && !canEditContent(status) && (
        <div className="tl-shop-notice tl-shop-notice--info" role="status">
          <span>
            {status === "pending_review"
              ? "Sản phẩm đang chờ duyệt nên tạm khoá sửa — quyết định của quản trị viên phải rơi vào đúng bản đã xem. Rút lại để sửa tiếp."
              : status === "archived"
                ? "Sản phẩm đã ngừng bán. Bật bán lại thì sửa tiếp được."
                : status === "approved"
                  ? "Sản phẩm đang bán nên khoá sửa. Bấm “Gỡ xuống để sửa” bên dưới — nó rời kệ trong lúc anh/chị sửa, rồi đăng lại."
                  : status === "suspended"
                    ? "Sản phẩm bị quản trị viên gỡ. Chỉ quản trị viên mở lại được, và khi mở sẽ kèm chỗ cần sửa."
                    : "Sản phẩm ở trạng thái này chưa sửa nội dung được."}
          </span>
        </div>
      )}

      {row?.applicant_note && (status === "needs_changes" || status === "rejected") && (
        <div className="tl-shop-notice tl-shop-notice--danger" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>
              {status === "needs_changes" ? "Quản trị viên yêu cầu sửa:" : "Lý do từ chối:"}
            </strong>
            <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>{row.applicant_note}</p>
            {row.requested_fields.length > 0 && (
              <p className="tl-shop-hint" style={{ marginTop: 8 }}>
                Cần sửa: {row.requested_fields.map((f) => SECTION_LABEL[f as keyof typeof SECTION_LABEL] ?? f).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {recovery && (
        <RecoveryNotice
          stored={recovery}
          onUseLocal={() => {
            setDraft(recovery.draft);
            setRecovery(null);
          }}
          onUseServer={() => {
            if (key) clearStored(key);
            if (serverDraft) setDraft(serverDraft);
            setRecovery(null);
          }}
        />
      )}

      {conflict && row && serverDraft && (
        <ConflictNotice
          mine={conflict}
          theirs={serverDraft}
          onTakeServer={() => {
            setDraft(serverDraft);
            setConflict(null);
            setSaveState("idle");
            setSaveError(null);
            if (key) clearStored(key);
          }}
          onKeepMine={async () => {
            // Re-read first, then write on top of what is actually there. The
            // overwrite is the seller's decision AND it is applied to the
            // current row, not to the stale one they were looking at.
            setConflict(null);
            await product.refetch();
            setSaveState("idle");
          }}
        />
      )}

      {/* ── 1. Category ──────────────────────────────────────────────────── */}
      <section aria-labelledby="sec-cat">
        <h2 id="sec-cat" className="tl-shop-h2">
          Ngành hàng
        </h2>
        <Field
          id="p-cat"
          label="Ngành hàng"
          error={errors.category_slug}
          hint="Người mua lọc theo ngành hàng. Bắt buộc trước khi đăng bán."
        >
          <select
            id="p-cat"
            className="tl-shop-select"
            disabled={!editable}
            value={draft?.category_slug ?? ""}
            aria-invalid={!!errors.category_slug}
            ref={(el) => (fieldRefs.current.category_slug = el)}
            onChange={(e) => setField("category_slug", e.target.value)}
          >
            <option value="">— Chưa chọn —</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name_vi}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {/* ── 2. Basics ────────────────────────────────────────────────────── */}
      <section aria-labelledby="sec-basic">
        <h2 id="sec-basic" className="tl-shop-h2">
          Thông tin cơ bản
        </h2>

        <Field
          id="p-title"
          label="Tên sản phẩm"
          error={errors.title}
          hint="Viết như anh/chị nói với khách: loại + chất liệu + điểm đáng chú ý."
        >
          <input
            id="p-title"
            className="tl-shop-input"
            maxLength={140}
            disabled={!editable}
            value={draft?.title ?? ""}
            aria-invalid={!!errors.title}
            ref={(el) => (fieldRefs.current.title = el)}
            onChange={(e) => setField("title", e.target.value)}
          />
        </Field>

        <fieldset className="tl-shop-fieldset" style={{ marginBottom: 16 }}>
          <legend className="tl-shop-label" style={{ padding: 0 }}>
            Tình trạng
          </legend>
          <div className="tl-shop-optrow">
            {(
              [
                ["new", "Mới"],
                ["used", "Đã qua sử dụng"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="tl-shop-opt"
                disabled={!editable}
                aria-pressed={draft?.condition === value}
                onClick={() => setField("condition", value)}
              >
                {label}
              </button>
            ))}
          </div>
          {draft?.condition === "used" && (
            <p className="tl-shop-hint">
              Hàng cũ nên mô tả rõ vết xước và mức mòn. Đây là lý do khiếu nại phổ biến nhất.
            </p>
          )}
        </fieldset>

        <Field id="p-desc" label="Mô tả" error={errors.description}>
          <textarea
            id="p-desc"
            className="tl-shop-textarea"
            rows={5}
            maxLength={4000}
            disabled={!editable}
            value={draft?.description ?? ""}
            aria-invalid={!!errors.description}
            ref={(el) => (fieldRefs.current.description = el)}
            onChange={(e) => setField("description", e.target.value)}
          />
        </Field>
      </section>

      {/* ── 3. Price and stock ───────────────────────────────────────────── */}
      {/* A new product is single-variant until it exists: the matrix is a
          server reconcile against a real product id, and inventing a local one
          would mean replaying it after create. Saving the draft redirects
          straight here, so the switch is one click away and nothing is lost. */}
      {isNew || multiVariant ? (
        <section aria-labelledby="sec-price">
          <h2 id="sec-price" className="tl-shop-h2">
            Giá &amp; tồn kho
          </h2>
          {isNew ? (
            <p className="tl-shop-hint" style={{ marginTop: -4 }}>
              Một giá, một mức tồn kho. Lưu nháp xong là bật được nhiều phiên bản (màu, size…).
            </p>
          ) : (
            <p className="tl-shop-hint" style={{ marginTop: -4 }}>
              Sản phẩm này có nhiều phiên bản — sửa giá và tồn kho ở bảng bên dưới.
            </p>
          )}

          {!multiVariant && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Field
                id="p-price"
                label="Giá (₫)"
                error={errors.price_vnd}
                hint={
                  draft?.price_vnd && /^[0-9]+$/.test(draft.price_vnd)
                    ? `Hiển thị: ${vnd(Number(draft.price_vnd))}`
                    : "Chỉ nhập số, không dấu chấm."
                }
              >
                <input
                  id="p-price"
                  className="tl-shop-input"
                  inputMode="numeric"
                  disabled={!editable}
                  value={draft?.price_vnd ?? ""}
                  aria-invalid={!!errors.price_vnd}
                  ref={(el) => (fieldRefs.current.price_vnd = el)}
                  onChange={(e) => setField("price_vnd", e.target.value)}
                />
              </Field>

              <Field
                id="p-stock"
                label="Hàng đang có"
                error={errors.stock_on_hand}
                hint="Bỏ trống nếu không đếm. Để 0 nghĩa là hết hàng."
              >
                <input
                  id="p-stock"
                  className="tl-shop-input"
                  inputMode="numeric"
                  placeholder="để trống nếu không đếm"
                  disabled={!editable}
                  value={draft?.stock_on_hand ?? ""}
                  aria-invalid={!!errors.stock_on_hand}
                  ref={(el) => (fieldRefs.current.stock_on_hand = el)}
                  onChange={(e) => setField("stock_on_hand", e.target.value)}
                />
              </Field>
            </div>
          )}
        </section>
      ) : null}

      {/* The matrix editor arrives in its own chunk, only for a saved product.
          A seller with a simple product never downloads it. */}
      {!isNew && row && (
        <Suspense fallback={<p className="tl-shop-hint">Đang mở bảng phiên bản…</p>}>
          <VariantEditor
            disabled={!editable}
            initialGroups={row.option_groups ?? []}
            initialRows={variantRows}
            onDirtyChange={setVariantsDirty}
            onSave={async ({ groups, rows, keepVariantId }) => {
              await reconcile.mutateAsync({
                expectedVersion: row.version,
                groups,
                rows,
                clientToken: newToken(),
                keepVariantId,
              });
              // Prices and SKUs are checklist items too.
              void preflight.refetch();
            }}
          />
        </Suspense>
      )}

      {/* ── 4. Photos ────────────────────────────────────────────────────── */}
      {isNew ? (
        <section aria-labelledby="sec-media">
          <h2 id="sec-media" className="tl-shop-h2">
            Ảnh sản phẩm
          </h2>
          <div className="tl-shop-notice tl-shop-notice--info" role="status">
            <ImageOff size={16} aria-hidden="true" />
            <div>
              <strong>Lưu nháp trước rồi thêm ảnh.</strong> Ảnh gắn với một sản phẩm đã tồn tại,
              nên bấm &ldquo;Lưu nháp&rdquo; xong là màn hình ảnh mở ra ngay ở bước tiếp theo.
              Sản phẩm cần ít nhất một ảnh mới đăng bán được.
            </div>
          </div>
        </section>
      ) : (
        <Suspense fallback={<p className="tl-shop-hint">Đang mở phần ảnh…</p>}>
          <ProductMediaSection
            productId={row!.id}
            productVersion={row!.version}
            media={row!.media}
            variants={row!.variants}
            optionLabel={(variant) =>
              Object.values(variant.option_values ?? {}).join(" · ") || "Sản phẩm"
            }
            disabled={!editable}
            onChanged={() => {
              // The checklist is derived from the server preflight, and
              // uploading a photo answers one of its items — so it has to be
              // re-asked, or the seller adds the photo it demanded and it
              // still says the photo is missing.
              void product.refetch();
              void preflight.refetch();
            }}
          />
        </Suspense>
      )}

      {editable && (
        <SaveBar
          state={saveState}
          // A conflict has its own panel, with the two choices that actually
          // resolve it. A generic Retry beside it would send the same stale
          // version again and fail identically.
          error={conflict ? null : saveError}
          dirty={isNew ? dirtyNew : dirty}
          label={isNew ? "Lưu nháp" : "Lưu thay đổi"}
          onSave={() => void save()}
          onReload={() => {
            if (key) clearStored(key);
            setDraft(null);
            setConflict(null);
            setSaveState("idle");
            void product.refetch();
          }}
        />
      )}

      {/* ── 5. URL ───────────────────────────────────────────────────────── */}
      {!isNew && (
        <SlugSection
          slug={row!.slug}
          canEdit={isManager && !shopBlocked && canEditSlug(status)}
          published={row!.is_published}
          onSubmit={async (next) => await updateSlug.mutateAsync(next)}
        />
      )}

      {/* ── 6. Stop / restart selling ────────────────────────────────────── */}
      {!isNew && isManager && !shopBlocked && (
        <ArchiveSection
          status={status}
          busy={archive.isPending}
          onArchive={async () => await archive.mutateAsync({ productId: row!.id, archived: false })}
          onUnarchive={async () => await archive.mutateAsync({ productId: row!.id, archived: true })}
        />
      )}

      {/* ── 7. Preview and submit ────────────────────────────────────────── */}
      {!isNew && (
        <section aria-labelledby="sec-submit">
          <h2 id="sec-submit" className="tl-shop-h2">
            Xem trước &amp; đăng bán
          </h2>

          {status === "pending_review" ? (
            <div className="tl-shop-notice tl-shop-notice--warn" role="status">
              <div>
                <strong>Đã gửi duyệt. Đang chờ quản trị viên xem.</strong>
                <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>
                  Anh/chị không cần làm gì thêm cho tới khi có phản hồi. Nếu muốn sửa tiếp, rút lại
                  rồi sửa — sản phẩm sẽ quay về nháp.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <Link to="/seller/products" className="tl-shop-btn tl-shop-btn--sm">
                    Về danh sách sản phẩm
                  </Link>
                  {isManager && !shopBlocked && (
                    <button
                      type="button"
                      className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
                      disabled={withdraw.isPending}
                      onClick={() => void withdraw.mutateAsync().catch(() => {})}
                    >
                      Rút lại để sửa tiếp
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : status === "approved" ? (
            /* Live. The only thing this screen can offer is the way back —
               without it, self-publishing means the seller publishes once and
               can never fix a typo. */
            <div className="tl-shop-notice tl-shop-notice--info" role="status">
              <Check size={16} aria-hidden="true" />
              <div>
                <strong>Đang bán.</strong>
                <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>
                  Người mua đang thấy sản phẩm này. Muốn sửa thì gỡ xuống đã — sản phẩm rời kệ
                  ngay, sửa xong bấm “Đăng bán” là lên lại.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <Link to="/seller/products" className="tl-shop-btn tl-shop-btn--sm">
                    Về danh sách sản phẩm
                  </Link>
                  {isManager && !shopBlocked && (
                    <button
                      type="button"
                      className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
                      disabled={editAgain.isPending}
                      onClick={() => void editAgain.mutateAsync(row?.version).catch(() => {})}
                    >
                      {editAgain.isPending ? "Đang gỡ…" : "Gỡ xuống để sửa"}
                    </button>
                  )}
                </div>
                {editAgain.isError && (
                  <p className="tl-shop-hint" role="alert" style={{ marginTop: 8 }}>
                    {shopErrorMessage(editAgain.error)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <SubmitPanel
              problems={preflight.data ?? []}
              loading={preflight.isLoading}
              canSubmit={isManager && !shopBlocked && canEditContent(status)}
              dirty={dirty}
              variantsDirty={variantsDirty}
              state={submitState}
              error={submitError}
              onGoTo={(problem) => {
                const target = focusTargetFor(problem);
                if (target.lazySection === "media" || target.lazySection === "variants") {
                  // The control lives in a lazily-mounted area. Focusing before
                  // it mounts is a no-op that reads as a broken link, so the
                  // scroll waits a frame for the chunk to render.
                  setShowPreview(false);
                }
                window.requestAnimationFrame(() => {
                  const el = document.getElementById(target.elementId) as HTMLElement | null;
                  if (!el) return;
                  el.scrollIntoView({ block: "center", behavior: "smooth" });
                  // A section heading is not focusable, so focus() on it is a
                  // no-op that reads as a broken link. tabindex -1 makes it a
                  // programmatic focus target without adding a tab stop.
                  if (!el.hasAttribute("tabindex") && !el.matches("input,select,textarea,button,a")) {
                    el.setAttribute("tabindex", "-1");
                  }
                  el.focus();
                });
              }}
              onSubmit={async () => {
                if (!row) return;
                setSubmitState("sending");
                setSubmitError(null);
                try {
                  // Sửa xong mà chưa bấm "Lưu thay đổi" thì bản nháp CHỈ nằm
                  // trong localStorage — không có autosave lên máy chủ. Trước
                  // đây nút này đăng thẳng bản trên máy chủ, tức là đăng đúng
                  // cái mà người bán vừa sửa xong và tưởng đã đổi. Người bán
                  // gỡ hàng xuống, sửa giá, bấm đăng, và sản phẩm lên lại với
                  // GIÁ CŨ, không một lời cảnh báo. Bấm "Đăng bán" nghĩa là
                  // "đăng cái tôi đang NHÌN THẤY", nên lưu trước — và nếu lưu
                  // hỏng (xung đột phiên bản, lỗi hợp lệ) thì KHÔNG đăng.
                  let version = row.version;
                  if (dirty) {
                    const saved = await save();
                    if (!saved) {
                      setSubmitState("idle");
                      return;
                    }
                    version = saved.version;
                  }
                  const result = await submit.mutateAsync({
                    expectedVersion: version,
                    clientToken: submitTokenRef.current,
                  });
                  if (result.ok) {
                    setSubmitState("sent");
                  } else {
                    // Not an error: the server handed back the whole list.
                    setSubmitState("idle");
                    await preflight.refetch();
                  }
                } catch (e) {
                  setSubmitState("error");
                  setSubmitError(shopErrorMessage(e));
                  if (isConflict(e)) await product.refetch();
                }
              }}
            />
          )}

          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="tl-shop-btn"
              aria-expanded={showPreview}
              onClick={() => setShowPreview((open) => !open)}
            >
              {showPreview ? "Đóng bản xem trước" : "Xem trước như người mua"}
            </button>
          </div>

          {showPreview && (
            <Suspense fallback={<p className="tl-shop-hint">Đang mở bản xem trước…</p>}>
              {preview.data ? (
                <div style={{ marginTop: 14 }}>
                  <ProductPreview
                    projection={preview.data}
                    editHref={`/seller/products/${row!.id}/edit`}
                  />
                </div>
              ) : (
                <p className="tl-shop-hint">Đang tải bản xem trước…</p>
              )}
            </Suspense>
          )}
        </section>
      )}

      <p style={{ marginTop: 22 }}>
        <Link to="/seller/products" className="tl-shop-btn tl-shop-btn--ghost">
          Về danh sách sản phẩm
        </Link>
      </p>
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
      <label className="tl-shop-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="tl-shop-hint">{hint}</p>}
      {/* Next to its field, not in a toast that scrolls away. */}
      {error && (
        <p className="tl-shop-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SaveBar({
  state,
  error,
  dirty,
  label,
  onSave,
  onReload,
}: {
  state: SaveState;
  error: string | null;
  dirty: boolean;
  label: string;
  onSave: () => void;
  onReload: () => void;
}) {
  return (
    <div className="tl-shop-decision-actions">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--primary"
          // Disabled in flight so a double tap cannot send it twice. The create
          // token makes that harmless anyway; this makes it impossible.
          disabled={state === "saving" || !dirty}
          onClick={onSave}
        >
          {state === "saving" ? "Đang lưu…" : label}
        </button>

        {/* One of four, never a generic tick. */}
        {state === "saved" && !dirty && (
          <span className="tl-shop-pill tl-shop-pill--ok" role="status">
            <Check size={14} aria-hidden="true" /> Đã lưu
          </span>
        )}
        {dirty && state !== "saving" && state !== "error" && (
          <span className="tl-shop-pill tl-shop-pill--warn" role="status">
            Chưa lưu
          </span>
        )}
        {state === "error" && (
          <span className="tl-shop-pill tl-shop-pill--danger" role="status">
            Chưa lưu được
          </span>
        )}
      </div>

      {state === "error" && error && (
        <div className="tl-shop-notice tl-shop-notice--danger" role="alert" style={{ marginTop: 10 }}>
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

/** A local draft that disagrees with the server. Both are offered; neither is
 *  applied on the seller's behalf. */
function RecoveryNotice({
  stored,
  onUseLocal,
  onUseServer,
}: {
  stored: StoredDraft;
  onUseLocal: () => void;
  onUseServer: () => void;
}) {
  return (
    <div className="tl-shop-notice tl-shop-notice--warn" role="status">
      <GitCompare size={16} aria-hidden="true" />
      <div>
        <strong>Có một bản đang sửa dở trên máy này.</strong>
        <p style={{ margin: "6px 0 10px", lineHeight: 1.55 }}>
          Lưu lúc {new Date(stored.savedAt).toLocaleString("vi-VN")}, và khác với bản trên máy chủ.
          Anh/chị chọn dùng bản nào — không bản nào bị xoá cho tới khi chọn.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--primary" onClick={onUseLocal}>
            Dùng bản đang sửa dở
          </button>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={onUseServer}>
            Dùng bản trên máy chủ
          </button>
        </div>
      </div>
    </div>
  );
}

/** The save that lost a race. Shows what differs and lets the seller decide;
 *  the primary action is the non-destructive one. */
function ConflictNotice({
  mine,
  theirs,
  onTakeServer,
  onKeepMine,
}: {
  mine: ProductDraft;
  theirs: ProductDraft;
  onTakeServer: () => void;
  onKeepMine: () => void | Promise<void>;
}) {
  const differing = (Object.keys(mine) as (keyof ProductDraft)[]).filter((k) => mine[k] !== theirs[k]);
  const LABEL: Record<keyof ProductDraft, string> = {
    title: "Tên",
    description: "Mô tả",
    category_slug: "Ngành hàng",
    condition: "Tình trạng",
    price_vnd: "Giá",
    stock_on_hand: "Hàng đang có",
  };
  const short = (value: string) => (value.length > 60 ? `${value.slice(0, 60)}…` : value || "(trống)");

  return (
    <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
      <GitCompare size={16} aria-hidden="true" />
      <div style={{ width: "100%" }}>
        <strong>Sản phẩm này vừa được sửa ở nơi khác.</strong>
        <p style={{ margin: "6px 0 12px", lineHeight: 1.55 }}>
          Một phiên đăng nhập khác đã lưu bản mới hơn. Nội dung anh/chị vừa gõ{" "}
          <strong>không bị mất</strong> — xem khác nhau chỗ nào rồi quyết định.
        </p>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            marginBottom: 12,
          }}
        >
          <div className="tl-shop-card">
            <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Bản trên máy chủ
            </p>
            {differing.map((k) => (
              <div key={k} style={{ fontSize: 13.5 }}>
                {LABEL[k]}: {short(theirs[k])}
              </div>
            ))}
          </div>
          <div className="tl-shop-card" style={{ borderColor: "var(--tl-green)" }}>
            <p className="tl-shop-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Bản anh/chị đang sửa
            </p>
            {differing.map((k) => (
              <div key={k} style={{ fontSize: 13.5 }}>
                {LABEL[k]}: {short(mine[k])}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="tl-shop-btn tl-shop-btn--primary" onClick={onTakeServer}>
            Dùng bản trên máy chủ
          </button>
          <button type="button" className="tl-shop-btn tl-shop-btn--danger" onClick={() => void onKeepMine()}>
            Giữ bản của tôi rồi lưu lại
          </button>
        </div>
      </div>
    </div>
  );
}

function SlugSection({
  slug,
  canEdit,
  published,
  onSubmit,
}: {
  slug: string;
  canEdit: boolean;
  published: boolean;
  onSubmit: (next: string) => Promise<string>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValue(slug), [slug]);

  return (
    <section aria-labelledby="sec-slug">
      <h2 id="sec-slug" className="tl-shop-h2">
        Đường dẫn sản phẩm
      </h2>
      <p className="tl-shop-hint">
        Địa chỉ trang sản phẩm: <code>/shop/product/{slug}</code>. Đổi tên sản phẩm không đổi đường
        dẫn — đường dẫn chỉ đổi khi anh/chị bấm đổi ở đây.
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
              {published
                ? "Sản phẩm này đang bán, nên đường dẫn cũ có thể đã được gửi cho người mua. Ai giữ liên kết cũ sẽ không mở được nữa — hệ thống chưa có chuyển hướng tự động."
                : "Sản phẩm chưa từng lên trang mua hàng nên đổi lúc này gần như không ảnh hưởng ai. Sau khi bán thì đổi sẽ làm hỏng liên kết cũ, vì chưa có chuyển hướng tự động."}
            </span>
          </div>
          <Field id="p-slug" label="Đường dẫn mới" error={error ?? undefined}>
            <input
              id="p-slug"
              className="tl-shop-input"
              value={value}
              aria-invalid={!!error}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
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

function ArchiveSection({
  status,
  busy,
  onArchive,
  onUnarchive,
}: {
  status: ProductRow["status"];
  busy: boolean;
  onArchive: () => Promise<unknown>;
  onUnarchive: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      setConfirming(false);
    } catch (e) {
      setError(shopErrorMessage(e));
    }
  };

  if (canUnarchive(status)) {
    return (
      <section aria-labelledby="sec-archive">
        <h2 id="sec-archive" className="tl-shop-h2">
          Bán lại
        </h2>
        <p className="tl-shop-hint">
          Sản phẩm đang ngừng bán. Bật lại sẽ đưa nó về trạng thái nháp — không quay lại &ldquo;đã
          duyệt&rdquo;, vì lần duyệt cũ nói về sản phẩm lúc đó.
        </p>
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--primary"
          disabled={busy}
          onClick={() => void run(onUnarchive)}
        >
          {busy ? "Đang bật lại…" : "Bán lại sản phẩm này"}
        </button>
        {error && (
          <p className="tl-shop-error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  if (!canArchive(status)) return null;

  return (
    <section aria-labelledby="sec-archive">
      <h2 id="sec-archive" className="tl-shop-h2">
        Ngừng bán
      </h2>
      {!confirming ? (
        <button type="button" className="tl-shop-btn tl-shop-btn--danger" onClick={() => setConfirming(true)}>
          Ngừng bán sản phẩm này
        </button>
      ) : (
        <div className="tl-shop-notice tl-shop-notice--danger">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>Ngừng bán sẽ làm những việc sau:</strong>
            <ul style={{ margin: "8px 0", paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Gỡ sản phẩm khỏi trang mua hàng và khỏi tìm kiếm ngay lập tức.</li>
              <li>Thu lại ảnh công khai — người ngoài không mở được ảnh nữa.</li>
              <li>Không xoá dữ liệu: bật bán lại được bất cứ lúc nào, và về trạng thái nháp.</li>
            </ul>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="tl-shop-btn tl-shop-btn--danger"
                disabled={busy}
                onClick={() => void run(onArchive)}
              >
                {busy ? "Đang ngừng…" : "Vẫn ngừng bán"}
              </button>
              <button type="button" className="tl-shop-btn" onClick={() => setConfirming(false)}>
                Huỷ
              </button>
            </div>
            {error && (
              <p className="tl-shop-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * The checklist and the submit button.
 *
 * The list is the SERVER's preflight, not a client re-derivation: the screen
 * cannot offer a submit the server is about to refuse, and cannot refuse one
 * the server would have taken. Each line links to the thing to fix.
 */
function SubmitPanel({
  problems,
  loading,
  canSubmit,
  dirty,
  variantsDirty,
  state,
  error,
  onGoTo,
  onSubmit,
}: {
  problems: SubmitProblem[];
  loading: boolean;
  canSubmit: boolean;
  /** Ô thường còn thay đổi chưa lưu. Nút sẽ lưu trước rồi mới đăng. */
  dirty: boolean;
  /** Bảng phiên bản còn thay đổi chưa lưu. Nút KHÔNG lưu hộ được — bảng có
   *  RPC riêng — nên nó chặn và chỉ chỗ. */
  variantsDirty: boolean;
  state: "idle" | "sending" | "sent" | "error";
  error: string | null;
  onGoTo: (problem: SubmitProblem) => void;
  onSubmit: () => void | Promise<void>;
}) {
  if (state === "sent") {
    return (
      <div className="tl-shop-notice tl-shop-notice--info" role="status">
        <Check size={16} aria-hidden="true" />
        <div>
          <strong>Đã đăng bán.</strong>
          <p style={{ margin: "6px 0 0", lineHeight: 1.55 }}>
            Sản phẩm đang hiển thị cho người mua. Muốn sửa thì mở lại sản phẩm và bấm
            “Gỡ xuống để sửa” — nó rời kệ trong lúc anh/chị sửa, rồi đăng lại.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link to="/seller/products" className="tl-shop-btn tl-shop-btn--sm">
              Về danh sách sản phẩm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <p className="tl-shop-hint">Đang kiểm tra…</p>;

  const groups = groupProblems(problems);
  const ready = problems.length === 0;

  return (
    <>
      {ready ? (
        variantsDirty ? (
          <div className="tl-shop-notice tl-shop-notice--warn" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              Bảng phiên bản còn thay đổi chưa lưu — bấm <strong>“Lưu bảng phiên bản”</strong> ở
              trên trước. Đăng bây giờ là đăng đúng giá cũ.
            </span>
          </div>
        ) : (
          <p className="tl-shop-hint">
            {dirty
              ? "Còn thay đổi chưa lưu. Bấm nút dưới sẽ lưu trước rồi mới đăng — không đăng bản cũ."
              : "Đủ điều kiện đăng bán. Bấm là sản phẩm hiển thị ngay cho người mua — không qua bước duyệt nào. Muốn sửa sau đó thì gỡ nó xuống, sửa, rồi đăng lại."}
          </p>
        )
      ) : (
        <div className="tl-shop-notice tl-shop-notice--warn" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <div style={{ width: "100%" }}>
            <strong>Còn {problems.length} chỗ chưa xong trước khi đăng bán:</strong>
            {groups.map((group) => (
              <div key={group.section} style={{ marginTop: 8 }}>
                <p className="tl-shop-eyebrow" style={{ display: "block" }}>
                  {group.label}
                </p>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
                  {group.problems.map((problem, index) => (
                    <li key={`${problem.code}-${index}`}>
                      {problemMessage(problem)}{" "}
                      <button
                        type="button"
                        className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
                        onClick={() => onGoTo(problem)}
                      >
                        Đi tới chỗ cần sửa
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {canSubmit && (
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--primary"
          // Disabled in flight so a double tap cannot send it twice. The client
          // token makes that harmless anyway; this makes it impossible.
          //
          // `variantsDirty` chặn hẳn, không lưu hộ: bảng phiên bản đi qua
          // product_variants_reconcile với quyết định riêng của nó
          // (keepVariantId khi thu từ nhiều về một), và một nút đăng bán tự
          // quyết hộ chuyện đó là một nút vứt SKU của người khác.
          disabled={!ready || variantsDirty || state === "sending"}
          onClick={() => {
            const first = firstProblem(problems);
            if (first) onGoTo(first);
            else void onSubmit();
          }}
        >
          {state === "sending" ? "Đang đăng…" : dirty ? "Lưu và đăng bán" : "Đăng bán"}
        </button>
      )}

      {state === "error" && error && (
        <div className="tl-shop-notice tl-shop-notice--danger" role="alert" style={{ marginTop: 10 }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => void onSubmit()}>
            Thử lại
          </button>
        </div>
      )}
    </>
  );
}
