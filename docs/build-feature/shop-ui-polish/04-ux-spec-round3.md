# 04-ux-spec-round3.md — Shop UI polish vòng 3: card-first theo reference

Neo: `reference/target-look.jpeg` (PO cung cấp 17/08). Genre: modern-minimal card-first — khu shop tách khỏi editorial The Line bằng sub-theme, vẫn cùng token gốc. Light mode là mặt tiền; mọi màu qua token 2 mode.

**File bị ảnh hưởng (không file mới, không JS lib mới):** `src/styles/shop.css` (token block + block mới) · `src/components/shop/ProductCard.tsx` · `src/components/shop/CatalogResults.tsx` · `src/pages/shop/ShopStore.tsx` · `src/pages/shop/ShopHome.tsx` · `src/pages/shop/ProductDetail.tsx` (chỉ radius/nhịp) · `src/styles/__tests__/contrast.test.ts` (thêm assertion cặp màu mới). Seller/admin surfaces KHÔNG đụng — giữ kết quả vòng 1-2.

## 0. Hallmark audit vòng 3 (punch list)

**Critical**
1. **Đảo ngược thứ bậc — trang store đọc như văn bản.** `ShopStore.tsx:113-164`: deflist Xác minh/Giao hàng/Đổi trả + section "Liên hệ" (kể cả khi RỖNG in nguyên câu `NO_CONTACT_COPY` 2 dòng) chiếm vùng trên fold; grid sản phẩm nằm dưới ~2 màn text.
2. **Card sản phẩm không đọc là "card".** `shop.css:1237-1273`: `.tl-pcard` chỉ border 1px + radius 12 trên nền cream, media theo aspect ảnh gốc (lệch), giá không nổi.

**Major**
3. Banner storehead vô hình ở light (`gradient 14%` trên `#fcfbf7`), chiếm 56px vô ích; monogram 56px chìm.
4. Chip active tín hiệu yếu (`aria-current` chỉ đổi border-color 1px).
5. Text meta dài ở vị trí đắc địa: câu sparse của `CatalogResults.tsx:274-277` TRƯỚC grid; câu xác minh 2 dòng giữa trang.

**Minor**: (6) skeleton 4/3 vs ảnh thật → layout nhảy, thiếu hàng giá/nút; (7) `.tl-shop-h2` 16px/650 quá gần body; (8) ShopHome tiêu chiều dọc → B01 pass sát nút.

## 1. Sub-theme token (shop.css — CHỈ thêm vào 2 token block hiện có; raw hex chỉ trong block, tiền lệ `--shop-on-accent`)

Block `.tl-shop` (default = dark):
```
--shop-radius-card: 20px;  --shop-radius-media: 14px;
--shop-card-surface: var(--tl-surface);  --shop-card-edge: var(--tl-border);
--shop-shadow-1: 0 0 #0000;  --shop-shadow-2: 0 0 #0000;
--shop-chip-bg: var(--tl-surface-2);  --shop-chip-ink: var(--tl-fg-2);
--shop-chip-active-bg: var(--tl-fg);  --shop-chip-active-ink: var(--tl-bg);
--shop-gap-grid: 16px;  --shop-card-pad: 12px;
```
Block light `[data-theme="the-line"][data-mode="light"] .tl-shop`:
```
--shop-card-surface: #ffffff;
--shop-card-edge: color-mix(in srgb, var(--tl-fg) 6%, transparent);
--shop-shadow-1: 0 1px 2px rgb(23 20 10 / 0.04), 0 6px 16px rgb(23 20 10 / 0.06);
--shop-shadow-2: 0 2px 4px rgb(23 20 10 / 0.05), 0 12px 28px rgb(23 20 10 / 0.10);
--shop-chip-bg: color-mix(in srgb, var(--tl-fg) 5%, #ffffff);
```
Chip active = cặp ink↔bg The Line → tự AA 2 mode, VẪN thêm assertion contrast.test.ts (§8).

## 2. ProductCard redesign

**Bất biến giữ nguyên: cả card là MỘT link, KHÔNG control lồng.** Nút tròn "→" là `<span aria-hidden>` trang trí — hành động thật là cả card điều hướng.

