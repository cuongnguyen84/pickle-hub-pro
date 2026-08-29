# Round 1 — FAB "Đơn của tôi" + Giỏ hàng trên 5 trang catalogue Shop (mobile)

## 0. Môi trường (bắt buộc)

Worktree: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab`, nhánh `feat/shop-floating-cart` (từ `origin/main` 3e5f6365). `node_modules` là symlink về repo gốc — không cài package. **Mọi lệnh đều chạy trong worktree này** (cwd có thể reset giữa các lệnh — luôn `cd` hoặc dùng đường dẫn tuyệt đối). Không commit, không push; chỉ để thay đổi trong working tree.

Trước khi sửa:
```bash
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab && git branch --show-current && git status --short
```
Sai worktree/nhánh → dừng, báo lại.

## 1. Mục tiêu

Trên 5 trang catalogue (`ShopHome`, `ShopSearch`, `ShopCategory`, `ShopStore`, `ProductDetail`), ở viewport **<900px**, hai link hiện có ("Đơn của tôi" + icon giỏ có badge) đang nằm inline trong `.tl-shop-topline` và cuộn mất theo trang. Biến chúng thành cụm nút nổi cố định góc dưới phải, phía trên BottomNav. Ở **≥900px** giữ inline y như hiện tại. Nút giỏ có hiệu ứng tĩnh "2 light" (2 lớp box-shadow xanh) **chỉ khi count > 0**, chỉ trên mobile.

## 2. Ràng buộc

- Không component mới, không hook/RPC mới, không sửa `CartAddedToast`, không đổi copy "Đơn của tôi", không đổi aria-label.
- Không mount FAB ở `App.tsx`/`ShopShell.tsx`/shell dùng chung. Không ẩn-khi-cuộn. Không pulse lặp.
- Không hex/màu literal mới (`#…`, `rgb()`, `hsl()`), không token mới trong `shop.css` — `src/styles/__tests__/contrast.test.ts` đọc file này. Không sửa test contrast.
- Không đụng `src/pages/shop/{Cart,Checkout,Orders,OrderDetail}.tsx`. Không đụng `/apple`.
- Không cài dependency.

## 3. Thay đổi theo file

### 3.1 `src/components/shop/CartLink.tsx`

- `ShopCartLink({ floating = false }: { floating?: boolean })`.
- Giữ nguyên: `if (!user) return null` (cả hai chế độ), `useCartCount()`, href `/shop/orders` rồi `/shop/cart`, icon, badge `99+`, `CART_ARIA`, thứ tự Đơn → Giỏ.
- `floating` falsy → render Fragment cũ, DOM y nguyên (4 test cũ không đổi).
- `floating` true → bọc đúng 2 `<Link>` trong `<div className="tl-shop-fab">` (wrapper không role/aria).
- Link giỏ: thêm class `is-lit` **chỉ khi** `floating && count !== null && count > 0` (giữ `tl-shop-iconbtn`). Đây là hook cho CSS "2 light" và test jsdom.

### 3.2 Năm trang `src/pages/shop/{ShopHome,ShopSearch,ShopCategory,ShopStore,ProductDetail}.tsx`

- `<ShopCartLink />` → `<ShopCartLink floating />` (chỉ instance trong `.tl-shop-topline`).
- **Giữ** `<div className="tl-shop-topline">` ở mọi trang (Home/Search topline rỗng trên mobile cao 0px — không xử lý gì).
- Thêm class `tl-shop-has-fab` vào `<div className="tl-shop-page">` của **nhánh render chính** (ShopHome:42, ShopSearch:96, ShopCategory:91, ShopStore:104, ProductDetail:260) — không thêm vào nhánh loading/error/404.
- ProductDetail: giữ nguyên `className={ordering ? "tl-pdp tl-shop-has-buybar" : "tl-pdp"}` và toàn bộ logic buybar/add-to-cart.

### 3.3 `src/styles/shop.css`

