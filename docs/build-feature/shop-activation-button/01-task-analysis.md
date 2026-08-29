# Phân tích công việc — Nút kích hoạt shop (post-Closed-Pilot)

Nguồn: `/Users/cm10/pickle-hub-pro/docs/build-feature/shop-activation-button/00-idea.md`
Hiện trạng đọc từ: migration `supabase/migrations/20260811090000_shop_phase1_seller_onboarding.sql`, `src/pages/admin/shop/AdminShopApplications.tsx` + `AdminShopApplicationReview.tsx`, `src/lib/shop/applicationState.ts`, `src/pages/shop/SellerHome.tsx`, `src/components/shop/ShopShell.tsx`, memory `shop-closed-pilot-package.md`.

---

## 1. Tóm tắt ý tưởng

Shop Closed Pilot đã lên production (PR #578 + #580). Bước tiếp theo Cuong đề xuất: (a) xây nút kích hoạt shop trong admin UI để thay script tạm `wave0s-activate.sh`, (b) legal review chạy song song không chặn code, (c) mở Wave 1 với 3-5 seller quen rồi soak 2-4 tuần theo phễu 3 số, (d) chỉ bàn P3a (giỏ hàng/đơn hàng) khi có tín hiệu seller thật. Kèm câu hỏi so sánh: đi từng bước như trên, hay build luôn full feature shop (cart, order, payment) ngay bây giờ.

## 2. Mục tiêu / bài toán cần giải

Chuỗi seller onboarding hiện đứt ở mắt xích cuối: admin duyệt hồ sơ qua UI thật (`/admin/shop/applications/:id` → RPC `shop_application_decide`), RPC tạo shop ở state **`pending_activation`** — nhưng bước cuối `pending_activation → active` (bước duy nhất làm shop hiện ra công khai, vì RLS `shops_select_public_active` chỉ cho đọc `state='active'`) chưa có UI, đang làm bằng PATCH REST thủ công qua script scratchpad (đã mất theo phiên f5dba95a). Bài học pilot đã ghi thành chữ: "harness làm hộ UI = che dây chưa nối" — đây chính là dây chưa nối cuối cùng. Không có nút này thì Wave 1 không vận hành được bằng quy trình thật, và mọi lần kích hoạt đều là thao tác tay không audit trail, không ai kiểm chứng được.

Người dùng của tính năng: **1 người** — Cuong, vai admin (aal2/TOTP). Tần suất: vài lần trong Wave 1 (3-5 seller).

## 3. Phạm vi (scope)

**TRONG phạm vi (code, ~1 buổi như ý tưởng ước lượng):**
- Nút/màn kích hoạt shop trong khu admin `/admin/shop/*`, chuyển `shops.state` từ `pending_activation` → `active`.
- Cách admin **tìm được** shop đang chờ kích hoạt (hiện không có trang danh sách shop nào trong admin — chỉ có hàng đợi hồ sơ; entry `Sản phẩm`, `Khiếu nại` trong `ShopShell.tsx` đang `ready: false`).
- Test đi xuyên hook thật tới call site thật (bài học pilot: "test bảo vệ HÀM chứ không bảo vệ CHỖ NỐI").

**NGOÀI phạm vi lần này (quy trình, không phải code — hoặc code bị cấm chờ PO):**
- Legal review — việc của Cuong, chạy song song, không chặn code nút.
- Mở Wave 1 + bật indexing — **đang CẤM chờ PO duyệt**; nút chỉ là công cụ, quyết định mở Wave 1 là của PO.
- Soak 2-4 tuần + phễu 3 số — vận hành, không phải code (trừ khi phễu 3 số cần dashboard đo — xem câu hỏi mở).
- P3a (giỏ hàng, đơn hàng, thanh toán) — theo chính ý tưởng, chỉ bàn khi có tín hiệu; xem mục 5.
- Siết column-grant `shops` cho anon (`owner_user_id` lộ qua `select=*`) — đã ghi nhận là việc hậu-pilot có chủ đích, không vá tiện tay.

## 4. Requirement chi tiết cho nút kích hoạt (dựa trên hiện trạng DB/RPC thật)

Bối cảnh kỹ thuật hiện có, để 2 agent phản biện và agent UI/UX dùng làm input:

- **Nút này KHÔNG phải duyệt/từ chối đơn** — việc đó đã xong (`shop_application_decide` với 3 quyết định approve/reject/request-changes, UI review có sẵn). Nút này là bước **sau** approve: kích hoạt shop đã được tạo.
- **Chưa có RPC kích hoạt.** Đường ghi hiện tại là UPDATE trực tiếp qua policy `shops_update_admin` + trigger `shops_guard_privileged_columns` (admin thì cho qua mọi cột; không phải admin thì trigger **im lặng ghi đè lại giá trị cũ** — UPDATE "thành công" nhưng không đổi gì). Hệ quả bắt buộc cho UI: **sau khi ghi phải đọc lại và xác nhận state thực sự đã đổi**, không được tin HTTP 200 — đây đúng kiểu "xanh giả" pilot đã ăn nhiều lần.
- Khác với approve/reject, đường PATCH hiện tại **không để lại vết nào**: không dòng `shop_application_events`, không `log_audit_event`. Requirement nghiệp vụ: kích hoạt phải có audit trail ngang cấp với quyết định duyệt hồ sơ (ai, lúc nào, shop nào). Cơ chế (RPC riêng theo mẫu `shop_application_decide`, hay PATCH + ghi log) để agent sau quyết.
- Trạng thái hợp lệ: enum `shop_state` = `pending_activation | active | restricted | suspended | closed`. Nút kích hoạt tối thiểu chỉ cần một chiều `pending_activation → active`, idempotent (bấm 2 lần không lỗi).
- Bảng `shops` có cặp `verified_method` (`giay-phep-kinh-doanh` | `gap-truc-tiep`) + `verified_at`, CHECK bắt buộc đủ đôi hoặc rỗng cả đôi. Thời điểm kích hoạt là chỗ tự nhiên duy nhất để ghi nhận "đã xác minh bằng cách nào" — cần PO chốt có ghi ở bước này không (xem câu hỏi mở).
- Vị trí trong admin: hai lựa chọn tự nhiên — (a) nút ngay trên trang review hồ sơ đã approved (trang này đã có `shop_id`), (b) trang danh sách shop mới trong `ShopShell`. Tối thiểu cho Wave 1 là (a); (b) trở nên cần khi admin phải quản shop độc lập với hồ sơ. Để agent UI/UX quyết.
- Ràng buộc kèm theo: khu admin đã nằm sau `RequireAuth requiredRole="admin"` + AdminMFAGate (aal2) — nút thừa hưởng, không cần gate mới. Route admin đã lazy-load nên áp lực bundle nhỏ, nhưng gate bundle thật là `scripts/check-bundle-size.mjs` (headroom chỉ ~20 KB) và gate coverage 83% — file UI mới có test là tự cộng mình vào mẫu số coverage.
- Điều nút làm về mặt sản phẩm: `state='active'` là công tắc công khai — anon đọc được row shop và shop hiện trên `/shop` (vẫn noindex). Màn kích hoạt nên cho admin thấy rõ "bấm xong thì cái gì thành công khai" trước khi xác nhận.
- Seller nhìn thấy gì: `SellerHome.tsx` đã hiển thị badge "Chờ kích hoạt" khi `pending_activation` — sau kích hoạt, phía seller không cần code thêm. Pilot đã ký quyết định "chưa có thông báo tự động" → báo seller là việc tay (Zalo), không phải scope code.

## 5. "Nếu làm luôn full feature shop thì sao" — phân tích được/mất

**Được (build luôn P3a ngay):**
- Thiết kế data model một lần, tránh rework khi ghép order vào catalog sau này.
- Trải nghiệm buyer trọn vẹn ngay từ Wave 1, câu chuyện sản phẩm/pitch mạnh hơn.
- Tận dụng đà: context Shop đang nóng trong đầu, khỏi phải nạp lại sau vài tháng.

**Mất / rủi ro (nặng hơn đáng kể trong bối cảnh này):**
- **Build trên số 0 tín hiệu.** Chưa có seller thật nào vận hành. Toàn bộ pilot được thiết kế để trả lời câu hỏi "seller cần gì" — build P3a trước khi có câu trả lời là đặt cược rằng mình đoán đúng mô hình đơn hàng (cart web? chốt qua Zalo? COD? VietQR chuyển thẳng seller?). Với seller nhỏ VN, chốt đơn qua inbox là chuẩn de facto — cart có thể là giải pháp sai cho bài toán không tồn tại.
- **Chi phí solo không tương xứng.** Phase 1+2 (chỉ onboarding + catalog, chưa đụng tiền) đã tốn 114 commit / 320 file / +76k dòng, nhiều tuần, và mỗi vòng test tay đều lòi P0 thật. P3a (đơn hàng, thanh toán, tồn kho reservation, hoàn tiền, khiếu nại) lớn hơn về code và **cao hơn hẳn về giá của bug** — bug catalog làm sai một trang, bug thanh toán làm mất tiền người thật.
- **Đảo ngược quyết định PO đã ký.** Option B′ (09/08) chốt rõ: KHÔNG KYC/bank. Nhận và luân chuyển tiền kéo theo nghĩa vụ trung gian thanh toán, thuế TMĐT sàn phải khấu trừ hộ seller, và mở rộng đúng phần legal mà Cuong đang review — tức P3a **tự chặn chính nó** bằng legal, trong khi phương án từng bước thì legal chạy song song được.
- **Không mở khóa gì cả.** Nút chặn hiện tại của Wave 1 là quyết định PO, không phải thiếu tính năng. Build P3a chỉ trì hoãn thời điểm có tín hiệu thật — thứ duy nhất giúp quyết định P3a đúng.
- **Chi phí chìm nếu pilot fail.** Nếu 3-5 seller Wave 1 không dùng, phần P3a là code chết kèm bề mặt tấn công và gánh bảo trì (RLS, audit, cron) phải nuôi mãi.

**Kết luận phân tích:** trình tự trong ý tưởng gốc (nút → legal song song → Wave 1 → soak → mới bàn P3a) là hợp lý và tự nhất quán; phương án full-build thua trên gần như mọi trục trong bối cảnh solo-builder + 0 seller thật + Wave 1 đang chờ PO. Điều nên bổ sung để trình tự này chặt hơn: **định nghĩa trước tín hiệu kích hoạt P3a** (phễu 3 số cụ thể là 3 số nào, ngưỡng bao nhiêu thì bàn P3a) — không có ngưỡng viết trước thì "khi có tín hiệu" dễ thành cảm tính.

## 6. Rủi ro / điểm cần cẩn thận

- **Bẫy no-op câm:** trigger guard làm UPDATE không-phải-admin trông như thành công. UI phải xác nhận bằng đọc lại state; test phải phá đúng call site production (red-proof), không chỉ test hàm thuần.
- **Kích hoạt = công khai:** bấm nút là dữ liệu shop (tên, intro, city, return_note) ra anon ngay, dù noindex. Kích hoạt sớm hơn legal xong có ổn không — cần PO xác nhận trình tự.
- **Nhánh suspend có side effect thật:** rời `active` sẽ kích trigger thu hồi media (`shops_revoke_media_on_state_change`). Nếu scope phình sang "quản lý state" thì đây không còn là nút một chiều vô hại nữa.
- **Runbook B12 (offboarding chủ shop) đang phụ thuộc một màn admin chưa tồn tại:** bước `state → suspended` "phải qua màn admin aal2, psql là no-op câm" — tức nhu cầu suspend qua UI đã được văn bản hóa từ trước, không phải phát minh mới.
- Gate CI: bundle headroom ~20 KB, coverage ≥83% (mẫu số cộng file mới có test), pgTAP nếu thêm migration/RPC.

## 7. Câu hỏi còn mở (cần PO / vòng bàn luận sau quyết)

1. **Scope nút:** chỉ một chiều `pending_activation → active`, hay gộp luôn suspend/re-activate thành màn quản lý state (runbook B12 đang cần suspend qua UI)? Gộp thì hết "~1 buổi".
2. **Có ghi `verified_method`/`verified_at` lúc kích hoạt không?** Wave 1 toàn seller quen — `gap-truc-tiep`? Hay để trống (copy pilot đã sửa để không nói quá về xác minh)?
3. **Audit trail mức nào:** ghi `log_audit_event` là đủ, hay cần event hiển thị trong timeline hồ sơ (`shop_application_events`) cho nhất quán với approve/reject?
4. **Trình tự với legal:** nút code xong có được **dùng** trước khi legal review xong không, hay kích hoạt shop đầu tiên phải chờ legal?
5. **Phễu 3 số là 3 số nào, đo bằng gì?** Nếu cần dashboard/query đo thì đó là hạng mục code riêng, chưa nằm trong scope nút.
6. **Ngưỡng tín hiệu để bàn P3a** — viết trước con số, tránh quyết định cảm tính sau soak.
7. Sau kích hoạt, ai báo seller và bằng kênh nào (pilot đã ký "không thông báo tự động" — xác nhận vẫn giữ)?
