# Manual test backlog — việc cần Cuong test tay

Gom tất cả mục cần mắt người / điện thoại thật, để test 1 thể. Mỗi mục có nguồn gốc (PR / phiên). Test xong tick ✅ và ghi ngày; lệch gu/regression thì mở issue hoặc nhắn Claude phiên sau.

_Cập nhật lần cuối: 2026-07-19 (thêm mục 9 — cụm UX-01..05)._

## 1. Money path — flow đăng ký social event (ARCH-02, PR #399/#400, 2026-07-18)

Refactor lớn nhất đợt này chạm đúng luồng tiền. Đã có 21 test parity nhưng cần 1 lượt mắt người trên **điện thoại thật**:

- [ ] **Khách (OTP path), sự kiện CÓ PHÍ**: nhập SĐT → nhận OTP (Zalo trước, thử link "Gửi lại qua SMS") → xác nhận → màn VietQR hiện đúng QR + số tiền + mã tham chiếu → bấm "Đã chuyển khoản" → về màn success có mã tham chiếu + card lưu link `/dang-ky/<token>`.
- [ ] **Hội viên CLB (skip OTP)**: mở modal từ event của CLB mình → xác nhận 1 chạm → success. Có slot thì phải bắt chọn slot.
- [ ] **Slot đầy**: nhóm hết chỗ phải mờ + "Đã đầy", không chọn được; nhóm còn chỗ hiện "Còn X/Y chỗ".
- [ ] **Badge "Chưa thanh toán"** (event yêu cầu trả trước, bỏ qua bước thanh toán): badge giờ dùng token `--tl-gold` (#e9b649) thay amber cũ hsl(38 92% 50%) — hơi trầm hơn. Lệch gu thì đổi lại 1 dòng.
- [ ] **Giao diện EN**: đổi ngôn ngữ EN rồi mở modal đăng ký — các dòng "Verifying your browser…", nút "Reload CAPTCHA", "Bookmark:" phải là tiếng Anh (trước 2026-07-18 hiện tiếng Việt cứng).

## 2. Route VI mirror (ARCH-05, PR #393/#396, 2026-07-17)

- [ ] Trên điện thoại: đang ở trang EN (vd `/rankings`) → chuyển ngôn ngữ / bấm link sang `/vi/bang-xep-hang` và `/vi/feed` **không reload trang** → nội dung phải render tiếng Việt (bug cũ: kẹt EN khi SPA-nav).

## 3. Push broadcast admin (BE-02, PR #322, treo từ 2026-07-16)

- [ ] `/admin/push-notification`: chạy **dry_run** xem count hợp lý → gửi thật 1 bản → notification đến máy thật (iOS + Android nếu có) → xem response có `pruned` count (token chết bị dọn).

## 4. Đợt audit UI/UX 2026-07-09 (treo từ phiên đó — Chrome tool không nối được local dev)

- [ ] Hộp xác nhận branded (thay `window.confirm`) tại: QuickTable xoá bảng · rời CLB · admin xoá match.
- [ ] **MatchScoring mất mạng**: đang chấm điểm → tắt mạng → phải hiện banner đỏ "Lưu thất bại" + nút Thử lại (không mất điểm đã nhập).
- [ ] Soi mắt 2 chỗ đổi sắc độ: cúp vàng trong chat `#FFD700` → `--tl-gold`; ô "thắng" ở `/match` emerald → lime `--tl-green`. Lệch gu → đổi lại 1 dòng.

## 5. Analytics thật trên prod (BASE-02/03, treo từ 2026-07-16)

- [ ] Sau khi có 1 registration + 1 lần organizer publish thật: mở GA4 (segment Vietnam) xem event `player_registration_started/completed` + funnel organizer có bắn không.

## 6. Native (/apple)

- [ ] Bộ test case UI native đã có sẵn trong repo docs của nhánh native (`docs(native): manual UI test cases` — commit `e563f812`, `f8f05a7d` trên nhánh local `feat/mlp-captain-registration`, đã backup `backup/native-2026-07-18`). Chạy theo doc đó khi quay lại native.
- [ ] Cân nhắc port "MatchScoring save-failure banner" sang SwiftUI (web-only hiện tại).


## 7. DS-03 — component chuẩn hoá (PR #403, 2026-07-18)

ui-ux-verifier PASS trên preview nhưng KHÔNG dựng được modal đăng ký (DB hết event tương lai) — các mục sau cần mắt anh trên máy thật:

- [ ] **Tạo 1 social event tương lai** → mở `/social/<slug>` mobile: CTA đăng ký = nút lime to (hơi THẤP hơn bản cũ ~5-8px + bo tròn hơn 1px — lệch gu thì báo); bấm CTA mở modal → **bấm X phải ĐÓNG được modal** (guard chống sự cố kẹt-modal iOS Safari); "Đăng ký hộ bạn bè" = nút viền.
- [ ] **Wizard `/clb/<slug>/social/moi`**: Next/Back/Lưu nháp/Đăng ngay — Back KHÔNG được submit form; nút mono "Quay lại" giữ chữ mono nhỏ như cũ.
- [ ] **Lướt 44px toàn app**: /, /feed, /tournaments, nav bar — mọi nút cao hơn ~4px so trước; chỗ nào chật/vỡ thì chụp lại.

## 8. Native App Store submit — RED gate (chặn tới khi tick đủ)

TLButton/TLSheet/TLDialog/TLSelect/TLBadge/TLIconButton mới đã merge nhưng CHƯA có trong bản App Store nào. Trước khi submit build chứa chúng:

- [ ] Chạy app trên iPhone thật (máy nhỏ nếu có): flow đăng ký + sheet thanh toán với **cỡ chữ hệ thống AX3** — mọi nút Xác nhận/mã chuyển khoản phải cuộn tới được.
- [ ] VoiceOver lướt 1 sheet: icon button phải đọc đúng nhãn tiếng Việt.
- [ ] Bàn phím mở che sheet: field + nút vẫn thao tác được.
- [ ] `TLComponentsRenderTests` xanh trong CI (tự động — đã có).

## 9. Cụm UX-01..05 organizer wizard (PR #406-#409, 2026-07-19)

Autosave/fee-mode/recovery đều sau login wall — cả 2 lượt ui-ux-verifier chỉ verify tĩnh được. Cần mắt anh + máy thật:

- [ ] **Autosave round-trip social (ca ngoài sân):** `/clb/<slug>/social/moi` → điền dở bước 2 → khoá màn hình 5 phút → mở lại → banner "Đã khôi phục bản nháp trên thiết bị này" + đúng bước/đúng data; 3 trường ngân hàng phải TRỐNG (bank không vào localStorage — cố ý).
- [ ] **Card "Bản nháp" ClubManage:** có nháp → trang quản lý CLB hiện card đúng tên + giờ; nút Tiếp tục/Xoá chạy; đổi CLB qua menu → card KHÔNG hiện nháp CLB khác.
- [ ] **Autosave 4 flow tournament:** teammatch/doubles/flex/quicktable — điền → kill tab → mở lại → khôi phục đúng (quicktable scope theo shareId).
- [ ] **Bank prefill guard (#406):** manager sửa event cũ có phí → phải tick xác nhận tên chủ STK mới lưu được.
- [ ] **Fee-mode clear-state (#409):** tạo event CÓ phí → điền bank → đổi radio "Miễn phí" → publish → check DB `event_payment_config` KHÔNG còn STK cũ.
- [ ] **Panel recovery:** đứng step 2 bấm dòng lỗi thuộc step 1 → lật step + focus đúng ô (mobile thật).
- [ ] **Weekly-repeat partial retry:** ép fail giữa batch (trùng slug) → Publish lại → chỉ tạo tuần thiếu, không double.
- [ ] **TeamMatch Dreambreaker (5→4 bước):** game chẵn bật toggle / game lẻ disable → `has_dreambreaker` xuống DB đúng như bản cũ.
- [ ] **3 template:** apply → không field bank nào prefill; chip biến mất sau khi form dirty.
- [ ] **Native (#408, cùng RED-gate mục 8):** 5 màn tạo trên iPhone thật — autosave khôi phục sau khi kill app; VoiceOver đọc banner/status tiếng Việt.
- [ ] **Fail-loud quota:** Safari private mode → dòng status đỏ "Chưa thể lưu thay đổi", không hiện "Đã lưu".

## 10. UX-08 navigation (PR #414, 2026-07-19)

- [ ] Mở link `/social/<slug>` từ tab MỚI (deep-link, không history) → nút back phải HIỆN và về `/social` (thử thêm /clb/x → /clubs, bài blog → /blog, bản /vi giữ /vi).
- [ ] /rankings: đổi scope sang Thế giới + format → sang trang khác → back → scope/format GIỮ NGUYÊN (và URL share được).
- [ ] /feed: cuộn sâu → mở 1 post → back → thứ tự feed KHÔNG xáo lại, vị trí cuộn giữ; đóng tab mở lại → feed xáo mới (đúng thiết kế).