Đặt cạnh block `.tl-shop-topline` (~dòng 1915). Dùng token có sẵn. **Mọi style riêng của FAB nằm trong `@media (max-width: 899px)`** — lý do: `.tl-shop-btn` gốc có `background: var(--tl-surface-2); border: 1px solid var(--tl-border-2)`, nếu reset về transparent ở desktop sẽ phá nút "Đơn của tôi".

```css
/* Cụm nổi mobile: Đơn của tôi + giỏ. Desktop: chỉ là wrapper flex ngang trong topline. */
.tl-shop-fab { display: flex; align-items: center; gap: 8px; }

@media (max-width: 899px) {
  .tl-shop-fab {
    position: fixed;
    right: 12px;
    bottom: calc(var(--shop-bottomnav) + var(--shop-safe-b) + 12px);
    z-index: 44; /* buybar 60 > toast 45 > FAB 44 > header 40 */
    flex-direction: column;
    align-items: flex-end;
  }
  .tl-shop-fab > a {
    background: var(--tl-bg-elev);
    border: 1px solid var(--tl-border-2);
    border-radius: var(--tl-radius);
    box-shadow: var(--shop-shadow-2);
  }
  .tl-shop-fab > .tl-shop-btn { min-height: var(--shop-tap); white-space: nowrap; }
  .tl-shop-fab > .tl-shop-iconbtn { width: 48px; height: 48px; }
  /* "2 light" — 2 lớp sáng xanh tĩnh, chỉ khi có hàng trong giỏ */
  .tl-shop-fab > .tl-shop-iconbtn.is-lit {
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--tl-green) 18%, transparent),
      0 0 18px color-mix(in srgb, var(--tl-green) 35%, transparent),
      var(--shop-shadow-2);
  }
  /* PDP: buybar hiện thì nhường chỗ */
  body:has(.tl-shop-buybar[data-shown="true"]) .tl-shop-fab { display: none; }
  /* Chừa đáy để card cuối không bị FAB che (cùng cơ chế .tl-shop-has-buybar) */
  .tl-shop-page.tl-shop-has-fab { padding-bottom: calc(96px + 112px); }
}

@media (min-width: 900px) {
  .tl-shop-fab { position: static; flex-direction: row; }
}
```

Thêm toàn cục (cạnh `.tl-shop-iconbtn:hover`, dòng ~505):
```css
.tl-shop-iconbtn:active { transform: scale(0.96); }
```

Tùy chọn (bỏ nếu >15 dòng): nhịp sáng 1 lần khi count tăng — animation ≤600ms, `1` lần, không `infinite`; reduced-motion đã được block `.tl-shop *` ép về 0.001ms nên không cần rule riêng. Nếu làm, đặt class theo count trong JSX, không thêm state/effect phức tạp.

### 3.4 `src/components/shop/__tests__/CartLink.test.tsx`

Giữ 4 test cũ; dùng mock/setup hiện có (`state.signedIn`, `state.count`). Thêm:
1. `floating` + login: đúng 1 `.tl-shop-fab`; bên trong đúng 2 `<a>`; `a[0]` href `/shop/orders`, `a[1]` href `/shop/cart`.
2. Không `floating`: không có `.tl-shop-fab`, 2 link vẫn đúng.
3. `floating` + signed-out: `container.querySelector("a")` và `.tl-shop-fab` đều null.
4. `floating` + count 3: badge "3" hiện; link giỏ có cả `tl-shop-iconbtn` và `is-lit`; aria "Giỏ hàng, 3 món".
5. `floating` + count 0 và count null: không badge, không `is-lit`. Không `floating` + count 3: không `is-lit`.

Tùy chọn, rẻ: test đọc `src/styles/shop.css` bằng regex (không phụ thuộc whitespace tuyệt đối) cho 3 invariant: `.tl-shop-fab` có `z-index: 44`; `body:has(.tl-shop-buybar[data-shown="true"]) .tl-shop-fab` có `display: none`; `.tl-shop-page.tl-shop-has-fab` có `padding-bottom: calc(96px + 112px)`. Không test computed style trong jsdom.

