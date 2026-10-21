# solution-architect — round 1 (nguyên văn, 2026-08-09)

## Tóm tắt kiến trúc

Slice đầu chỉ cần **một bảng mới (`shops`)** cộng một hàm `is_shop_member()` làm điểm nối duy nhất cho mọi RLS về sau — 6 bảng còn lại trong plan §13 đều hoãn được mà không khoá cửa nào, miễn là policy viết qua helper chứ không viết thẳng `owner_user_id`. Toàn bộ ghi trạng thái đi bằng **RPC `SECURITY DEFINER`**, không phải edge function: `is_admin()` đã tự cưỡng chế aal2 từ migration `20260730090000`, nên đi đường RPC là được MFA miễn phí và tránh phải chạm `supabase/config.toml` (RED). KYC bucket riêng tư **không vào slice này** — repo chưa có một bucket private nào (`grep "INSERT INTO storage.buckets" + false` = 0 kết quả) và §22.13 (thời hạn lưu KYC) vẫn chưa có quyết định, dựng kho giấy tờ trước khi có lịch huỷ dữ liệu là làm ngược.

---

## Option A — Full self-serve application flow (đúng plan §21)

**Effort: 14 half-days** (schema+RLS 2 · pgTAP 1.5 · submit/resubmit RPC 1 · review RPC 1 · form nhiều bước + autosave 3 · admin queue + doc viewer 2.5 · i18n VI/EN 1 · private bucket + signed URL 1 · route snapshot/test 1)

**Files:**
- new `supabase/migrations/<ts>_shop_seller_applications.sql` — 4 bảng: `seller_applications`, `seller_application_documents`, `shops`, `shop_members` + enum `seller_application_status`, `shop_status`, `shop_member_role` + bucket `seller-docs` (`public = false`) + policy `storage.objects`
- new `supabase/tests/shop_seller_application_rls.test.sql`
- new `src/pages/SellerApplication.tsx`, `src/pages/admin/AdminShopApplications.tsx`, `src/components/shop/ApplicationStatusBadge.tsx`, `src/components/admin/ShopDecisionForm.tsx`
- mod `src/App.tsx` (MIRRORED entry cho `/shop/sell` + literal route admin), `src/components/admin/AdminLayout.tsx`, `src/i18n/en.ts` + `vi.ts`, `src/routes/__tests__/route-snapshot.json`, `functions/_middleware.ts` (NOINDEX_PATTERNS), `public/robots.txt` + `functions/robots.txt.ts`, `src/integrations/supabase/types.ts`

**Data:** RED — migration 4 bảng + 3 enum + bucket private + storage policy. GRANT block bắt buộc (`.claude/memory/lessons-learned.md:8-35`), gồm cả `GRANT USAGE ON TYPE` cho 3 enum.

**How it works:** user tạo draft → điền 5 bước → upload CCCD/GPKD vào `seller-docs/<uid>/…` → RPC `seller_application_submit()` khoá row `FOR UPDATE`, chuyển `draft→submitted`. Admin đọc queue, xem giấy tờ qua `createSignedUrl` (storage RLS cho `is_admin()` SELECT), gọi `seller_application_review(_id, _action, _reason)` — approve tạo `shops` + `shop_members` idempotent bằng `UNIQUE(application_id)` trên `shops`.

**Wins:** đúng plan, mở cửa cho seller lạ ngay ngày đầu, có hồ sơ pháp lý đầy đủ.
**Loses:** 14 nửa ngày *trước khi có một sản phẩm nào tồn tại*. Thước đo của Cuong là "seller thật chịu đăng bán" — phương án này không chạm được vào thước đo đó. Và nó dựng kho PII (CCCD, GPKD) khi Phase 0 chưa chốt lịch lưu/huỷ, tức là tự nhận nghĩa vụ NĐ 13/2023 sớm hơn cần thiết, cho đúng 1-3 người mà Cuong đã biết mặt.
**Forecloses:** gần như không khoá cửa kiến trúc — nhưng khoá 3 tuần buổi tối, và một khi `seller-docs` có dữ liệu thật thì việc xoá bucket không còn là `git revert`.

---

## Option B — Admin tạo shop, không có application flow (bản rẻ)

**Effort: 5 half-days** (migration 1 · pgTAP 1 · admin page 1.5 · màn chấp thuận điều khoản 0.75 · i18n + snapshot + types 0.75)

