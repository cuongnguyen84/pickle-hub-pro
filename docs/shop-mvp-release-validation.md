# Shop MVP — release & validation packet

Ngày chốt: 28/08/2026. App Store đang sống: `2.0.3 (8)`. Release candidate:
`2.1.0 (9)` trên nhánh `codex/shop-mvp-release`.

## Kết luận release

**Chưa release.** Phần mã thuộc repo đã đủ để tạo release candidate: catalogue,
tìm kiếm, danh mục, PDP/variant, store, cart, checkout một shop, COD/VietQR,
danh sách/chi tiết đơn, payment claim, deep link/push và funnel analytics native.

Không đưa vào MVP: wishlist hoàn chỉnh, return workflow, dispute và verified
reviews. Ba phần trust này chỉ được xây sau khi có đơn delivered và bằng chứng
validation; UI không được hứa rằng chúng đã tồn tại.

Automated evidence của candidate:

- source preflight: pass, gồm identity `2.1.0 (9)`, production backend,
  Firebase/push, privacy manifest và Shop flags;
- iOS Debug: 160 tests / 32 suites pass;
- iOS Release simulator build: pass;
- web: 3.747 tests pass, lint 0 errors, production build pass;
- chưa chứng minh được bằng máy tự động: signed archive, App Store validation,
  APNs/FCM trên thiết bị thật, Analytics DebugView và một đơn production end-to-end.

## Phạm vi Go / No-Go

Chỉ submit khi tất cả mục P0 sau đều xanh:

1. Signed archive qua `./scripts/release_preflight.sh --shipping --archive ...`
   hoặc IPA qua `--shipping --ipa ...`.
2. Trên iPhone thật: update từ `2.0.3`, đăng nhập lại một lần, kill/relaunch vẫn
   giữ session; Sign in with Apple, permission push và universal link hoạt động.
3. Một buyer không phải admin tạo được **hai** đơn production nhỏ: một COD và
   một bank transfer. Seller nhìn thấy, xác nhận tiền, chuyển trạng thái và buyer
   nhận push mở đúng chi tiết đơn. Sau smoke, huỷ/ghi chú rõ hai đơn test.
4. Firebase DebugView nhận đủ chuỗi tối thiểu:
   `shop_home_viewed → shop_product_viewed → shop_cart_add_succeeded →
   shop_checkout_started → shop_order_create_succeeded`. Không event/property
   nào có tên, số điện thoại, địa chỉ, email, user id, order code, memo hoặc bank.
5. App Store Privacy answers được đối chiếu lại với Firebase Analytics và
   `PrivacyInfo.xcprivacy`: Product Interaction + Device ID dùng cho Analytics,
   linked, không tracking; đồng thời giữ mọi disclosure hiện có của app.
6. Mỗi shop pilot có phí ship khớp lời hứa, `region`, return note cụ thể, kênh
   liên hệ, tài khoản nhận tiền (nếu bật transfer), tồn kho và ít nhất một ảnh
   thật. Không bật `SHOP_PUBLIC_INDEXING`.

No-Go ngay nếu tạo đơn trừ tồn kho sai, tổng tiền client/server lệch, push mở
sai account/order, buyer cũ còn nhận push sau logout, bank info/memo sai, privacy
answers chưa cập nhật, hoặc crash/hang chặn checkout. Rollback phân phối bằng
App Store release controls; rollback bề mặt trong binary kế tiếp bằng
`SHOP_NATIVE_PILOT_ENABLED=NO`. Cờ này là build-time, không phải remote kill switch.

## Việc chỉ Product Owner / account owner làm được

1. Duyệt merge release candidate vào `main` và cho phép push/deploy.
2. Cấp/đăng nhập Apple Developer + App Store Connect; tạo signed archive bằng
   Team `5S49Q7AB7M`, Validate App, upload build 9 và chọn cho version 2.1.0.
3. Trong App Store Connect, cập nhật App Privacy và metadata. Release note gợi ý:
   “Chợ Pickleball đã có mặt: tìm sản phẩm, chọn phiên bản, đặt hàng COD hoặc
   chuyển khoản và theo dõi trạng thái đơn ngay trong ứng dụng.”
4. Chạy checklist thiết bị thật ở trên và gửi lại ảnh/video + order codes test
   qua kênh nội bộ; order code không đưa vào analytics/tài liệu công khai.
5. Chọn 2 seller vận hành được và mời 20 buyer đúng ICP. Ghi riêng user IDs của
   team/test để loại khỏi số validation; không đưa PII vào tài liệu repo.
6. Bật phased release, theo dõi crash/auth/push/order trong 24 giờ đầu; chỉ tăng
   rollout khi không có P0/P1.

## Validation: câu hỏi và bằng chứng

Giả thuyết cần kiểm: **người chơi pickleball đang có nhu cầu mua thật sẽ tin và
hoàn tất đơn trong một marketplace chuyên ngành, dù MVP chưa có review/returns
automation.** Không dùng lượt xem hoặc lời khen làm bằng chứng chính.

