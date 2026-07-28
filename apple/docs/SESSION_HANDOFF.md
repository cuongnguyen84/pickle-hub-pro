# Session handoff — ThePickleHub native iOS

> Paste/đọc file này khi mở một phiên Claude Code mới. Memory của Claude nằm ở
> `~/.claude` của máy gốc, **không đi theo repo** — file này là nguồn bối cảnh
> bền vững trong repo.

## Bối cảnh

REPO `pickle-hub-pro` = web (React) + app native iOS. App native ở `apple/`
(SwiftUI, XcodeGen). Backend Supabase dùng chung với web (project ref
`ajvlcamxemgbxduhiqrl`). Tại lần handoff gần nhất (2026-07-21), branch đang làm
là **`main`**, HEAD `ba462a01`; luôn kiểm tra lại branch/worktree trước khi sửa.

## Workstream đang ưu tiên (2026-07-21)

Đọc đầy đủ **`apple/docs/HARDENING_PLAN_2026-07-21.md`** trước khi tiếp tục.
Đây là memory bền vững cho đợt sửa 4 nhóm blocker: CI + privacy, auth session,
Doubles Elimination bracket và transaction/toàn vẹn dữ liệu. Làm tuần tự từng
task, chạy verification và cập nhật trạng thái trong file đó sau mỗi task.

Trạng thái hiện tại: Task 1–4 đã hoàn tất. Task 4 dùng mười migration atomic
`20260722010000`…`20260722100000` và caller web/native tương ứng. Team Match
create, round-robin/group, single-elimination, main + repechage, start vòng và
reset không còn chuỗi REST nhiều bước. Fresh replay + full pgTAP 398/398, web
Vitest 1.122 pass + 10 skip/build và native 116/116 đều pass. Remote preflight
cũng đã xong và sau phê duyệt rõ, cả 10 migration đã được apply lên production.
Hậu kiểm: ledger local/production 302/302 in-sync, dry-run báo up to date, 19/19
RPC contract tồn tại với `authenticated` execute và `anon` revoked. Source Task
1–4 cùng hardening ImagePipeline/WebView/error handling đã qua local release
gate và được gom trong source-control release ngày 2026-07-22; chưa deploy web
hay phát hành iOS.

## Release gate gần nhất (2026-07-23)

- Full native 116/116, targeted hardening 9/9, strict-concurrency simulator
  build, web Vitest/TypeScript/ESLint/build và `git diff --check` đều pass.
- Unsigned Release archive và Development-signed Release archive đều pass;
  privacy manifest embedded, lint pass và khớp source.
- Artifact release-readiness hiện tại là unsigned Release archive cho
  `net.thepicklehub.app`, version `1.1.0 (3)`. Máy chỉ có Apple Development
  certificate, không có Apple Distribution/App Store Connect API key, nên chưa
  thể validate/upload App Store.
- Direct App Store upload đã chạy xong từ signed cloud-distributed IPA; Xcode
  báo `Upload succeeded` và App Store Connect đang xử lý package. Build này là
  `ThePickleHub.ipa` từ archive `ThePickleHub-1.1.0-3.xcarchive`.
- Hai iPhone vật lý đang offline nên device smoke còn mở. Product/legal cần
  reconcile privacy disclosure; Supabase PAT đã từng chia sẻ qua chat cần rotate.

### P1 Release & Activation update — 2026-07-22

- Debug/Release đã tách bằng tracked xcconfig. Debug giữ
  `net.thepicklehub.app.dev`; Release thay app Capacitor bằng
  `net.thepicklehub.app`, version kế tiếp `1.1.0 (3)`, environment production.
- Native registration cần build flag + valid Turnstile public site key + remote
  `system_settings.native_event_registration_enabled=true` + event cho guest.
  Mọi missing/error state fail closed về Safari; remote setting là kill switch
  không cần phát hành binary mới. Chưa tạo/đổi setting production.
- Transitive Swift packages (23 pins, gồm Firebase Messaging 12.9.0) được khóa
  bằng `Config/Package.resolved`. CI chạy
  source release preflight, full tests với resolved-only mode và unsigned Release
  build có complete strict-concurrency diagnostics.
- FCM parity đã port từ Capacitor: Firebase client config fail-closed, APNs token
  nối sang FCM, upsert `push_tokens`, tap payload vào deep link native. Lần chạy
  native đầu/đổi account/logout đều xoay FCM token để stale row không gửi nhầm
  tài khoản. Release push đã bật để giữ parity với Capacitor; `--shipping` cấm
  ship nếu Firebase/APNs config thiếu.
- Session Capacitor nằm trong WebKit localStorage, session Swift nằm trong
  Keychain. Bản native yêu cầu user login lại một lần; product đã chấp thuận và
  Release đặt `CAPACITOR_AUTH_RESET_APPROVED=YES`.
