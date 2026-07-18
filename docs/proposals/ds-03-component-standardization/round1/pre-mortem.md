# pre-mortem — DS-03 (2026-07-18, nguyên văn)

Đã đọc đủ code. Hai cơ chế hấp dẫn nhất đã bị chính code bác bỏ, tôi không dựng chuyện quanh chúng — ghi rõ ở cuối. Ba postmortem dưới đây mỗi cái một cơ chế khác nhau, mắt xích nào cũng trỏ file thật.

Bối cảnh gate hiện có, xác nhận bằng đọc file: `quality.yml` chỉ chạy lint + `tsc -b` + Vitest + build + bundle-size (`quality.yml:36-98`); TheLine gate chỉ soi hex + thiếu `title` trên changed files (`check-theline.mjs:74-131`, `quality.yml:42-55`); Playwright **chỉ cài chromium** và projects toàn Desktop Chrome + Pixel 7, **không có WebKit** (`playwright.yml:38`, `playwright.config.ts:44-88`); apple-tests chạy `xcodebuild test` một simulator, toàn logic scoring/scheduling (`apple-tests.yml:58-61`); `theline-audit.yml` full-tree nhưng report-only (`|| true`, dòng 27). Đây là ba khe hở mà cả ba sự cố chui qua.

---

### Sự cố 1 — "Đóng không được cái modal đăng ký": user iPhone kẹt trong RegistrationModal, phải kill app giữa lúc đăng ký giải
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 2-5 ngày (một câu chửi trên Facebook page)

**Timeline**
- T+0 (deploy): DS-03 chuẩn hoá `dialog.tsx`. Hai thay đổi "hợp lý": (a) `DialogContent` nhận default mới `onInteractOutside`/`onPointerDownOutside` → `preventDefault()` để "không mất form dở khi lỡ tay chạm ra ngoài" (mẫu rất phổ biến trong design system); (b) nút X đóng — vốn là chính `DialogPrimitive.Close` (`dialog.tsx:45`) — được thay bằng component mới `<IconButton>` (component thứ 8 DS-03 phải tạo, hôm nay chưa tồn tại) cho đồng bộ.
- T+0: Trên desktop mọi thứ ổn — Radix vẫn đóng bằng **Escape** (không bị (a) chặn). Panel duyệt, dev test, soak đều bấm Escape/click theo thói quen bàn phím → không ai thấy gì.
- T+3 tuần: user thật mở `/su-kien/:slug`, bấm đăng ký, nhập OTP trên iPhone Safari. Muốn đóng lại sửa tên → chạm ra ngoài: **không đóng** (đã preventDefault). Bấm X: **không đóng** (xem cơ chế). iOS Safari **không có phím Escape**. Modal `bg-black/80` phủ kín (`dialog.tsx:22`). User kẹt cứng → force-kill app, bỏ đăng ký.

**Cơ chế**
`dialog.tsx:45` nút đóng cũ **chính là** `<DialogPrimitive.Close>` — bản thân nó mang hành vi đóng của Radix. → DS-03 thay bằng `<IconButton aria-label="Close"><X/></IconButton>`. `IconButton` chỉ là một `<button>` bọc `Button` (`button.tsx:39-42`), **không phải** `DialogClose` và cũng không được bọc trong `<DialogClose asChild>`. → Click X không dispatch lệnh đóng nào — X thành nút trang trí. → Cộng với `onPointerDownOutside` bị preventDefault (đóng-ngoài tắt) + iOS không có Escape → **không còn đường nào đóng modal**. Surface trúng đòn: `RegistrationModal.tsx:715` (`<Dialog open onOpenChange>`), `:720` (`DialogContent max-h-[90vh] overflow-y-auto`) — journey north-star số 1.

**Vì sao mọi gate vẫn xanh**
`tsc -b` xanh: `<IconButton>` là JSX hợp lệ, không có kiểu nào ép nó phải là `DialogClose`. Lint/Vitest xanh: zero test khẳng định "X trong Dialog đóng được Dialog" (recon: không có test render-assertion nào). `check-theline.mjs` chỉ soi hex + title, không đụng hành vi. Playwright: **chỉ có chromium**, project mobile duy nhất là Pixel 7 (`playwright.config.ts:52-53`) — Pixel 7 Chromium **có** Escape trong automation và **không** mô phỏng "Safari không Escape + soft-keyboard". Soak 30 phút trên desktop: Escape đóng ngon. Cả pipeline không có một lần chạm WebKit thật.

**Ai báo, sau bao lâu**
User, 2-5 ngày, qua Facebook ("app treo không thoát được"). Cuong không tự thấy vì Cuong test trên desktop/simulator có bàn phím.