**Files:**
- new `supabase/migrations/<ts>_shop_slice1_shops.sql` — **1 bảng** `shops` + enum `shop_status` + hàm `is_shop_member(uuid)` + RPC `admin_manage_shop(_shop_id, _action, _notes)` + RPC `shop_accept_policy(_shop_id, _version)` + widen 2 CHECK trên `audit_logs`
- new `supabase/tests/shop_rls.test.sql`
- new `src/pages/admin/AdminShops.tsx` (list + form tạo/sửa + nút activate/suspend)
- new `src/pages/Seller.tsx` (một màn: tên shop + nút "Tôi đồng ý với Quy chế người bán v1")
- mod `src/App.tsx`, `src/components/admin/AdminLayout.tsx` (icon `Store`), `src/i18n/en.ts` + `vi.ts`, `src/routes/__tests__/route-snapshot.json`, `functions/_middleware.ts`, `public/robots.txt`, `functions/robots.txt.ts`, `src/integrations/supabase/types.ts`

**Data:** RED — 1 migration. Không bucket, không PII giấy tờ, không số tài khoản (COD-first nên slice này chưa cần bank).

**How it works:** Cuong mở `/admin/shops`, chọn user từ ô search (dùng lại `admin_get_profile_emails`), nhập tên + slug + tỉnh/thành + mô tả → shop sinh ra ở `pending_activation`. Seller đăng nhập, vào `/seller`, bấm đồng ý → `shop_accept_policy()` ghi `policy_version` + `policy_accepted_at` + `policy_accepted_by` rồi chuyển `active`. Giấy tờ định danh thu qua Zalo, chỉ lưu `verified_method text` + `verified_at` — không lưu file. Mọi hành động ghi `log_audit_event(...)`.

Enum `shop_status` khai đủ **5 trạng thái** (`pending_activation/active/restricted/suspended/closed`) ngay từ đầu — thêm giá trị enum sau là migration RED nữa, khai một lần cho xong.

**Wins:** 5 nửa ngày, RED duy nhất là 1 migration, không tạo nghĩa vụ dữ liệu nào. Toàn bộ ngân sách còn lại đổ vào product editor — đúng chỗ thước đo nằm.
**Loses:** seller lạ không có đường tự đăng ký; người thứ 4 sẽ nhắn Zalo và Cuong nhập tay. Ở N<10 đó là tính năng, không phải lỗi.
**Forecloses:** **không khoá gì, với điều kiện** mọi RLS về sau gọi `is_shop_member(shop_id)` (thân hàm hôm nay: `owner_user_id = auth.uid() OR is_admin()`), để khi thêm `shop_members` chỉ phải đổi thân hàm chứ không phải viết lại policy của products/orders. Nếu bỏ helper mà viết thẳng `owner_user_id` vào policy thì đây **là** một cánh cửa đóng — và là cửa đắt nhất trong cả ba phương án.

---

## Option C — Form đăng ký công khai, không upload giấy tờ (bản lai)

**Effort: 9 half-days** (migration 1.5 · pgTAP 1 · 2 RPC 1 · form công khai VI/EN 2 · admin queue 1.5 · noindex/snapshot 0.5 · i18n 0.5 · types 0.25 · buffer 0.75)

**Files:** như Option B, cộng bảng `seller_applications` (không có `seller_application_documents`, không có state `draft` — chỉ `submitted/needs_changes/approved/rejected/withdrawn`), cộng `src/pages/SellerApply.tsx` (public, `/shop/sell` + `/vi/shop/sell`), cộng `src/pages/admin/AdminShopApplications.tsx`.

**Data:** RED — 2 bảng + 2 enum. Vẫn không có bucket: form có ô "Link giấy phép / trao đổi qua Zalo", nháp lưu `localStorage` chứ không lưu DB.

**How it works:** như A nhưng cắt hai thứ đắt nhất: upload file và draft server-side. `seller_application_review()` approve → INSERT `shops` với `UNIQUE(application_id)` nên retry không đẻ shop thứ hai (đúng §25).

**Wins:** có kênh tiếp nhận seller lạ, có hồ sơ chấp thuận điều khoản gắn với đơn, mà không đụng PII file.
**Loses:** vẫn là 9 nửa ngày để xây hàng đợi phục vụ 1-3 người đã quen; `/shop/sell` là route công khai đầu tiên của Shop nên kéo theo nghĩa vụ SSR + noindex + hreflang trong khi chưa có gì để bán — trang "đăng ký bán hàng" trên một sàn 0 sản phẩm là tín hiệu xấu cho cả người dùng lẫn bot.
**Forecloses:** không khoá gì. Đây là bản A trừ đi phần sẽ phải làm lại khi Phase 0 chốt lịch lưu KYC.