Markup:
```
<Link to=/shop/product/:slug class="tl-pcard" aria-label={title}>
  <span class="tl-pcard-media">      ← 1:1 CỐ ĐỊNH (gỡ inline aspectRatio trong TSX!), radius 14
    <img … width/height giữ>  |  <span class="tl-pcard-noimg">  [+ <span class="tl-pcard-flag">Hết hàng]
  </span>
  <span class="tl-pcard-body">
    <span class="tl-pcard-title">   ← 14px/600, clamp 2 dòng
    <span class="tl-pcard-meta">    ← 1 dòng 11.5px fg-3 ellipsis: {used && "Đã qua sử dụng · "}{shop.name} ✓; BỎ "Còn hàng"
    <span class="tl-pcard-foot">    ← flex gap 8
      <span class="tl-pcard-price"> ← flex:1, 16.5px/700, tabular-nums, ellipsis
      <span class="tl-pcard-go" aria-hidden>→</span>  ← 34px tròn, bg var(--tl-fg) color var(--tl-bg), ArrowRight 16
```
CSS `.tl-pcard`: `background var(--shop-card-surface); border 1px var(--shop-card-edge); radius var(--shop-radius-card); box-shadow var(--shop-shadow-1); padding 6px 6px 0; transition transform/box-shadow/border .15s`. `.tl-pcard-media`: `aspect-ratio 1/1; radius var(--shop-radius-media); overflow hidden; background color-mix(fg 4%, card-surface)`; img cover. Body pad `10px var(--shop-card-pad) var(--shop-card-pad)`, grid gap 4.

8 trạng thái: hover = lift -2px + shadow-2 + edge 12% + `.tl-pcard-go` nền green/on-accent · focus-visible = rule global + cùng lift · active = scale .98 · disabled n/a (hết hàng = flag, card vẫn xem) · loading = `ProductCardSkeleton` mới cùng khung card, media sk 1:1, foot sk 60×16 + circle 34 (reduced-motion đã cover) · error/success = cấp grid/n-a.

## 3. Chip filter (`.tl-shop-cat`)

