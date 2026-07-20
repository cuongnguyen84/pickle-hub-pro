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

## 11. A11Y-02 touch targets (PR #418, 2026-07-20)

- [ ] Trên điện thoại thật: tick checkbox/radio trong wizard social (bước phí) + registration modal bằng NGÓN CÁI — phải trúng phát một, kể cả bấm lệch ~10px quanh control.
- [ ] Bảng admin có checkbox dày: hit-area chồng nhau có gây tick nhầm hàng không (trade-off đã chấp nhận — nếu tệ thì báo).
- [ ] ManualGroupAssignment (quicktable): tap chọn VĐV + gỡ khỏi bảng bằng chip — dễ bấm hơn trước.

## 12. ARCH-03 TeamMatch playoff propagation (PR #421, 2026-07-20)

Bug race trận tranh hạng 3 chỉ nổ khi HAI bán kết kết thúc gần như đồng thời — test đơn + mock đã pin logic, nhưng cần một lượt xác nhận trên bracket thật:

- [ ] **Hai bán kết xong đồng thời:** 1 giải TeamMatch có playoff + trận tranh hạng 3 → 2 máy/2 tab, mỗi bên chấm xong 1 bán kết rồi bấm lưu CÙNG LÚC → trận hạng 3 phải có **đủ 2 đội thua** (trước đây 1 đội biến mất), chung kết đủ 2 đội thắng.
- [ ] **Games tự sinh:** ngay khi trận hạng 3 / chung kết đủ 2 đội → danh sách game sinh đúng số + Dreambreaker chỉ xuất hiện khi số game CHẴN và giải có bật.
- [ ] **Chấm lại bán kết:** sửa điểm 1 bán kết đã xong (giữ nguyên đội thắng) → lưu lại → KHÔNG nhân đôi đội trong trận hạng 3, KHÔNG sinh thêm bộ game thứ 2.
- [ ] **Realtime không xuyên giải:** mở giải A trên máy 1, giải B trên máy 2, chấm điểm ở B → màn giải A KHÔNG nhấp nháy/refetch (trước đây mọi thay đổi game toàn site đều làm mọi bracket refetch).
- [ ] Nhánh Tái sinh: giải có repechage → vẫn KHÔNG sinh trận tranh hạng 3.

## 13. Cụm UX-06/07 — increment 1-7 (PR #423, 2026-07-20)

Cụm này bắt đầu từ 2 task UX nhưng thực chất là vá 7 lỗi đang sống trên prod. Phần lớn nằm sau login wall hoặc cần 2 thiết bị, CI không phủ được.

**Luồng người chơi (UX-07)**

- [ ] **Tab mặc định:** mở `/tournaments` bằng tab ẩn danh (chưa từng vào) → phải rơi vào tab **Cộng đồng**, không phải "Xem Pro". Trước đây luôn rơi vào Xem Pro vì nhánh community là code chết.
- [ ] **Đường Zalo thật (quan trọng nhất):** gửi link 1 giải `/tools/quick-tables/<share_id>` cho một **tài khoản mới hoàn toàn** → bấm đăng ký → tường đăng nhập → tạo tài khoản → qua hết onboarding → phải quay lại **đúng giải đó**, không phải trang cá nhân. Đây là bug #4, trước đây mất giải luôn.
- [ ] Người **đã onboard sẵn** theo cùng link → đăng nhập xong về thẳng giải, không ghé onboarding.
- [ ] **Nhãn VI:** ở chế độ tiếng Việt, 4 thể thức hiện `Quick Tables · Chia bảng`, `Doubles Elimination · Loại kép`, `Flex Format · Tùy chỉnh`, `Team Match · Đồng đội`.
- [ ] **"Quick Table của bạn":** mục này giờ chỉ hứa Quick Table (trước hứa "Các giải bạn đã đăng ký" nhưng chỉ hiện 1/4 thể thức). Nếu anh đăng ký Doubles/Flex/TeamMatch thì chúng vẫn KHÔNG hiện — đúng thiết kế đợt này, bản mở rộng là P2.

**Thao tác phá huỷ (UX-06)**

- [ ] **Gỡ thành viên có xác nhận:** trong Team Match, rời đội (`TeamJoinPanel`) và đội trưởng từ chối yêu cầu (`TeamOverviewCard`) → phải hiện hộp xác nhận. Trước đây bấm là mất luôn, không hỏi gì.
- [ ] **Dialog xoá giải có CON SỐ:** `/giai-dau-cua-toi` → xoá 1 giải có người đăng ký → dialog phải nêu rõ sẽ mất bao nhiêu đội/người chơi. Giải rỗng thì nói "chưa có ai đăng ký".
- [ ] **Cảnh báo tiền:** giải Team Match có đội đã bấm "Đã chuyển khoản" hoặc BTC đã xác nhận → dialog phải có dòng đỏ nói hệ thống KHÔNG hoàn tiền và không khôi phục được.
- [ ] **Dialog không treo:** ngắt mạng rồi mở dialog xoá → phải hiện cảnh báo chung, KHÔNG kẹt spinner mãi (bug này bắt được lúc verify).
- [ ] **Native xoá đội:** trên iPhone thật, Team Match → quản lý đội → bấm icon thùng rác → phải hiện confirm. Trước đây **một chạm là mất đội**, nút lại nằm sát badge trạng thái. Kiểm cả hit area có dễ bấm không.

**Guard tầng DB (increment 6-7, đã áp migration prod)**

- [ ] **Chặn xoá đội đã trả tiền:** thử xoá 1 đội có trạng thái "đã chuyển khoản"/"đã xác nhận" → phải bị chặn, hiện lỗi. Thử trên CẢ web lẫn native (trigger nằm ở DB nên phải chặn cả hai).
- [ ] **Chặn xoá cả giải:** thử xoá nguyên giải Team Match có đội đã trả tiền → cũng phải bị chặn (qua cascade). Đây là đường quan trọng nhất vì quota 3 giải trọn đời đẩy anh về phía nút xoá.
- [ ] **Không chặn nhầm:** giải Team Match mà mọi đội đều "chưa nộp" → xoá bình thường, không vướng gì.
- [ ] **Đường thoát:** nếu anh thật sự cần xoá đội đã trả tiền → đổi trạng thái thanh toán về "chưa nộp" trước, rồi xoá được. Nếu kẹt quota thì nâng ở `/admin/users` chứ đừng xoá giải cũ.

## 14. Vá race next_match_slot NULL (PR #424, 2026-07-20)

- [ ] Không có gì để test tay — prod hiện 0 hàng rơi vào nhánh này, và unit test đã pin (gỡ guard là đỏ). Ghi ở đây để anh biết nó tồn tại: nếu sau này bracket generation sinh trận có `next_match_id` mà thiếu `next_match_slot`, hệ thống giờ claim ô trống thay vì đoán và đè lên nhau.
