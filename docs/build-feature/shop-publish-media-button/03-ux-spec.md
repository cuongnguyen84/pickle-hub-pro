# 03 — UX spec (ux-designer)

Phạm vi: khối profile media trong `src/components/shop/MediaEditor.tsx` (`ProfileSlot`, `:410-515`). Genre bề mặt shop: **modern-minimal**, token thật ở `src/styles/shop.css` (`--tl-*` + `--shop-*`).

## 0. Audit punch list

**Critical**
1. **Nhánh loại trừ nuốt mất lối thoát** — `:489-513`: `publish.isPending ? <p> : <>nút + lỗi</>`. Pending thì **không nút, không huỷ, không giới hạn thời gian**. Fix: một nút luôn render, `disabled` khi pending, đổi nhãn; `invoke` có `timeout`.
2. **Ba tên cho một hành động** — comment `:424-426` "Thử lại", dòng lỗi `:500` "Bấm thử lại", nhãn nút `:509` "Đưa lên trang shop". Fix: chốt **"Thử lại"** cả ba chỗ.
3. **Không có trạng thái `success`** — publish xong thì khối `:487-515` biến mất im lặng, seller không có bằng chứng việc đã xong. Fix: pill `tl-shop-pill--ok` "Đã lên trang shop" trong phiên.

**Major**
4. **Lỗi nói quy trình nội bộ, không nói hậu quả** — `:495-497`, `:500`. Fix: "Trang shop hiện chưa có logo."
5. **Lỗi bị nuốt hoàn toàn** — `useProductMedia.ts:115,121` ném error thô; UI `:498-502` hiển thị **một chuỗi cứng cho mọi loại lỗi**; câu tiếng Việt chuẩn của server (`20260817090000:56-59`) bị vứt.
6. **Từ vựng lệch trong cùng một khối** — "công khai" (`:491,496`), "ra ngoài" (`:485`), "trang shop" (`:509`), "trang shop công khai" (`:599`). Fix: chỉ dùng **"trang shop"**.
7. **Auto-publish không biết trạng thái shop** — `:427-432` bắn publish sau mọi upload; `prepare` từ chối mọi shop ≠ `active` ⇒ seller `pending_activation` rơi vào vòng lặp bấm-lỗi.

**Minor**
8. **Focus ring của input file không nhìn thấy** — `PickFiles :148-165`: input bị `clip` (`shop.css:373`), label không có `:focus-within`.
9. **Thiếu `:active`** cho `.tl-shop-btn` (`shop.css:209-242` chỉ có hover + disabled) — trên iPhone không có hover, `:active` là phản hồi chạm duy nhất.

`3 critical · 4 major · 2 minor`

## 1. User flow

Chủ shop mở `/seller/settings` → `<details>` "Logo & ảnh bìa" → **Chọn ảnh** → nén + tải lên → `finalize` đặt `verified_at` → **hệ thống tự đưa ảnh lên trang shop, seller không bấm gì**.

Ba nhánh rẽ:
- **Shop chưa `active`** → **không** thử publish (mới). Seller thấy dòng nói ảnh đã lưu, sẽ tự hiện khi shop được kích hoạt. **Không nút** — bấm chỉ nhận 403.
- **Publish lỗi** → 2 dòng (câu hành động được theo 5 nhóm + dòng mờ `Mã lỗi: …`) + nút **Thử lại** bấm được ngay.
- **Quá 20 giây** → mutation tự thành lỗi nhóm "mạng", nút **Thử lại** sống lại. Không trạng thái nào treo quá 20s.

## 2. Bảng trạng thái → UI → copy

Áp cho **mỗi** `ProfileSlot` (logo/bìa dùng chung bộ, chỉ khác chữ).

