# Native iOS — Release & Activation Runbook

Nguồn sự thật cho việc thay app Capacitor bằng app SwiftUI native. Không upload,
không bật OTP và không đổi production setting nếu chưa có phê duyệt release rõ ràng.

## Trạng thái hiện tại

| Configuration | Bundle ID | Version | Environment | Native registration | FCM push |
|---|---|---|---|---|---|
| Debug | `net.thepicklehub.app` | `2.1.0 (9)` | development | ON | OFF |
| Release | `net.thepicklehub.app` | `2.1.0 (9)` | production | ON | ON |

`2.1.0 (9)` là Shop MVP candidate nối tiếp bản đang sống `2.0.3 (8)`. Nếu App Store Connect
đã có build/version mới hơn bảng này, tăng cả `MARKETING_VERSION` và
`CURRENT_PROJECT_VERSION` trong `Config/Debug.xcconfig` + `Config/Release.xcconfig`
trước khi archive.

Shop native chỉ hiện khi **đồng thời** `SHOP_NATIVE_BUILT_IN=YES` và
`SHOP_NATIVE_PILOT_ENABLED=YES`. Release bật cả hai; Debug compile Shop nhưng
để pilot OFF mặc định nhằm fail closed. Khi Shop bật, Social và Công cụ vẫn có
trong tab **Thêm**, không bị mất khỏi điều hướng.

Native registration chỉ mở khi **đồng thời** đạt bốn gate:

1. `NATIVE_EVENT_REGISTRATION_ENABLED = YES` trong build.
2. `TURNSTILE_SITE_KEY` hợp lệ.
3. Remote setting `system_settings.native_event_registration_enabled = true`.
4. Event có `allow_guests != false`.

Thiếu một gate, lỗi mạng hoặc setting sai kiểu đều mở Safari registration. Form
native cũng luôn có nút `Đăng ký trên web`.

Remote push là parity bắt buộc vì app Capacitor hiện tại dùng Firebase Messaging,
không lưu token APNs thô. Build shipping chỉ qua khi:

1. `REMOTE_PUSH_ENABLED = YES` trong Release.
2. Đủ bốn Firebase client identifiers public trong `Secrets.xcconfig`.
3. Bundle/environment là chính xác `net.thepicklehub.app`/production.
4. Signed artifact có entitlement `aps-environment=production`.

Lần chạy native đầu tiên xoay FCM token cũ trước khi lưu token mới. Khi logout
hoặc đổi tài khoản, app xoá binding khi còn JWT rồi xoay token; nhờ đó thiết bị
không tiếp tục nhận thông báo của tài khoản trước nếu DB còn stale row.

### Sign in with Apple

Code native dùng `AuthenticationServices`, nonce ngẫu nhiên + SHA-256 và đổi
Apple ID token trực tiếp lấy Supabase session. Trước khi ký build thật:

1. Trong Apple Developer → Identifiers → `net.thepicklehub.app`, bật
   **Sign in with Apple** và chọn primary/group phù hợp với Services ID của web.
2. Nếu cần chạy Debug trên thiết bị, bật capability cho
   `net.thepicklehub.app.dev`; không dùng profile production cho bundle Debug.
3. Trong Supabase Dashboard → Authentication → Providers → Apple, giữ
   **Services ID của web ở vị trí đầu tiên**, sau đó thêm
   `net.thepicklehub.app` (và `net.thepicklehub.app.dev` nếu test Debug) vào
   Client IDs. Thứ tự này giữ web OAuth hoạt động đồng thời với native ID token.
4. Tạo lại provisioning profile sau khi capability thay đổi, hoặc dùng
   automatic signing để Xcode cập nhật profile.

Apple chỉ trả họ tên ở lần cấp quyền đầu tiên. App lưu tên đó vào auth metadata
và profile khi profile chưa có tên tùy chỉnh; đăng nhập các lần sau không ghi đè
tên người dùng đã sửa.

### Hành vi khi update từ Capacitor

