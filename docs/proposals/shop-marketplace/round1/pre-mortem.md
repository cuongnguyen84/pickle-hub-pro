# pre-mortem — round 1 (nguyên văn, 2026-08-09)

## Pre-mortem: shop-marketplace Phase 1 (seller application + admin review + shop activation)

Đã ship 2026-08-09. Hôm nay là 2026-08-30. Ba chuyện dưới đây đã xảy ra.

---

### Sự cố 1 — "Ảnh CCCD của 3 seller pilot đọc được bằng anon key có sẵn trong bundle, suốt 22 ngày, không ai biết"

**Xác suất:** trung bình-cao · **Thời gian tới lúc phát hiện:** 22 ngày (và chỉ vì may)

**Timeline**

- T+0 (09/08, ship): migration tạo bucket `seller-documents` với `public = false`. PR ghi rõ *"first private bucket in the repo, KYC docs are NOT publicly accessible"*. Đúng plan §14.
- T+0: Cuong kiểm bằng cách dán URL `/storage/v1/object/public/seller-documents/…` vào cửa sổ ẩn danh → `400 Bucket not found`. Kết luận: kín.
- T+3, T+6, T+11: 3 seller pilot nộp hồ sơ — tổng 7 file, đủ số CCCD + họ tên + địa chỉ + số tài khoản trên ảnh sao kê.
- T+22: một agent đọc lại migration để chuẩn bị Phase 2, chạy thử bằng anon key từ `.env`: `storage.from('seller-documents').list('')` → trả 3 folder UUID user; `createSignedUrl(path, 3600)` → 200, tải được ảnh CCCD.

**Cơ chế**

`supabase/migrations/20260512160000_clubs_self_service.sql:100` là **file mẫu duy nhất trong repo** cho bucket + policy. Nó tạo `clubs-logos` `public = true`, và dòng 114-117:

```sql
CREATE POLICY "clubs_logos_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'clubs-logos');
```

Không `TO authenticated`, không điều kiện chủ sở hữu (đúng cho logo CLB — comment dòng 111-113 nói thẳng).

→ Khối 4 policy được copy nguyên, đổi tên bucket, giữ nguyên `select` mở, chỉ đổi `public: true` → `false` ở dòng bucket — thao tác trông *có vẻ* chính là "làm cho nó private".

→ `buckets.public = false` **chỉ tắt đúng một đường**: route `/object/public/…`. Ba đường còn lại — `list()`, `download()`, `POST /object/sign/…` — gác bằng RLS trên `storage.objects`, và policy vừa copy cho phép **PUBLIC role**, gồm cả `anon`. Anon key nằm trong bundle production.

→ Repo chưa từng có bucket private — 7/7 `INSERT INTO storage.buckets` đều `public = true`. Không có mẫu đúng để copy.

→ Mắt xích sống sót qua review: bài học storage RLS duy nhất trong lessons-learned (dòng 80-114) nói về **WITH CHECK của INSERT** (admin bypass OUTER OR). Người đọc lessons-learned sẽ kiểm đúng nhánh upload — nhánh upload lần này viết đúng. Nhánh SELECT không có bài học nào canh.

**Vì sao mọi gate vẫn xanh**

- Panel duyệt: đọc `public = false` và tick — ràng buộc plan §14 *"private storage bucket"* **thoả mãn theo nghĩa đen**. Ràng buộc viết theo thuộc tính bucket, không theo phép thử truy cập.
- pgTAP `rls_auth_matrix.test.sql`: mọi assertion blanket query `pg_tables WHERE schemaname = 'public'` — `storage.objects` không nằm trong đó → **toàn bộ ma trận RLS mù với storage**.
- Test §19 của plan: *"Storage policies prevent public KYC access"* — từ "public" là bẫy: ai cũng test route `/object/public/` và nó **thật sự 400**. Test xanh, chứng minh sai thứ.
- CI: không job nào gọi Storage API bằng anon key.
- Soak: `soak-watch.mjs` chỉ đọc `client_errors` — đọc trộm không ném exception (ops-runbook:366-368 đã nói trước).
- risk-tier: RED, Cuong duyệt — tier đúng, tier không đọc nội dung SQL.

**Ai báo, sau bao lâu:** Không ai. Phát hiện T+22 là tình cờ. **Nếu Phase 2 hoãn, con số là vô hạn** — sự cố không có cơ chế phát hiện nào.

