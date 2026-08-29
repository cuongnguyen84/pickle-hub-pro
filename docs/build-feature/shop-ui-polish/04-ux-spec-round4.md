# 04 — UX Spec vòng 4: Hero ShopHome + 4 chỉnh nhỏ vòng 3

Phạm vi: chỉ vùng đầu trang `/shop` (`src/pages/shop/ShopHome.tsx`) + 4 chỉnh nhỏ đã duyệt. Không đụng card/chip/giá (chốt vòng 3). Không lib mới, không file ảnh mới.

## 0. Audit vùng header hiện tại
1. **Naked utility opening** (major) — h1 trần + sub + search rời rạc → gói vào hero card gradient token.
2. Inline style `{{marginBottom:12, fontSize:13.5}}` trên sub (minor) → class `.tl-shop-herocard-sub`.
3. Search pill 999 vs nút "Tìm" radius thường không cùng ngôn ngữ (minor) → trong hero nút nhận radius 999.

## 1. Flow: không đổi — hero thuần thị giác, không hành vi mới.

## 2. Hero card — `.tl-shop-herocard`

⚠️ **`.tl-shop-hero` ĐÃ TỒN TẠI cho sell landing** (`shop.css:1585`, có rule `.tl-shop-hero .tl-shop-btn{width:100%}` mobile sẽ phá nút Tìm) — BẮT BUỘC block mới `.tl-shop-herocard`, không kế thừa.

### 2.1 Markup (thay ShopHome.tsx dòng 35-67, chữ giữ 100%)
```html
<section class="tl-shop-herocard">
  <svg class="tl-shop-herocard-art" aria-hidden="true" …/>
  <h1 class="tl-shop-h1 tl-shop-herocard-title">Chợ đồ pickleball</h1>
  <p class="tl-shop-sub tl-shop-herocard-sub">Vợt, giày, bóng và phụ kiện…(nguyên văn)</p>
  <form role="search" class="tl-shop-searchfield tl-shop-herocard-search">…giữ nguyên…</form>
</section>
```

### 2.2 Token mới (block `.tl-shop`; contrast test chỉ resolve HEX literal → tint tính sẵn hex, comment công thức — tiền lệ `--shop-on-accent`)
```css
/* Hero tint = color-mix(green N%, surface) tính sẵn. Dark: 16%/5% trên #131416. Light: 12%/4% trên #eeebe1. */
--shop-hero-tint-strong: #2d3620;  --shop-hero-tint-weak: #1b1f19;
--shop-hero-edge: color-mix(in srgb, var(--tl-green) 28%, var(--tl-border));
--shop-hero-ink: var(--tl-fg);  --shop-hero-sub-ink: var(--tl-fg-2);  /* KHÔNG fg-3 trên tint */
--shop-hero-art-ink: var(--tl-green);
```
Block light: `--shop-hero-tint-strong: #dbdcc9; --shop-hero-tint-weak: #e8e6d9;`
Ratio tính tay (coder xác nhận bằng test): dark fg/strong ≈11.5, fg-2 ≈7.2; light ≈14.2/8.3 — AA thừa.

### 2.3 CSS
```css
.tl-shop-herocard { position:relative; overflow:hidden; border-radius:var(--shop-radius-card);
  border:1px solid var(--shop-hero-edge);
  background:linear-gradient(135deg, var(--shop-hero-tint-strong), var(--shop-hero-tint-weak) 58%, var(--tl-surface));
  box-shadow:var(--shop-shadow-1); padding:18px 16px 16px; margin-bottom:14px; }
.tl-shop-herocard-title { color:var(--shop-hero-ink); margin-bottom:4px; position:relative; }
.tl-shop-herocard-sub { color:var(--shop-hero-sub-ink); font-size:13.5px; margin:0 0 12px; max-width:52ch; position:relative; }
.tl-shop-herocard-search { position:relative; }
.tl-shop-herocard-search .tl-shop-btn { border-radius:999px; }
.tl-shop-herocard-art { position:absolute; right:-18px; top:-14px; color:var(--shop-hero-art-ink); opacity:.14; pointer-events:none; }
@media (min-width:768px){ .tl-shop-herocard{padding:26px 24px 22px} .tl-shop-herocard-search{max-width:560px}
  .tl-shop-herocard-art{right:8px; top:50%; translate:0 -50%; width:180px; height:180px} }
@media (max-width:359px){ .tl-shop-herocard{padding:14px} .tl-shop-herocard-art{display:none}
  .tl-shop-herocard-sub{display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden} }
```
Search input giữ style hiện có (bg-elev tự tách khỏi tint). Chips giữ ngay dưới. Bù chiều cao B01: nếu card đầu tụt fold 320 → giảm margin `.tl-shop-h2` "Mới đăng" 22→16px CHỈ trong ShopHome (đo trước, chỉ áp nếu cần).

