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

## Release gate gần nhất (2026-07-22)

- Full native 116/116, targeted hardening 9/9, strict-concurrency simulator
  build, web Vitest/TypeScript/ESLint/build và `git diff --check` đều pass.
- Unsigned Release archive và Development-signed Release archive đều pass;
  privacy manifest embedded, lint pass và khớp source.
- Artifact hiện tại là Development signing cho `net.thepicklehub.app.dev`,
  version `0.1.0 (1)`. Máy chỉ có Apple Development certificate, không có Apple
  Distribution/App Store Connect API key, nên chưa thể validate/upload App Store.
- Hai iPhone vật lý đang offline nên device smoke còn mở. Product/legal cần
  reconcile privacy disclosure; Supabase PAT đã từng chia sẻ qua chat cần rotate.

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
  (MLP), Doubles Elimination, Flex. Create native cho QT/MLP/DE; Flex create giữ web.
- **Notifications + Search** native (icon trên toolbar Home).
- **Social hub**: segmented **Sân / Xé vé / CLB** (mặc định Xé vé).
  - Sân: court finder (`venues`) — list + detail (chỉ đường/giờ/tiện ích).
  - Xé vé: sự kiện social grouped theo ngày + detail (trận đấu + roster ẩn tên).
  - CLB: clubs list + detail (membership, events, matches, members).
- Log trận, player profiles, rankings (DUPR VN).

## Còn mở web (hybrid line — KHÔNG phải bug; đừng rebuild trừ khi được yêu cầu)

Admin (`/admin/*`), Creator studio (`/creator/*`), quản lý CLB, tạo/sửa sự kiện,
thêm sân, tạo CLB, **đăng ký OTP + thanh toán**, xếp cặp Mexicano, DUPR SSO connect.

## Việc có thể làm tiếp

- Cấu hình bundle/version production, Apple Distribution + App Store Connect,
  chạy signed validation/upload và device smoke khi thiết bị online.
- Reconcile App Store privacy answers/policy và rotate Supabase PAT đã lộ qua chat.
- Native phone-OTP registration cho Xé vé (edge fn `phone-otp-send`/`phone-otp-verify`
  + magic token, account-less).
- Native event create / club create-manage nếu muốn rời web.
- Escape đầy đủ PostgREST grammar trong search; nâng Realtime chat API và làm
  start/stop idempotent; cập nhật GoogleSignIn/reproducible dependency resolution.
- Test trên device theo `native-test-cases.md`.

## Tài liệu trong repo

- `apple/docs/native-test-cases.md` — test case thủ công đầy đủ (Bracket Lab → các màn).
- `apple/docs/BUILD_ON_NEW_MAC.md` — build trên máy khác.
- `apple/README.md` — kiến trúc + setup.
- `CLAUDE.md` (gốc repo) — bối cảnh web/backend.

## Nguyên tắc khi làm tiếp

Đọc `apple/` trước khi sửa. **Port prod chính xác** — đọc cả web source liên quan
ở `src/` (page + hook + i18n) trước khi dựng một màn native; đừng tự nghĩ form/flow.
Hybrid: native cho luồng người dùng cuối dùng nhiều; giữ web cho admin/creator/payment.
