# 03 — UX Spec: Shop UI Polish

Nguồn thật: token The Line trong `src/styles/the-line.css` + semantic tokens `--shop-*` đầu `src/styles/shop.css`. Không token gốc mới, không màu raw (gate cấm hex dưới token block). Genre: editorial/modern-minimal — polish bằng **phân cấp và nhịp**, không thêm trang trí. Viewport nghiệm thu: iPhone ~390px, kiểm thêm 320px (ràng buộc B01).

## 0. Hallmark audit — punch list (đọc code thật)

**Critical**
1. **Uniform-box monotony** — `SellLanding.tsx:87-128`: 4 section liên tiếp đều là `tl-shop-notice` xám cùng cỡ, cùng nhịp "h2 + hộp". Chính là cái PO chê "6 khối xám". Fix: mục 4, giữ nguyên lời.
2. **Dashboard-that-isn't** — `SellerHome.tsx:63-118`: màn "Tổng quan" không có một con số; hành động giá trị nhất (khoe link shop) chôn thành inline link giữa câu notice. Fix: mục 3.

**Major**
3. **Placeholder-as-production** — `SellerProducts.tsx:407-415` (`Thumb`): danh mục bán hàng render chữ "N ảnh" thay vì ảnh. Fix: mục 1.
4. **Faceless storefront** — `ShopStore.tsx:84-117`: đầu trang shop = h1 + dl xám, không mặt mũi. Fix: mục 2.
5. **Blank-div fallback** — `ProductCard.tsx:51` (`tl-pcard-noimg`) ô xám trống tuyệt đối. Fix: mục 5.
6. **Loading-as-text** — `ShopHome.tsx:69-71`: chips loading bằng chữ trong khi grid có skeleton — hai ngôn ngữ loading một màn. Fix: mục 5.

**Minor**: (7) inline style dày đặc — gom cụm lặp vào class MỚI, không refactor đại trà; (8) hai hệ card song song `.tl-shop-pcard` (proto, không dùng) vs `.tl-pcard` (thật) — không style nhầm; (9) Status xếp "Thông tin đã gửi" trên "Diễn biến" — đảo lại.

**Điểm tốt GIỮ NGUYÊN**: 2 loại empty ở SellerProducts, error ≠ empty ở CatalogResults, copy trung thực, `<dialog>` filter sheet, aspect-ratio giữ chỗ ảnh, 1 link/card.

Tổng: **2 critical · 4 major · 3 minor.**

---

## 1. Thumbnail thật ở SellerProducts (commit riêng)

**Data:** `useSellerProducts.ts:84` — `product_media(id,position)` → thêm `public_path,draft_path`. Lift `useSignedPreviews` từ `MediaEditor.tsx:56-82` ra `src/hooks/shop/useSignedPreviews.ts` (giữ nguyên body, bucket `shop-product-media-draft`, TTL 300s); MediaEditor import lại. Chọn media: `position` nhỏ nhất. Ưu tiên `public_path` (qua `publicMediaUrl` — không hết hạn); chỉ khi không có mới mint signed URL cho `draft_path`. Gom **MỘT** call `createSignedUrls` cho cả page (~20 rows) — không mint từng card.

**Anatomy — `Thumb` viết lại:**
```
<span class="tl-shop-thumb">
  <img class="tl-shop-thumb-img" …>    ← có URL
  | <span class="tl-shop-sk" …>        ← chờ signed URL
  | <ImageOff/>                        ← thật sự không có ảnh
</span>
```
- `.tl-shop-thumb`: `aspect-ratio:1/1; width:100%; border-radius:var(--tl-radius); overflow:hidden; background:var(--tl-surface-2); border:1px solid var(--tl-border); display:grid; place-items:center; color:var(--tl-fg-3);`
- `.tl-shop-thumb-img`: `width/height 100%; object-fit:cover; display:block;`
- Kích thước giữ chỗ đặt hiện tại: **44px** table row, **56px** mobile card. Không đổi layout hàng.

**3 trạng thái ảnh (bắt buộc):**
| Điều kiện | Render |
|---|---|
| `mediaCount === 0` | `ImageOff` 18px (+ pill "Chưa có ảnh" đã có — giữ) |
| Có `public_path` | `<img>` ngay (`loading="lazy" decoding="async"`) |
| Chỉ `draft_path`, URL chưa về | shimmer `tl-shop-sk` phủ kín (KHÔNG ImageOff — chưa-tải ≠ không-có) |
| Mint lỗi / ảnh 404 (`onError`) | rơi về `ImageOff`, không notice/retry |