---

## Khuyến nghị

**Option B.**

Lý do cụ thể, không phải "vì rẻ": thước đo Cuong đặt ra là *số sản phẩm thật được đăng*, mà cả ba phương án ở trên đều dừng **trước** product editor. Chênh lệch A−B là 9 nửa ngày; 9 nửa ngày đó là gần đúng chi phí của product + variant + media + editor — tức là đúng thứ duy nhất có thể làm kim đồng hồ nhúc nhích. Xây hàng đợi duyệt hồ sơ cho 3 người mà Cuong có số Zalo là tự động hoá một việc chưa hề tốn thời gian.

**A thua** vì nó phụ thuộc vào một quyết định Phase 0 chưa có: `docs/proposals/shop-marketplace-plan.md:1021` (§22.13, thời hạn lưu KYC) và exit-criteria Phase 0 "produce threat model and data-retention schedule" đều chưa xong. Bucket `seller-docs` chứa CCCD là bề mặt private-storage **đầu tiên** của repo (đã kiểm: 0/8 `INSERT INTO storage.buckets` có `public=false`) — pattern net-new, không ai review, và một khi có file thật thì `git revert` vô nghĩa. Xây nó sau khi có seller lạ *và* có lịch huỷ dữ liệu, không phải trước.

**C thua** vì nó trả 4 nửa ngày phụ trội để mua một kênh tiếp nhận mà lưu lượng dự kiến là ~0 trong 4-8 tuần tới, và nó mở route công khai `/shop/sell` trên một sàn chưa có sản phẩm nào. C là phương án **đúng cho slice thứ hai hoặc thứ ba**, sau khi 3 shop pilot đã đăng sản phẩm thật và bắt đầu có người lạ hỏi.

Trả lời thẳng 4 câu hỏi:

| | Trả lời |
|---|---|
| **A. Flow nào** | Admin tạo shop. Bỏ application flow khỏi slice 1, mang lại ở slice 3 khi có seller lạ. |
| **B. Bảng nào** | Chỉ `shops`. `shop_members` hoãn sau `is_shop_member()`. `shop_addresses/policies/bank_accounts` → cột trên `shops` (bank thì **không** lưu, COD-first). `shop_audit_events` **không tạo** — dùng lại `audit_logs` (`20260301120755`) + widen CHECK. |
| **C. Private KYC bucket** | Không. Không có precedent trong repo, và §22.13 chưa chốt. Thu qua Zalo, chỉ ghi `verified_method` + `verified_at`. |
| **D. Edge function hay RPC** | RPC `SECURITY DEFINER`, theo khuôn `btc_manage_team` (`20260102004009`): `FOR UPDATE` + kiểm quyền + dispatch action + trả `json_build_object`. Edge function thua vì (1) `is_admin()` đã bao gồm `admin_session_aal_ok()` nên RPC được MFA miễn phí, edge function phải tự import `_shared/admin-aal.ts`; (2) function mới bắt buộc thêm block `[functions.x] verify_jwt=false` vào `supabase/config.toml` — **RED** theo `scripts/agents/risk-tier.mjs` — cộng entry `auth-registry.json` cho `npm run auth:registry`; (3) RPC không thêm artifact deploy nào ngoài migration vốn đã RED. Để dành edge function cho payment webhook ở Phase 4, chỗ thật sự cần service-role + chữ ký ngoài. |

**Cảnh báo RED:** migration là RED (`scripts/agents/risk-tier.mjs`, dòng rule `^supabase/migrations/`) → cần Cuong ký. Không chạm `supabase/config.toml`, không chạm auth, không chạm payments trong slice này — đó là chủ ý.

**Bundle:** +0 KB dependency (react-hook-form 7.61, @hookform/resolvers, zod 3.25 đã có sẵn trong `package.json`). `AdminShops.tsx` đi qua `lazyRetry` như 21 trang admin khác, ước ~10-14 KB gz vào CODE chứ không vào INITIAL; `Seller.tsx` cũng lazy. Ngưỡng "any single route chunk ≤ 150 KB" và INITIAL ≤ 280 KB không bị đụng.

