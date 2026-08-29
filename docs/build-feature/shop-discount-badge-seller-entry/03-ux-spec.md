# UX spec — Badge giảm giá + Lối vào Kênh người bán

Worktree `.claude/worktrees/shop-fab`. Không token/hex mới; mọi màu đã có trong `src/styles/shop.css` :root.

## Audit ProductCard.tsx trước khi sửa
- major: comment L10-11 "no struck-out original price" sẽ nói dối → viết lại: "Giá gạch và badge % chỉ in khi `compare_at_min`/`discount_pct_max` đến từ server; không suy diễn client."
- minor: flag "Hết hàng" (trái-trên) và badge mới chồng → badge góc **phải-trên**.
- minor: giá `nowrap + ellipsis` — giá gạch là span riêng, chỉ khi single-price, ẩn dưới 414px.

## 1. Người mua
### 1.1 Badge "-XX%" trên card
- Hiện khi `card.discount_pct_max` ≥ 1; 0/null → không render node.
- Text `-{n}%`. Class mới `.tl-pcard-off` copy `.tl-pcard-flag` (absolute, top 8px, padding 3px 8px, radius 999px, 11.5px/600, tabular-nums) nhưng `right: 8px`. Nền `var(--shop-danger-fill)`, chữ `var(--shop-on-danger)`, border 1px cùng màu nền. Không media query.
- Chung sống với "Hết hàng": trái = flag, phải = badge, cả hai cùng lúc được.
- Aria: `<span class="tl-shop-sr">giảm </span>` trước số → SR đọc "giảm 30%". Không aria-label/aria-hidden.
- Span tĩnh trong Link, kế thừa trạng thái `.tl-pcard`. Skeleton không vẽ badge. Light mode: danger tokens same both modes.

### 1.2 Giá gạch trên card
- Gate: `price_min === price_max && compare_at_min != null && compare_at_min > price_min`.
- Markup: trong `.tl-pcard-price`, span `.tl-shop-price-was` (đã có) đứng trước giá bán, `margin-right: 6px`. Cụm vẫn nowrap.
- Theo số đo thật (375px card ≈165px, chỗ chữ 123px, cần ~152px) → **giá gạch card chỉ hiện ≥ 414px**: `.tl-pcard-price .tl-shop-price-was { display: none } @media (min-width: 414px) { … display: inline }`. Badge gánh thông tin ở màn nhỏ.
- Aria: `<span class="tl-shop-sr">giá gốc </span>` trước số gạch.

### 1.3 PDP (`ProductDetail.tsx` 332-338, 501-517, 540-546)
- Block giá: `resolved` có `compare_at_price_vnd > price_vnd` → `[giá gạch .tl-shop-price-was 14px] [giá bán 22px/700] [badge .tl-pdp-off]` (cùng token badge, pill 12px/600, padding 2px 8px, vertical-align middle). % = `Math.floor(100 - price*100/compare_at)` — trùng RPC.
- Chưa chọn variant: giá khoảng + badge `-XX%` max từ `variants[]`, không gạch. Không giảm: như cũ.
- `<p>` cho phép wrap (`flex-wrap: wrap; gap: 6px 8px; align-items: baseline`), từng span nowrap.
- Aria: sr "giá gốc " / "giảm ".
- Buybar `.tl-shop-buybar-price`: chỉ giá gạch 12.5px trước giá bán khi resolved có compare_at; **không badge**; ẩn giá gạch <360px.
- Câu miễn trừ (514-517): `Giá, giá gốc và tình trạng hàng do shop tự khai. ThePickleHub kiểm duyệt nội dung trước khi hiển thị.`

## 2. Người bán
### 2.1 Form đơn (`SellerProductForm.tsx` mục 3, grid 747)
- Field thứ 3 `id="p-compare"`, label **"Giá gốc (₫) — không bắt buộc"**, `inputMode="numeric"`, `aria-invalid` theo `errors.compare_at_price_vnd`, ref vào `fieldRefs`, `aria-describedby` hint.
- Hint live: rỗng → `Giá trước giảm. Người mua thấy giá này gạch ngang và % giảm.`; hợp lệ → `Người mua thấy: {vnd} gạch ngang · -{pct}%`; thiếu giá bán → `Nhập giá bán trước để tính % giảm.`
- Error (client, chặn submit, `Field.error` role=alert): không số → `Chỉ nhập số, không dấu chấm.`; compare ≤ price → **`Giá gốc phải lớn hơn giá bán.`** (cùng chuỗi map `check_violation` trong `errors.ts`).
- Cảnh báo `.tl-shop-hint` dưới grid khi ô có giá trị hợp lệ: `Chỉ nhập giá shop thật sự từng bán món này. Giá gốc đặt cho có sẽ bị gỡ khi kiểm duyệt.` (*Cuong xác nhận vế 2*).
- Ô rỗng → gửi `null`. Trạng thái input kế thừa `.tl-shop-input`.