**Vì sao khó sửa**
`git revert` được — nhưng trong 2-5 ngày đó, mọi user iOS trên journey đăng ký (chính là traffic quý nhất) bị chặn ngay bước OTP. Không phục hồi được số đăng ký đã mất — họ không quay lại. Revert dialog.tsx cũng kéo theo revert luôn `IconButton` mà các màn khác đã bắt đầu dùng → phải gỡ có chọn lọc.

**Dấu hiệu sớm lẽ ra phải có**
Rơi thẳng conversion đăng ký từ iOS Safari. Nhưng Ahrefs mới có data từ 2026-07-04, không ai theo dõi conversion tách theo browser ở mức từng bước OTP → tín hiệu chìm trong nhiễu.

**Biện pháp chặn (1 việc):** Thêm **1 project WebKit** vào `playwright.config.ts` (`devices["iPhone 14"]`, engine webkit) + `npx playwright install webkit` trong `playwright.yml`, và 1 test: mở RegistrationModal → click nút `aria-label="Close"` → assert `dialog` biến mất. Test này đỏ ngay khi X thành trang trí.

---

### Sự cố 2 — "Gate đếm sai làm mọi PR đỏ, dev tắt gate — rồi drift thật lọt tự do 6 tuần"
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** phần flapping: tức thì; phần hậu quả (gate đã chết): 4-8 tuần, âm thầm

**Timeline**
- T+0: DoD (b) của DS-03 (`00-intake.md:9`) yêu cầu "CI ratchet gate cho phần còn lại của app". Gate mới đếm số `<button>`/`<input>`/`<select>` thô so với baseline chốt trong 1 file JSON, fail nếu tăng.
- T+0: Baseline được chốt **trên nhánh DS-03** — nơi refactor của DS-03 đã hạ số đếm xuống thấp nhất.
- T+2 ngày: một PR **không liên quan** (ví dụ đúng loại PR `fix/tiny-chart-codex-findings` đang mở, hoặc một bài blog mới) đỏ gate với thông báo "raw element count 214 > baseline 209", dù diff **không thêm nút nào** — số tăng vì gate đếm cả string trong test/code, cả file `.legacy.tsx` mới tạo cho rollback window, hoặc vì rename-detection của `git` tính nhầm.
- T+2 ngày: Cuong đang giữa một fix khác, red gate không giải thích được. Theo đúng phản xạ đã ghi trong memory ("fix→review→merge tự chạy không hỏi lại"), cách unblock nhanh nhất là hạ gate xuống advisory `|| true` — **y hệt** `theline-audit.yml:27` đã làm.
- T+6 tuần: một dev domain thêm `<button onClick>` thô ngay trên màn `SocialEventDetail.tsx` (journey screen) thay vì `<Button>`. Gate đã inert → lọt. DS-03 coi như thủng, nhưng dashboard vẫn "xanh".

**Cơ chế**
`theline-audit.yml:22-27` đã cho thấy đúng cái bẫy: full-tree scan (`find src`) + report-only. Một ratchet **enforcing** nhưng đếm full-tree kế thừa cùng bản chất → mọi PR đụng bất kỳ file nào có thể làm tổng số nhích. → Ngược hẳn kỷ luật changed-files của `check-theline.mjs:42-65` và `quality.yml:53` (chỉ diff `BASE_SHA HEAD`). → Vì baseline chốt ở đáy nhánh DS-03, headroom = 0, PR đầu tiên chạm tới là đỏ. → Red-không-giải-thích-được + reflex-unblock-nhanh = gate bị hạ cấp thành advisory. → Từ đó gate không còn bắt gì.

**Vì sao mọi gate vẫn xanh**
Đây là sự cố **của chính gate**. Panel duyệt proposal thấy "có ratchet gate" = tick được DoD (b), không ai chạy thử nó trên một PR ngẫu nhiên không liên quan để xem nó có flap không. CI của chính PR DS-03 xanh vì baseline vừa chốt = số hiện tại. Cái đỏ chỉ nổ ở **PR kế tiếp của người khác** — ngoài tầm soak của DS-03.

**Ai báo, sau bao lâu**
Phần flapping: chính Cuong, tức thì, và bực. Phần chết-gate: **không ai** — cho tới khi một lần audit thủ công hoặc một bug UI trên journey screen lộ ra rằng nút thô đã lọt hàng tuần.

**Vì sao khó sửa**
Không phải chuyện `git revert`. Niềm tin vào gate mất rồi thì không lấy lại bằng commit. Sau khi gate bị tắt, mọi drift tích trong 6 tuần phải dọn thủ công. Đây đúng loại "âm thầm ăn mòn" đề bài coi trọng: một gate giả-xanh nguy hiểm hơn không có gate, vì nó cho cảm giác an toàn sai.