**SSR:** `/seller` là route mới duy nhất lộ ra ngoài SPA. Không cần handler trong `functions/_lib/render/` — nó vào `NOINDEX_PATTERNS` của `functions/_middleware.ts` (`/^\/(?:vi\/)?seller(?:\/|$)/`), thêm `Disallow` vào cả `public/robots.txt` lẫn `functions/robots.txt.ts`, và **không** vào sitemap nào. Cặp hreflang: không có, vì noindex. `/admin/shops` đã được `/^\/admin(?:\/|$)/` phủ sẵn. Text VI + EN vào `src/i18n/vi.ts` và `en.ts` cùng một commit.

---

## Increments

1. **Migration + pgTAP** (2 nửa ngày) — bảng `shops`, enum 5 trạng thái, `is_shop_member()`, `admin_manage_shop()`, `shop_accept_policy()`, GRANT block, widen `audit_logs` CHECK. Verify: `supabase test db --local supabase/tests` xanh, với ít nhất 4 assertion — anon không SELECT được shop `pending_activation`; user thường không gọi được `admin_manage_shop`; owner đọc được shop của mình; owner **không** đọc được shop người khác.
2. **`/admin/shops`** (1.5) — list + form tạo + activate/suspend. Verify: `npm run test -- route-snapshot` xanh sau khi cập nhật `route-snapshot.json`; tạo tay 1 shop trên preview branch, kiểm `/admin/audit-log` có dòng `SHOP_CREATED`.
3. **`/seller` + chấp thuận điều khoản** (0.75) — Verify: `curl -A "Googlebot" "https://<preview>/seller?nocache=1"` trả `X-Robots-Tag: noindex`; DB có `policy_accepted_at` khác NULL sau khi bấm.
4. **i18n VI/EN + regen types** (0.75) — Verify: `npx supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl --schema public`, `npm run lint`, `npm run build`.

> **Điểm dừng-và-nhìn: sau bước 4.** Tạo 3 shop pilot thật, rồi *dừng lại đếm*. Nếu sau 2 tuần chưa seller nào bấm đồng ý điều khoản, product editor là công sức đổ sông — vấn đề nằm ở phía cung, không nằm ở phần mềm. Chỉ khi cả 3 đã active mới mở slice 2 (products).

---

## Điều em không chắc

1. **`log_audit_event` đang có 2 overload trên prod và gọi ≤6 tham số sẽ lỗi.** `20260301120755` tạo bản `(text,text,text,text,text,jsonb,text)` RETURNS uuid; `20260302020338:30` dùng `CREATE OR REPLACE` với danh sách tham số khác `(…,jsonb,jsonb)` RETURNS void — Postgres coi đó là hàm **mới**, không thay thế, và migration không có `DROP FUNCTION`. `20260313113655` vẫn gọi bản 7-tham-số-text, nên cả hai còn sống. Hệ quả: `log_audit_event('SHOP_CREATED','admin','shop',id::text)` sẽ ném `42725 function is not unique`. Phải `\df log_audit_event` trên prod trước khi viết RPC, và gọi đủ 8 tham số dạng jsonb. Em chưa query được prod trong phiên này để xác nhận.
2. **CHECK `audit_logs_resource_type_check` chưa có `'shop'`** (`20260302020338:22`) — em đề xuất widen, nhưng đây là `DROP CONSTRAINT` + `ADD CONSTRAINT` trên bảng có dữ liệu thật; em chưa đếm số dòng `audit_logs` để ước thời gian khoá bảng. Nếu bảng lớn, cân nhắc `NOT VALID` rồi `VALIDATE` riêng.
3. **Ai gán user cho shop.** Em giả định Cuong chọn seller từ ô search dùng `admin_get_profile_emails`, nhưng em chưa đọc `src/pages/admin/AdminUsers.tsx` để biết đã có sẵn component search tái dùng được hay phải viết mới — nếu phải viết mới thì bước 2 lên ~2 nửa ngày.
4. **Chấp thuận điều khoản trong app có đủ giá trị pháp lý không** — em không biết. Nội dung "Quy chế người bán v1" là việc của Cuong/luật sư, không phải của em; em chỉ thiết kế chỗ ghi version + timestamp + user_id.
5. **Ước lượng 5 nửa ngày chưa tính vòng review/CI đỏ.** Lịch sử repo cho thấy deploy-guard đang đỏ kinh niên vì drift 10 migration (memory: `deploy-guard-migration-drift-chronic`) — migration mới có thể tốn thêm nửa ngày chỉ để chứng minh gate đỏ không phải lỗi của PR này.
