## Báo cáo Round 1 — FAB Đơn của tôi + Giỏ hàng

Worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab`, nhánh `feat/shop-floating-cart`, không commit/push.

### 1. Đã làm
- `src/components/shop/CartLink.tsx`: `ShopCartLink({ floating = false }: { floating?: boolean } = {})`. Không floating → Fragment cũ. Floating → bọc 2 Link trong `<div className="tl-shop-fab">`. Link giỏ thêm `is-lit` chỉ khi `floating && count !== null && count > 0`. Giữ guard `!user`, href, icon, badge 99+, CART_ARIA, thứ tự Đơn → Giỏ.
- 5 trang catalogue: `<ShopCartLink floating />` + `tl-shop-has-fab` trên `.tl-shop-page` nhánh chính (42/96/91/104/260). Loading/error/404 không đổi. Buybar PDP không đổi.
- `shop.css`: block FAB sau `.tl-shop-topline > .tl-shop-crumbs` (~1925) theo spec; `.tl-shop-iconbtn:active { transform: scale(0.96) }` sau `:hover` (506). Chỉ token có sẵn. Selector `.tl-shop-buybar[data-shown="true"]` khớp `ProductDetail.tsx:537`.
- `CartLink.test.tsx`: giữ 4 test cũ, thêm 7 test (5 spec + CSS invariant regex).

### 2. git diff --stat
```
 src/components/shop/CartLink.tsx                | 13 ++++--
 src/components/shop/__tests__/CartLink.test.tsx | 60 +++++++++++++++++++++++++
 src/pages/shop/ProductDetail.tsx                |  4 +-
 src/pages/shop/ShopCategory.tsx                 |  4 +-
 src/pages/shop/ShopHome.tsx                     |  4 +-
 src/pages/shop/ShopSearch.tsx                   |  4 +-
 src/pages/shop/ShopStore.tsx                    |  4 +-
 src/styles/shop.css                             | 40 +++++++++++++++++
 8 files changed, 119 insertions(+), 14 deletions(-)
```
Phạm vi mục 4: đúng 8 file; 4 trang Cart/Checkout/Orders/OrderDetail sạch; grep 2 dòng/trang (5/5); không màu literal mới.

### 3. Kiểm chứng
| Lệnh | Kết quả |
|---|---|
| `npx vitest run src/components/shop src/styles` | exit 0 — 10 files, 227 passed (gồm contrast) |
| `npm run lint` | exit 0 — 0 errors, 31 warnings (baseline, đều ở src/proto) |
| `npx tsc -b --noEmit` | exit 0 |
| `npm run build && node scripts/check-bundle-size.mjs` | exit 0 — INITIAL 225.4/280, CODE 1661.4/1800, CONTENT 466.9/600 KB |

### 4. Còn thiếu / lệch
- Nhịp sáng tùy chọn khi count tăng: **KHÔNG làm** (cần state/effect theo dõi count; chỉ class theo count sẽ chạy lại mỗi lần mount).
- Test CSS invariant: có làm.
- Thêm `= {}` default vào chữ ký để call-site không props type-safe; DOM không đổi.
- Chưa kiểm tra trình duyệt.
