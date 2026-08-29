# Vòng 1 — Prompt cho coder (soạn bởi prompt-engineer, có Codex CLI duyệt)

**Quy trình soạn:** Codex CLI chạy thành công (`codex exec --skip-git-repo-check`) soạn nháp; prompt-engineer xác minh lại trên worktree main thật, bổ sung gotcha repo (lệnh pgTAP chuẩn `npx supabase test db --local`, fixture-down trước pgTAP, drift ledger, guard trigger). 2 chỉnh sửa so với nháp Codex: (1) thay `pg_prove` bằng lệnh chuẩn của acceptance run pilot; (2) `CONSEQUENCE.approve` là function `(n) => string` chứ không phải string tĩnh.

---

# PROMPT KỸ THUẬT CHO CODER — Nút kích hoạt shop (vòng 1)

## Bối cảnh

ThePickleHub — platform pickleball VN (React 18 + TS + Vite + Supabase). Shop Closed Pilot đã live trên production. Khi admin duyệt hồ sơ seller (RPC `shop_application_decide`), shop được tạo ở state `pending_activation`. Việc kích hoạt shop (state → `active`, shop hiện công khai) hiện làm bằng script tạm. Nhiệm vụ: xây RPC `shop_activate` + UI admin thật + copy seller, đúng scope đã chốt — không hơn.

## Môi trường thi công (BẮT BUỘC)