Baseline biết đến 19/08/2026 có 2 sản phẩm đang bán và 1 đơn thật. Đây là bằng
chứng rất thấp; cần cohort mới và tách hoàn toàn team/test order.

### V0 — usability trước rollout (tối đa 2 ngày)

- 5 buyer mục tiêu, mỗi người làm task: tìm một sản phẩm phù hợp → chọn variant
  → hiểu phí ship/return promise → thêm giỏ → tới bước xác nhận đơn.
- Pass khi ít nhất 4/5 hoàn thành không cần hướng dẫn và 5/5 nói đúng tổng tiền,
  nơi gửi hàng, điều kiện đổi trả đang được hứa và bước thanh toán tiếp theo.
- Ghi quan sát hành vi trước; chỉ hỏi sau task. Không hỏi “anh/chị có thích không”.

### V1 — demand + transaction (14 ngày)

Cohort: 20 buyer không thuộc team, đã mua hoặc có ý định mua phụ kiện/vợt trong
30 ngày tới; 2 seller; tối thiểu 5 sản phẩm có tồn kho thật.

Ngưỡng quyết định đặt trước khi mời:

| Kết quả | Điều kiện sau 14 ngày | Quyết định |
|---|---|---|
| Validated | ≥8 buyer bắt đầu checkout, ≥5 buyer tạo legitimate order, ≥3 đơn delivered/paid, seller-caused cancel ≤1 | Giữ Shop trong nav, sang V2; ưu tiên trust gap được quan sát nhiều nhất |
| Iterate | 3–4 buyer tạo đơn hoặc có checkout nhưng <3 delivered/paid | Sửa đúng một bottleneck lớn nhất rồi chạy lại cohort mới |
| Not validated | <3 buyer tạo đơn, hoặc <2 delivered/paid dù inventory/ops sẵn sàng | Không mở indexing/paid acquisition; đưa Shop khỏi vị trí ưu tiên và phỏng vấn lại problem |

`Legitimate order` là đơn của người ngoài team có ý định nhận hàng thật; không
tính smoke/test, duplicate retry hoặc đơn seller/admin tự tạo. Database là nguồn
sự thật cho create/delivered/paid; Firebase chỉ dùng để tìm chỗ rơi trong funnel.

### V2 — trust và repeat (30 ngày tiếp theo)

- Phỏng vấn 5 buyer đã mua/abandon và 2 seller, tối thiểu 5 điểm dữ liệu độc lập
  cho mỗi kết luận được gọi là “pattern”.
- Hỏi theo hành vi quá khứ: lần mua gần nhất, điều gì khiến dừng, bằng chứng nào
  họ đã kiểm, chuyện gì xảy ra khi hàng lỗi; tránh câu giả định “nếu có review…”.
- Pass direction khi có ≥2 repeat buyers **hoặc** ≥5 buyer mới legitimate order,
  đồng thời không có dispute nghiêm trọng xử lý ngoài quy trình.
- Chỉ xây verified reviews khi đã có delivered orders để gắn review với giao
  dịch. Chỉ xây returns/dispute workflow khi log vận hành cho thấy tần suất và
  loại case đủ rõ; trước đó dùng policy + contact + manual log trung thực.

## Instrumentation và cách đọc

Firebase funnel theo `app_surface=native_ios`, `shop_schema_version=1`:

`shop_home_viewed → shop_product_viewed → shop_cart_add_succeeded →
shop_cart_viewed → shop_checkout_started → shop_order_create_succeeded`.

Diagnostic events: search/category/store/variant/order-list/payment-claim. Không
dùng `shop_order_create_succeeded` làm số doanh thu; event có thể retry/mất.
Đối chiếu cuối kỳ bằng truy vấn chỉ đọc tại
[`scripts/ops/shop-mvp-validation.sql`](../scripts/ops/shop-mvp-validation.sql).

## Research notes và mức tin cậy

- **Cao — trạng thái code/data nội bộ:** server đã có order state machine,
  inventory authority, COD/bank transfer, seller push và public read contracts.
- **Trung bình — trust gaps:** nghiên cứu nội bộ ngày 19/08 chỉ ra phí ship,
  return promise, region, review và tracking là các điểm cản. Phí ship và product
  specs đã được hỗ trợ trong schema sau đó; dữ liệu seller vẫn phải kiểm thủ công.
- **Cao — privacy release gate:** Apple yêu cầu khai cả dữ liệu do SDK bên thứ ba
  thu thập và giữ App Store answers cập nhật. Firebase nói developer phải tự đối
  chiếu nutrition label theo đúng SDK/feature thực dùng.
- **Thấp — product-market fit:** 1 đơn lịch sử không đủ kết luận. Chỉ nâng mức
  tin cậy sau V0/V1 với cohort mới và bằng chứng hành vi.

Nguồn: [nghiên cứu Shop nội bộ](./proposals/shop-marketplace/2026-08-19-nghien-cuu-tinh-nang-shop.html),
[Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/),
[Firebase App Store data disclosure](https://firebase.google.com/docs/ios/app-store-data-collection).
