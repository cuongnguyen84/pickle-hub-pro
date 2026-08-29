# Nhiệm vụ: thêm giá gốc, badge giảm giá và lối vào Seller Hub

Thực hiện trực tiếp trên codebase ThePickleHub tại:

```text
/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-fab
```

Branch mục tiêu:

```text
feat/shop-discount-badge-seller-entry
```

Stack: React 18, TypeScript, Vite, Supabase Postgres RPCs, Cloudflare Pages. Worktree được tạo từ `origin/main` commit `6cd211d4`; `node_modules` đã được symlink.

Mục tiêu:

1. Cho phép seller nhập thủ công “Giá gốc”; hệ thống chỉ tính phần trăm giảm giá.
2. Hiển thị giá gốc và badge đỏ `-XX%` trên product card, PDP và buybar theo đúng quy tắc bên dưới.
3. Thêm các lối vào `/seller` hoặc trạng thái đơn mở shop cho seller.
4. Wire `compare_at_price_vnd` xuyên suốt database RPC, types, editor, public projection/search và UI.
5. Bổ sung unit/integration tests và pgTAP tương ứng.

Không deploy, không apply migration lên production và không commit/push nếu không được yêu cầu.

## 1. Chuẩn bị và khảo sát

Trước khi sửa:

1. `cd` vào đúng worktree, xác nhận branch và xem `git status`.
2. Không ghi đè hoặc hoàn tác thay đổi có sẵn không thuộc nhiệm vụ.
3. Đọc các implementation hiện tại trước khi chỉnh sửa, đặc biệt:
   - `supabase/migrations/20260811120000_shop_phase2a_catalog.sql`
   - `supabase/migrations/20260811200000_shop_product_editor.sql`
   - `supabase/migrations/20260811210000_shop_variants_inventory.sql`
   - `supabase/migrations/20260813090000_shop_p2b_public_read.sql`
   - `supabase/migrations/20260823090000_shop_product_specs.sql`
   - `supabase/tests/shop_phase2a_variants.test.sql`
   - `supabase/tests/shop_p2b_public_read.test.sql`
   - Các frontend files và tests được liệt kê bên dưới.
4. Xác minh enum status thật trong `src/integrations/supabase/shop-schema.ts`; không tự đoán ngoài schema.
5. Xác minh `useMyShop()` và `useMyApplication()` hiện gate query theo session thế nào. Việc thêm hook vào layout không được làm query cho logged-out users.
6. Dùng implementation/style hiện tại làm chuẩn. Không refactor ngoài phạm vi.

## 2. Thực hiện theo thứ tự

### A. Thêm lối vào Seller Hub

#### `src/components/layout/TheLineLayout.tsx`

Trong avatar dropdown, chèn item mới ngay sau “Giải đấu của tôi” / “My Tournaments” và trước các item Creator/Admin.

Dùng:

- `useMyShop().data`
- `useMyApplication().data?.status`
- `language === "vi" | "en"`

Quy tắc:

- Nếu có shop của owner:
  - Link `/seller`
  - VI: `Kênh người bán`
  - EN: `Seller hub`
- Nếu không có shop và application status là `submitted` hoặc `under_review`:
  - Link `/seller/application/status`
  - VI: `Đơn mở shop: đang chờ duyệt`
  - EN: `Shop application: under review`
- Nếu status là `needs_changes`:
  - Link `/seller/application/status`
  - VI: `Đơn mở shop: cần bổ sung`
  - EN: `Shop application: needs changes`
- Status khác, loading hoặc không có dữ liệu: không render item.
- Không thêm icon/import icon.
- Link phải kế thừa `.tl-dropdown a`.
- Có `onClick={() => setAvatarOpen(false)}`.
- Thêm đúng comment:

```ts
// ponytail: owner-only (useMyShop); shop_members không owner chưa thấy
```

Bảo đảm hooks không bật network query khi chưa đăng nhập. Nếu gating hiện tại chưa đủ, sửa tối thiểu ở hook và thêm test phù hợp.

#### `src/pages/shop/ShopHome.tsx`

Bên trong `.tl-shop-topline`, trước `<ShopCartLink floating />`, nếu `useMyShop().data` tồn tại thì render:

