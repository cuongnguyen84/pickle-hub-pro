# Session handoff — ThePickleHub native iOS

> Paste/đọc file này khi mở một phiên Claude Code mới. Memory của Claude nằm ở
> `~/.claude` của máy gốc, **không đi theo repo** — file này là nguồn bối cảnh
> bền vững trong repo.

## Bối cảnh

REPO `pickle-hub-pro` = web (React) + app native iOS. App native ở `apple/`
(SwiftUI, XcodeGen). Backend Supabase dùng chung với web (project ref
`ajvlcamxemgbxduhiqrl`). Branch đang làm: **`feat/native-ios-phase-1`** (đã push).

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

- Native phone-OTP registration cho Xé vé (edge fn `phone-otp-send`/`phone-otp-verify`
  + magic token, account-less).
- Native event create / club create-manage nếu muốn rời web.
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
