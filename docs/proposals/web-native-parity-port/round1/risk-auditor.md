# Risk audit — web→native parity port (vòng 1)

## Verdict: 🔴 RED
Một đêm code không ai review, chạy trên **simulator trỏ thẳng vào Supabase prod bằng tài khoản admin duy nhất của hệ thống**, sẽ ghi/xoá nhầm dòng thật trong `event_registrations` / `social_events` / `payment_orders` — và không có đường phục hồi từng dòng: `git revert` không trả lại row, backup duy nhất đã diễn tập được là "restore CẢ DB sang project mới" (ops-runbook §6).

**Classifier: KHÔNG CHẠY ĐƯỢC.** `scripts/agents/risk-tier.mjs` không tồn tại (`scripts/agents/` không có trong repo — đã biết từ memory `idea-pipeline-missing-scripts.md`). Không có sàn tier từ máy; tier dưới đây là em tự đặt và tự chịu trách nhiệm.

**RED này hẹp, không phải RED toàn bộ ý tưởng.** Phân vùng rõ:

| Nhóm việc | Tier | Lý do |
|---|---|---|
| Màn hình **chỉ đọc**: `/tournaments` 3-tab, parent tournament page, TV-mode dashboard, pro tournament detail phần **hiển thị bracket** | 🟢 GREEN | không mutation, không deploy, `git revert` là đủ |
| Màn hình **có ghi**: social event slots/perks/recurrence, club invite member, tournament registration trong pro-tournament detail, Creator Studio | 🔴 RED | ghi thật vào prod, không revert được từng dòng |
| **Remote push APNs/FCM** | 🔴 RED | không hoàn thành được trong phiên, và thử nửa vời để lại rác vĩnh viễn trong `push_tokens` |
| Bất kỳ **migration / edge function deploy** nào phát sinh để phục vụ port | 🔴 RED | PAT prod có sẵn trong máy; migration không revert bằng git |