```tsx
<nav className="tl-shop-crumbs" aria-label="Lối tắt người bán">
  <Link to="/seller" className="tl-crumb">
    Quản lý shop<span aria-hidden="true"> →</span>
  </Link>
</nav>
```

Không có shop thì không render gì.

Trong `src/styles/shop.css`:

- `.tl-crumb` có `min-height: 44px`.
- `.tl-shop-crumbs` có `flex: 1`.
- Nếu chưa có, thêm:

```css
.tl-shop-crumbs a:hover {
  color: var(--tl-fg);
}
```

### B. Migration và pgTAP

#### Migration mới

Tạo đúng một migration mới:

```text
supabase/migrations/20260829120000_shop_compare_at_price.sql
```

Timestamp `20260829120000` (đã lớn hơn `20260828160000`; nếu trùng file có sẵn thì +1 giờ). Không sửa các migration lịch sử để thay thế migration mới. Không thêm `NOTIFY pgrst`.

Hạ tầng đã có và phải tái sử dụng:

```sql
product_variants.compare_at_price_vnd INTEGER
```

với constraint:

```sql
CONSTRAINT product_variants_compare_range
CHECK (
  compare_at_price_vnd IS NULL
  OR (
    compare_at_price_vnd BETWEEN 0 AND 2000000000
    AND compare_at_price_vnd > price_vnd
  )
)
```

##### Helper mới

Tạo:

```sql
public.product_compare_at_vnd(jsonb) RETURNS INTEGER
```

Yêu cầu:

- Trả `NULL` khi đầu vào là SQL NULL, JSON null hoặc giá trị không tồn tại.
- Với giá trị có mặt, parse/validate giống `public.product_price_vnd(jsonb)`:
  - Chấp nhận JSON number hoặc numeric string.
  - Phải là số nguyên.
  - Phải nằm trong range hiện có.
- Sao chép đúng function attributes, volatility và security properties của `product_price_vnd`.
- Không dùng trực tiếp `product_price_vnd` cho trường optional vì hàm đó raise khi NULL.

##### Năm RPC phải `CREATE OR REPLACE`

Giữ chữ ký hàm chính xác. Sao chép body mới nhất từ migration được chỉ định, chỉ thêm xử lý `compare_at_price_vnd`; không làm thay đổi hành vi không liên quan.

1. `product_create`
   - Nguồn mới nhất: `20260811210000_shop_variants_inventory.sql`, khoảng dòng 575.
   - Thêm `compare_at_price_vnd` vào variant `INSERT`.
   - Parse bằng `public.product_compare_at_vnd(...)`.
   - Kiểm tra column list và `VALUES` có cùng arity.

2. `product_update`
   - Nguồn mới nhất: `20260823090000_shop_product_specs.sql`.
   - Variant `INSERT` thêm `compare_at_price_vnd`.
   - Variant `UPDATE` dùng đúng semantics:
   
   ```sql
   CASE
     WHEN _variant ? 'compare_at_price_vnd'
       THEN public.product_compare_at_vnd(_variant -> 'compare_at_price_vnd')
     ELSE compare_at_price_vnd
   END
   ```
   
   - Gửi `null` nghĩa là clear.
   - Key vắng mặt nghĩa là giữ giá trị hiện tại.
   - Mirror pattern `price_vnd` trong `20260811210000_shop_variants_inventory.sql`, khoảng dòng 422–432.

3. `product_variants_reconcile`
   - Nguồn mới nhất: `20260811210000_shop_variants_inventory.sql`, khoảng dòng 813.
   - Trong `privileged_write`, bổ sung cả:
     - `UPDATE` khoảng dòng 960
     - `INSERT` khoảng dòng 976
   - Đọc `_row -> 'compare_at_price_vnd'`.
   - Semantics update phải giữ/clear theo presence của key như trên nếu đó là pattern hiện hành.

4. `product_public_projection`
   - Nguồn mới nhất: `20260823090000_shop_product_specs.sql`.
   - Variant JSONB thêm:
   
   ```sql
   'compare_at_price_vnd', v.compare_at_price_vnd
   ```