**A11y:** `alt=""` + `aria-hidden="true"` (trang trí — title cạnh bên). Thumb không phải touch target — link vẫn là title.

**Test:** mock `createSignedUrls` (pattern `MediaEditor.test.tsx`): public_path → img public; draft-only → img sau resolve; 0 media → ImageOff.

---

## 2. ShopStore — monogram + header có mặt mũi

**Anatomy thay khối h1 (`ShopStore.tsx:84-95`), breadcrumb giữ:**
```
<header class="tl-shop-storehead">
  <div class="tl-shop-storehead-banner" aria-hidden="true"/>
  <div class="tl-shop-storehead-row">
    <ShopMonogram name={shop.name} size={56}/>
    <div class="tl-shop-storehead-id">
      <h1 class="tl-shop-h1">{shop.name} [BadgeCheck + sr như cũ]</h1>
      <p class="tl-shop-storehead-meta">{product_count} sản phẩm{region && ` · ${region}`}</p>
    </div>
  </div>
  {shop.intro && <p class="tl-shop-sub">…</p>}
</header>
```
- Banner: cao **56px** mobile / 72px ≥768px; `border-radius:var(--tl-radius-lg)`; nền gradient token theo màu hash shop: `linear-gradient(140deg, var(--tl-surface-2), color-mix(in srgb, <accent-hash> 14%, var(--tl-surface)))` — đúng công thức `.tl-shop-media--a/b/c` có sẵn.
- Row: flex gap 12; monogram đè banner `margin-top:-28px` → banner không tốn thêm chiều cao. Ở 390px catalog không bị đẩy quá ~1.5 màn cuộn; cấm hero to.
- Card dl giữ vị trí/copy, TRỪ dòng "Đang bán / N sản phẩm" — đã lên header, bỏ để không lặp (coder verify: grep `"Đang bán"` trong __tests__ trước khi bỏ).

**`ShopMonogram` — `src/components/shop/ShopMonogram.tsx` (thuần, 0 data, 0 dep):**
- Props: `name: string`, `size?: number` (default 40).
- Chữ: `[...name.trim()][0]` uppercase (code point đủ cho tiếng Việt: "Đạt" → "Đ"); rỗng → "?".
- Hash: `sum codePoints % 5` → PALETTE 5 cặp token accent: `--tl-green / --tl-blue / --tl-gold / --tl-accent-team / --tl-accent-qt`.
- Màu đúng kỷ luật contrast: nền `color-mix(in srgb, <accent> 16%, var(--tl-surface))`, viền `color-mix(in srgb, <accent> 45%, transparent)`, **chữ `var(--tl-fg)`** — tint 16% nên AA giữ nguyên cả 2 mode, không đụng `contrast.test.ts`.
- `.tl-shop-monogram`: `border-radius:var(--tl-radius-lg)` (vuông bo, đồng bộ `.tl-shop-seller-mark`); `display:grid; place-items:center; font-weight:700; font-size:size*0.42; flex:none;` accent truyền qua CSS var `--mono-accent` inline (giá trị là `var(--tl-…)` — vẫn token).
- `aria-hidden="true"`.
- Size dùng vòng này: 56px ShopStore. (22px PDP storecard: TUỲ CHỌN.)

**Trạng thái:** loading/not-found/redirect giữ nguyên; header render từ data có sẵn.

---

## 3. SellerHome → dashboard thật

1. Notice trạng thái — **GIỮ NGUYÊN TỪNG CHỮ** (`SellerHome.copy.test.tsx` là guard).
2. **MỚI — hàng CTA** (chỉ khi `state === "active"`): `div.tl-shop-cta-row` gồm `<a>` "Xem shop của tôi" (`tl-shop-btn--primary`, icon Store 16, target _blank + rel) + `<Link>` "Đăng sản phẩm" → `/seller/products/new`. Mobile <560px: mỗi nút `flex:1 1 100%` xếp dọc.
3. **MỚI — ô số liệu** dùng `useProductStatusCounts(shopId)` (coder verify `useMyShop` trả `id`; nếu không → `useMyShopMembership().data.shop_id`):
   - `.tl-shop-stats`: grid 2 cột mobile / 4 cột ≥768px, gap `var(--shop-gap)`.
   - `.tl-shop-stat` (là Link → `/seller/products`, không deep-filter): nền `var(--tl-surface)`, border, radius, padding 14, min-height 44.
   - `.tl-shop-stat-n`: 26px/700/`tabular-nums`/`var(--tl-fg)`. Ô "Cần sửa" khi >0: số `var(--shop-danger)` + viền `color-mix(danger 45%, transparent)` — ô duy nhất có màu.
   - `.tl-shop-stat-l`: 12px `var(--tl-fg-3)`.
   - 4 ô: **Đã duyệt** = approved · **Chờ duyệt** = pending_review · **Cần sửa** = needs_changes + rejected · **Nháp** = draft. (Dùng "Đã duyệt" chứ không "Đang bán" — không nói quá.)