- Unsigned production archive cuối tại
  `/tmp/picklehub-p1-release.wtRT49/ThePickleHub-1.1.0-3.xcarchive` đã pass: đúng
  bundle/environment, export-compliance flag, embedded privacy manifest,
  registration/push OFF. Runbook: `docs/RELEASE_AND_ACTIVATION.md`.
- P1 full suite pass: 130 Swift Testing + 7 XCTest = 137 tests. App target đã
  chuyển sang Swift 6 language mode; Debug test build, clean Release strict build
  và toàn bộ suite đều pass, không còn warning concurrency trong source app.
  Shipping preflight dừng đúng tại blocker push chưa được device-smoke/activate;
  máy vẫn thiếu Apple Distribution identity.
- Còn external gate: Firebase client config + APNs, Apple Distribution identity/
  provisioning, App Store Connect credential, version/build hiện tại và privacy
  disclosure reconciliation. Không upload hay kích hoạt production.
- Product đã chấp thuận forced re-login ngày 2026-07-22 và yêu cầu bỏ TestFlight,
  upload build thẳng vào App Store Review. Release config đã đặt
  `CAPACITOR_AUTH_RESET_APPROVED=YES`, `REMOTE_PUSH_ENABLED=YES`; native
  registration vẫn OFF/Safari fallback. Firebase public config được lấy từ
  production `GoogleService-Info.plist` trong local keystore, không commit.

## Build (`apple/`)

- **XcodeGen**: `.xcodeproj` bị gitignore → luôn `cd apple && xcodegen generate`
  trước khi build. Sửa `project.yml`, KHÔNG sửa trực tiếp trong Xcode.
- **Secrets**: `Config/Secrets.xcconfig` (gitignore) chứa `SUPABASE_PROJECT_REF`
  + `SUPABASE_ANON_KEY`. Xem `BUILD_ON_NEW_MAC.md`.
- **Build**: mở `ThePickleHub.xcodeproj` → Run; hoặc
  `xcodebuild -scheme ThePickleHub -destination 'platform=iOS Simulator,name=iPhone 16' build`
  (bỏ `-derivedDataPath` nếu không phải máy gốc).
- **Design system**: `TLColor` / `TLFont` (sans=Geist, mono=Geist Mono,
  serif=Instrument Serif) / `TLRadius` / `TLCard` / `.feedCard()`. Dark-only,
  accent optic-lime. **KHÔNG hardcode hex mới.**
- **Pattern**: `Core/<Feature>/{Models,Repository}.swift` +
  `Features/<Feature>/...View.swift`, `@Observable` ViewModel với
  `enum Phase { loading, loaded, failed(String) }`. Repo gọi
  `SupabaseManager.shared.client`. Search debounce 300ms, pull-to-refresh,
  empty/error states.
- **Gotcha**: SourceKit báo "Cannot find type X / No such module Supabase"
  cross-file là **FALSE** — chỉ tin `xcodebuild`. Chạy `xcodegen generate` lại nếu cần.

## Đã hoàn thành (native)

- **5 tab**: Home (editorial mirror Index.tsx), Live (cinematic redesign +
  resume playback + reminders), Social hub, Feed (match/blog/news/video đều
  native), Tools.
- **Bracket Lab (Tools)** — đủ 4 format view+score: Quick Table, Team Match
  (MLP), Doubles Elimination, Flex. Cả bốn có đầy đủ luồng tạo và workspace
  quản lý native; gồm đăng ký/ghép đôi, roster, chia bảng, chấm điểm, playoff,
  trọng tài/PIN, dashboard sân và giải nhiều nội dung.
- **Notifications + Search** native (icon trên toolbar Home).
- **Social hub**: segmented **Sân / Xé vé / CLB** (mặc định Xé vé).
  - Sân: court finder (`venues`) — list + detail (chỉ đường/giờ/tiện ích).
  - Xé vé: sự kiện social grouped theo ngày + detail (trận đấu + roster ẩn tên).
  - CLB: clubs list + detail (membership, events, matches, members).
- Log trận, player profiles, rankings (DUPR VN).

## Còn mở web (hybrid line — KHÔNG phải bug; đừng rebuild trừ khi được yêu cầu)

Admin (`/admin/*`), Creator studio (`/creator/*`), quản lý CLB, tạo/sửa sự kiện,
thêm sân, tạo CLB, xếp cặp Mexicano và DUPR SSO connect. Đăng ký sự kiện giữ
Safari fallback khi app chưa có Turnstile site key hợp lệ hoặc sự kiện không cho
khách đăng ký; đây là fail-safe có chủ đích.

## Việc có thể làm tiếp

- Cài Apple Distribution/provisioning + App Store Connect credential, rồi chạy
  signed validation và upload thẳng App Store Connect theo quyết định release.