5. `shop_public_search(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, UUID, INTEGER)`
   - Nguồn mới nhất: `20260813090000_shop_p2b_public_read.sql`, bắt đầu khoảng dòng 240.
   - Giữ chữ ký chính xác.
   - Card JSONB khoảng dòng 335 thêm:
     - `discount_pct_max`
     - `compare_at_min`
   - Chỉ xét variants của product không retired.
   - Công thức phần trăm phải đúng:
   
   ```sql
   max(floor(100 - v.price_vnd * 100.0 / v.compare_at_price_vnd))::int
   ```
   
   với `compare_at_price_vnd IS NOT NULL`; không có discount thì `NULL`.
   - `compare_at_min` là compare-at của variant có `price_vnd = price_min`.
   - Khi nhiều variant cùng `price_min`, dùng một rule deterministic, ví dụ:
   
   ```sql
   min(compare_at_price_vnd) FILTER (WHERE price_vnd = price_min)
   ```
   
   - Ghi SQL comment ngắn mô tả tie-break rule đã chọn.
   - Không làm thay đổi search/order/pagination/access-control hiện tại.
   - Giữ các dòng `REVOKE`/`GRANT` giống hệt file nguồn hiện tại.

Sau khi viết migration, đọc lại thủ công toàn bộ SQL để kiểm tra:

- Mọi cặp `$$` đóng/mở đúng.
- Chữ ký hàm đúng.
- Column lists khớp `VALUES`.
- Alias/subquery không tham chiếu sai scope.
- `CASE` phân biệt đúng key absent và explicit null.
- `REVOKE`/`GRANT` không bị thay đổi.

#### pgTAP bắt buộc

Docker đang down; không chạy `supabase db reset` hoặc local pgTAP. Tuy vậy vẫn phải viết test theo đúng style hiện có:

```sql
BEGIN;
SELECT plan(N);
...
SELECT throws_ok(
  format($$...$$, ...),
  '23514',
  NULL,
  'message'
);
SELECT * FROM finish();
ROLLBACK;
```

Đọc kỹ hai file test trước, giữ fixtures/auth setup hiện có và tăng `plan(N)` đúng bằng tổng số assertion.

Trong `supabase/tests/shop_phase2a_variants.test.sql`, thêm ba case:

1. `product_update` với variant có `compare_at_price_vnd: 1500000`, lớn hơn sale price → DB column bằng `1500000`.
2. Update cùng variant với `compare_at_price_vnd: null` → DB column là `NULL`.
3. `compare_at_price_vnd <= price_vnd` → `throws_ok(..., '23514', NULL, ...)`.

Trong `supabase/tests/shop_p2b_public_read.test.sql`, thêm case:

- Product có `price_vnd = 780000` và `compare_at_price_vnd = 1000000`.
- Card trả bởi `shop_public_search` có:
  - `discount_pct_max = 22`
  - `compare_at_min = 1000000`

Không được bỏ pgTAP chỉ vì local Docker không chạy. Trong báo cáo cuối phải nói rõ pgTAP chưa chạy local và sẽ do CI chạy.

### C. Frontend types, helper, errors và serialization

#### Types

Cập nhật:

- `src/integrations/supabase/shop-schema.ts`
  - Trong `ProductProjection.variants[]` thêm:
  
  ```ts
  compare_at_price_vnd?: number | null;
  ```

- `src/hooks/shop/usePublicShop.ts`
  - Trong `ProductCard` thêm:
  
  ```ts
  discount_pct_max?: number | null;
  compare_at_min?: number | null;
  ```

- `src/hooks/shop/useSellerProducts.ts`
  - Thêm `compare_at_price_vnd` vào `LIST_COLUMNS` để edit form load được giá trị.

#### Pure discount helpers

Tạo module nhỏ độc lập, ví dụ:

```text
src/lib/shop/discount.ts
src/lib/shop/__tests__/discount.test.ts
```

Đặt các helper thuần dùng chung tại đây, tối thiểu gồm:

- Tính discount integer bằng đúng công thức floor của RPC.
- Parse/validate compare-at input cần dùng bởi single form và VariantEditor.
- Không import hook, page hoặc component vào unit test chỉ để test helper.
- Không tạo dependency mới.
- Phân biệt message theo context nếu UI single form và VariantEditor yêu cầu câu non-numeric khác nhau.

Helper phải đảm bảo:

- Không discount nếu compare-at không hợp lệ hoặc không lớn hơn sale price.
- Công thức frontend và SQL cho cùng kết quả.
- Test các biên: empty, numeric, non-numeric, bằng sale price, nhỏ hơn sale price, và `780000/1000000 => 22`.

#### Variant matrix

Trong `src/lib/shop/variantMatrix.ts`:

- `VariantRow` thêm:

```ts
compareAtVnd: string;
```

- `""` biểu diễn null trong editor.
- Serialize khoảng dòng 279 phải emit:

```ts
compare_at_price_vnd: number | null
```

- Dùng helper thuần khi phù hợp.
- Cập nhật `src/lib/shop/__tests__/variantMatrix.test.ts`, bao gồm empty → null và giá hợp lệ.

#### Error mapping

Trong `src/lib/shop/errors.ts`:

- Với code `23514` và `raw` chứa `product_variants_compare_range`, trả đúng:
  
  ```text
  Giá gốc phải lớn hơn giá bán.
  ```

- Các lỗi `23514` khác giữ nguyên generic message hiện tại.
- Không leak constraint name trong message.
- Thêm test vào `src/lib/shop/__tests__/errors.test.ts`.

### D. Seller single-product form

Sửa `src/pages/shop/SellerProductForm.tsx`, section 3, price grid khoảng dòng 747.

Thêm field thứ ba:

- `id="p-compare"`
- Label chính xác:
  
  ```text
  Giá gốc (₫) — không bắt buộc
  ```
- `inputMode="numeric"`
- `aria-invalid` dựa trên `errors.compare_at_price_vnd`
- Đăng ký ref trong `fieldRefs` để focus-on-error hoạt động như các field khác.
- `aria-describedby` trỏ tới live hint.
- Empty phải serialize/send thành `null`.

Validation client, chặn submit và render qua `Field.error` với `role="alert"`:

- Non-numeric:
  
  ```text
  Chỉ nhập số, không dấu chấm.
  ```

- Compare-at nhỏ hơn hoặc bằng sale price:
  
  ```text
  Giá gốc phải lớn hơn giá bán.
  ```

Live hint:

- Empty:
  
  ```text
  Giá trước giảm. Người mua thấy giá này gạch ngang và % giảm.
  ```

- Có compare-at nhưng sale price chưa nhập:
  
  ```text
  Nhập giá bán trước để tính % giảm.
  ```

- Cả hai hợp lệ:
  
  ```text
  Người mua thấy: {vnd} gạch ngang · -{pct}%
  ```

`{vnd}` phải dùng formatter VND hiện có; `{pct}` dùng helper floor chung.

Ngay dưới price grid, chỉ khi compare-at có giá trị hợp lệ, render `.tl-shop-hint`:

```text
Chỉ nhập giá shop thật sự từng bán món này. Giá gốc đặt cho có sẽ bị gỡ khi kiểm duyệt.
```

Cập nhật fixtures và assertions trong:

```text
src/pages/shop/__tests__/SellerProductForm.save.test.tsx
```

Test tối thiểu (mở rộng file save.test có sẵn, đừng tạo harness mới): (a) compare ≤ price → không gọi RPC + có text lỗi; (b) hợp lệ → payload gửi `compare_at_price_vnd` đúng số; (c) rỗng → payload `null`. Focus/aria-invalid `tester` kiểm trên Chrome.

### E. VariantEditor

Sửa `src/components/shop/VariantEditor.tsx`.

#### RowCells và table

Thêm input thứ tư ngay sau “Giá”:

- `aria-label="Giá gốc {label}"`
- `placeholder="không giảm"`
- Numeric input.
- Có `aria-invalid` khi lỗi.

Desktop header thêm sau “Giá (₫)”:

```text
Giá gốc (₫)
```

Trong `src/styles/shop.css`, grid hiện khoảng dòng 687:

```css
1fr 1fr 1fr
```

đổi thành:

```css
1fr 1fr 1fr 1fr
```

Mobile giữ kiểu stack dọc hiện tại.

#### Validation và messages

`validateRows` phải validate `compareAtVnd`:

- Compare-at nhỏ hơn hoặc bằng price:
  
  ```text
  Giá gốc phải lớn hơn giá bán.
  ```