### 2.2 VariantEditor
- `VariantRow.compareAtVnd: string` (rỗng = null). `RowCells` input thứ 4 sau Giá: `aria-label="Giá gốc {label}"`, `placeholder="không giảm"`, numeric, aria-invalid.
- Desktop `<th>Giá gốc (₫)</th>` sau "Giá (₫)"; grid ô 687 `1fr 1fr 1fr` → `1fr 1fr 1fr 1fr`. Mobile stack dọc như cũ.
- `validateRows`: lỗi `compareAtVnd` `Giá gốc phải lớn hơn giá bán.` / `Chỉ nhập số.`; `RowMessages` nối ` · `; `hasRowErrors` chặn Lưu. Hợp lệ + có giá gốc → hint dòng `Người mua thấy -{pct}%` (12px `--tl-fg-3`).
- BulkPanel: `BulkField` thêm `"compareAtVnd"`, option "Giá gốc", tiêu đề "Đặt giá gốc cho N phiên bản cùng lúc". Hoàn tác giữ.
- Cảnh báo niềm tin `.tl-shop-hint` dưới MatrixTable khi ≥1 dòng có giá gốc.

## 3. Lối vào Kênh người bán
### 3.1 Dropdown avatar (`TheLineLayout.tsx` 683-699)
- Chèn sau "Giải đấu của tôi", trước Creator/Admin. Không icon (menu hiện không icon).
- `useMyShop().data` → `<Link to="/seller">` VI **"Kênh người bán"** / EN "Seller hub".
- Không shop + `useMyApplication().data?.status ∈ {submitted, under_review}` → `/seller/application/status` VI **"Đơn mở shop: đang chờ duyệt"** / EN "Shop application: under review"; `needs_changes` → "Đơn mở shop: cần bổ sung" / "Shop application: needs changes". Status khác → không mục. Đang loading → không render.
- Kế thừa `.tl-dropdown a`; `onClick={() => setAvatarOpen(false)}`.
- `// ponytail: owner-only (useMyShop); shop_members không owner chưa thấy`.

### 3.2 Topline `/shop` (`ShopHome.tsx:45`)
- Trong `.tl-shop-topline` trước `<ShopCartLink floating />`: `useMyShop().data` → `<nav class="tl-shop-crumbs" aria-label="Lối tắt người bán"><Link to="/seller" className="tl-crumb">Quản lý shop<span aria-hidden="true"> →</span></Link></nav>` (`.tl-crumb` min-height 44px; `.tl-shop-crumbs` flex:1 đẩy trái).
- Mobile: FAB fixed nên topline chỉ còn link này, căn trái trên hero. Thêm `.tl-shop-crumbs a:hover { color: var(--tl-fg) }` nếu chưa có (kiểm 1482-1499).

## 4. Microcopy
| Chỗ | VI | EN |
|---|---|---|
| Badge | `-30%` (sr "giảm 30%") | — |
| PDP miễn trừ | Giá, giá gốc và tình trạng hàng do shop tự khai. ThePickleHub kiểm duyệt nội dung trước khi hiển thị. | — |
| Form label | Giá gốc (₫) — không bắt buộc | — |
| Lỗi | Giá gốc phải lớn hơn giá bán. / Chỉ nhập số, không dấu chấm. | — |
| Dropdown | Kênh người bán · Đơn mở shop: đang chờ duyệt · Đơn mở shop: cần bổ sung | Seller hub · Shop application: under review · Shop application: needs changes |
| Topline | Quản lý shop → | — |

## 5. Responsive & a11y
320: badge + flag cùng ô ảnh, giá gạch ẩn; 375 ẩn; 414+ hiện. Contrast: danger tokens đã pass; `--shop-price-was` = `--tl-fg-3` AA. Không hex mới. Touch 44px sẵn. Ô mới vào fieldRefs. Không animation.

## Acceptance criteria
1. Card `discount_pct_max ≥ 1` → `.tl-pcard-off` góc phải-trên text `-N%`, nền `--shop-danger-fill`, chữ `--shop-on-danger`; null/0 → không node.
2. Card vừa hết hàng vừa giảm → cả `.tl-pcard-flag` (trái) và `.tl-pcard-off` (phải).
3. Giá gạch card chỉ trong DOM khi `price_min === price_max && compare_at_min > price_min`; CSS ẩn <414px; không 2 dòng (320/375/414).
4. Accessible name Link card chứa "giảm 30%" và "giá gốc 2.400.000₫".
5. PDP: variant có compare_at → gạch + badge; đổi sang không giảm → biến mất; chưa chọn → chỉ badge max; % PDP == % card (floor).
6. Buybar giá gạch theo resolved, không badge; ẩn <360px.
7. Câu miễn trừ PDP đúng chuỗi.
8. Form đơn: compare ≤ price → lỗi "Giá gốc phải lớn hơn giá bán.", aria-invalid, chặn submit, focus ô; hợp lệ → hint "Người mua thấy: … · -N%"; xoá → null.
9. `errors.ts` map check_violation compare_at → chuỗi (8) (test).
10. VariantEditor: cột "Giá gốc (₫)" + ô thứ 4 mobile; dòng sai đỏ + "Còn ô chưa hợp lệ"; bulk "Giá gốc" + Hoàn tác; serialize rỗng → null.
11. Dropdown avatar theo §3.1, vị trí sau "Giải đấu của tôi"; EN khi `language === "en"`.
12. `/shop` topline: có shop → "Quản lý shop →" tới `/seller`, ≥44px; không shop → không render.
13. Không hex/token mới ngoài :root; contrast + bundle xanh; route inventory không đổi.
14. Comment đầu ProductCard.tsx cập nhật.