Capacitor/supabase-js lưu session trong WebKit localStorage; supabase-swift lưu
session native trong Keychain. Bản `2.0.1` hiện **yêu cầu người dùng đăng nhập lại
một lần** sau update. Product đã chấp thuận hành vi này ngày 2026-07-22 và
`CAPACITOR_AUTH_RESET_APPROVED = YES`; không cần session bridge cho release này.

## 1. Source preflight

```sh
cd apple
./scripts/release_preflight.sh
```

Gate kiểm tra production bundle/version, environment, registration/push flags,
APNs entitlement template, App Store icon, privacy manifest, associated domains,
Sign in with Apple entitlement, package lock, Swift 6 language mode,
iPhone+iPad compatibility và cấm server credential trong client. Script tự generate
`.xcodeproj` và seed `Config/Package.resolved` vào workspace được generate.

## 2. Chuẩn bị device smoke

1. Tạo Cloudflare Turnstile widget cho `thepicklehub.net` và
   `www.thepicklehub.net`; chỉ dùng **site key public**, tuyệt đối không đưa secret
   vào app.
2. Điền site key vào `Config/Secrets.xcconfig` trên máy test.
3. Build Debug trên iPhone thật với override có chủ đích:

```sh
xcodebuild build \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -configuration Debug \
  -destination 'platform=iOS,id=<DEVICE_UDID>' \
  NATIVE_EVENT_REGISTRATION_ENABLED=YES
```

4. Remote setting vẫn cần `true` để test native. Thao tác sau là thay đổi trạng
   thái production và chỉ được chạy sau phê duyệt:

```sql
insert into public.system_settings (key, value, updated_at)
values ('native_event_registration_enabled', 'true'::jsonb, now())
on conflict (key) do update
set value = excluded.value, updated_at = excluded.updated_at;
```

Tắt ngay/rollback không cần binary mới:

```sql
update public.system_settings
set value = 'false'::jsonb, updated_at = now()
where key = 'native_event_registration_enabled';
```

## 3. Device-smoke bắt buộc

- Không đủ gate, remote=false và lỗi mạng: nút Đăng ký mở Safari.
- CAPTCHA render trên thiết bị thật; token expired/error tải lại được và token đã
  dùng không được reuse.
- OTP qua Zalo và fallback SMS; phone sai, OTP sai, OTP hết hạn và quá số lần thử
  hiển thị đúng stable error code.
- Event không slot, có slot, slot đầy và tranh chỗ cuối; server vẫn là authority.
- Event miễn phí đi thẳng tới quản lý đăng ký.
- Event có phí + payment enabled hiện VietQR/reference; payment disabled/lỗi vẫn
  giữ đăng ký và cho thanh toán tại sân.
- Kill app/mở lại: magic token khôi phục từ Keychain; huỷ/kích hoạt lại đúng.
- Nút `Đăng ký trên web` hoạt động ở mọi bước.
- Universal link `https://thepicklehub.net/...` và custom scheme
  `thepicklehub://...` mở đúng app production.
- Nút “Tiếp tục với Apple” mở sheet hệ thống; chọn chia sẻ email và ẩn email đều
  tạo/khôi phục đúng Supabase session. Hủy sheet không hiện lỗi đỏ.
- Kill/mở lại sau Apple login vẫn giữ session. Tên Apple lần đầu được lưu, nhưng
  tên đã tự sửa trong profile không bị ghi đè khi đăng nhập lại.

Sau smoke, đặt remote setting về `false` cho tới khi quyết định rollout.

### Upgrade + push smoke bắt buộc

Chạy trên thiết bị có bản Capacitor production/TestFlight tương đương `1.0.1`,
sau đó update đè bằng signed native build cùng bundle `net.thepicklehub.app`:

- App mở bình thường, dữ liệu server không mất; màn auth yêu cầu đăng nhập lại
  đúng một lần và session native còn sau kill/relaunch.
- Firebase Console config dùng đúng iOS app production. Điền các giá trị public
  `GOOGLE_APP_ID`, `GCM_SENDER_ID`, `API_KEY`, `PROJECT_ID` vào bốn biến
  `FIREBASE_*` trong `Config/Secrets.xcconfig`.