- Reconcile App Store privacy answers/policy và rotate Supabase PAT đã lộ qua chat.
- Cấu hình public Turnstile site key/hostname cho native, rồi chạy device smoke
  với OTP SMS/Zalo thật, token hết hạn/replay, slot đầy, sự kiện miễn phí/có phí
  trước khi bật flow native trong bản phát hành.
- Lấy bốn Firebase iOS client identifiers production, chạy update-over-Capacitor
  và bật `REMOTE_PUSH_ENABLED`; forced re-login đã được duyệt riêng.
- Native event create / club create-manage nếu muốn rời web.
- Giữ Swift 6 + strict concurrency trong release gate; khi nâng Google/Firebase/
  Supabase phải chạy lại clean Release vì package ngoài giữ language mode riêng.
- Reconcile version/build với App Store Connect ngay trước archive; tăng khỏi
  `1.1.0 (3)` nếu record thực tế đã dùng số mới hơn.
- Test trên device theo `native-test-cases.md`.

### Progress update — 2026-07-23

- Native Bracket Lab foundation now has a shared `TournamentService` and
  `QuickTableDetailView` subscribes to quick-table realtime invalidation instead
  of relying only on the 15s polling loop. The shared subscription handle is
  actor-isolated and cleaned up on screen disappear / tournament switch.
- Follow-up sharing step: `DoublesElimDetailView`, `TeamMatchDetailView`, and
  `FlexDetailView` now reuse the same shared current-user lookup path instead of
  each screen asking its own repo directly.
- Verification for this increment: targeted native result tests pass
  (`QuickTableResultTests`, `DoublesElimResultTests`, `TeamMatchResultTests`)
  24/24, and `xcodegen generate` was rerun so the new Core/Tournament file stays
  in the app target.
- Native tournament roadmap follow-up is complete:
  1) all four detail screens use one lifecycle for initial load, pull refresh,
     15-second fallback polling and cleanup;
  2) reloads are serialized/coalesced, realtime bursts debounce for 500 ms, and
     Team Match child-table subscriptions no longer use invalid filters;
  3) Flex now has full realtime invalidation, and all four detail screens expose
     native share links;
  4) failed score saves retain the entered draft, block duplicate submits and
     offer a safe retry instead of dismissing the sheet.
- Targeted verification for the shared lifecycle/result increment passes 38/38
  tests across five suites. Full native verification passes 132 Swift Testing +
  7 XCTest = 139/139; both Debug and strict-concurrency Release simulator builds
  pass in Swift 6. No backend, migration or production state changed by this
  follow-up.
- Search PostgREST grammar hardening completed: native global search quotes
  reserved punctuation and escapes quotes, backslashes and ILIKE wildcards;
  contract tests cover punctuation/wildcard inputs without deleting user text.
- Realtime chat now uses the typed Postgres filter and error-aware subscription
  APIs. Repeated loads stop prior tasks/channels, duplicate startup is guarded,
  and a failed subscription exposes an in-panel reconnect action.
- Native social-event guest registration now mirrors the production contract:
  Turnstile-protected OTP send, OTP verify with optional slot, live slot capacity,
  free/paid branch, VietQR management, cancel/reactivate and stable backend error
  codes. Magic bearer tokens live in Keychain, never UserDefaults.
- Native registration is fail-closed: without a valid public Turnstile site key,
  or when `allow_guests` is false, the existing Safari registration flow remains.
  Khi form native đã mở, người dùng vẫn luôn có nút "Đăng ký trên web" nếu CAPTCHA,
  OTP hoặc payment service gặp sự cố.
  Activation still requires hostname configuration plus real-device OTP/payment
  smoke; no backend function, migration or production data changed in this slice.
- Verification for this increment: 119 Swift Testing + 7 XCTest = 126 tests pass;
  standard and complete strict-concurrency simulator builds pass. Strict mode
  still reports pre-existing Swift 6 warnings outside the touched registration/
  chat files, recorded above as the next hardening backlog.
- GoogleSignIn dependency upgraded from 7.1.0 to 9.2.0; package resolution and
  simulator build both pass. Generated Xcode project remains ignored by design,
  so reproducibility still requires regenerating from `project.yml` in CI.

## Tài liệu trong repo

- `apple/docs/native-test-cases.md` — test case thủ công đầy đủ (Bracket Lab → các màn).
- `apple/docs/BUILD_ON_NEW_MAC.md` — build trên máy khác.
- `apple/README.md` — kiến trúc + setup.
- `CLAUDE.md` (gốc repo) — bối cảnh web/backend.

## Nguyên tắc khi làm tiếp

Đọc `apple/` trước khi sửa. **Port prod chính xác** — đọc cả web source liên quan
ở `src/` (page + hook + i18n) trước khi dựng một màn native; đừng tự nghĩ form/flow.
Hybrid: native cho luồng người dùng cuối dùng nhiều; giữ web cho admin/creator/payment.