### 2.4 SVG hoạ tiết (~450 bytes, inline, stroke currentColor)
```html
<svg class="tl-shop-herocard-art" aria-hidden="true" viewBox="0 0 140 140" width="132" height="132"
     fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round">
  <ellipse cx="62" cy="50" rx="34" ry="40" transform="rotate(-24 62 50)"/>
  <line x1="80" y1="86" x2="96" y2="118"/>
  <circle cx="112" cy="52" r="16"/>
  <circle cx="108" cy="47" r="1.6" fill="currentColor" stroke="none"/>
  <circle cx="117" cy="52" r="1.6" fill="currentColor" stroke="none"/>
  <circle cx="109" cy="58" r="1.6" fill="currentColor" stroke="none"/>
</svg>
```
Coder chỉnh toạ độ cho cân được; không đổi bản chất (line-art 1 màu, không gradient/filter/ảnh).

### 2.5 Trạng thái
Input: default giữ; **hover thêm `border-color: var(--tl-border-2)`** (mới); focus-visible rule global; active=focus; disabled/loading/error/success không phát sinh (điều hướng tức thời — ghi comment). Nút Tìm: mọi state đã có (hover green-dim, active translateY, disabled opacity); chỉ thêm radius 999 trong hero.

## 3. Component: KHÔNG component React mới — markup + CSS tại chỗ; SVG inline (hoặc const cục bộ). Tái dùng h1/sub/searchfield/btn + token card vòng 3.

## 4. Bốn chỉnh nhỏ đã duyệt (review vòng 3)
1. `ProductCard.tsx:38`: XOÁ `aria-label={card.title}` — accessible name = toàn bộ text content. ⚠️ `CatalogResults.test.tsx:220` đang assert getAttribute("aria-label") → đổi thành `getAllByRole("link", { name: /Giày Court Pro/ })` (regex, name giờ chứa giá).
2. `contrast.test.ts` INK_ON_FILL: thêm `["--shop-chip-ink","--shop-chip-bg"]`. ⚠️ Kéo theo: `--shop-chip-bg` light đang là color-mix → resolver throw → đổi thành hex tính sẵn `#f3f3f3` + comment công thức (fg-2/#f3f3f3 ≈10.4).
3. `ShopStore.tsx:88`: xoá style `--mono-accent` chết (banner đã bỏ R3; ShopMonogram tự set) + dọn import monogramAccent/CSSProperties nếu hết chỗ dùng + sửa comment stale `ShopMonogram.tsx:5-6`.
4. `CatalogResults.tsx:286`: câu sparse → `Sàn đang ở giai đoạn thử nghiệm — đây là toàn bộ những gì đang bán.` (giữ từ ngữ, hoa chữ đầu, gạch vào giữa).

## 5. Microcopy: KHÔNG chữ mới. H1/sub/placeholder/nút giữ từng ký tự.

## 6. Responsive & a11y
- 320px: hero ẩn SVG, pad 14, sub clamp 2 → ~150px (< trần 200px PO); **card đầu ló trên fold 320×568** — đo bằng phương pháp B01 thật, KHÔNG Chrome MCP resize.
- 375/414: SVG hiện opacity .14, không đè chữ (sub max-width 52ch + relative); hero ~160-170px.
- 768+: pad 26/24, search 560px, SVG 180 giữa dọc phải.
- Không heading nghiêng; touch input+nút ≥44 (có sẵn); reduced-motion đã cover toàn cục; dark mode ngang hàng light (kiểm mắt cả 2).

## 7. Coder verify (thứ tự)
1. Contrast gate xanh với 4 cặp mới: `[hero-ink, hero-tint-strong]`, `[hero-sub-ink, hero-tint-strong]`, `[chip-ink, chip-bg]`, cặp cũ không vỡ sau đổi chip-bg hex.
2. `CatalogResults.test.tsx` cập nhật mục 4.1 và xanh.
3. Fold check 320×568 card đầu ló (phương pháp B01); hero mobile ≤200px kể cả search.
4. Screenshot 4 breakpoint × 2 mode — SVG không đè chữ, không tràn ngang.
5. Grep `.tl-shop-hero ` (khoảng trắng) xác nhận hero sell landing và herocard không ảnh hưởng nhau.
6. Hết inline style sub trong ShopHome; không raw hex ngoài token block.
