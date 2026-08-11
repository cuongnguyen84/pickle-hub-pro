// ============================================================================
// Media editing UI (P2a step 6) — product photos, variant photo assignment,
// shop logo and cover.
// ----------------------------------------------------------------------------
// One lazily-loaded chunk for all three, because they are the same machine
// with different targets: pick files, re-encode in the browser, upload the
// original and the rendition, finalize. A seller who never opens the media
// section never downloads any of it.
//
// Previews of unpublished photos come from short-lived signed URLs held in
// memory for the life of the screen. Nothing signed is written to storage,
// logged, or put in a query key.
// ============================================================================

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ImageOff, Star, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { shopErrorMessage } from "@/lib/shop/errors";
import { IMAGE_LIMITS } from "@/lib/shop/imagePipeline";
import {
  PHASE_LABEL,
  isBusy,
  productMediaTarget,
  profileMediaTarget,
  useMediaUpload,
  type UploadItem,
} from "@/hooks/shop/useMediaUpload";
import {
  moveItem,
  useDeleteProductMedia,
  useDeleteProfileMedia,
  useReorderProductMedia,
  useSetCoverFocal,
  useSetVariantMedia,
  useShopProfileMedia,
} from "@/hooks/shop/useProductMedia";
import type {
  ProductMediaRow,
  ProductVariantRow,
  ShopMediaPurpose,
} from "@/integrations/supabase/shop-schema";

const DRAFT_BUCKET = "shop-product-media-draft";
const ACCEPT = IMAGE_LIMITS.inputTypes.join(",");

/** An icon has no text to widen the box, so a 44px target has to be asked for.
 *  .tl-shop-btn--sm is 36px tall by 40 wide once an icon is all it holds. */
const ICON_BUTTON = { minWidth: 44, minHeight: 44 } as const;

/**
 * Signed previews, in memory only.
 *
 * The draft bucket is private, so a preview needs a signed URL. They live five
 * minutes, are never persisted, and are re-minted when the media list changes.
 */