---

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | **Guard sức chứa nằm trong RPC, KHÔNG nằm trong bảng.** `20260716090000_db01_atomic_event_capacity.sql` + `20260717200000_db01c_member_capacity_lock.sql` đặt `pg_advisory_xact_lock('event_capacity:'‖event_id)` **bên trong** `social_event_guest_register` / `register_event_as_member`. Không có trigger, không có constraint trên `event_registrations`. Policy INSERT là toàn bộ hàng rào: `event_registrations_insert_self` = `auth.uid() IS NOT NULL AND profile_id = auth.uid()` (`20260511120000_social_events_foundation.sql:302-307`), + `GRANT ... INSERT ... TO authenticated` (`20260511130000:51`). Không có migration nào siết lại sau đó (đã grep toàn bộ `event_registrations_insert*`). → Repository native mới cho "slots" viết `.insert()` thẳng như 98 call-site mutation đang có sẽ **được PostgREST trả 201** và bỏ qua sạch: sức chứa, slot, trạng thái event, yêu cầu thanh toán. | 9 người vào sân 8 chỗ. Cả hai người cùng nhận "đăng ký thành công"; BTC phải gọi điện loại bớt một người **đã chuyển tiền**. | Mọi đường đăng ký/huỷ/kích hoạt lại của native **bắt buộc** đi qua RPC guarded (`register_event_as_member`, edge fn `reactivate-registration` — native đã dùng đúng ở `SocialRepository.swift:86`, đừng phá pattern đó). Gate merge: `grep -n 'from("event_registrations")' apple/` không được xuất hiện `.insert(`. |
| 2 | **Cao** | **Tài khoản test = admin duy nhất của prod.** `event_registrations_update_organizer` / `_delete_organizer` (`20260511120000:311-341`) là `has_role(auth.uid(),'admin') OR <là organizer>`. `user_roles` có đúng **1 dòng admin** = `thecuong@gmail.com` — chính là tài khoản đăng nhập trên dev build. Một repository mới thiếu `.eq("event_id", ...)` hoặc truyền nhầm ID sẽ UPDATE/DELETE **xuyên qua mọi event của mọi BTC** mà RLS không chặn. `event_registrations` không có audit table, `.delete()` là xoá cứng (`cancelled_at` chỉ dùng cho luồng huỷ mềm). | Đăng ký của người thật biến mất khỏi roster. BTC mở app thấy sân trống. Không ai biết chuyện gì xảy ra vì không có log. | Đêm chạy dùng **tài khoản viewer riêng**, không dùng account admin. Ngoài ra: test như admin còn **che mất lỗi 403** mà organizer thường sẽ gặp — tức là sáng mai "chạy được" không chứng minh được gì cho user thật. |
| 3 | **Cao** | **"Chỉ commit feature branch" KHÔNG cô lập backend.** PAT Supabase Management API nằm sẵn ở `~/Downloads/secrets.local.md` (đã xác nhận file tồn tại), và memory `supabase-migrations-auto-apply` cho phép agent áp migration prod không cần hỏi. Nếu port slots/perks cần một RPC mới (rất có khả năng — xem #1), agent sẽ áp migration lúc 3h sáng **không có pgTAP, không có migration-drift check** (cả hai là GitHub Actions, đang chết). | Tuỳ migration. Xấu nhất: RPC bị `CREATE OR REPLACE` sai → luồng đăng ký web hỏng cho toàn bộ user. | **Cấm tuyệt đối** migration + `functions deploy` trong đêm. Gate merge: `git diff --stat main..<branch> -- supabase/ src/ functions/` phải **rỗng**. Nếu port cần schema mới → dừng, ghi vào báo cáo, chờ Cuong. |
| 4 | **Cao** | **APNs không thể hoàn thành, và thử nửa vời để lại rác vĩnh viễn.** `/apple` hiện có **0** dòng APNs/FCM (grep `registerForRemote|deviceToken|FirebaseMessaging|push_token` → rỗng), `project.yml` không có package Firebase, không có `GoogleService-Info.plist` trong repo, entitlements chỉ có `associated-domains` — **không có `aps-environment`**. Thiếu: bật Push capability cho App ID, provisioning profile chứa `aps-environment`, APNs key, upload key lên Firebase, đăng ký `net.thepicklehub.app.dev` làm Firebase iOS app. Không có portal access trong phiên → không làm được cái nào. Nếu agent vẫn ghi một token vào `push_tokens`: `send-push-notification/index.ts:215-220` chỉ prune khi HTTP 404 hoặc `errorCode === "UNREGISTERED"`. Token hỏng do sai APNs credential trả `THIRD_PARTY_AUTH_ERROR`/`SENDER_ID_MISMATCH` → **không bao giờ bị prune**, nằm mãi trong mẫu số. RLS `push_tokens` chỉ cho `auth.uid() = user_id` xoá → không có UI nào của Cuong dọn được, phải chạy SQL tay. | Không user nào thấy gì ngay. Nhưng **SLO 7 (push ≥95% sent/total) tụt vĩnh viễn** và mọi broadcast sau đó báo lỗi giả. | Đêm nay **không viết code đăng ký token**. Nếu vẫn làm phần client: chặn cứng `push_tokens` insert sau `#if targetEnvironment(simulator)`. |
| 5 | **TB** | **Test "gửi thông báo" = 2000 người thật nhận push lúc 3h sáng.** CLAUDE.md nói fn này "no specific role check" — **sai/lỗi thời**: `index.ts:120-142` có check admin thật. Nhưng gate đó đi qua đúng tài khoản mà agent dùng. `handler.ts:8` `broadcast: true` = mọi token đã đăng ký. | Push "test" tới toàn bộ user. Không unsend được. | Chỉ dùng `dry_run: true` (`handler.ts:8` có sẵn). Không bao giờ gọi với `broadcast: true`. |
| 6 | **TB** | **Mux tạo state ngoài, tính tiền.** Port Creator Studio gọi `mux-create-livestream` (role `creator`/`admin` — account test qua). Live stream / direct upload / asset là tài nguyên Mux thật; `git revert` và restore DB không xoá chúng. | Stream test lộ trên `/live` nếu record được publish. Hoá đơn Mux tăng. | Bỏ Creator Studio khỏi phạm vi đêm nay (recon cũng ghi đây là quyết định web-only có chủ đích). |
| 7 | **Thấp** | Club invite by search bắn `social_notifications` tới profile thật khi test. | Người lạ nhận lời mời vào CLB không quen. Xoá row không rút lại được thông báo đã hiện. | Test bằng 2 tài khoản của chính Cuong, không search profile thật. |

### Rủi ro em đã KIỂM TRA VÀ LOẠI (đừng ai nêu lại)

- **"File Swift mới không vào target, phá build main"** — không xảy ra. `apple/project.yml:31` dùng `sources: - path: ThePickleHub` (cả thư mục), và `apple/.gitignore:2` ignore `*.xcodeproj/` → project được generate lại mỗi lần, không có file project cũ để lệch.
- **"Không có CI thì không verify được Swift"** — verify được, chỉ là chạy local. Em đã chạy baseline trên `main` ngay trong phiên này: `xcodegen generate && xcodebuild test -scheme ThePickleHub -destination "iPhone 17 Pro"` → **TEST SUCCEEDED, 109 tests / 19 suites, ~17 giây test + ~40 giây build**. Đó là gate thay thế hợp lệ cho `apple-tests.yml` đang chết. Baseline xanh nên nếu đêm nay đỏ thì đúng là lỗi mới.
- **SLO web / bundle / SEO** — không đụng, xem mục dưới.

---

## SLO bị đe doạ

- **SLO 3 (Registration 99%)** — rủi ro #1. Overbooking không hiện ra dưới dạng lỗi; nó là insert **thành công** ghi đè business rule. Metric hiện tại (`registration_insert_failed` vs `registered`) sẽ báo 100% khoẻ trong khi sân bị đặt quá chỗ.
- **SLO 7 (Push ≥95%)** — rủi ro #4. Token rác không prune được kéo tỉ lệ xuống vĩnh viễn.
- **SLO 4 (Scoring, zero lost-update)** — chỉ bị đe doạ nếu port chạm bracket **ghi** (pro-tournament registration). Phần render bracket read-only thì không.
- **SLO 1/2/6 (availability, auth, latency)** — **KHÔNG bị đe doạ**, với điều kiện gate #3 giữ (không đụng `src/`, `functions/`, `supabase/`).

## Ngân sách hiệu năng

- **Bundle: +0 KB → không đổi.** Port chỉ chạm `apple/`; `scripts/check-bundle-size.mjs` đo `dist/` của Vite, không thấy Swift. Trần 1970 KB gz không bị chạm.
- **Vietnam p75: không ảnh hưởng.** Không có JS mới trên đường web. RUM `web_vital` không nhận thêm gì.
- Cảnh báo duy nhất: nếu port push thì thêm SPM package Firebase (kéo theo FirebaseCore/GoogleUtilities/nanopb) — đó là **thời gian build native**, không phải bundle web. Là thêm một lý do nữa để không làm push đêm nay.

## SEO

- **Routes SSR bị ảnh hưởng: none.** Không chạm `functions/_middleware.ts`, `functions/_lib/render/`, sitemap, canonical/hreflang.
- **Cần bump `pr:v30`? Không** — không có thay đổi output SSR nào để invalidate.
- Verify (chỉ để chứng minh không regression sau khi merge): `curl -A "Googlebot" https://www.thepicklehub.net/` → 200 + title + og:image + hreflang.

## Kế hoạch rollback

- **Cơ chế cho code:** `git revert` / xoá branch — **đủ**, vì binary không tới tay user (chưa submit App Store).
- **Cơ chế cho dữ liệu: KHÔNG CÓ.** Đây mới là chỗ quyết định tier.
- **Thời gian khôi phục:** code ~2 phút. Dữ liệu: restore cả DB sang project mới ~4 phút (ops-runbook §6) — nhưng đó **không phải rollback**, đó là forensics: nó không trả row về project prod, và làm mất mọi write của user thật kể từ mốc backup (~15:45 UTC hằng ngày). Storage objects **không nằm trong backup**.
- **Không revert được (đây là lý do RED):**
  1. Row đã INSERT/UPDATE/DELETE trong `event_registrations`, `social_events`, `event_payment_config`, `payment_orders`.
  2. Row trong `push_tokens` (không prune tự động, không UI xoá).
  3. Push đã gửi tới máy người thật.
  4. Migration prod / edge function đã deploy.
  5. Tài nguyên Mux (live stream, asset, upload) + hoá đơn.
  6. Thông báo mời CLB đã hiện trên máy người khác.

## Phải verify trước khi merge

- [ ] `git diff --stat main..<branch> -- src/ functions/ supabase/ scripts/` → **rỗng**. Có dòng nào = dừng, audit lại.
- [ ] `cd apple && xcodegen generate && xcodebuild test -project ThePickleHub.xcodeproj -scheme ThePickleHub -destination "platform=iOS Simulator,name=iPhone 17 Pro" CODE_SIGNING_ALLOWED=NO` → `TEST SUCCEEDED`, **≥109 tests** (baseline hôm nay). Ít hơn 109 = có suite bị mất.
- [ ] `grep -rn 'from("event_registrations")' apple/ | grep -n '\.insert('` → **0 kết quả**. Mọi đăng ký phải qua RPC/edge fn.
- [ ] `grep -rn 'push_token\|registerForRemoteNotifications' apple/` → 0 kết quả (nếu push bị hoãn như khuyến nghị).
- [ ] Báo cáo sáng mai phải liệt kê **mọi row prod đã tạo trong đêm** (bảng + id) để Cuong dọn tay. Không có danh sách này = coi như chưa xong.
- [ ] Xác nhận tài khoản dùng để test là **không phải** `thecuong@gmail.com`.

## Phản biện độc lập (GPT-5.6)

Đã chạy — nhưng **không bằng `scripts/agents/ask-model.mjs`, script đó không tồn tại trong repo**. Em gọi thẳng OpenAI Responses API (`OPENAI_MODEL=gpt-5.6`, reasoning effort high). Prompt: `external/risk-auditor-gpt56-prompt.md`, trả lời nguyên văn: `external/risk-auditor-gpt56-reply.md`.

**Đã xác minh trong repo và giữ lại:**
- *"'Chưa merge' không cô lập được gì cho DB / edge function / FCM / Mux"* — **đúng và là điểm mạnh nhất của nó**. Em đã xác nhận PAT prod nằm ở `~/Downloads/secrets.local.md`. → rủi ro #3.
- *"DB-01 không phải integrity boundary chừng nào INSERT trực tiếp còn mở"* — **đúng, và nặng hơn em nghĩ ban đầu**: đây là lỗ hổng **đang sống trên prod ngay bây giờ**, không phải do port tạo ra. Bất kỳ user đăng nhập nào cũng POST thẳng `/rest/v1/event_registrations` được. Port chỉ thêm một UI đi vào cửa đó. → viết vào #1 kèm khuyến nghị fix ở tầng DB (trigger/constraint), không phải kỷ luật client.
- *"Test bằng account admin che mất lỗi 403 của organizer thường"* — đúng, em đã bổ sung vào #2. Đây là góc em bỏ sót: em chỉ nghĩ tới blast radius, nó chỉ thêm mặt "false green".
- *"Simulator không test được push end-to-end; `simctl push` bỏ qua APNs, FCM, token registration"* — đúng, khớp với việc không có `aps-environment` trong entitlements.

**Bác bỏ:**
- *"Storage overwrite có thể mất dữ liệu không phục hồi được"* — **SAI với repo này.** `ProfileRepository.swift:131` dùng path `{uid}/{timestamp}.{ext}`, `upsert: true` nhưng key luôn mới → không bao giờ đè object cũ. Cùng pattern ở `clubs-logos`/`forum-images`. Tệ nhất là rác orphan, không phải mất dữ liệu.
- *"Agent hammer login 8 tiếng → throttle Supabase Auth, user thật 429"* — **suy đoán, và chính GPT cũng tự hedge.** Native `SessionStore` giữ session (`SessionStoreTests` xanh trong baseline); không có vòng lặp OTP nào trong kế hoạch port. Loại. (Ghi chú: memory `session-2026-07-22` có ghi hammer mint local *đập* rate limit thật — nhưng đó là kịch bản verify lặp thủ công, không phải kịch bản này.)
- *"Realtime channel leak làm đơ live courtside"* — GPT tự nói "drop this concern if no measured growth". Một simulator không đe doạ gì. Loại.
- *"Deploy `send-push-notification` hỏng → broadcast chết"* — đúng về cơ chế nhưng đã nằm trọn trong #3 (cấm deploy). Không tách thành mục riêng.
- *"CI cạn budget tự nó không gây hại"* — **đồng ý, và em nói mạnh hơn**: gate native chạy local được, baseline hôm nay 109/109 xanh. Đừng ai đưa "không có CI" vào proposal như một RED — nó là AMBER và có cách bù.

**Panel KHÔNG bị one-model-down**: `OPENAI_API_KEY` có, gọi thành công.