- Apple Push capability/provisioning hợp lệ; APNs auth key/certificate của app
  production vẫn được Firebase Cloud Messaging chấp nhận.
- Cho phép và từ chối notification đều không crash. Sau khi cho phép, hàng
  `push_tokens` của user có `platform=ios` và FCM token mới.
- Gửi targeted FCM từ luồng production: foreground có banner, background có
  notification, tap `event_slug`/`link_url`/livestream mở đúng màn native.
- Logout rồi đăng nhập tài khoản khác trên cùng thiết bị: tài khoản cũ không còn
  nhận push; tài khoản mới nhận được. Kill/relaunch không tạo token trùng.

Không thể xác nhận các mục APNs/FCM bằng simulator hoặc unsigned archive.

## 4. Bật trong Release

Vì Turnstile site key là public và được nhúng trong binary, activation PR cần ghi
rõ trong `Config/Release.xcconfig`:

```xcconfig
TURNSTILE_SITE_KEY = <public-site-key>
NATIVE_EVENT_REGISTRATION_ENABLED = YES
```

CI sẽ fail nếu flag bật nhưng site key thiếu/sai. Upload TestFlight khi remote
setting còn `false`; chỉ bật remote cho internal smoke, theo dõi OTP delivery,
function errors và payment claims rồi mới rollout.

Push được bật cho direct App Store build để giữ parity với bản Capacitor:

```xcconfig
REMOTE_PUSH_ENABLED = YES
CAPACITOR_AUTH_RESET_APPROVED = YES
```

Bốn `FIREBASE_*` giữ ở file ignored `Secrets.xcconfig`/CI secret, không commit.
Đây chỉ là client config; service-account JSON/server key tuyệt đối không vào app.

## 5. Archive và distribution

Unsigned artifact check, không cần certificate:

```sh
xcodebuild archive \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/ThePickleHub.xcarchive \
  -onlyUsePackageVersionsFromResolvedFile \
  CODE_SIGNING_ALLOWED=NO

./scripts/release_preflight.sh --archive /tmp/ThePickleHub.xcarchive
```

Shipping artifact cần:

- Apple Distribution identity thuộc Team `5S49Q7AB7M`.
- App Store provisioning/automatic signing cho `net.thepicklehub.app`, gồm Push
  Notifications, Sign in with Apple, production APNs và
  `com.apple.developer.applesignin=["Default"]`.
- Quyền App Store Connect phù hợp hoặc API key/JWT.
- App Store privacy answers/policy đã đối chiếu với `PrivacyInfo.xcprivacy`.
- Signed archive đã qua Organizer Validate App.
- Push production/device-upgrade smoke đã pass; forced re-login đã được product
  chấp thuận trong config Release.

Sau khi tạo signed archive:

```sh
./scripts/release_preflight.sh \
  --shipping \
  --archive /path/to/ThePickleHub.xcarchive
```

Gate `--shipping` yêu cầu production Supabase + Firebase config, remote push ON,
auth-reset approval, Apple Distribution identity, Distribution signature,
production APNs entitlement và đúng artifact metadata. Upload/submit vẫn là bước
riêng, không nằm trong script này.

## 6. Rollout và rollback

Trạng thái ngày 28/08/2026: App Store đang sống ở `2.0.3 (8)`; Shop MVP
`2.1.0 (9)` mới là release candidate cục bộ, **chưa archive ký, chưa upload và
chưa submit review**. Rollout Shop dùng phased release của App Store và cohort
validation được mời có chủ đích; không bật `SHOP_PUBLIC_INDEXING` trong giai đoạn
validation.

1. Upload signed build vào App Store Connect và chọn trực tiếp cho App Review.
2. Giữ `native_event_registration_enabled=false`; Safari tiếp tục xử lý đăng ký.
3. Sau khi Apple duyệt, phát hành theo release option đã chọn trong App Store Connect.
4. Theo dõi auth, crash và push ngay sau rollout; FCM vẫn phải hoạt động từ binary đầu.
5. Native registration chỉ bật ở release sau khi có Turnstile/device validation riêng.