- Non-numeric:
  
  ```text
  Chỉ nhập số.
  ```

`RowMessages` nối message bằng:

```text
 · 
```

`hasRowErrors` phải chặn Save với message hiện có:

```text
Còn ô chưa hợp lệ
```

Nếu row có compare-at hợp lệ, hiển thị hint:

```text
Người mua thấy -{pct}%
```

Style hint: `12px`, màu `var(--tl-fg-3)`.

#### BulkPanel

Mở rộng `BulkField` với:

```ts
"compareAtVnd"
```

Thêm option:

```text
Giá gốc
```

Title:

```text
Đặt giá gốc cho N phiên bản cùng lúc
```

Undo hiện có phải tiếp tục hoạt động cho bulk compare-at.

#### Trust warning

Dưới `MatrixTable`, nếu có ít nhất một row có compare-at, render `.tl-shop-hint`:

```text
Chỉ nhập giá shop thật sự từng bán món này. Giá gốc đặt cho có sẽ bị gỡ khi kiểm duyệt.
```

Cập nhật `src/components/shop/__tests__/VariantEditor.test.tsx` theo pattern test hiện có, tối thiểu: ô "Giá gốc" render, dòng sai → Save bị chặn, bulk "Giá gốc" áp cho N dòng. `validateRows`/serialize đã test ở `variantMatrix.test.ts`/`discount.test.ts` — đừng lặp.

### F. Product card

Sửa `src/components/shop/ProductCard.tsx`.

Đổi header comment hiện nói “There is no struck-out original price” thành đúng câu:

```text
Giá gạch và badge % chỉ in khi `compare_at_min`/`discount_pct_max` đến từ server; không suy diễn client.
```

#### Badge

Chỉ render khi `discount_pct_max >= 1`. `null`, `undefined` hoặc `0` không được tạo node.

Markup chính xác:

```tsx
<span className="tl-pcard-off">
  <span className="tl-shop-sr">giảm </span>-{n}%
</span>
```

Trong `src/styles/shop.css`, thêm `.tl-pcard-off` bằng geometry của `.tl-pcard-flag`, nhưng:

- `right: 8px`, không dùng `left`.
- `background: var(--shop-danger-fill)`.
- `color: var(--shop-on-danger)`.
- Border `1px` cùng màu background.
- Không thêm media query cho badge.
- Badge phải cùng tồn tại với “Hết hàng”: out-of-stock bên trái, discount bên phải.
- Skeleton không vẽ badge.

#### Giá gạch

Chỉ render strike trong DOM nếu tất cả điều kiện đúng:

```ts
price_min === price_max
compare_at_min != null
compare_at_min > price_min
```

Bên trong `.tl-pcard-price`, đặt strike trước sale price:

```tsx
<span className="tl-shop-price-was">
  <span className="tl-shop-sr">giá gốc </span>
  {formatted}
</span>
```

Margin-right `6px`.

CSS:

```css
.tl-pcard-price .tl-shop-price-was {
  display: none;
}

@media (min-width: 414px) {
  .tl-pcard-price .tl-shop-price-was {
    display: inline;
  }
}
```

Price cluster phải `nowrap`, không xuống dòng ở 320/375/414px.

Test (jsdom, nhỏ gọn — 1 file `src/components/shop/__tests__/ProductCard.test.tsx` nếu chưa có): badge có/không theo `discount_pct_max`, strike có/không theo gate 3 điều kiện, cùng tồn tại với "Hết hàng", accessible name. KHÔNG test responsive/ẩn dưới 414px bằng jsdom — phần đó `tester` kiểm trên Chrome. Với sản phẩm mẫu giảm 30%, Link accessible name phải chứa:

```text
giảm 30%
giá gốc 2.400.000₫
```

### G. Product detail page và buybar

Sửa `src/pages/shop/ProductDetail.tsx`, tập trung vào price block khoảng dòng 332–338, main price khoảng 501–517 và buybar khoảng 540–546.

Dùng helper discount chung, cùng công thức:

```ts
Math.floor(100 - price * 100 / compareAt)
```

#### Khi đã resolved variant

Nếu:

```ts
compare_at_price_vnd > price_vnd
```

main price hiển thị theo thứ tự:

1. Strike `.tl-shop-price-was`, font `14px`.
2. Sale price, `22px/700`.
3. Badge `.tl-pdp-off`.

`.tl-pdp-off`:

- `background: var(--shop-danger-fill)`.
- `color: var(--shop-on-danger)`.
- Border cùng màu nền.
- Pill.
- `12px/600`.
- Padding `2px 8px`.
- `vertical-align: middle`.
- Có SR prefix `giảm `.

Strike có SR prefix `giá gốc `.

Nếu chuyển sang variant không discount, cả strike và badge phải biến mất.

#### Khi chưa chọn variant

- Giữ price range.
- Không render strike.
- Badge là `-XX%` lớn nhất tính trên `variants[]` hợp lệ.
- Không có discount thì UI không đổi.

Price `<p>` phải có:

```css
display: flex;
flex-wrap: wrap;
gap: 6px 8px;
align-items: baseline;
```

Mỗi span giá/badge phải `nowrap`.

#### Buybar

Trong `.tl-shop-buybar-price`:

- Khi resolved variant có compare-at hợp lệ, hiển thị strike `12.5px` trước sale price.
- Không có badge.
- Ẩn strike dưới `360px`.
- Strike phải cập nhật theo resolved variant.

#### Disclaimer

Đổi thành đúng chuỗi, không sửa dấu câu:

```text
Giá, giá gốc và tình trạng hàng do shop tự khai. ThePickleHub kiểm duyệt nội dung trước khi hiển thị.
```

Test: chỉ helper thuần (pct, max-over-variants, gate `compare_at > price`) trong `discount.test.ts`. KHÔNG viết test render cho `ProductDetail.tsx` (page nặng, đã có cảnh báo bẫy coverage khi import cả page) — variant switching/buybar/disclaimer do `tester` kiểm trên Chrome.

## 3. CSS và accessibility constraints

Tái sử dụng các token/class sẵn có trong `src/styles/shop.css`:

- `--shop-danger-fill`
- `--shop-on-danger`
- `--shop-price-was`
- `.tl-shop-price-was`
- `.tl-shop-sr`
- `.tl-pcard-flag`

Không thêm màu hex mới và không thêm token màu mới.

Mọi SR text phải giữ đúng chữ thường:

- `giảm `
- `giá gốc `

Các badge không được chỉ cung cấp thông tin bằng màu sắc; accessible name phải có phần trăm. Không phá focus behavior, `role="alert"` hay touch target 44px.

## 4. Hard constraints

- Không thêm dependency.
- Không thêm icon import.
- Không tạo `.legacy.tsx`.
- Không sửa route inventory.
- Không sửa SSR prerender.
- Không sửa native app.
- Không triển khai bulk import; phần đó deferred phase 2.
- Không apply migration lên production.
- Không thêm `NOTIFY pgrst`.
- Giữ code ngắn gọn vì CODE bundle chỉ còn khoảng 53 KB gzip headroom.
- `src/styles/__tests__/contrast.test.ts` phải tiếp tục pass.
- Pure helpers phải nằm trong standalone module có unit test; không import nguyên hook/page/component chỉ để test helper.
- Không suy diễn giá gốc hoặc phần trăm trên card khi server không trả field tương ứng.
- Giữ nguyên chữ ký RPC, grants, security model và behavior không liên quan.
- Mọi chuỗi được ghi là “chính xác” phải giữ nguyên nội dung và dấu câu.

### Gotcha riêng của repo (Codex không biết, phải tuân)

