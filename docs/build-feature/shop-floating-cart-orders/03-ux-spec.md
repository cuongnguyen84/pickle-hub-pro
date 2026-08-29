# UX spec — cụm FAB Giỏ hàng + Đơn của tôi (Shop web)

(Audit CartLink.tsx: 0 critical · 2 major (iconbtn thiếu `:active`; badge không live-region — chấp nhận) · 2 minor. Chỉ `:active` thành việc.)

Token nguồn: `src/styles/the-line.css` + block `.tl-shop` trong `shop.css`. Không token mới, không hex mới, không thư viện mới.

## 1. User flow
Người mua đã login, 1 trong 5 trang catalogue trên điện thoại → cuộn → cụm FAB luôn góc dưới phải trên BottomNav → chạm giỏ → `/shop/cart`; chạm "Đơn của tôi" → `/shop/orders`.
- PDP: buybar trượt lên → FAB `display:none`; buybar ẩn → FAB hiện lại.
- PDP: "Thêm vào giỏ" → toast (z 45) hiện 6s; badge tăng, nhịp sáng 1 lần (tùy chọn); toast nằm TRÊN FAB (FAB z 44).
- Chưa login → không render (giữ `if (!user) return null`).
- Count null → nút giỏ hiện, không badge, không light.
- Desktop ≥900px → không FAB, inline trong `.tl-shop-topline` như hiện tại.

## 2. Layout (mobile <900px)
```
                                      ┌──────────────┐
                                      │ ▤ Đơn của tôi│  ← tl-shop-btn tl-shop-btn--sm, h 44
                                      └──────────────┘
                                             8px
                                      ┌────┐
                                      │ 🛍 ③│  ← tl-shop-iconbtn 48×48, badge góc trên phải
                                      └────┘
  ──────────────────── 12px ─────────────────┘ right
  bottom = var(--shop-bottomnav) + var(--shop-safe-b) + 12px
 ╔════════════════ BottomNav 72px ════════════════╗
```
- Wrapper `.tl-shop-fab`: `position:fixed; right:12px; bottom:calc(var(--shop-bottomnav) + var(--shop-safe-b) + 12px); z-index:44; display:flex; flex-direction:column; align-items:flex-end; gap:8px`.
- Cả 2 nút: `background: var(--tl-bg-elev); border: 1px solid var(--tl-border-2); border-radius: var(--tl-radius); box-shadow: var(--shop-shadow-2)`.
- Nút giỏ 48×48. Badge giữ `.tl-shop-cart-count`.
- Nút Đơn: `.tl-shop-btn--sm`, `min-height: var(--shop-tap)`, `white-space: nowrap`. Cụm ≤140px ở 320px.
- Desktop ≥900px: `.tl-shop-fab { position: static; flex-direction: row; gap: 8px; box-shadow: none; }` → y hệt inline. Giữ topline ở mọi trang; topline rỗng trên mobile cao 0px → không làm gì.

## 3. Trạng thái
### Nút giỏ (`.tl-shop-fab .tl-shop-iconbtn`)
| State | Spec |
|---|---|
| count=0/null | nền `--tl-bg-elev`, viền `--tl-border-2`, icon `--tl-fg-2`, không badge, không light |
| count>0 | badge; **2 light** = `box-shadow: 0 0 0 3px color-mix(in srgb, var(--tl-green) 18%, transparent), 0 0 18px color-mix(in srgb, var(--tl-green) 35%, transparent), var(--shop-shadow-2)`. Tĩnh. Chỉ trong `.tl-shop-fab` <900px |
| hover | nền `--tl-surface-2`, icon `--tl-fg` (có sẵn) |
| focus-visible | outline 2px `--tl-green` offset 2px (có sẵn) |
| active | `transform: scale(0.96)` — **thêm mới** cho `.tl-shop-iconbtn:active` |
| loading/error | count null → không badge, không light (có sẵn) |
| success | count vừa tăng → class `is-bump` → `animation: tl-shop-fab-bump 480ms ease-out 1` (glow 35%→60%→35%). **Tùy chọn; bỏ nếu >15 dòng.** Reduced-motion: block `.tl-shop *` đã ép duration |

### Nút Đơn của tôi: kế thừa `.tl-shop-btn`; không có count/disabled.

### Cụm
- `body:has(.tl-shop-buybar[data-shown="true"]) .tl-shop-fab { display:none }`.
- Bàn phím ảo: chấp nhận lơ lửng. Light mode: không rule riêng (token đổi theo mode). Reduced-motion: không transition vị trí.

## 4. Copy + aria (giữ nguyên)
- Nhãn "Đơn của tôi". Nút giỏ `aria-label` = `Giỏ hàng` / `Giỏ hàng, {n} món`. Badge `aria-hidden`. Wrapper không role/aria.

## 5. Hành vi từng trang
| Trang | topline | mobile | desktop |
|---|---|---|---|
| ShopHome | chỉ CartLink | FAB, topline cao 0 | inline |
| ShopSearch | chỉ CartLink | FAB | inline |
| ShopCategory | crumbs + CartLink | FAB, crumbs giữ | inline |
| ShopStore | crumbs + CartLink | FAB | inline |
| ProductDetail | crumbs + CartLink | FAB; ẩn khi buybar; toast đè FAB 6s | inline |
| Cart/Checkout/Orders/OrderDetail | không đổi (không `floating`) | inline | inline |

Padding đáy: 5 trang catalogue thêm class `tl-shop-has-fab` trên `.tl-shop-page` → `@media (max-width:899px) { .tl-shop-page.tl-shop-has-fab { padding-bottom: calc(96px + 112px); } }`.

## 6. Z-index: buybar 60 > toast 45 > **FAB 44** > header 40.

## 7. Responsive & a11y
320/375/414 không tràn ngang; 768 vẫn FAB. Touch giỏ 48, đơn ≥44. Contrast: icon `--tl-fg-2` trên `--tl-bg-elev` đã pass. Tab order Đơn → Giỏ.

## 8. Acceptance
1. `ShopCartLink floating` → wrapper `.tl-shop-fab` chứa đúng 2 link hiện tại; không `floating` → markup cũ nguyên vẹn (4 test mock không đổi).
2. Chưa login → null cả hai chế độ.
3. count>0 → nút giỏ có box-shadow 2 lớp green chỉ trong `.tl-shop-fab` <900px; count 0/null → không.
4. `body:has(.tl-shop-buybar[data-shown="true"])` → `.tl-shop-fab` display:none.
5. `.tl-shop-iconbtn:active` scale 0.96.
6. z-index FAB 44.
7. `.tl-shop-page.tl-shop-has-fab` padding-bottom mobile = 96+112.
8. Không hex mới trong shop.css (contrast test).
9. ≥900px: `.tl-shop-fab` static, ngang, không shadow.

Files (worktree shop-fab): `src/components/shop/CartLink.tsx`, `src/styles/shop.css` (491-521, 1570-1603, 1880-1923), 5 page trong `src/pages/shop/`.
Skipped: nhịp sáng khi count tăng là tùy chọn; ẩn-khi-cuộn — không làm.
