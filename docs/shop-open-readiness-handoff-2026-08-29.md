# Shop open-readiness handoff — 2026-08-29

## Mục tiêu và quyết định đã chốt

- Chuẩn bị Shop để mở công khai cho người mua.
- Giai đoạn mở đầu chỉ dùng tài khoản thanh toán SePay của nền tảng.
- Người bán vẫn đăng ký theo lời mời; chưa mở đăng ký đại trà.
- Người mua thanh toán bằng QR ngay trong ứng dụng, không điều hướng sang trang SePay.
- Nếu đã chọn chuyển khoản ở checkout thì màn hình đơn hiển thị ngay yêu cầu thanh toán, không bắt bấm thêm một nút “Thanh toán qua SePay”.
- Không xây luồng hoàn trả/khiếu nại nội bộ. Sau khi đơn đã giao, khách liên hệ Zalo đã được duyệt của shop.

## Trạng thái SePay production

- Merchant ID và Secret Key production đã được cấu hình.
- `SEPAY_IPN_SECRET` cùng các secret cần thiết đã được cấu hình.
- Webhook SePay đã gửi test thành công.
- Một giao dịch thực tế đã tự động được đối soát và xác nhận nhận tiền.
- Copy phía người bán phải nói đúng rằng giao dịch gateway dùng QR của nền tảng và được hệ thống đối soát; không nói tiền đi thẳng vào tài khoản người bán.

## Code đã hoàn thành

- Nhánh sạch: `codex/shop-open-readiness`.
- Worktree: `/Users/cm10/pickle-hub-pro/.codex/worktrees/shop-open-readiness`.
- Base: `origin/main` tại `7785100a`.
- Commit sẵn sàng: `de82cd18 fix(shop): prepare public buyer launch`.
- Nhánh đang đi trước `origin/main` một commit, chưa merge, chưa push/deploy.
- Worktree gốc `/Users/cm10/pickle-hub-pro` đang rất dirty trên `feat/shop-production-phase-1`; không trộn hoặc ghi đè các thay đổi ở đó.

Commit `de82cd18` đã:

- Bật `SHOP_PUBLIC_OPEN = true` cho luồng buyer.
- Tách closed gate để khi Shop mở không còn gọi truy vấn quyền pilot/admin thừa trên mỗi lần điều hướng.
- Xóa copy “MVP”, “pilot”, “thử nghiệm”, “dữ liệu mẫu” khỏi giao diện Shop web và iOS.
- Giữ seller onboarding theo lời mời và đổi toàn bộ copy sang ngôn ngữ production.
- Bổ sung/giữ trang “Đơn của tôi”, xác nhận hai bước cho nút “Tôi đã nhận hàng”, RPC `deliver`, và CTA liên hệ Zalo sau giao hàng.
- Không thêm luồng hoàn trả hay khiếu nại nội bộ; bỏ mục admin “Khiếu nại · sắp có”.
- Sửa copy Seller Order Detail cho thanh toán SePay qua tài khoản nền tảng.
- Cập nhật Privacy VI/EN để bao phủ dữ liệu đơn hàng, giao nhận, thanh toán, đối soát và hoàn tiền; ngày hiệu lực `28/08/2026`.
- Thêm test giữ buyer gate mở và các test hồi quy copy/thanh toán/privacy.

## Kết quả kiểm tra

- 51 file test liên quan Shop: 939 test pass.
- Toàn bộ web: 247 file pass, 5 file skip; 3.797 test pass, 69 skip.
- ESLint quiet pass.
- Production build và PWA build pass sau khi chạy `npm ci` trong clean worktree.
- `git diff --check` pass.
- Bundle không còn các chuỗi cũ: `Shop đang chạy thử nghiệm kín`, `Sàn đang ở giai đoạn thử nghiệm`, `SHOP / PILOT`.
- Test trọng điểm sau cùng: 5 file, 57 test pass, gồm buyer gate, catalogue copy, nhận hàng, Zalo, Seller SePay copy và Privacy.

## Production hiện tại và blocker trước khi open

1. Production hiện vẫn trả `x-robots-tag: noindex, nofollow, noarchive`. Chỉ bật `SHOP_PUBLIC_INDEXING=1` cùng lượt deploy mở buyer; không bật indexing trước khi code gate mở được deploy.
2. Shop ThePickleHub đang có ghi chú `Giao hàng miễn phí toàn quốc` nhưng `shipping_fee_vnd = 30000`; giao dịch thực tế cũng tính 30.000đ. Cần sửa trong `/seller/settings` thành `Giao hàng toàn quốc` hoặc đổi phí về 0 nếu thực sự miễn phí.
3. Tất cả biến thể public đang để `stock_on_hand = null`/không theo dõi tồn. Trước khi có traffic công khai cần nhập tồn thật để tránh bán quá số lượng, hoặc quyết định rõ mô hình không theo dõi tồn.
4. Chất lượng dữ liệu cần sửa:
   - Kaiwin Diamond chỉ có mô tả `Hàng mới về` và thiếu thông số.
   - 6.0 Double Black Diamond thiếu thông số.
   - Zocker Aspire có lỗi chữ `bền bิด`.
   - Shop ThePickleHub nên bổ sung giới thiệu và khu vực.
5. Seller Rules production vẫn là `v1`, scope `closed-pilot`, tiêu đề `Quy chế người bán v1 — Closed Pilot`, có nhiều câu nói chưa có hệ thống đơn hàng. Không dùng bản này để mở seller đại trà.
6. Terms hiện chưa có điều khoản Shop dành cho người mua: vai trò nền tảng, tạo/xác nhận đơn, thanh toán qua tài khoản nền tảng, giao hàng, huỷ, hoàn tiền và xử lý qua Zalo. Cần chủ sản phẩm/pháp lý duyệt nội dung trước khi public launch.
7. Nếu sau này mở seller bên thứ ba, phải quyết định rõ quyền sở hữu dòng tiền, payout và bên chịu trách nhiệm hoàn tiền. Hiện mô hình chỉ an toàn khi shop nền tảng là người bán.

## Trình tự tiếp tục được khuyến nghị

1. Sửa phí/ghi chú giao hàng, tồn kho và nội dung sản phẩm trên production.
2. Duyệt và ban hành Terms Shop cho buyer. Giữ Seller Rules/invite gate hiện tại nếu chỉ mở buyer với shop nền tảng.
3. Review commit `de82cd18`, rồi merge vào `main` và deploy production.
4. Cùng lượt deploy, đặt Cloudflare Pages `SHOP_PUBLIC_INDEXING=1` và redeploy để bỏ noindex.
5. Chạy một smoke test sau deploy: xem sản phẩm → chọn biến thể → giỏ hàng → checkout → QR SePay trong app → webhook tự xác nhận → seller xác nhận/đóng gói/giao → buyer bấm “Tôi đã nhận hàng” → CTA Zalo sau giao.