- KHÔNG chạy `npx supabase gen types` — RPC trả JSONB, `types.ts` không đổi; chỉ sửa tay `shop-schema.ts`/`usePublicShop.ts`.
- `product_variants_reconcile` là full-row replace (bulk import): đọc `_row -> 'compare_at_price_vnd'` với `product_compare_at_vnd()` — key vắng → NULL (đúng semantic replace), KHÔNG dùng CASE giữ giá trị cũ ở đây. Ghi 1 dòng comment SQL nói rõ.
- `product_compare_at_vnd`: kiểm tra `_v IS NULL OR jsonb_typeof(_v) = 'null'` trước khi delegate — `jsonb -> 'key'` trả SQL NULL khi key vắng và JSON null khi gửi null; cả hai → NULL.
- `errors.ts` hiện cố ý KHÔNG lộ tên constraint trong message; giữ nguyên tinh thần đó — match trên `raw` nhưng chuỗi trả về không chứa `product_variants_compare_range`.
- `useMyShop`/`useMyApplication` nằm ở `src/hooks/shop/useSellerApplication.ts`. Đọc `enabled:` của chúng; layout render cho cả khách vãng lai — nếu hook chưa gate `enabled: !!session` thì thêm, và đừng để `/shop` topline gọi query khi chưa đăng nhập.
- Bundle: `TheLineLayout.tsx` nằm trong chunk INITIAL — import hook shop vào đó có thể kéo `@/hooks/shop/*` + `shop-client` vào initial bundle. Sau `check-bundle-size.mjs`, nếu INITIAL/CODE vượt → chuyển 2 link dropdown thành component nhỏ `React.lazy` hoặc gate import; báo rõ số đo trước/sau.
- Không commit/push; orchestrator làm. Không `git add -A`; liệt kê file trong báo cáo.

## 5. Verification

Chạy từ đúng worktree, sửa mọi failure do thay đổi này gây ra:

```bash
npx tsc -b --noEmit
npm run lint
npx vitest run src/components/shop src/pages/shop src/lib src/styles src/hooks/shop src/components/layout
npm run build && node scripts/check-bundle-size.mjs
```

Docker đang down (`docker ps` sẽ lỗi), vì vậy KHÔNG thử `supabase start`/`supabase db reset`/pgTAP local — đừng mất thời gian retry. Vẫn phải đọc soát SQL và viết đầy đủ pgTAP; CI sẽ chạy chúng khi push.

Sau test, kiểm tra `git diff --check`, `git status --short` và rà lại diff để bảo đảm không có file ngoài scope hoặc accidental formatting churn.

## 6. Acceptance criteria

1. Card `discount_pct_max ≥ 1` → `.tl-pcard-off` top-right, text `-N%`, bg `--shop-danger-fill`, fg `--shop-on-danger`; null/0 → no node.
2. Card out-of-stock + discounted → both `.tl-pcard-flag` (left) and `.tl-pcard-off` (right).
3. Card strike price in DOM only when `price_min === price_max && compare_at_min > price_min`; hidden via CSS <414px; never wraps to 2 lines at 320/375/414.
4. Card Link accessible name contains "giảm 30%" and "giá gốc 2.400.000₫" (for such a product).
5. PDP: variant with compare_at → strike + badge; switching to a non-discounted variant → both disappear; no selection → badge max only; PDP % == card % (floor).
6. Buybar strike follows resolved variant, no badge, hidden <360px.
7. PDP disclaimer exact string.
8. Single form: compare ≤ price → error "Giá gốc phải lớn hơn giá bán.", aria-invalid, submit blocked, field focused; valid → hint "Người mua thấy: … · -N%"; cleared → null sent.
9. `errors.ts` maps 23514 + `product_variants_compare_range` → same string (unit test).
10. VariantEditor: "Giá gốc (₫)" column + 4th mobile input; invalid row red + "Còn ô chưa hợp lệ"; bulk "Giá gốc" + Undo; empty serializes to null.
11. Avatar dropdown per spec, positioned after "Giải đấu của tôi"; EN strings when `language === "en"`.
12. `/shop` topline: shop owner sees "Quản lý shop →" to `/seller`, ≥44px tall; non-owner sees nothing.
13. No new hex/tokens; contrast + bundle gates green; route inventory unchanged.
14. ProductCard.tsx header comment updated.
15. Migration: 5 RPCs CREATE OR REPLACE with identical signatures + new `product_compare_at_vnd`; pgTAP cases added with correct plan(N).
16. All four verification commands pass; coder's report lists changed files and states pgTAP was not run locally.

## 7. Báo cáo cuối

Kết thúc bằng báo cáo ngắn gồm:

- Những gì đã hoàn thành.
- Danh sách file đã thay đổi.
- Từng command verification đã chạy và kết quả.
- Xác nhận `git diff --check`.
- Nói rõ pgTAP không chạy local vì Docker down và CI sẽ chạy.
- Bất kỳ điểm nào lệch spec; nếu có, giải thích lý do cụ thể.