**Dấu hiệu sớm lẽ ra phải có**
Lẽ ra commit tắt gate (`|| true`) phải là một cảnh báo lớn. Nhưng vì `theline-audit.yml` **đã** report-only sẵn, thêm một gate advisory nữa trông "bình thường" — normalization of deviance.

**Biện pháp chặn (1 việc):** Ratchet gate **chỉ đếm trên changed files** (copy nguyên khối `targetFiles()` diff `BASE_SHA..HEAD` của `check-theline.mjs:42-65`), và chạy **report-only 2 tuần** trước khi enforce. Số của bạn không bao giờ tăng vì PR người khác chạm file khác → hết flap → không ai muốn tắt.

---

### Sự cố 3 — "Đăng ký xong mà giải báo chưa có tên": sheet native cắt mất nửa dưới ở cỡ chữ lớn, user không thấy nút xác nhận/mã chuyển khoản
**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** 3-6 tuần (support ticket "tôi đăng ký rồi mà")

**Timeline**
- T+0: DS-03 thêm `TLSheet`/`TLDialog` native (chưa tồn tại — recon xác nhận `TLComponents.swift` mới có `TLCard`/`TLPrimaryButton`/`TLTextField`). `TLSheet` theo đúng "house style" hiện có: padding cứng, không xử lý Dynamic Type.
- T+0: Test trên iPhone 17 Pro simulator, cỡ chữ mặc định (đúng loop trong memory `native-build-run-loop`). Sheet đăng ký/thanh toán vừa khít, đẹp.
- T+3 tuần: một chú lớn tuổi (rất phổ biến trong tệp user VN) để **cỡ chữ hệ thống AX3+**. Mở sheet đăng ký giải: header + 2 field đầu hiện ra bình thường, **không có thanh scroll**, nhìn như đã hết. Nửa dưới — nút `TLPrimaryButton` "Xác nhận" + mã chuyển khoản — bị detent `.medium` cắt mất. Chú tưởng xong, đóng lại. Thực tế chưa xác nhận / chưa thấy mã để chuyển tiền.

**Cơ chế**
`TLComponents.swift:34` `TLPrimaryButton` dùng `.padding(.vertical, 14)` cứng, `Text(title).fontWeight(.semibold)` **không** `.lineLimit`/`.minimumScaleFactor` → ở Dynamic Type lớn label wrap 2-3 dòng, nút cao gấp đôi. `TLTextField:63` cũng `.padding(14)` cứng. → `TLSheet` mới dựng detent `.medium` (một phần cố định chiều cao màn) **không bọc `ScrollView`** — theo đúng pattern các view hiện có đều không cuộn. → Tổng chiều cao nội dung ở AX3 vượt `.medium`, phần dưới bị clip, **không có affordance cuộn** → user không biết còn nội dung. Khác sự cố 1 ở chỗ: sự cố 1 user *biết* mình kẹt (chửi ngay); ở đây sheet **trông như đã hoàn tất** → im lặng tuyệt đối.

**Vì sao mọi gate vẫn xanh**
`apple-tests.yml:58-61` chạy `xcodebuild test` một scheme, một simulator, toàn bộ 11 file test là logic scoring/scheduling — **zero** snapshot/UI test cho `DesignSystem/Components/` (recon xác nhận). Không có test nào chạy ở `.dynamicTypeSize(.accessibility3)` hay trên iPad. Panel + dev soak ở cỡ chữ mặc định. Web CI không đụng SwiftUI. Không một gate nào từng render sheet này ở cỡ chữ lớn.

**Ai báo, sau bao lâu**
Support ticket / tin nhắn "tôi đăng ký rồi mà danh sách không có tên", 3-6 tuần, và chỉ từ nhóm nhỏ để cỡ chữ lớn nên dễ bị coi là lỗi lẻ, khó tái hiện (Cuong mở lại ở cỡ mặc định → thấy bình thường → nghi user thao tác sai).

**Vì sao khó sửa**
Revert được về mặt code, nhưng dữ liệu đã hỏng theo kiểu vô hình: những đăng ký "user tưởng xong" không tồn tại trong DB — không có gì để phục hồi, chỉ có niềm tin bị mẻ. Người bị lỗi lại đúng nhóm ít khiếu nại nhất.

**Dấu hiệu sớm lẽ ra phải có**
Không có. Không log, không exception (SwiftUI clip là hành vi layout hợp lệ, không throw). Không analytics "sheet bị cắt". Đúng loại hỏng không có ô nào để tick.