function useSignedPreviews(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join("|");

  useEffect(() => {
    let cancelled = false;
    if (!paths.length) {
      setUrls({});
      return;
    }
    void supabase.storage
      .from(DRAFT_BUCKET)
      .createSignedUrls(paths, 300)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, string> = {};
        for (const row of data) if (row.path && row.signedUrl) next[row.path] = row.signedUrl;
        setUrls(next);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

// ─── In-flight files ────────────────────────────────────────────────────────

const UploadCard = memo(function UploadCard({
  item,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  onRetry: (token: string) => void;
  onRemove: (token: string) => void;
}) {
  const busy = isBusy(item.phase);
  return (
    <li className="tl-shop-card" style={{ display: "flex", gap: 10, marginBottom: 8 }}>
      <span style={{ width: 52, flex: "none" }}>
        {item.previewUrl ? (
          <img
            src={item.previewUrl}
            alt=""
            style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8 }}
          />
        ) : (
          <span className="tl-shop-media" aria-hidden="true" />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, wordBreak: "break-word" }}>{item.name}</p>
        {/* Phase, not a percentage. supabase-js reports no byte progress, and a
            percentage driven by a timer is a lie the seller finds out about. */}
        <p className="tl-shop-hint" style={{ marginTop: 2 }} role="status" aria-live="polite">
          {PHASE_LABEL[item.phase]}
          {busy && "…"}
        </p>
        {item.error && (
          <p className="tl-shop-error" role="alert">
            {item.error}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {item.phase === "failed" && (
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--sm"
              onClick={() => onRetry(item.token)}
            >
              Thử lại
            </button>
          )}
          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
            onClick={() => onRemove(item.token)}
          >
            <X size={14} aria-hidden="true" /> {busy ? "Huỷ" : "Bỏ"}
          </button>
        </div>
      </div>
    </li>
  );
});

function UploadList({
  items,
  onRetry,
  onRemove,
}: {
  items: UploadItem[];
  onRetry: (token: string) => void;
  onRemove: (token: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
      {items.map((item) => (
        <UploadCard key={item.token} item={item} onRetry={onRetry} onRemove={onRemove} />
      ))}
    </ul>
  );
}

function PickFiles({
  id,
  label,
  multiple,
  disabled,
  onPick,
}: {
  id: string;
  label: string;
  multiple: boolean;
  disabled: boolean;
  onPick: (files: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* A real file input, labelled — not a div with a click handler, which a
          keyboard cannot reach and a screen reader cannot name. */}
      <input
        ref={ref}
        id={id}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        disabled={disabled}
        className="tl-shop-sr"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onPick(files);
          // Reset so choosing the same file twice still fires.
          e.target.value = "";
        }}
      />
      <label htmlFor={id} className="tl-shop-btn" style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
        <Upload size={16} aria-hidden="true" /> {label}
      </label>
    </>
  );
}

// ─── Product media ──────────────────────────────────────────────────────────

export function ProductMediaSection({
  productId,
  productVersion,
  media,
  variants,
  optionLabel,
  disabled,
  onChanged,
}: {
  productId: string;
  productVersion: number;
  media: ProductMediaRow[];
  variants: ProductVariantRow[];
  optionLabel: (variant: ProductVariantRow) => string;
  disabled: boolean;
  onChanged: () => void;
}) {
  const upload = useMediaUpload(productMediaTarget(productId, onChanged));
  const reorder = useReorderProductMedia(productId);
  const remove = useDeleteProductMedia(productId);
  const setVariantMedia = useSetVariantMedia(productId);
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(() => [...media].sort((a, b) => a.position - b.position), [media]);
  const previews = useSignedPreviews(
    useMemo(() => ordered.map((m) => m.rendition_source_path ?? m.draft_path), [ordered]),
  );

  // Once a file's server row is on screen, its local card is noise.
  useEffect(() => {
    if (upload.items.some((i) => i.phase === "complete")) upload.clearComplete();
  }, [media, upload]);

  const applyOrder = async (ids: string[]) => {
    setError(null);
    try {
      await reorder.mutateAsync({ expectedVersion: productVersion, mediaIds: ids });
    } catch (e) {
      setError(shopErrorMessage(e));
    }
  };

  const move = (from: number, to: number) => {
    const next = moveItem(ordered, from, to);
    if (next !== ordered) void applyOrder(next.map((m) => m.id));
  };

  const full = ordered.length >= IMAGE_LIMITS.maxPerProduct;

  return (
    <section aria-labelledby="sec-media">
      <h2 id="sec-media" className="tl-shop-h2">
        Ảnh sản phẩm
      </h2>
      <p className="tl-shop-hint" style={{ marginTop: -4 }}>
        Tối đa {IMAGE_LIMITS.maxPerProduct} ảnh, mỗi ảnh dưới{" "}
        {IMAGE_LIMITS.maxInputBytes / 1048576} MB. JPG, PNG hoặc WebP. Ảnh được nén ngay trên máy
        anh/chị trước khi gửi đi, và thông tin vị trí trong ảnh không được gửi lên.
      </p>
      <p className="tl-shop-hint">
        Ảnh đầu tiên là <strong>ảnh chính</strong> — đây là ảnh người mua thấy trước. Cần ít nhất
        một ảnh mới gửi duyệt được.
      </p>

      {!disabled && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <PickFiles
            id="pick-product-media"
            label={ordered.length ? "Thêm ảnh" : "Chọn ảnh"}
            multiple
            disabled={full}
            onPick={upload.add}
          />
          {full && (
            <span className="tl-shop-hint" style={{ marginTop: 0 }}>
              Đã đủ {IMAGE_LIMITS.maxPerProduct} ảnh. Xoá bớt để thêm ảnh khác.
            </span>
          )}
        </div>
      )}

      <UploadList items={upload.items} onRetry={upload.retry} onRemove={upload.remove} />

      {error && (
        <div className="tl-shop-notice tl-shop-notice--danger" role="alert" style={{ marginTop: 10 }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {ordered.length === 0 ? (
        <p className="tl-shop-hint">Chưa có ảnh nào.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: "12px 0 0",
            padding: 0,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          }}
        >
          {ordered.map((row, index) => (
            <li key={row.id} className="tl-shop-card">
              {previews[row.rendition_source_path ?? row.draft_path] ? (
                <img
                  src={previews[row.rendition_source_path ?? row.draft_path]}
                  alt={row.alt_text ?? row.original_filename ?? `Ảnh ${index + 1}`}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }}
                />
              ) : (
                <span className="tl-shop-media" aria-hidden="true" style={{ display: "block" }} />
              )}

              <p className="tl-shop-hint" style={{ marginTop: 6 }}>
                {index === 0 ? (
                  <span className="tl-shop-pill tl-shop-pill--ok">
                    <Star size={12} aria-hidden="true" /> Ảnh chính
                  </span>
                ) : (
                  `Ảnh ${index + 1}`
                )}
                {!row.verified_at && (
                  <span className="tl-shop-pill tl-shop-pill--warn" style={{ marginLeft: 6 }}>
                    Chưa xác minh
                  </span>
                )}
              </p>

              {!disabled && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {/* Buttons, not drag-only. A phone cannot drag reliably and a
                      keyboard cannot drag at all. */}
                  <button
                    type="button"
                    className="tl-shop-btn tl-shop-btn--sm"
                    style={ICON_BUTTON}
                    disabled={index === 0 || reorder.isPending}
                    aria-label={`Chuyển ảnh ${index + 1} lên trước`}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="tl-shop-btn tl-shop-btn--sm"
                    style={ICON_BUTTON}
                    disabled={index === ordered.length - 1 || reorder.isPending}
                    aria-label={`Chuyển ảnh ${index + 1} xuống sau`}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                  {index !== 0 && (
                    <button
                      type="button"
                      className="tl-shop-btn tl-shop-btn--sm"
                      disabled={reorder.isPending}
                      aria-label={`Đặt ảnh ${index + 1} làm ảnh chính`}
                      onClick={() => move(index, 0)}
                    >
                      <Star size={14} aria-hidden="true" /> Ảnh chính
                    </button>
                  )}
                  <button
                    type="button"
                    className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--danger"
                    style={ICON_BUTTON}
                    disabled={remove.isPending}
                    aria-label={`Xoá ảnh ${index + 1}`}
                    onClick={async () => {
                      setError(null);
                      try {
                        await remove.mutateAsync(row.id);
                      } catch (e) {
                        setError(shopErrorMessage(e));
                      }
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── Variant photo assignment ──────────────────────────────────────── */}
      {ordered.length > 0 && variants.length > 1 && (
        <div style={{ marginTop: 18 }}>
          <h3 className="tl-shop-h2" style={{ fontSize: 15 }}>
            Ảnh cho từng phiên bản
          </h3>
          <p className="tl-shop-hint" style={{ marginTop: -4 }}>
            Chọn ảnh tương ứng với từng màu/kích cỡ. Bỏ trống thì dùng ảnh chính.
          </p>
          {variants.map((variant) => (
            <div key={variant.id} className="tl-shop-field">
              <label className="tl-shop-label" htmlFor={`vm-${variant.id}`}>
                {optionLabel(variant)}
              </label>
              <select
                id={`vm-${variant.id}`}
                className="tl-shop-select"
                disabled={disabled || setVariantMedia.isPending}
                value={variant.media_id ?? ""}
                onChange={async (e) => {
                  setError(null);
                  try {
                    await setVariantMedia.mutateAsync({
                      variantId: variant.id,
                      mediaId: e.target.value || null,
                    });
                  } catch (err) {
                    setError(shopErrorMessage(err));
                  }
                }}
              >
                <option value="">Dùng ảnh chính</option>
                {ordered.map((row, index) => (
                  <option key={row.id} value={row.id}>
                    {index === 0 ? "Ảnh chính" : `Ảnh ${index + 1}`}
                    {row.original_filename ? ` — ${row.original_filename}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Shop logo and cover ────────────────────────────────────────────────────

function ProfileSlot({
  shopId,
  purpose,
  disabled,
  onChanged,
}: {
  shopId: string;
  purpose: ShopMediaPurpose;
  disabled: boolean;
  onChanged: () => void;
}) {
  const profile = useShopProfileMedia(shopId);
  const upload = useMediaUpload(profileMediaTarget(shopId, purpose, onChanged));
  const remove = useDeleteProfileMedia(shopId);
  const setFocal = useSetCoverFocal(shopId);
  const [error, setError] = useState<string | null>(null);

  const row = (profile.data ?? []).find((m) => m.purpose === purpose) ?? null;
  const previews = useSignedPreviews(useMemo(() => (row ? [row.rendition_source_path] : []), [row]));
  const src = row ? previews[row.rendition_source_path] : undefined;
  const isLogo = purpose === "logo";

  useEffect(() => {
    if (upload.items.some((i) => i.phase === "complete")) upload.clearComplete();
  }, [profile.data, upload]);

  return (
    <div style={{ marginBottom: 20 }}>
      <p className="tl-shop-label">{isLogo ? "Logo shop" : "Ảnh bìa"}</p>
      <p className="tl-shop-hint" style={{ marginTop: 0 }}>
        {isLogo
          ? "Ảnh vuông, hiện cạnh tên shop. Logo cũ sẽ được thay và thu hồi."
          : "Ảnh ngang, chạy hết chiều rộng đầu trang shop."}
      </p>

      {src ? (
        <div
          style={{
            width: isLogo ? 96 : "100%",
            aspectRatio: isLogo ? "1" : "3 / 1",
            borderRadius: isLogo ? 12 : 8,
            overflow: "hidden",
            border: "1px solid var(--tl-border)",
          }}
        >
          <img
            src={src}
            alt={isLogo ? "Logo shop" : "Ảnh bìa shop"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              // Framing is a number, applied at display. The stored file is
              // untouched, so re-framing later still has the whole photo.
              objectPosition: `center ${((row?.focal_y ?? 0.5) * 100).toFixed(0)}%`,
            }}
          />
        </div>
      ) : (
        <p className="tl-shop-hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ImageOff size={15} aria-hidden="true" /> Chưa có {isLogo ? "logo" : "ảnh bìa"}.
        </p>
      )}

      {row && !row.verified_at && (
        <p className="tl-shop-hint">Đang chờ xác minh — chưa hiển thị ra ngoài.</p>
      )}
      {row?.verified_at && !row.public_path && (
        <p className="tl-shop-hint">
          Đã xác minh. Ảnh sẽ hiện trên trang shop công khai khi trang đó mở.
        </p>
      )}

      {!disabled && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <PickFiles
            id={`pick-${purpose}`}
            label={row ? "Thay ảnh" : "Chọn ảnh"}
            multiple={false}
            disabled={false}
            onPick={upload.add}
          />
          {row && (
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--danger"
              disabled={remove.isPending}
              onClick={async () => {
                setError(null);
                try {
                  await remove.mutateAsync(row.id);
                } catch (e) {
                  setError(shopErrorMessage(e));
                }
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> Xoá
            </button>
          )}
        </div>
      )}

      {/* Cover framing: one slider, no crop editor. The whole decision is
          "how far down does the interesting part sit", and a drag-crop UI
          would cost more bundle than the problem is worth. */}
      {!disabled && row && !isLogo && (
        <div className="tl-shop-field" style={{ marginTop: 12 }}>
          <label className="tl-shop-label" htmlFor="cover-focal">
            Vị trí khung ảnh: {Math.round((row.focal_y ?? 0.5) * 100)}% từ trên xuống
          </label>
          <input
            id="cover-focal"
            type="range"
            min={0}
            max={100}
            step={5}
            defaultValue={Math.round((row.focal_y ?? 0.5) * 100)}
            style={{ width: "100%" }}
            onChange={(e) => {
              void setFocal.mutateAsync({
                mediaId: row.id,
                focalY: Number(e.target.value) / 100,
              });
            }}
          />
        </div>
      )}

      <UploadList items={upload.items} onRetry={upload.retry} onRemove={upload.remove} />

      {error && (
        <p className="tl-shop-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ShopProfileMediaSection({
  shopId,
  disabled,
  onChanged,
}: {
  shopId: string;
  disabled: boolean;
  onChanged: () => void;
}) {
  return (
    <section aria-labelledby="sec-shop-media">
      <h2 id="sec-shop-media" className="tl-shop-h2">
        Logo &amp; ảnh bìa
      </h2>
      <p className="tl-shop-hint" style={{ marginTop: -4 }}>
        Ảnh được nén ngay trên máy anh/chị và thông tin vị trí bị loại bỏ trước khi gửi. Trang shop
        công khai chưa mở, nên chưa ai ngoài shop nhìn thấy.
      </p>
      <ProfileSlot shopId={shopId} purpose="logo" disabled={disabled} onChanged={onChanged} />
      <ProfileSlot shopId={shopId} purpose="cover" disabled={disabled} onChanged={onChanged} />
    </section>
  );
}
