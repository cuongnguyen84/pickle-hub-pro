# Build ThePickleHub native iOS trên một máy Mac khác

App native nằm trong `apple/` trên branch `feat/native-ios-phase-1`. Dự án dùng
**XcodeGen** (`.xcodeproj` bị gitignore → phải generate), và đọc secrets từ
`Config/Secrets.xcconfig` (cũng gitignore).

## 1. Cài công cụ

```sh
# Xcode 16+ từ App Store (kèm iOS Simulator runtime; min deployment target = iOS 17)
xcode-select --install
brew install xcodegen          # bắt buộc — repo không commit .xcodeproj
```

## 2. Lấy code

```sh
git clone https://github.com/cuongnguyen84/pickle-hub-pro.git
cd pickle-hub-pro
git checkout feat/native-ios-phase-1     # branch chứa app native
```

## 3. Tạo file secrets (bắt buộc)

`Config/Secrets.xcconfig` bị gitignore nên không có sẵn — tạo từ file mẫu:

```sh
cd apple
cp Config/Secrets.example.xcconfig Config/Secrets.xcconfig
```

Mở `Config/Secrets.xcconfig` và điền (lấy từ `.env` của web repo — anon key là
**publishable**, được thiết kế để nhúng client, gated bởi RLS):

```
SUPABASE_PROJECT_REF = ajvlcamxemgbxduhiqrl
SUPABASE_ANON_KEY = <giá trị VITE_SUPABASE_PUBLISHABLE_KEY trong .env>
```

## 4. Generate project + mở Xcode

```sh
xcodegen generate
open ThePickleHub.xcodeproj
```

Lần đầu Xcode tự resolve Swift Packages (`supabase-swift`, `GoogleSignIn-iOS`) —
đợi xong.

## 5. Build & chạy

- **Xcode**: chọn 1 simulator có sẵn (iPhone 15/16/17…) → **Run (⌘R)**.
- **CLI**:

```sh
xcodebuild -scheme ThePickleHub \
  -destination 'platform=iOS Simulator,name=iPhone 16' build
```

## Khác biệt so với máy gốc (đừng copy nguyên lệnh cũ)

- **Bỏ `-derivedDataPath /Volumes/CMBackup/...`** — đó là ổ ngoài riêng của máy gốc.
  Máy mới để mặc định (bỏ flag).
- **Tên simulator**: máy gốc dùng `iPhone 17` (iOS 26.5); máy mới dùng simulator nào
  đang có (min target iOS 17 nên iPhone 15/16 chạy tốt).
- **Mọi thay đổi target/dependency**: sửa `project.yml` rồi `xcodegen generate` lại.
  **KHÔNG** sửa trực tiếp trong Xcode — `.xcodeproj` gitignore, sẽ mất khi regenerate.

## Chạy trên iPhone thật (tùy chọn)

Xcode → target **ThePickleHub** → **Signing & Capabilities** → đăng nhập Apple ID,
chọn **Team** (Personal Team miễn phí cũng được) → cắm iPhone → Run. Bundle id dev là
`net.thepicklehub.app.dev`, tách khỏi app live (`net.thepicklehub.app`) nên cài song
song được.

## Ghi chú

- Fonts (Geist, Geist Mono, Instrument Serif) đã commit trong `ThePickleHub/Resources/Fonts/`
  — không cần cài thêm.
- Simulator runtime (~8GB) nằm ở ổ boot dưới `/Library/Developer/CoreSimulator`; Apple
  không cho di dời. Chỉ build output mới offload được.
- Backend Supabase dùng chung với web (project ref `ajvlcamxemgbxduhiqrl`), không cần
  dựng riêng.