4. Card DefList + "Bước tiếp theo" — giữ nguyên.

**Trạng thái stats:** loading = 4 ô `tl-shop-sk` cao 76px `aria-busy`; error = 1 dòng `tl-shop-hint` "Chưa tải được số liệu sản phẩm." + nút `--sm` "Thử lại" (refetch, KHÔNG ErrorState toàn màn); empty (tổng=0) = empty nhỏ "Chưa có sản phẩm nào" + nút "Đăng sản phẩm đầu tiên"; chỉ render khi có `shop.data`.

**⚠️ Bẫy test:** `SellerHome.copy.test.tsx` không bọc QueryClientProvider — cùng commit PHẢI `vi.mock` module `useSellerProducts` (+ hook shopId nếu thêm); thêm assert nút "Xem shop của tôi" đúng href/target/rel.

---

## 4. SellLanding + SellerApplicationStatus

### SellLanding — phá "6 khối xám", copy giữ 100%
- **Hero**: bọc `div.tl-shop-hero` — sub 15px, CTA `--primary` + `--block` <560px, hint giữ. Eyebrow MỚI trên h1: `<p class="tl-shop-eyebrow">Thử nghiệm kín · Chưa thu phí</p>` (2 fact đã có trong copy — chỉ nâng lên).
- "Cần chuẩn bị gì": giữ card checklist.
- 4 section notice → nhịp editorial `.tl-shop-faq`: mỗi item `border-top:1px solid var(--tl-border); padding:16px 0;` — h2 giữ text + icon inline (`var(--tl-fg-3)`), body giữ nguyên. Riêng "Huy hiệu Đã xác minh": `border-left:3px solid var(--shop-verified); padding-left:14px` — 1 điểm màu duy nhất.
- Notice "thử nghiệm kín / chưa trong nhóm" giữ nguyên trạng (cảnh báo thật).

### SellerApplicationStatus — "hồ sơ có người thật cầm"
- Thứ tự mới: notice → "Cần sửa N chỗ" → **Diễn biến (timeline)** → Thông tin đã gửi → hàng nút.
- Timeline: item "ghost" MỚI trên cùng khi status ∈ {submitted, under_review}: `.tl-shop-timeline li.is-next` (dot rỗng `border:1px dashed var(--tl-border-2)`), nội dung "Quản trị viên xem hồ sơ và trả lời tại đây" — không hứa SLA.
- **Khối liên hệ MỚI** cuối trang (mọi status trừ draft): card "Cần hỏi nhanh? Hồ sơ do người thật xem — nhắn Zalo cho ThePickleHub, kèm tên shop dự kiến." + nút `--sm` "Nhắn Zalo" (href ZALO_URL). 🔴 **ZALO_URL chờ Cuong xác nhận; coder grep `zalo` toàn repo trước; CHƯA xác nhận → SHIP KHÔNG NÚT, chỉ giữ câu chữ.**
- Nút "Rút hồ sơ": loading label "Đang rút…" + `aria-busy`; lỗi mutation hiện `--danger` + `shopErrorMessage` (coder verify hành vi thật `useWithdrawApplication` — hiện lỗi có thể rơi im lặng).

---

## 5. ShopHome + ProductCard + empty states

### ProductCard
- Fallback không ảnh: `tl-pcard-noimg` thêm nội dung `<ImageOff size={20}/> + "Chưa có ảnh"` — `display:grid; place-items:center; gap:4px; color:var(--tl-fg-3); font-size:11px;`
- Giá `.tl-pcard-price`: 14.5px → **15.5px** (neo Shopee giá đậm). Không đổi gì khác.

### ShopHome
- Chips loading: thay chữ bằng 4 chip skeleton `span.tl-shop-sk` (88×44, radius 999) trong `div aria-busy aria-label="Đang tải ngành hàng"`.
- Giữ B01: không hero; nghiệm thu lại card đầu trên fold 320px sau sửa.