**Vì sao khó sửa:** Policy sửa 1 migration. Hậu quả không: CCCD 3 người thật ở trạng thái đọc-được 22 ngày, không log storage tier hiện tại để chứng minh "không ai tải". `git revert` vô nghĩa (migration đã áp, revert làm drift tệ hơn). Nghĩa vụ đạo đức: gọi điện báo 3 người Cuong đích thân mời — mất họ là mất toàn bộ supply pilot = mất thước đo `00-intake.md:14`. Pháp lý: NĐ 13/2023, bucket private-trên-giấy không phải biện pháp bảo vệ.

**Dấu hiệu sớm lẽ ra phải có:** một dòng curl POST `/storage/v1/object/list/seller-documents` bằng anon key trong close-out (10 giây); một assertion pgTAP kiểu `notification_insert_rls.test.sql` đọc `pg_policies` trực tiếp; recon đã cảnh báo đúng chỗ (*"net-new pattern"*) — cảnh báo được xử lý bằng cách đặt tên bucket, không bằng một phép thử.

> **Điều rẻ nhất đã có thể ngăn:** một assertion pgTAP rằng mọi policy SELECT trên `storage.objects` có `bucket_id = 'seller-documents'` phải chứa `auth.uid()` hoặc `is_admin()` trong `qual` — 4 dòng, đỏ ngay lần chạy đầu.

---

### Sự cố 2 — "Sáu tuần, ba seller quen, không sản phẩm nào lên sàn — và kết luận rút ra là sai"

**Xác suất:** cao · **Phát hiện:** 3-6 tuần, và cái *được* phát hiện là một kết luận sai

**Timeline**

- T+0: `/shop/sell` lên prod, lối vào nằm trong burger drawer (không có slot bottom nav).
- T+1: Cuong nhắn Zalo 3 seller kèm link. Cả 3 bấm.
- T+1: seller #1 (làm việc bằng điện thoại) tới bước 3/7, mở camera chụp CCCD, quay lại, tab bị iOS thu hồi.
- T+2: mở lại → banner "Đã khôi phục bản nháp" → bấm tới Review, Gửi → fail ở bước 4 (bank) và 5 (giấy tờ) — hai bước anh tin đã điền. Điền lại bank, đi tìm lại ảnh CCCD, bỏ dở.
- T+4: seller #2 nộp đủ. Admin thấy ảnh ĐKKD mờ, bấm **Yêu cầu bổ sung** kèm lý do → "Đã gửi yêu cầu tới người nộp".
- T+4 → T+21: seller #2 không nhận được gì. Không push, không email.
- T+21: Cuong nhắn Zalo hỏi. Trả lời: *"Em gửi rồi mà anh, không thấy ai phản hồi."*
- T+21: Cuong ghi note: *"seller VN chưa sẵn sàng bán online qua form, cần làm hộ tay"*. **Kết luận này sai** — và là output đắt nhất của sự cố.

**Cơ chế**

`src/hooks/useAutosaveDraft.ts:82-95` — `flush()` serialize nguyên `value`, không sanitizer, không allow-list. Wizard seller đưa cả form vào → CodeQL đỏ `js/clear-text-storage-of-sensitive-data` (đúng lớp lỗi đã bắt ở organizer wizard, lessons-learned:426) → fix đúng: loại bank/CCCD/documents khỏi draft → hệ quả không ai viết ra: draft khôi phục 5/7 bước, banner "Đã khôi phục bản nháp" **đúng kỹ thuật, sai thông tin**. Thêm: `JSON.stringify(new File(...))` = `{}` — chip "đã tải 2 ảnh" vẽ từ mảng object rỗng.

→ Nhánh thông báo: `notification-send/index.ts` skeleton trả `{"status":"skeleton"}` **HTTP 200** — caller `invoke()` nhận 200, không ném, không log. Recon đã cảnh báo đúng chữ; khuyến nghị không phải là code.