| # | Điều kiện | Hiển thị | Nút | Copy |
|---|---|---|---|---|
| S0 | `row == null`, không upload | icon `ImageOff` + hint | **Chọn ảnh** | `Chưa có logo.` / `Chưa có ảnh bìa.` |
| S1 | `upload.items` đang chạy | `UploadCard` sẵn có (`PHASE_LABEL`), khối publish ẩn | **Huỷ** (sẵn có) | giữ `PHASE_LABEL` |
| S2 | `row && !row.verified_at` | 1 dòng hint | không | `Đang kiểm tra ảnh — chưa hiện trên trang shop.` |
| S3 | `row.verified_at && !row.public_path && shopState !== "active"` | 1 dòng hint, **không nút** | không | C3a / C3b |
| S4 | `publish.isPending` | dòng `role="status"` + nút disabled | **Đang đưa lên trang shop…** (disabled) | C4 |
| S5 | `publish.isError` | 2 dòng (lỗi + mã) + nút | **Thử lại** | C5-1…C5-5 + C6 |
| S6 | `publish.isSuccess && row.public_path` | pill xanh, tự ẩn ở render sau | không | `Đã lên trang shop` |
| S7 | `disabled` (vai trò chỉ xem) | dòng trạng thái vẫn hiện | không nút | không chuỗi mới |

### 8 trạng thái của nút publish

| Trạng thái | Thể hiện | Nguồn |
|---|---|---|
| default | `.tl-shop-btn .tl-shop-btn--sm`, nền `--tl-surface-2`, cao 44px | `shop.css:209-242` + `:1183` |
| hover | nền `--tl-border` | `shop.css:227` (có sẵn) |
| focus-visible | outline 2px `--tl-green`, offset 2px | `shop.css:245-249` (có sẵn) |
| active | `transform: translateY(1px)` | **thiếu** — thêm 1 dòng CSS |
| disabled | `opacity .45` + `not-allowed` — chỉ cho S4 | `shop.css:241` |
| loading | chính nút đó: `disabled` + nhãn `Đang đưa lên trang shop…`. **Không spinner, không %** | mới |
| error | nút bật lại, nhãn `Thử lại`, `aria-describedby` trỏ dòng lỗi | mới |
| success | nút unmount, pill `Đã lên trang shop` thế chỗ | mới |

## 3. Component — tái dùng, không tạo mới

Dùng lại `.tl-shop-btn--sm`, `.tl-shop-hint`, `.tl-shop-error`, `.tl-shop-pill--ok`, `<code>` trần trong `.tl-shop-hint` (pattern đã dùng ở `SellerShopSettings.tsx:486,616`). Không thêm icon/animation, không đụng layout card-first #603.

Thay đổi theo file:dòng:
- **`MediaEditor.tsx:410-420`** — `ProfileSlot` nhận thêm prop `shopState: ShopState`.
- **`:427-432`** — auto-publish chỉ chạy khi `shopState === "active"`.
- **`:484-486`** — đổi copy S2 (từ vựng "trang shop").
- **`:487-515`** — thay toàn bộ nhánh loại trừ bằng: dòng trạng thái (S3/S4/S5) + **một** nút luôn render khi `shopState === "active" && !disabled`, `disabled={publish.isPending}`, nhãn đổi theo pending. Thêm `reportCaughtError(e, "shop:publish_profile")` trong `onError`.
- **`:583-604`** — `ShopProfileMediaSection` nhận `shopState`, truyền xuống hai `ProfileSlot`.
- **`SellerShopSettings.tsx:335-339`** — truyền `shopState={row.state}` (đã có sẵn, không cần query mới).
- **`src/lib/shop/errors.ts`** — thêm `edgeErrorMessage(error, response)`: đọc body, rút `error` / `failed[0].error` + status, cho qua `shopErrorMessage`; trả `{ message, code }`. `code` ≤ **80 ký tự**, format `"<status> · <mã>"`, cắt `…` nếu dài hơn.
- **`useProductMedia.ts:104-128`** — destructure thêm `response`, ném `edgeErrorMessage(error, response)`, truyền `{ timeout: 20000 }` cho `invoke` (SDK 2.89 có sẵn). 20s < 30s ⇒ ràng buộc "không treo quá 30s" được bảo đảm **bằng code**, không bằng lời hứa.
- **`src/styles/shop.css`** — 2 dòng (mục 5).

## 4. Copy chốt (chép thẳng — VI-only có chủ đích)

**Trạng thái**
- `C2` — `Đang kiểm tra ảnh — chưa hiện trên trang shop.`
- `C3a` (`pending_activation`) — `Ảnh đã lưu. Shop được kích hoạt xong là ảnh tự lên trang shop, anh/chị không phải làm gì thêm.`
- `C3b` (`restricted`/`suspended`/`closed`) — `Ảnh đã lưu. Shop đang ở trạng thái "{SHOP_STATE_LABEL[state]}" nên chưa đưa ảnh lên trang shop được.`
- `C4` — `Đang đưa ảnh lên trang shop…`
- `C6-success` (pill) — `Đã lên trang shop`