### Empty states từng màn (nâng `.tl-shop-empty`: icon lucide 28px `var(--tl-fg-3)` trên title)
| Màn | Bổ sung MỚI (chỉ thêm) |
|---|---|
| ShopHome "Mới đăng" rỗng | + link "Anh/chị có đồ pickleball muốn bán? **Tìm hiểu cách mở shop**" → `/shop/sell` |
| ShopSearch/Category rỗng | icon `SearchX`, không thêm chữ |
| ShopStore catalog rỗng | icon `Package`, không thêm chữ |
| SellerProducts rỗng | icon `PackageOpen` cho empty đầu (giữ cả 2 empty) |
| Status chưa có hồ sơ | icon `FileText` |

ResultsGrid nhận prop mới `emptyAction?: ReactNode` — 1 prop, không fork.

## 6. Kỷ luật 8 trạng thái
Thừa hưởng `shop.css` sẵn có (btn default/hover/disabled, focus-visible rule toàn cục). THÊM 1 rule: `.tl-shop-btn:active:not(:disabled), .tl-shop-stat:active { transform: translateY(1px); }` (reduced-motion đã cover). Loading = label đổi + aria-busy (mutation) / `tl-shop-sk` (data). Error = notice `--danger` + Thử lại. Success = data hiện.

## 7. Responsive & A11y
- 390px chuẩn; kiểm 320/375/414/768. 320px: CTA xếp dọc, stats 2 cột `minmax(0,1fr)`, storehead không đẩy catalog sâu.
- Touch ≥44px (`--shop-tap`); stat ≥76px; monogram không phải target.
- Contrast: fg trên tint ≤16% surface; không chữ nhỏ `--tl-fg-4` trên surface; KHÔNG sửa `--shop-on-*`; `contrast.test.ts` xanh nguyên trạng.
- `aria-hidden` monogram/thumb/icon trang trí; section mới có `aria-labelledby`.
- Light mode tự flip qua token — nghiệm thu cả 2 mode.

## 8. Copy VI mới (CHỈ THÊM)
1. "Xem shop của tôi" / "Đăng sản phẩm" · 2. Nhãn stat "Đã duyệt · Chờ duyệt · Cần sửa · Nháp" · 3. "Chưa tải được số liệu sản phẩm." + "Thử lại" · 4. Eyebrow "Thử nghiệm kín · Chưa thu phí" · 5. Ghost timeline "Quản trị viên xem hồ sơ và trả lời tại đây" · 6. Khối liên hệ Zalo (🔴 URL chờ PO) · 7. "Đang rút…" · 8. "Chưa có ảnh" (ProductCard) · 9. Link mở shop ở ShopHome empty · 10. `aria-label="Đang tải ngành hàng"`

## 9. Thứ tự cắt khi thiếu thời gian (bỏ từ trên xuống)
1. Monogram 22px PDP (tuỳ chọn sẵn) · 2. Timeline ghost · 3. Icon empty states · 4. Chip skeleton ShopHome · 5. Nhịp FAQ SellLanding (tối thiểu vẫn làm hero + eyebrow) · 6. Khối Zalo (chờ URL).
**KHÔNG BAO GIỜ cắt:** thumbnail thật · nút "Xem shop của tôi" · monogram ShopStore.

## 10. Coder xác minh trước khi gõ
1. `useMyShop` có trả `id`? (không → `useMyShopMembership`)
2. Seller đọc được `public_path` qua join trong list — chạy THẬT (bài học "RLS không lọc CỘT").
3. Grep `"Đang bán"` trong tests trước khi bỏ dòng dl ShopStore.
4. Grep `zalo` toàn repo tìm kênh sẵn có.
5. `SellerHome.copy.test.tsx`: mocks cùng commit.
6. Bundle gate JS: hook lift + monogram + counts trong headroom ~13.6KB (CSS tự do).
7. Sau CSS: `contrast.test.ts` + card đầu trên fold 320px.
8. Cuối vòng (tuỳ chọn): thêm `/shop`, `/shop/sell`, PDP vào `tests/visual.spec.ts` + workflow_dispatch capture baseline.

**File chính:** `src/pages/shop/{SellerProducts,ShopStore,SellerHome,SellLanding,SellerApplicationStatus,ShopHome}.tsx` · `src/components/shop/{ProductCard,CatalogResults,ShopShell,MediaEditor}.tsx` · `src/hooks/shop/useSellerProducts.ts` · `src/styles/shop.css`. Component mới duy nhất: `ShopMonogram.tsx`; hook lift duy nhất: `useSignedPreviews.ts`.