→ Lối lui cuối — chuông in-app — chính là bề mặt từng chết click **2 tuần** không ai bắt (lessons-learned:586, PR #454, `.tl-icon-btn::after` nuốt click).

**Vì sao mọi gate vẫn xanh:** sự cố **không có sự kiện nào xảy ra** — soak sạch (ops-runbook: *"clean soak means nothing threw — not that anyone used the feature"*), client_errors 0, Playwright human-path xanh (test trang tồn tại, không test người hoàn thành 7 bước), unit test draft round-trip xanh trên object đã strip (khẳng định đúng cái hành vi là bug), không test nào assert "yêu cầu bổ sung tới được người nhận". **Quan trọng nhất:** funnel `seller_apply_step_complete`/`seller_apply_needs_changes` định nghĩa ở plan:795-805 nhưng "Analytics funnel" xếp vào **Phase 3** (dòng 955) — công cụ duy nhất nhìn thấy sự cố được lên lịch sau hai phase so với phase cần nó.

**Ai báo:** Cuong, ngày 21, bằng Zalo, bằng một câu hỏi.

**Vì sao khó sửa:** Code sửa một buổi. **Không sửa được là niềm tin của 3 người quen** — mời bằng uy tín cá nhân, lần hai khó hơn lần đầu; hỏng đúng thước đo "seller thật chịu đăng bán". **Tệ nhất là kết luận sai:** "seller VN không chịu tự nộp form" dẫn tới quyết định admin-tạo-tay — vốn là lựa chọn hợp lệ (intake đã gợi ý!) nhưng lần này được chọn vì dữ liệu bịa. Quyết định đúng trên bằng chứng sai vẫn dẫn sai ở ngã rẽ tiếp theo.

**Dấu hiệu sớm lẽ ra phải có:** skeleton trả 501 thay 200 (fail-open có sẵn); một dòng log `[seller-app] decision=needs_changes notify=<ok|skipped>`; 3 seller là **ba số điện thoại** — một tin nhắn ngày 3 thay thế toàn bộ hạ tầng analytics Phase 3. Đó là lợi thế của closed pilot mà pipeline không hề dùng.

> **Điều rẻ nhất đã có thể ngăn:** đổi `notification-send/index.ts` từ 200 sang `501` — một số, và mọi caller tương lai sẽ nổ thay vì im.

---

### Sự cố 3 — "Một function shop không build được → cả hai đường tự-vá blob-loss chết cùng lúc → đăng nhập/OTP/thanh toán chết 5 tiếng, Telegram gửi một tin nhắn trống"

**Xác suất:** trung bình · **Phát hiện:** 40 phút; ~5 giờ tới quy đúng nguyên nhân

**Timeline**

- T+0 (23:40): merge PR shop có `seller-application-submit/`, `seller-application-review/` + sửa nhỏ `_shared/admin-aal.ts`.
- T+0: `deploy-guard.yml:60-66` thấy `_shared/` đổi → deploy **TOÀN BỘ fleet**.
- T+2': step Deploy (dòng 86-95, `set -e`) chết ở function 34: `seller-application-review/index.ts` import symbol không tồn tại. Job abort.
- T+2': **step Self-heal (dòng 98-150) không bao giờ chạy** — cùng job, không `if: always()`.
- T+2': Telegram nổ. Nội dung: `edge function failed to deploy._` — không SHA, không link. Cuong đã nhận đúng chuỗi này ~40 lần từ 04/08 (drift kinh niên) và đã học cách bỏ qua. Đi ngủ.
- T+4': GitHub integration của Supabase deploy metadata không kèm blob (bug đã biết) → 83 function `NOT_FOUND_FUNCTION_BLOB`.
- T+10' → mỗi 10': `uptime-ping.yml` Blob sweep phát hiện đúng, step Heal chạy `supabase functions deploy` **fleet-wide** → bundle shop hỏng → fail → **0 function được vá**. Lặp.
- T+40': Probe routes vẫn **xanh** — `/` và `/feed` 200 (Pages không phụ thuộc edge function). Không alert P1.
- T+5h: user đầu tiên không đăng nhập được (`send-auth-email` là Auth Hook). `create-payment-order`, `mux-webhook`, `phone-otp-verify` chết theo.
- T+5h20: Cuong dậy, không login được, chạy tay deploy, thấy lỗi bundle, phải xoá tạm function shop.

**Cơ chế**

`tsconfig.app.json:30-32` `"include": ["src"]` → `tsc -b` trong `quality.yml:73` **không typecheck `supabase/functions/`**. `vite.config.ts:356-361` vitest chỉ nhận `_shared/__tests__`. Mọi `index.ts` edge function ngoài mọi runner → **cách duy nhất biết một function build được là deploy nó.** Cả hai cơ chế tự-vá gọi `supabase functions deploy` **toàn fleet, all-or-nothing** (`deploy-guard.yml:134`, `uptime-ping.yml:101`) — hai lớp phòng thủ độc lập **chia chung một lệnh**, một function hỏng đầu độc cả hai; nạn nhân là 82 function không liên quan.

Mắt xích biến 40 phút thành 5 giờ: `deploy-guard.yml:175`:

```sh
MSG="$MSG_An edge function failed to deploy._"
```

`$MSG_An` là tên biến hợp lệ chưa gán → expand rỗng, **ghi đè toàn bộ `MSG`** — SHA và link run mất. Alert duy nhất mang **0 bit chẩn đoán** — trùng khít 40 alert giả trước.

**Vì sao mọi gate vẫn xanh:** quality 8/8 (lint/tsc/vitest không đọc cây edge; build là Vite của src); auth:registry kiểm **khai báo**, không kiểm chạy được; smoke xanh (Pages sống); uptime-ping probe `/` + `/feed` — theo `docs/slo.md` SLO-1, **site không hề down** trong khi không ai đăng nhập được; soak xanh (user không login được thì không sinh JS error); edge-auth-parity so danh sách, blob-loss không đổi danh sách.

**Ai báo:** Cuong, 5 tiếng sau, bằng chính điện thoại mình.

**Vì sao khó sửa:** sửa nhanh nhưng đòi người biết đúng thứ tự — người đó đang ngủ. Revert không tự khôi phục (vẫn phải deploy tay blob; revert xoá migration khỏi ledger → drift nặng thêm). Lần thứ ba lớp lỗi "self-heal chết vì phụ thuộc chéo" (27-29/07 budget, 23/07 artifact quota) — lần này thủ phạm nằm *trong* repo.

**Dấu hiệu sớm lẽ ra phải có:** alert mang SHA + link (lỗi ở đúng một cặp ngoặc `${MSG}`); step CI 20 giây `deno check supabase/functions/*/index.ts` (repo 83 function, **không kiểm cú pháp cái nào** trước khi 2 workflow production deploy chúng); `if: always()` trên self-heal; alert nhờn là dấu hiệu chín muồi nhất — memory đã ghi *"đừng coi đỏ là lỗi PR mình"*: một gate được chính thức hoá thành "hãy bỏ qua" đã không còn là gate.

> **Điều rẻ nhất đã có thể ngăn:** `if: always()` vào `deploy-guard.yml:98` + sửa `$MSG_An` → `${MSG}_An` dòng 175 — hai ký tự và một dòng YAML.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | KYC đọc được bằng anon key (bucket private nhưng RLS mở) | TB-cao (~50%: copy-paste từ mẫu duy nhất) | **Không có cơ chế phát hiện** — 22 ngày là may | **P0** |
| 2 | Pilot chết đói supply + kết luận sai về seller | **Cao (~80%)** | 3-6 tuần, và cái phát hiện được là kết luận sai | **P0** |
| 3 | Function shop đầu độc fleet-heal → auth/OTP/payment chết 5h | TB (~35%) | 5h quy đúng nguyên nhân; loud khi đã biết | P1 |

#1 trên #3 vì #3 mất 5 giờ rồi hết; #1 không có đồng hồ đếm ngược và ảnh CCCD người quen không revert được. #2 ngang #1: sự cố duy nhất giết đúng thước đo Cuong tự viết, và trả về *bài học sai* — đắt hơn downtime vì định hướng sai ba quyết định tiếp theo.

## Rẻ nhất để chặn từ bây giờ

1. **Assertion pgTAP cho `storage.objects`** (chặn #1) — 4 dòng, kiểu `notification_insert_rls.test.sql`, cho đỏ trước.
2. **`notification-send/index.ts:35` trả 501 thay 200** (chặn #2 + mọi caller tương lai) + banner khôi phục nháp liệt kê rõ bước nào chưa có.
3. **`if: always()` + `${MSG}`** ở deploy-guard + step `deno check supabase/functions/*/index.ts` trong quality.yml (chặn #3). Tổng: 3 dòng.

## Khoảng hở pipeline lộ ra

1. **Không gate nào nhìn thấy `storage.objects`** — rls_auth_matrix quét `schemaname='public'`. Gate phải mở rộng sang schema storage **trước** bucket private đầu tiên, không phải sau.
2. **~83 file `supabase/functions/**/index.ts` không nằm trong typechecker/linter/test runner nào** — cách duy nhất biết build được là deploy vào prod.
3. **Hai lớp self-heal chia chung một lệnh all-or-nothing** — redundancy trên sơ đồ, SPOF trong thực tế.
4. **SLO-1 định nghĩa availability = `/` + `/feed` 200** — toàn tầng edge (auth email, OTP, payment, webhook) không SLO, không prober. Site "up" 100% trong khi không ai đăng nhập được là trạng thái hợp lệ theo văn bản.
5. **Alert nhờn đã được ghi vào bộ nhớ tổ chức như quy tắc** — nợ phải trả (reconcile drift hoặc tách drift-check) trước khi thêm 7 migration vào cùng ledger.
6. **Gate đo sự kiện; sự cố tệ nhất của Phase 1 là sự vắng mặt của sự kiện.** Với thước đo = hành vi của 3 người cụ thể, pipeline hiện tại về mặt cấu trúc không thể báo thất bại. Thay thế rẻ nhất cho analytics: một dòng close-out *"gọi cả 3 seller vào ngày T+3"*.
