# Vòng 1 — Báo cáo coder

## Tóm tắt hiện thực

Xây trọn vòng 1 nút kích hoạt shop trong worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button`:

1. **Migration** `supabase/migrations/20260816090000_shop_activate_rpc.sql` — RPC `public.shop_activate(_shop_id UUID, _verified_method TEXT DEFAULT NULL)`: SECURITY DEFINER + `SET search_path = public`, chặn non-admin, validate method, `SELECT … FOR UPDATE`, một chiều `pending_activation → active`, idempotent khi đã `active` (không audit lần 2, không đè verified_*), set cặp `verified_method`+`verified_at` cùng nhau, audit qua `log_audit_event` với cast tường minh mọi đối số (gotcha 42725), REVOKE PUBLIC + GRANT authenticated/service_role. Không cần widen CHECK audit_logs: `resource_type='shop'`, `event_category='admin'`, `severity='info'` đều đã hợp lệ sẵn; `event_type` không có CHECK.
2. **pgTAP** `supabase/tests/shop_activate.test.sql` — 22 assert phủ đủ 8 nhóm case mục 2 của prompt.
3. **Hooks** trong `src/hooks/shop/useShopApplicationQueue.ts`: `useShopState`, `useActivateShop`, `activateErrorMessage` (3 nhánh đúng copy spec).
4. **Section "Kích hoạt shop"** trong `src/pages/admin/shop/AdminShopApplicationReview.tsx` — local component `ActivationSection` (không file mới), render chỉ khi `status==='approved' && shop_id != null`, đặt ngay sau section "Người nộp"; đủ 4 trạng thái UI (loading 1 dòng, error+Thử lại, pending đầy đủ notice/select/confirm/nút, active không nút + role=status, state cấm notice runbook); sửa `CONSEQUENCE.approve` (giữ dạng function).
5. **SellerHome** copy mới cho `pending_activation` (bỏ hẳn câu "giai đoạn tiếp theo") và `active` (link trang shop + link "đăng sản phẩm đầu tiên").
6. **`SHOP_STATE_LABEL`** export từ `src/lib/shop/applicationState.ts`, exhaustive theo `ShopState`; xoá map cục bộ ở `SellerHome.tsx` và (thêm ngoài danh sách nêu tên trong spec, xem mục Sai lệch) ở `SellerShopSettings.tsx`. Thêm `VERIFIED_METHOD_LABEL` dùng chung cho select + confirm + DefList.
7. **3 file test vitest mới** (18 test) xuyên call site thật.

## Kết quả 3 điểm xác minh (publish seller / preview pending / chuỗi lỗi RPC chốt)

1. **Publish seller: ĐÃ LIVE trên main.** `ShopShell.tsx` nav "Sản phẩm" có `ready: true` (không còn "sắp có"); routes `/seller/products`, `/seller/products/new`, `/seller/products/:id/edit` đều đăng ký trong `App.tsx`. → Copy active của SellerHome dùng LINK thật tới `/seller/products/new` cho "đăng sản phẩm đầu tiên"; notice pending viết "seller đăng bán được" trong cảnh báo admin là đúng sự thật.
2. **Preview pending: MÙ.** `shop_public_shop` (bản mới nhất, migration `20260813120000`) chỉ trả `found:true` khi `state='active'`, mọi state khác trả `found:false` kể cả với admin (RPC không phân quyền viewer). → DefList "Trang shop" khi chưa active hiển thị text trơn `/shop/store/{slug} (sẽ mở khi kích hoạt)`, không phải link; link "Xem trước (mở tab mới)" chỉ hiện khi `active`. Không sửa RLS/visibility.
3. **Chuỗi lỗi RPC chốt** (pgTAP assert verbatim cả errcode lẫn message):
   - `admin_required` (42501)
   - `shop_not_found` (P0002)
   - `invalid_verified_method` (22023)
   - `shop_not_activatable:<state>` (22023) — ví dụ thật: `shop_not_activatable:suspended`, `shop_not_activatable:closed`
   - Return: TEXT `'active'` (hoặc state hiện tại khi idempotent-replay).
   `activateErrorMessage` map đúng 3 nhánh theo spec.

## File thay đổi (git diff --stat)

```
 src/hooks/shop/useShopApplicationQueue.ts          |  60 ++++++++
 src/lib/shop/applicationState.ts                   |  18 +++
 .../admin/shop/AdminShopApplicationReview.tsx      | 168 ++++++++++++++++++++-
 src/pages/shop/SellerHome.tsx                      |  23 ++-
 src/pages/shop/SellerShopSettings.tsx              |  11 +-
 5 files changed, 256 insertions(+), 24 deletions(-)