**Biện pháp chặn (1 việc):** `TLSheet` **luôn bọc nội dung trong `ScrollView`** (native, 1 dòng) — clip biến mất, luôn cuộn tới được nút. Kèm 1 SwiftUI preview/snapshot test render sheet ở `.dynamicTypeSize(.accessibility3)` trên iPad để chốt bằng máy.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 2 | Ratchet gate flap → bị tắt → drift lọt 6 tuần | cao | rất cao (hậu quả âm thầm, ăn mòn niềm tin) | **1** |
| 3 | Sheet native cắt mất nửa dưới ở Dynamic Type lớn | TB | rất cao (im lặng tuyệt đối, không log) | **2** |
| 1 | Kẹt modal đăng ký trên iOS Safari | cao | thấp (user chửi trong vài ngày) | **3** |

Lý do #2 đứng đầu dù #1 "nặng" hơn tức thời: #1 tự tố cáo (loud, revert xong là hết), còn #2 để lại một gate giả-xanh — mất niềm tin thì `git revert` không lấy lại được, đúng thang đo đề bài đặt ra. #3 xếp trên #1 vì nó âm thầm làm hỏng đúng dữ liệu quan trọng (đăng ký) mà không một tín hiệu nào nổ.

## Rẻ nhất để chặn từ bây giờ
1. **Ratchet gate đếm changed-files, report-only 2 tuần trước khi enforce** — tái dùng nguyên `targetFiles()` của `check-theline.mjs:42-65`. Chặn #2, ~10 dòng.
2. **`TLSheet` bọc `ScrollView` mặc định** — chặn #3, 1 dòng, không cần biết trước cỡ chữ nào hỏng.
3. **1 project WebKit + 1 test "X đóng được Dialog"** trong Playwright — chặn #1, và mở đường bắt mọi lỗi iOS-only sau này.

## Khoảng hở của pipeline mà bài này lộ ra
Ba khe, và cả ba đều là cùng một mù màu: **pipeline chỉ chạy trên desktop-chromium + simulator cỡ chữ mặc định.**
- `playwright.yml:38` cài **duy nhất chromium**; `playwright.config.ts:44-88` không có project WebKit nào → mọi hành vi iOS-Safari-only (thiếu Escape, soft-keyboard resize viewport) là điểm mù tuyệt đối. Feedback cho `/idea`: bất kỳ đề xuất nào chạm Dialog/Sheet/overlay phải kèm điều kiện "có test WebKit".
- `apple-tests.yml` chạy logic, **0 UI/snapshot test**, không có trục Dynamic Type / iPad. DS-03 native được duyệt mà chưa từng có gate nào render component ở cỡ chữ trợ năng.
- `check-theline.mjs` + `quality.yml` bắt hex và `title`, **không bắt hành vi** (component có đóng được không, disabled có chặn thật không, gate có flap không). "Standardization" là chuyện hành vi, nhưng gate của chúng ta chỉ soi bề mặt tĩnh.

Và một feedback về chính DoD: DoD (b) "thêm ratchet gate" đo bằng *sự tồn tại của gate*, không đo *gate có flap trên PR không liên quan không* — cần bổ sung tiêu chí "chạy gate mới trên 3 PR gần nhất không liên quan, phải xanh cả 3" trước khi coi là đạt.

---

Hai cơ chế hấp dẫn tôi đã **bác bỏ vì code tự phòng thủ** (không dựng chuyện quanh chúng):
- **"Button đổi `disabled`→`aria-disabled` làm double-submit lọt → tạo 2 payment order."** Sai: `payment_orders.registration_id` là `UNIQUE` (`20260512130001_payment_orders.sql:24`) và `create-payment-order/handler.ts:146-178` idempotent + xử lý đúng race (insert trúng unique-violation thì đọc lại đơn cũ trả về). Hai lần bấm chỉ ra một đơn. OTP thì single-use nên verify lần hai fail. Cơ chế không tồn tại.
- **"`the-line.css` phình làm INITIAL budget gate đỏ ở PR không liên quan."** Sai: `check-bundle-size.mjs:46-54` `walk()` chỉ nhặt `.js`, `initialLoadFiles` chỉ theo modulepreload/script JS — **CSS không bao giờ được tính** vào bất kỳ budget nào. Gate này không thể đỏ vì CSS.
- Cũng đã loại **"native invisible-on-light"**: `TLColor.swift:54-64` là dynamic `UIColor` bám `traits.userInterfaceStyle`, light/dark đều định nghĩa đủ và a11y-paired (như web `the-line.css:2737-2788` ↔ `:16-40`) → không có collision màu nào để khai thác.