- Làm việc TRONG worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button` (nhánh `feat/shop-activation-button`, branch từ origin/main, đã đủ migration shop). **TUYỆT ĐỐI không sửa file ở `/Users/cm10/pickle-hub-pro` gốc** — working tree đó đứng sau main 187 commit, thiếu migration; mọi đường dẫn trong prompt này hiểu là tương đối so với worktree.
- `npm ci` đã chạy xong trong worktree — kiểm tra `node_modules` đầy đủ trước khi chạy test.
- Số dòng trích trong spec đọc từ nhánh cũ — **định vị lại trên code thật** trước khi sửa (ví dụ: `STATE_LABEL` ở `SellerHome.tsx` dòng ~18, `CONSEQUENCE` ở `AdminShopApplicationReview.tsx` dòng ~33-41, `decisionErrorMessage` ở `useShopApplicationQueue.ts` dòng ~74).
- **KHÔNG commit, KHÔNG push.** Deliverable = diff để nguyên trong worktree + báo cáo viết theo format cuối prompt.
- Trước khi viết pgTAP: xác nhận ledger migration khớp (`ls supabase/migrations/ | tail`, đủ các migration shop P1/P2a/P2b). Cấm chèn ledger mù.

## Sự thật DB đã xác minh (trên main)

- `public.shops.state` là enum `public.shop_state` = (`pending_activation`,`active`,`restricted`,`suspended`,`closed`), default `pending_activation`.
- `verified_method TEXT` — CHECK `shops_verified_method_check`: NULL hoặc IN (`'giay-phep-kinh-doanh'`,`'gap-truc-tiep'`). CHECK `shops_verified_pair`: `verified_method` và `verified_at` phải cùng NULL hoặc cùng NOT NULL.
- Trigger `shops_guard_privileged_columns_trg` (BEFORE UPDATE): admin (`is_admin()`) sửa được mọi cột; non-admin bị revert im lặng các cột privileged (state, verified_*, slug…) — no-op câm, không lỗi. Đây là LÝ DO dùng RPC thay vì PATCH: RPC lỗi là lỗi thật, không có 200 giả. Lưu ý: UPDATE bên trong RPC vẫn kích trigger này, nhưng vì RPC đã chặn non-admin từ đầu nên `is_admin()` trong trigger trả true — không cần `set_config('shop.privileged_write', ...)` cho bảng `shops` (setting đó chỉ dành cho `shop_applications`).
- Migration mẫu: `supabase/migrations/20260811090000_shop_phase1_seller_onboarding.sql` — RPC `shop_application_decide` là pattern chuẩn: SECURITY DEFINER, `SET search_path = public`, RAISE `admin_required` khi không phải admin, REVOKE ALL FROM PUBLIC + GRANT EXECUTE TO authenticated, service_role.
- **GOTCHA 42725 (bắt buộc tuân thủ):** `public.log_audit_event` có HAI overload (`…text,jsonb,text` và `…text,jsonb,jsonb,jsonb`). MỌI đối số phải cast tường minh (`::text`, `jsonb_build_object(...)`) — nếu không call ambiguous → runtime 42725 "function is not unique". Copy đúng call style ở dòng ~680-696 của migration mẫu ("Explicit casts are load-bearing").
- KHÔNG mở rộng CHECK của `shop_application_events` — audit chỉ qua `log_audit_event`.
- pgTAP nằm ở `supabase/tests/*.test.sql` (pattern: `shop_phase1_rls.test.sql`, `shop_p2b_moderation.test.sql`). Chạy local: **phải** `npx supabase db reset --local` (KHÔNG tin `supabase start` — không áp đủ migration), **fixture down TRƯỚC khi pgTAP chạy**, rồi `npx supabase test db --local supabase/tests`.

## 3 điểm XÁC MINH BẮT BUỘC trên main TRƯỚC khi viết copy có điều kiện (ghi kết quả vào báo cáo)

1. **Seller đã đăng/publish sản phẩm được qua UI trên main chưa?** Kiểm `src/components/shop/ShopShell.tsx` (nav Seller Center — mục "Sản phẩm" còn đánh dấu "sắp có" không), route tới `SellerProducts.tsx`/`SellerProductForm.tsx` có live không. → Quyết định 2 câu copy có điều kiện ở SellerHome (mục 5 dưới). Copy không được hứa thứ UI chưa có.
2. **Trang public `/shop/store/:slug` (`ShopStore.tsx` + hooks trong `usePublicShop.ts`) có render được shop `pending_activation` cho admin không?** Lưu ý: các read buyer-facing đi qua public RPC wrapper P2b (quyền quyết trong Postgres) — nhiều khả năng lọc `state='active'` với mọi viewer. Nếu đúng vậy: link preview trong section kích hoạt bị mù trước khi active → đổi text link thành "Trang shop (sẽ mở khi kích hoạt)" cho state `pending_activation` và ghi rõ trong báo cáo. KHÔNG sửa RLS/visibility public để "fix" — ngoài scope.
3. **Chuỗi lỗi RPC:** viết migration trước, chốt chuỗi RAISE chính xác (đề xuất: `admin_required`, `shop_not_found`, `invalid_verified_method`, `shop_not_activatable:<state>`), rồi `activateErrorMessage` khớp ĐÚNG các chuỗi đó, pgTAP che đúng các chuỗi đó. Ghi chuỗi cuối cùng vào báo cáo.

## Deliverables (tất cả bắt buộc)

### 1. Migration mới — RPC `public.shop_activate(_shop_id UUID, _verified_method TEXT DEFAULT NULL)`

File: `supabase/migrations/<timestamp mới nhất>_shop_activate_rpc.sql` (timestamp sau mọi migration hiện có).

- SECURITY DEFINER, `SET search_path = public`. Đầu hàm: `IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'`.
- Validate `_verified_method`: NULL hoặc IN (`'gap-truc-tiep'`,`'giay-phep-kinh-doanh'`) → sai thì RAISE `invalid_verified_method`.
- Lock row (`SELECT ... FOR UPDATE`), không thấy shop → RAISE `shop_not_found`.
- Chuyển một chiều duy nhất `pending_activation → active`:
  - Đã `active` → **idempotent**: trả về trạng thái hiện tại, không lỗi, KHÔNG ghi audit lần hai, KHÔNG đè verified_* đã có.
  - State ∈ (`restricted`,`suspended`,`closed`) → RAISE chuỗi ổn định `shop_not_activatable:<state>`.
- `_verified_method` có giá trị → set CẶP `verified_method` + `verified_at = now()` cùng nhau (thoả CHECK `shops_verified_pair`). NULL → không đụng 2 cột verified.
- Audit: `PERFORM public.log_audit_event(...)` với cast tường minh MỌI đối số (gotcha 42725); action ví dụ `'shop_activated'::text`, resource `'shop'::text`, id `_shop_id::text`, severity `'info'::text`, metadata `jsonb_build_object('verified_method', _verified_method)`, actor `'user'::text` — theo đúng call style mẫu. Nếu action mới đụng CHECK `audit_logs_resource_type_check`/action check thì widen CHECK đó trong cùng migration (pattern mục 7 migration mẫu) — đây là bảng audit_logs, được phép; KHÔNG đụng `shop_application_events`.
- REVOKE ALL ON FUNCTION FROM PUBLIC; GRANT EXECUTE TO authenticated, service_role.
- Return: state hiện tại của shop (TEXT hoặc record — chọn đơn giản, client chỉ cần biết thành công rồi refetch).

### 2. pgTAP mới — `supabase/tests/shop_activate.test.sql`

Theo pattern fixture/impersonation/`throws_ok`/plan/cleanup của các file shop hiện có. Phủ tối thiểu:

- Admin activate shop `pending_activation` → thành công, state = `active`.
- Kèm `'gap-truc-tiep'` → cặp `verified_method` + `verified_at` cùng được set; kèm NULL → cả hai vẫn NULL.
- `'giay-phep-kinh-doanh'` được chấp nhận; giá trị bậy → đúng chuỗi `invalid_verified_method`, shop không đổi.
- Non-admin gọi → đúng chuỗi `admin_required`.
- Gọi lần 2 trên shop đã `active` → không lỗi, không đè verified_* cũ, không ghi thêm audit row.
- Shop ở `suspended` (và ít nhất 1 state cấm khác) → đúng chuỗi `shop_not_activatable:<state>`.
- `_shop_id` không tồn tại → `shop_not_found`.
- Lần activate thành công ghi đúng 1 row audit (chứng minh không dính 42725).

### 3. Hooks client — thêm vào `src/hooks/shop/useShopApplicationQueue.ts` (cùng file, phía admin)

- `useShopState(shopId: string | null)`: query bảng `shops` select đúng `id, slug, name, state, verified_method`; `enabled` chỉ khi có shopId; queryKey `["shop","admin","shop-state",shopId]`; hỗ trợ `refetch` cho nút Thử lại. (Admin đọc được qua policy `shops_select_member` + `is_admin()`.)
- `useActivateShop()`: mutation gọi `supabase.rpc("shop_activate", { _shop_id, _verified_method: value || null })` — tên tham số khớp đúng migration; `onSuccess` invalidate key shop-state.
- `activateErrorMessage(err)`: export cạnh `decisionErrorMessage` (cùng pattern extract message):
  - chứa `admin_required` → `Phiên đăng nhập chưa đủ quyền. Đăng nhập lại bằng 2FA rồi thử lại.` (tái dùng nguyên văn hiện có)
  - chứa `shop_not_activatable` → `Shop không còn ở trạng thái chờ kích hoạt — có thể đã đổi ở nơi khác. Tải lại trang để xem trạng thái mới.`
  - mặc định (kể cả `shop_not_found`, `invalid_verified_method`, lỗi mạng) → `Chưa kích hoạt được. Shop vẫn ở trạng thái cũ, chưa có gì công khai. Thử lại hoặc kiểm tra kết nối.`

### 4. Section "Kích hoạt shop" — `src/pages/admin/shop/AdminShopApplicationReview.tsx`

Render **chỉ khi** `row.status === 'approved' && row.shop_id != null`, đặt **giữa section "Người nộp" và các section ghi chú/quyết định**. Viết inline trong file (trang tự chứa theo pattern — cho phép local component trong cùng file để hook ordering an toàn; KHÔNG tạo file component mới). Tái dùng duy nhất: `DefList`, class `tl-shop-*` có sẵn, `useConfirm()`, lucide `Check`/`AlertTriangle`/`Loader2`/`ExternalLink`. **KHÔNG CSS mới, KHÔNG dependency mới, KHÔNG inline màu mới** (token đã AA).

Cấu trúc: `<section aria-labelledby="a03-activate">` (đúng quy ước `a03-*` của trang) → `h2.tl-shop-h2` "Kích hoạt shop" → `div.tl-shop-card`:

- **DefList:** ["Trạng thái shop", nhãn từ `SHOP_STATE_LABEL`], ["Trang shop", `<a href="/shop/store/{slug}" target="_blank" rel="noopener noreferrer">` text "Xem trước (mở tab mới)" + icon `ExternalLink` size 13 `aria-hidden` — hoặc text theo kết quả xác minh điểm 2]. Khi `active` và có `verified_method`: thêm ["Xác minh", nhãn phương thức].
- **Loading query:** 1 dòng `tl-shop-hint` "Đang tải trạng thái shop…" (không skeleton). **Lỗi query:** `tl-shop-error` + nút `tl-shop-btn tl-shop-btn--sm` "Thử lại" chỉ gọi refetch.
- **`pending_activation`:**
  - Notice `tl-shop-notice--warn` + `AlertTriangle`: "**Sau khi bấm:** shop hiện công khai trên /shop ngay lập tức — ai cũng xem được, kể cả người chưa đăng nhập, và seller đăng bán được. Chưa có bước hoàn tác trong giao diện này."
  - Select `tl-shop-select`, label `tl-shop-label` "Phương thức xác minh (tuỳ chọn)": `Gặp trực tiếp` (`gap-truc-tiep`, mặc định) · `Giấy phép kinh doanh` (`giay-phep-kinh-doanh`) · `Chưa xác minh` (value rỗng). Hint `tl-shop-hint`: "Chỉ ghi lại cách anh đã xác minh người bán này — hệ thống không tự kiểm tra gì cả." Select disabled khi mutation pending; giữ nguyên giá trị sau lỗi RPC.
  - Lỗi mutation: `p.tl-shop-error role="alert"` NGAY TRÊN nút, text từ `activateErrorMessage`.
  - Nút `tl-shop-btn tl-shop-btn--primary tl-shop-btn--block` "Kích hoạt shop"; loading = disabled + `Loader2 animate-spin` + "Đang kích hoạt…" (đúng pattern nút "Gửi quyết định" hiện có); sau lỗi nút TRỞ LẠI default bấm được.
  - Click → `useConfirm()` với `destructive: false`, title `Kích hoạt shop "{tên shop}"?`, description (pre-line): `Shop hiện công khai trên /shop ngay lập tức, ai cũng xem được.\nPhương thức xác minh sẽ ghi: {Gặp trực tiếp | Giấy phép kinh doanh | (không ghi)}.\nSau khi kích hoạt, anh tự báo seller qua Zalo.`, confirmText `Kích hoạt`. Huỷ = không gọi RPC.
- **`active`:** KHÔNG còn nút — cả section đổi trạng thái (finding MAJOR audit: cấm để nút disabled trơ). Notice `tl-shop-notice--info` + `Check` + `role="status"`: "**Đã kích hoạt.** Shop đang công khai tại [Xem trang shop (mở tab mới)]. Nhớ báo seller qua Zalo — hệ thống không gửi thông báo tự động." F5/vào lại thấy y hệt (idempotent UI).
- **`restricted/suspended/closed`:** notice `--warn`, không nút: `Shop đang ở trạng thái "{label}". Chỉ kích hoạt được shop đang chờ kích hoạt — trạng thái này xử lý theo runbook, không qua màn hình này.`
- Race 2 tab admin: RPC idempotent → refetch → hiện "Đã kích hoạt". Không xử lý riêng.
- **Sửa `CONSEQUENCE.approve`** (hiện là function trả chuỗi "…Họ chưa đăng bán được cho tới khi hoàn tất bước tiếp theo." — dòng ~37-38): thay chuỗi trả về thành `"Shop được tạo ở trạng thái chờ kích hoạt và người nộp trở thành chủ shop. Sau khi duyệt, mục "Kích hoạt shop" xuất hiện ngay trên trang này để đưa shop lên công khai."` (giữ nguyên dạng function).
- A11y: link tab mới có chữ "(mở tab mới)" trong text; icon `aria-hidden`; nếu link tràn ở 320px được phép `overflow-wrap: anywhere` inline trên dd chứa link (theo pattern inline-style sẵn của trang). Kiểm bằng mắt/DOM 320/375/414/768px không tràn ngang.

### 5. Copy SellerHome — `src/pages/shop/SellerHome.tsx`

- Notice `pending_activation` (giữ `--warn` + `AlertTriangle`): "**Shop đã mở nhưng chưa hoạt động.** Quản trị viên sẽ kích hoạt sau khi xác minh với anh/chị — khi shop lên công khai, chúng tôi báo trực tiếp qua Zalo." — bỏ hẳn câu "Chức năng đăng sản phẩm sẽ bật ở giai đoạn tiếp theo…". KHÔNG thêm câu "có thể đăng sản phẩm ngay" trừ khi điểm xác minh 1 xác nhận UI sản phẩm seller đã mở trên main.
- Notice `active` (giữ `--info` + `Check`): "**Shop đang hoạt động** — ai cũng xem được tại [trang shop của anh/chị](/shop/store/{slug}, target _blank + rel noopener noreferrer, có chữ "(mở tab mới)"). Bước tiếp theo: đăng sản phẩm đầu tiên." — "đăng sản phẩm đầu tiên" chỉ thành link nếu điểm xác minh 1 xác nhận route seller products live; không thì để chữ trơn.
- Card "Bước tiếp theo": trên main copy đã khác spec cũ — đọc lại trên main, chỉ sửa nếu còn nội dung sai sự thật; không tự bịa.

### 6. Nâng `SHOP_STATE_LABEL` — `src/lib/shop/applicationState.ts`

Map `STATE_LABEL` hiện cục bộ trong `SellerHome.tsx` (dòng ~18-24) → export `SHOP_STATE_LABEL` từ `applicationState.ts`, type exhaustive theo enum shop_state; `SellerHome.tsx` và `AdminShopApplicationReview.tsx` cùng import; xoá map cục bộ, không để duplicate.

### 7. Test client xuyên call site thật (vitest)

Theo pattern sẵn ở `src/pages/admin/shop/__tests__/` và `src/hooks/shop/__tests__/` (file test mới được phép — ràng buộc "không file component mới" không áp cho test). Bài học pilot: "test bảo vệ HÀM chứ không bảo vệ CHỖ NỐI" — test phải fail nếu call `supabase.rpc("shop_activate", ...)` trong production code bị xoá/đổi tên/sai tên tham số. Phủ:

- Trang review: section hiện với approved + shop_id; ẩn khi thiếu một trong hai; loading/error/retry; `pending_activation` đủ notice + select + nút; confirm huỷ → 0 call RPC; confirm đồng ý → RPC đúng `{_shop_id, _verified_method: "gap-truc-tiep"}`; chọn "Chưa xác minh" → `_verified_method: null`; lỗi mutation → hiện message map đúng, nút bấm lại được, select giữ giá trị; `active` → notice + không nút; state cấm → notice runbook + không nút.
- `activateErrorMessage`: 3 nhánh (`admin_required` / `shop_not_activatable:suspended` / default).
- SellerHome: copy mới theo state; câu cũ "giai đoạn tiếp theo" không còn; dùng `SHOP_STATE_LABEL` import chung.

## Ràng buộc cứng

- Không dependency mới, không CSS mới, không file component mới.
- Không scope creep: không suspend/re-activate, không trang danh sách shop, không thông báo tự động cho seller, không siết column-grant, không sửa visibility/RLS public.
- Copy VI-only khu admin + Seller Center; admin xưng "anh", seller "anh/chị".
- Không commit/push; không đụng repo gốc ngoài worktree.

## Acceptance Criteria (chạy trong worktree, đánh số, đo được)

1. **Lint:** `npm run lint` → exit 0, 0 error.
2. **Typecheck:** `npx tsc -b` → exit 0, 0 error (nếu repo wire typecheck qua đường khác thì chạy cả đường đó và ghi vào báo cáo).
3. **Vitest:** `npm run test` → exit 0, toàn bộ pass, gồm các test mới xuyên call site thật; ít nhất một test fail nếu call `supabase.rpc("shop_activate", ...)` production bị gỡ hoặc sai tên tham số.
4. **pgTAP:** `npx supabase db reset --local` (exit 0, replay đủ migration kể cả migration mới) → fixture down → `npx supabase test db --local supabase/tests` → exit 0, 0 `not ok`; file `shop_activate.test.sql` mới pass đủ các case ở mục 2; toàn bộ suite shop cũ vẫn xanh (baseline pilot: 1241 PASS / 33 file — nay phải ≥ số đó + case mới).
5. **Bundle:** `npm run build` → exit 0; `node scripts/check-bundle-size.mjs` → exit 0, trong budget (headroom ~20 KB, không được cạn).
6. **Hành vi RPC (chứng minh bằng pgTAP ở tiêu chí 4):** admin activate OK + verified pair set đúng đôi; non-admin → `admin_required`; idempotent (lần 2 không lỗi, không đè verified, không audit trùng); state cấm → `shop_not_activatable:<state>`; không tồn tại → `shop_not_found`; method bậy → `invalid_verified_method`; audit ghi thành công không 42725.
7. **Cấu trúc:** `grep "const STATE_LABEL" src/pages/shop/SellerHome.tsx` → 0 match; `SHOP_STATE_LABEL` export từ `src/lib/shop/applicationState.ts` và được import ở cả 2 trang; `git diff --check` sạch.
8. **Kỷ luật worktree:** `git status` ở `/Users/cm10/pickle-hub-pro` gốc không có file nào bị đổi thêm bởi phiên này; `git log -1` trong worktree vẫn là commit gốc (không commit mới); diff để nguyên uncommitted.

## Báo cáo cuối (bắt buộc, đúng heading)

```
## Tóm tắt hiện thực
## Kết quả 3 điểm xác minh (publish seller / preview pending / chuỗi lỗi RPC chốt)
## File thay đổi (git diff --stat)
## Kết quả từng acceptance criterion (lệnh + exit code + số test)
## Sai lệch so với spec + lý do
```

Không được mô tả một check chưa chạy là "pass" — check nào không chạy được thì ghi rõ blocker kèm output.