```

File mới (untracked): `supabase/migrations/20260816090000_shop_activate_rpc.sql`, `supabase/tests/shop_activate.test.sql`, `src/pages/admin/shop/__tests__/AdminShopApplicationReview.activate.test.tsx`, `src/hooks/shop/__tests__/activateErrorMessage.test.ts`, `src/pages/shop/__tests__/SellerHome.copy.test.tsx`.

## Kết quả từng acceptance criterion (lệnh + exit code + số test)

1. **Lint:** `npm run lint` → exit 0, **0 error** / 29 warning (toàn bộ pre-existing ở `src/proto/`, `ui/`; grep xác nhận 0 warning trên file tôi sửa).
2. **Typecheck:** `npx tsc -b` → exit 0, 0 error (chạy sau khi mọi file kể cả test đã viết).
3. **Vitest:** `npm run test` → exit 0, **180 file / 2664 pass, 10 skipped, 0 fail** (gồm 3 file mới = 18 test). **Red-proof đã chạy thật:** đổi tên call `shopRpc("shop_activate", …)` trong production code → 2 test fail; hoàn nguyên xong xác nhận diff về đúng 60 dòng.
4. **pgTAP:** `npx supabase db reset --local` → exit 0, replay đủ tới `20260816090000_shop_activate_rpc.sql`; `node scripts/shop-p2b-fixture.mjs down` → "No fixture is up" (sạch); `npx supabase test db --local supabase/tests` → **Result: PASS, 42 file / 1425 test, 0 not ok** (≥ baseline 1241/33; `shop_activate.test.sql` 22/22). Lần chạy đầu file mới chết ở dòng đọc `audit_logs` dưới role authenticated (không có SELECT grant) — sửa bằng cách đọc audit count dưới postgres, chạy lại xanh.
5. **Bundle:** `npm run build` → exit 0; `node scripts/check-bundle-size.mjs` → exit 0. INITIAL 226.8/280 KB, CODE 1566.0/1800 KB, **Total 1956.4/1970 KB — headroom còn 13.6 KB**. Lưu ý: baseline main (đã đo bằng stash + build lại) đã chỉ còn 15.5 KB headroom; phần thêm ≈ **1.9 KB gz**. Script vẫn exit 0 (chỉ ⚠), nhưng con số "~20 KB headroom" trong prompt đã không còn đúng từ trước vòng này.
6. **Hành vi RPC:** chứng minh đủ bằng pgTAP ở tiêu chí 4 — 22 assert: admin OK + cặp verified; non-admin `admin_required`; idempotent (không lỗi/không đè/audit vẫn 1 row); `shop_not_activatable:suspended` + `:closed`; `shop_not_found`; `invalid_verified_method` + shop không đổi; đúng 1 audit row (không 42725).
7. **Cấu trúc:** `grep "const STATE_LABEL" src/pages/shop/SellerHome.tsx` → 0 match; `SHOP_STATE_LABEL` export từ `applicationState.ts`, import ở cả `SellerHome.tsx` lẫn `AdminShopApplicationReview.tsx` (và `SellerShopSettings.tsx`); `git diff --check` → exit 0, sạch.
8. **Kỷ luật worktree:** repo gốc `/Users/cm10/pickle-hub-pro` — các path shop đã đụng đều sạch (3 file `??` trong `supabase/migrations` là drift đã biết từ trước phiên); worktree `git log -1` vẫn `cf555653` (0 commit mới), diff để nguyên uncommitted, 0 stash sót.

## Sai lệch so với spec + lý do

- **`SellerShopSettings.tsx` cũng được chuyển sang `SHOP_STATE_LABEL`** dù spec mục 6 chỉ nêu tên 2 file: file này có bản copy thứ ba y hệt của map, để lại thì vi phạm chính yêu cầu "không để duplicate". Diff nhỏ (−7/+2 dòng), không đổi hành vi.
- **Thêm `VERIFIED_METHOD_LABEL` vào `applicationState.ts`** (spec không nêu): nhãn "Gặp trực tiếp"/"Giấy phép kinh doanh" cần ở 3 chỗ trong section (select, confirm dialog, DefList Xác minh) — một map dùng chung thay vì 3 chuỗi lặp, cùng pattern với `SELLER_TYPE_LABEL` sẵn có.
- **Link DefList khi pending là text trơn, không phải link chữ "Trang shop (sẽ mở khi kích hoạt)"** — spec cho phép đổi theo kết quả xác minh điểm 2; hiển thị luôn path `/shop/store/{slug}` kèm chú thích để admin biết URL sẽ là gì, và không tạo link chết.
- **Kiểm 320/375/414/768px bằng mắt/DOM: CHƯA làm** — cần browser; đã phòng tràn bằng `overflow-wrap: anywhere` inline trên dd chứa link/path theo đúng pattern cho phép của spec. Đây là mục duy nhất của prompt chưa kiểm chứng được trong môi trường này.
- Test dùng mock `useConfirm` (module-level) thay vì render `ConfirmProvider` + Radix dialog thật — call site trên trang vẫn là thật (confirm huỷ → 0 RPC được assert thật); render Radix trong jsdom sẽ kéo thêm I18n provider mà không tăng độ phủ chỗ nối RPC.
