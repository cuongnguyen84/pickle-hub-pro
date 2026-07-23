# Repro + Root Cause Analysis (orchestrator, runtime-verified trên prod 2026-07-23)

## Repro trên prod (www.thepicklehub.net, desktop 1400px, đã đăng nhập)

1. Chuông hiển thị badge "1" ở tl-nav (TheLineLayout header).
2. Click chuột thật vào chuông (1316, 40) → **không có gì xảy ra**. Panel không mở, `data-state` vẫn `closed`. ✅ đúng triệu chứng Cuong báo.
3. `button.click()` bằng JS → panel **MỞ bình thường** (`data-state="open"`, dialog render). Handler Radix sống, state hoạt động.
4. `document.elementsFromPoint(1316, 40)` cho stack: `DIV.tl-icon-btn` (i=0, **trên** button) → `BUTTON` (i=1) → `DIV.tl-icon-btn` (i=2, cùng element với i=0 — dấu hiệu pseudo-element) → …
5. `getComputedStyle(divCha, '::after')` = `content:""; position:absolute; inset:-4px` → box 42×42px, `pointer-events:auto`, phủ kín toàn bộ button.

## Root cause

- `src/styles/the-line.css:2838` — `[data-theme="the-line"] .tl-icon-btn::after { content:''; position:absolute; inset:-4px; }` — thêm bởi **`c5428303` (2026-07-09, PR #300)** với comment "a11y: 36px visual box, 44px effective hit area". Thiết kế cho các element `<button class="tl-icon-btn">` (dark-mode toggle, menu btn) — ở đó pseudo MỞ RỘNG hit area của chính button → tốt.
- `src/components/layout/TheLineLayout.tsx:694` — `<UnifiedNotificationBell className="tl-icon-btn" />`.
- `src/components/social/notifications/UnifiedNotificationBell.tsx:93,108` — component áp `className` vào **`<div>` bọc ngoài** (`<div className={className}>` quanh Popover/Drawer), không phải vào Button.
- Pseudo-element hit-test **như element gốc của nó** (div cha) và nằm TRÊN con trong paint order → mọi click chuột thật target vào DIV, event bubble từ DIV lên — **không bao giờ đi qua `<button>`** → onClick của Radix trigger không fire.
- Nút dark-mode cùng class vẫn hoạt động vì ở đó `.tl-icon-btn` là chính button.

## Phạm vi

- Hỏng từ **2026-07-09** (không phải regression của #447 — #447 chỉ đổi ARIA bên trong; span cũ cũng nằm trong div bọc nên chết y hệt).
- Hỏng trên **mọi trang dùng TheLineLayout** (homepage v.v.), cả desktop (Popover) lẫn mobile (Drawer) — khớp repro "web mobile + desktop" của Cuong.
- Các mount trong `AppHeader.tsx:141,204` truyền className `hidden md:block` / `md:hidden` (không có `tl-icon-btn`) → không dính pseudo → bell ở trang dùng AppHeader vẫn click được.
- Keyboard (Tab + Enter) vẫn hoạt động (focus vào button thật) — chỉ pointer chết. Không có test nào cover click chuông (recon: zero coverage).

## Hướng fix khả dĩ (để panel đánh giá, orchestrator KHÔNG chốt)

- A: Bỏ div bọc, truyền `className` vào `Trigger`/Button (như dark-mode toggle) — root-cause fix; cần soát 2 call site AppHeader (`hidden md:block` trên Button cần thành `md:inline-flex`?).
- B: CSS một dòng `div.tl-icon-btn::after { pointer-events: none }` (scope theo tag) — giữ nguyên hit-area 44px cho các button thật.
- C: `pointer-events: none` cho mọi `.tl-icon-btn::after` — KHÔNG được: phá hit-area 44px của #300.