`.tl-shop-cat`: `border 1px transparent; background var(--shop-chip-bg); color var(--shop-chip-ink); radius 999; min-height var(--shop-tap); padding 0 16px; 13px/600`. Active `[aria-current="page"]`: `background var(--shop-chip-active-bg); color var(--shop-chip-active-ink); weight 650`; `.count` bên trong: `color inherit`. Hover thường: `color-mix(fg 10%, card-surface)`; hover active: opacity .92; pressed scale .97. Tuỳ chọn rẻ (<30'): ShopCategory tap chip active = bỏ lọc + icon `X` 13 + aria-label "Bỏ lọc {name}" (KHÔNG làm trên ShopHome).

## 4. ShopStore bố cục lại

Thứ tự DOM mới: crumbs → **storehead mới** (XOÁ banner + margin-top -28px): row flex gap 14 = `ShopMonogram size 72` (radius theo card 20) + h1 24/28px KHÔNG icon ✓ trong h1 + hàng pill: `tl-shop-pill--info` "Đã xác minh" (BadgeCheck 13, sr-text vào trong pill — pill có sẵn đã pass contrast; non-interactive không cần 44px) + meta "N sản phẩm · region"; intro clamp 2 dòng 13.5px → **Liên hệ CHỈ khi có contacts** (hàng nút primary, bỏ heading, giữ hint "mở ứng dụng ngoài"; khi rỗng: không render gì ở đây) → **h2 "Sản phẩm"** + ResultsGrid (nhân vật chính, lên trên fold) + "Xem thêm" giữ → **footer `tl-shop-storefoot`** (border-top, padding 20 0, margin-top 28): h2 "Thông tin shop" + deflist 13px (Khu vực/Giao hàng/Đổi trả/Xác minh: CÂU ĐẦY ĐỦ hiện tại) + hint "Chính sách… do shop tự khai." + khi không contacts: `NO_CONTACT_COPY` nguyên văn dạng hint.

**Không câu nào bị xoá nội dung — chỉ đổi vị trí + cỡ chữ.** XOÁ khỏi ShopStore: deflist block giữa trang (113-132), section Liên hệ heading + nhánh rỗng, banner + CSS liên quan.

## 5. ResultsGrid + grid CSS (dùng chung mọi trang catalog)

`.tl-pgrid`: `repeat(2, minmax(0,1fr)); gap 12px` từ 320px (2 CỘT như reference); ≥400px gap `var(--shop-gap-grid)`; ≥768px `auto-fill minmax(200px,1fr)` gap 20. Dòng đếm role=status chỉ còn "N sản phẩm" 12px fg-3 trước grid; câu sparse "— sàn đang ở giai đoạn thử nghiệm…" chuyển SAU grid thành `tl-shop-hint` 12px, nguyên văn. Error/empty giữ logic + copy; khung `.tl-shop-empty` radius card. Skeleton 8 giữ, dùng skeleton mới §2.

## 6. ShopHome + PDP tối thiểu

ShopHome (GIỮ B01 — thay đổi đều tiết kiệm chiều dọc): giữ h1 + sub (copy giữ), sub margin-bottom 20→12 + 13.5px; XOÁ heading "Ngành hàng" (aria-label chuyển sang section/group đã có); `.tl-shop-h2` toàn cục: `17px/700, letter-spacing -0.015em, margin 22px 0 10px`. Search giữ nguyên.
PDP: `.tl-pdp-media img` + noimg radius → card; `.tl-pdp-seller` = card surface/edge/radius/shadow-1 pad 14 16; hint dài dòng 267-271 giữ chữ, hạ 11.5px. Không đụng option pills/thumbs/CTA/variant.

## 7. Microcopy đổi (khu shop VI thuần — giữ)

| Chỗ | Cũ → Mới |
|---|---|
| ShopStore h2 catalog | "Sản phẩm của shop" → "Sản phẩm" |
| Footer h2 | (mới) "Thông tin shop" |
| Badge verified | icon ✓ cạnh h1 → pill "Đã xác minh" + sr-text; câu đầy đủ giữ ở footer |
| Card meta | "Mới · Còn hàng" + shop 2 dòng → 1 dòng `[Đã qua sử dụng · ]{shop} ✓`; "Còn hàng" bỏ; "Hết hàng" vẫn flag |
| Câu sparse | trước grid → sau grid, nguyên văn |
| NO_CONTACT_COPY | section giữa trang → footer, nguyên văn |

Mọi câu khác giữ từng chữ. Không thêm claim/số.

## 8. Checklist coder PHẢI verify (fail dòng nào = chưa xong)

1. Responsive 320/375/414/768: grid 2 cột từ 320, không tràn ngang; 320px foot card không wrap (nếu tràn: price 14.5px dưới 360px).
2. B01: /shop 320px card đầu vẫn ló trên fold sau khi bỏ heading "Ngành hàng" (kiểm DOM, không suy diễn).
3. Contrast test xanh + assertion MỚI: chip-active-ink/bg 2 mode; fg-3 trên #ffffff; tl-bg trên tl-fg; pill--info trên card trắng.
4. Dark mode không vỡ (card = surface+border, shadow 0; chip active đảo ink).
5. Touch: chips ≥44; card là 1 link lớn; `.tl-pcard-go` KHÔNG phải target riêng.
6. Không control lồng trong card-link (span, không button).
7. 8 trạng thái có style thật (devtools force); skeleton 1:1; reduced-motion giữ.
8. Copy trung thực: câu xác minh đầy đủ + "do shop tự khai" + NO_CONTACT_COPY + câu sparse ĐỀU CÒN trong DOM ShopStore (grep từng câu).
9. Không hex ngoài token block; không JS lib mới; bundle JS gần như 0 tăng (headroom 9.9KB).
10. `CatalogResults.test.tsx`, `FilterSheet.test.tsx` xanh sau đổi markup (cập nhật assertion nếu bám text "Còn hàng").

**Rủi ro cho coder:** (a) `.tl-shop-pcard` (proto/seller) ≠ `.tl-pcard` (buyer) — CHỈ đụng `.tl-pcard*`; (b) inline `aspectRatio` trong TSX phải gỡ cùng CSS 1:1; (c) không thêm `<button>` lồng trong Link.

Thứ tự thi công: token §1 → card+grid §2/§5 → chips §3 → ShopStore §4 → ShopHome/PDP §6 → test.