## 4. Kiểm tra phạm vi

```bash
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab
git diff --name-only   # chỉ được: CartLink.tsx, CartLink.test.tsx, 5 page, shop.css
git diff --exit-code -- src/pages/shop/Cart.tsx src/pages/shop/Checkout.tsx src/pages/shop/Orders.tsx src/pages/shop/OrderDetail.tsx
grep -n "ShopCartLink floating\|tl-shop-has-fab" src/pages/shop/{ShopHome,ShopSearch,ShopCategory,ShopStore,ProductDetail}.tsx   # mỗi file ≥2 dòng
grep -n "tl-shop-fab\|is-lit\|z-index: 44\|tl-shop-has-fab\|scale(0.96)\|data-shown=\"true\"\]) .tl-shop-fab" src/styles/shop.css
git diff src/styles/shop.css | grep -E "^\+.*(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()"   # phải rỗng
```

## 5. Lệnh kiểm chứng bắt buộc (tất cả exit 0)

```bash
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab
npx vitest run src/components/shop src/styles
npm run lint
npx tsc -b --noEmit
npm run build && node scripts/check-bundle-size.mjs
```

Không sửa gate/test để xanh. Test trình duyệt do agent `tester` làm ở vòng sau — coder không cần chạy Chrome.

## 6. Báo cáo lại

Danh sách file đổi (`git diff --stat`), output 4 lệnh mục 5, có/không làm nhịp sáng tùy chọn, bất kỳ chỗ nào lệch spec và lý do.

## 7. Acceptance criteria

1. `floating` → `.tl-shop-fab` chứa đúng 2 link (Đơn → Giỏ); không `floating` → markup cũ; 4 test cũ pass.
2. Chưa login → `null` cả hai chế độ.
3. count>0 + floating → link giỏ có `is-lit` và 2 lớp box-shadow xanh, rule chỉ trong `@media (max-width: 899px)`; count 0/null hoặc không floating → không `is-lit`, không light.
4. `body:has(.tl-shop-buybar[data-shown="true"]) .tl-shop-fab { display: none }` tồn tại.
5. `.tl-shop-iconbtn:active { transform: scale(0.96) }` tồn tại.
6. `.tl-shop-fab` mobile `z-index: 44`.
7. `.tl-shop-page.tl-shop-has-fab` mobile `padding-bottom: calc(96px + 112px)`.
8. Không hex/màu literal mới trong `shop.css`; contrast test pass.
9. ≥900px: `.tl-shop-fab` `position: static`, `flex-direction: row`, không box-shadow, không background/border override → "Đơn của tôi" giữ nền `--tl-surface-2` như cũ.
10. Đúng 5 trang catalogue dùng `<ShopCartLink floating />` + `tl-shop-has-fab` trên `.tl-shop-page` chính; 4 trang Cart/Checkout/Orders/OrderDetail không đổi.
11. `vitest` (shop + styles), `lint`, `tsc -b --noEmit`, `build` + `check-bundle-size.mjs` đều xanh.
12. Không commit/push.

Kiểm chứng ở vòng sau bằng Chrome (tester): iPhone viewport Home có hàng → FAB cố định trên BottomNav khi cuộn, nút giỏ có glow xanh; PDP cuộn tới khi buybar `data-shown="true"` → FAB biến mất, cuộn ngược → hiện lại; PDP "Thêm vào giỏ" → toast nằm trên FAB, badge tăng; desktop 1280 → inline trong topline, không glow, nút Đơn giữ nền như cũ; signed-out → không có gì.

---
Ghi chú prompt-engineer: đã bác rule desktop `background: transparent` của Codex vì `.tl-shop-btn` (shop.css:247) có nền riêng. Gọi Codex: `codex exec --skip-git-repo-check -o out.md - < brief.md` (stdin), tránh treo.