**Câu trạng thái mới thay `:495-497`** (nói hậu quả)
- `C-status-logo` — `Trang shop hiện chưa có logo. Ảnh đã lưu trên hệ thống, lần đưa lên trước chưa xong.`
- `C-status-cover` — `Trang shop hiện chưa có ảnh bìa. Ảnh đã lưu trên hệ thống, lần đưa lên trước chưa xong.`

**Nhãn nút**
- default/error: `Thử lại` — `aria-label="Thử đưa logo lên trang shop lại"` / `"Thử đưa ảnh bìa lên trang shop lại"`
- loading: `Đang đưa lên trang shop…`

**5 nhóm lỗi — dòng 1 (`.tl-shop-error`)**
- `C5-1` shop chưa kích hoạt / tạm ngưng (403): `{câu tiếng Việt nguyên văn của server} Ảnh đã lưu rồi, kích hoạt shop xong bấm lại là hiện.`
- `C5-2` hết phiên: `Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi bấm Thử lại giúp em.`
- `C5-3` không gửi được / quá 20s: `Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Thử lại.`
- `C5-4` ảnh máy chủ không nhận (422 `rendition_*`): `Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác.`
- `C5-5` còn lại (409/502/không rõ): `Lỗi từ phía hệ thống, không phải do ảnh của anh/chị. Em đã nhận được báo lỗi rồi, bấm Thử lại sau vài phút.`

**Dòng 2 (`.tl-shop-hint`)**
- `C6` — `Mã lỗi: <code>{code}</code>` + `Chụp màn hình dòng này gửi cho ThePickleHub nếu bấm mấy lần vẫn lỗi.`
  Kênh gửi cụ thể (Zalo/số nào) **cần Cuong xác nhận** — không bịa vào copy.

## 5. Responsive & accessibility

Layout hai dòng lỗi — xếp dọc, không grid, không icon:
```
[.tl-shop-error]   12.5px / lh 1.45 / color var(--shop-danger) / margin-top 6px
[.tl-shop-hint]    12px   / lh 1.45 / color var(--tl-fg-3)     / margin-top 4px
   └─ <code> "Geist Mono", ui-monospace · 11.5px · var(--tl-fg-3) · wordBreak: break-word
[nút Thử lại]      margin-top 10px, min-height 44px
```
Không thêm class CSS mới (`shop.css:285-292`, `:260-265` đã có). **Cấm** bọc hai dòng trong `.tl-shop-notice--danger` — trong `ProfileSlot` mọi thông báo đang là dòng chữ trần.

**Giới hạn mã lỗi: 80 ký tự** (đã tính `"Mã lỗi: "`). Ở 320px, hint mono 11.5px ≈ 40 ký tự/dòng ⇒ tối đa 2 dòng. Dài hơn thì cắt + `…`.

**Mobile 320/375/414/768** — một cột, không grid để vỡ. Nhãn dài nhất "Đang đưa lên trang shop…" ≈ 192px ở 13px ⇒ **một dòng ở 320px**. `wordBreak: break-word` trên `<code>` chặn tràn ngang.

**A11y**
- Vùng bấm `.tl-shop-btn--sm` đã 44px (`shop.css:1183`) — đừng override chiều cao.
- S4 giữ `role="status"`; S5 giữ `role="alert"` và **thêm `id`** để nút trỏ `aria-describedby`.
- Nút loading dùng `disabled` thật (không `aria-disabled` giả) vì 20s là tự thoát.
- Thêm vào `src/styles/shop.css`:
  `.tl-shop-btn:active:not(:disabled) { transform: translateY(1px); }`
  `.tl-shop-sr:focus-visible + label { outline: 2px solid var(--tl-green); outline-offset: 2px; }`
- Màu dùng `--shop-danger` và `--tl-fg-3` có sẵn (đã qua retune AA ở `aed296ab`), không đặt màu mới.

## Không làm

Badge thường trực "đang/chưa hiển thị", link "Xem trang shop của tôi", confirm trước khi thay ảnh — backlog. Không thêm component/icon/animation/dependency, không đổi layout card-first #603, không thêm chuỗi tiếng Anh.
