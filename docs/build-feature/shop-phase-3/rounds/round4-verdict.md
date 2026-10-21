# VERDICT VÒNG 4 — **ĐẠT**

## Review độc lập vòng 4 (Codex + prompt-engineer): CHƯA ĐẠT → orchestrator sửa 2 dòng → ĐẠT

### F1 (`cancelled_by`) — SẠCH, đã tự xác minh
`20260818100000:404-410` GRANT còn đúng 17 cột, `cancelled_by` đã ra, không mất cột nào mà `ORDER_SELECT`/`LIST_SELECT` cần. Assertion pgTAP nằm đúng cạnh `buyer_user_id` (`shop_orders.test.sql:227`). Đỏ-trước-xanh có thật (Failed test 12/112 → 118/118).

### F2 (view) — SẠCH
`20260818120000:205-214` có `WITH (security_barrier = true)`, cột khớp 1-1 với GRANT bảng nền, `WHERE o.buyer_user_id = auth.uid()` còn nguyên, không bật `security_invoker`. Comment đã ghi đúng lý do (quyền cột, không phải policy).

**pgTAP không vacuous, plan khớp:** đếm tay = **118**, khớp `plan(118)`. Ca buyer-scoping có đối chứng thật: `:939` đọc `PH-2699-CCCC` bằng quyền service trên bảng nền và khẳng định `= 1`, trong khi view trả `0` cho buyer 1 (`:929`) và `1` cho đơn của chính mình (`:932`). Ba assertion này chết ngay nếu fixture rỗng hoặc nếu ai bỏ `WHERE`.

**Phát hiện phụ đáng ghi:** `Omit<…,"shop_id">` là **ĐÚNG**, không phải lỗi âm thầm. `shop_order_json` (`:456-490`) build `'shop', jsonb_build_object(slug,name,state)` và **không** có key `shop_id` ⇒ shape cũ (`Omit<…,"cancelled_by">`) mới là cái sai — nó giữ `shop_id` trong `ShopOrderDetail` dù RPC không bao giờ trả. Vòng 4 vô tình sửa luôn một lỗi type có sẵn.

---

### 🔴 CHẶN — F3(b) là **no-op** cho đúng loại lỗi nó tuyên bố sửa

`src/App.tsx` predicate đọc `error.status`. `PostgrestError` (`postgrest-js/dist/index.d.mts:26-55`) chỉ có `{message, details, hint, code}` — **không có `status`**. Lỗi shop tự ném cũng vậy (`src/lib/shop/errors.ts:246` gắn `{ code }`).

Kiểm tiếp ngữ nghĩa `failureCount` trong `query-core/retryer.js:89-94`: bắt đầu **0**, chỉ `++` **sau** khi quyết định ⇒ `failureCount < 1` ở lần fail đầu là `0 < 1` = true → **vẫn retry đúng 1 lần, giống hệt `retry: 1` cũ**, rồi `sleep().then(canContinue() ? … : pause())` — bẫy pause-khi-tab-ẩn còn nguyên vẹn cho cả 25 mutation shop chưa override.

Tệ hơn cái cũ ở một điểm: comment khẳng định "the same predicate that already protected queries now protects every mutation" — **một lời hứa sai nằm đúng chỗ người sau sẽ đọc** để quyết định có cần `retry: false` hay không.

Và `npm run test` xanh **không chứng minh được gì cho A59**: mọi test đều tự dựng `QueryClient` riêng với `mutations: { retry: false }`, default của `App.tsx` không có test nào chạm tới.

### 🟡 NÊN SỬA — probe có thể PASS mà bỏ qua ca đắt nhất
`order-read-jwt-probe.mjs:199-201`: không tìm được `ownerEmail` thì chỉ `console.log("skipping…")` rồi vẫn có thể in `PASS`. Ca vừa-bán-vừa-mua chính là lý do view tồn tại — một lần fixture đổi tên là A58 xanh giả.

---

## Đã sửa (orchestrator, 2 chỗ)

1. **`src/App.tsx`** — `mutations: { retry: false }`. Bỏ hẳn ý định lọc 4xx cho mutation (không lọc được vì `PostgrestError` không có `status`), viết lại comment cho đúng sự thật thay vì hứa suông. `retryUnless4xx` giữ nguyên cho `queries` — hành vi queries **không đổi**; sự mù `status` của queries là chuyện có sẵn, ngoài phạm vi.
2. **`scripts/qa/order-read-jwt-probe.mjs`** — nhánh không có `ownerEmail` giờ `problems.push("seller-and-buyer case did not run…")` ⇒ probe **fail** thay vì PASS-mà-bỏ-ca. (Phải nâng khai báo `const problems = []` lên trước điểm dùng — nếu không là TDZ.)

## Verify sau khi sửa

```
npx tsc -b --pretty false                → không output (OK)
node --check scripts/qa/order-read-jwt-probe.mjs  → SYNTAX OK
npm run lint    → ✖ 30 problems (0 errors, 30 warnings)
npm run test    → Test Files 200 passed (200) · Tests 3053 passed | 10 skipped (3063)
npm run build   → xanh
check-bundle-size.mjs → exit 0 · INITIAL 227.6/280 · CODE 1602.9/1800 · CONTENT 405.6/600
```

## Kết luận

**4 migration Phase 3 sẵn sàng cho PO áp prod.** Bất biến §E.10 giờ được canh ở **cả hai** chỗ (GRANT cột + cột view) bằng 4 assertion không vacuous. Hai việc phải sửa trước khi đóng vòng đều nằm ngoài DB và đã sửa xong.

**Ghi trung thực:** hai sửa cuối do orchestrator áp trực tiếp (mỗi cái một dòng, đã được review chỉ đích danh file:dòng và cách sửa), không qua thêm một vòng coder — nhưng vì thế **chúng chưa được review độc lập lần nữa**. Cả hai là mechanical: một là đổi `retry` thành `false`, một là thêm một dòng `problems.push`.
