# UI/UX Critique — ARCH-02 / ARCH-03 refactor (Social Event reg/payment + Team Match)

> Panel: Claude (Opus 4.8) + GPT-5.6. Second opinion đầy đủ (OPENAI_API_KEY có),
> brief + reply lưu ở `../external/ui-brief.md` + `../external/ui-openai.md`.
> Đây là **refactor thuần, cam kết "không đổi hành vi user"** — nên critique không
> đánh giá thiết kế mới, mà đánh giá **những bất biến UX sẽ vỡ âm thầm khi tách lớp**
> trên đúng 2 luồng tiền quan trọng nhất của sản phẩm.

## Đánh giá tổng thể

Thiết kế không đổi, nên rủi ro UX ở đây không phải "màn hình xấu" mà là **regression
vô hình trên money-path**: state cũ của event trước rò sang event sau, copy VI lệch trên
màn phí, một nhánh im lặng (`payment_not_enabled`) biến thành lỗi đỏ. Vấn đề gốc: **hôm
nay không có một test parity nào** cho cả 2 luồng (recon xác nhận 0 test UI/hook cho
`RegistrationModal`/`useRegistration`/`useTeamRegistration`/`TeamMatchSetup`) — nghĩa là
lời cam kết "không đổi hành vi" hiện **không thể kiểm chứng**. Với người dùng đứng ở sân,
một số tiền QR sai hay một mã tham chiếu rò từ event khác là mất tiền thật, mất niềm tin
thật. Refactor được — nhưng phải khoá hành vi bằng test + chuyển copy về i18n TRƯỚC khi
động vào cấu trúc.

## Luồng người dùng (deep-link reality)

**Flow A — Social Event (RegistrationModal):** người chơi tới từ link Facebook → thẳng
trang `/social/:slug` → bấm Đăng ký → modal 1 file với state machine
`phone → otp → payment → success` (hoặc `member → …` cho hội viên CLB). Money chạm ở
bước `payment` (QRPaymentStep, 2 sub-state pre-claim/post-claim) và ở card mã tham chiếu
trong `success`. Người dùng one-handed, 4G, giữa sân — mọi bước phải chịu được đóng modal
giữa chừng và mở lại sạch.

**Flow B — Team Match (TeamMatchSetup):** đây là phía **BTC tạo giải** (5 bước:
Basic → Templates → DreamBreaker → Format → **Lệ phí**). Money chạm ở Step 5: phí/VĐV,
phí/đội, bậc giảm giá slot sớm, bộ 3 bank → QR preview. Phía người chơi/đội trưởng **nộp**
phí nằm ở file khác (`TeamMatchPaymentSection.tsx`) — không phải đối tượng tách lớp chính
nhưng dùng chung `lib/payment/*` nên phải giữ parity.

## Trạng thái user-facing mà RegistrationModal đang xử lý (để đội refactor không bỏ sót)

| Nhóm | Trạng thái | Edge-case dễ rớt khi tách lớp |
|---|---|---|
| Entry | `member` skip-OTP (hội viên CLB) vs `phone` (khách) | member phải VẪN validate slot; đừng mã hoá member = "OTP thành công giả" |
| phone | tên bắt buộc, level tuỳ chọn, slot picker (bắt buộc nếu có slot), badge "X/Y chỗ" + "Full" disabled | badge "Full" hiện đang là chữ EN cứng trong VI (defect có sẵn) |
| phone | Turnstile: nút DISABLED tới khi có token; watchdog 20s → nút "Tải lại CAPTCHA" | token single-use: reset sau MỖI lần gửi (kể cả server lỗi), khi đổi số, khi đóng modal, khi reload |
| otp | 6 số, cooldown resend 60s, kênh zalo/sms/dev, link "gửi lại qua SMS" CHỈ khi kênh=zalo, dev OTP echo | cooldown phải tính theo timestamp không phải biến đếm; `devOtp` phải xoá khi resend đổi sang kênh non-dev |
| payment | pre-claim (QR + bank + ref) / post-claim (banner xanh); nhánh prepayment = warning amber + deadline + nút "Tôi sẽ thanh toán sau" | `payment_not_enabled` phải IM LẶNG rơi về success, KHÔNG hiện lỗi |
| success | 5 card: banner, Follow-OA, hướng dẫn thanh toán, mã tham chiếu + badge "chưa thanh toán" amber, save-link, recovery email | thứ tự + điều kiện hiện từng card là hành vi — giữ nguyên |
| errors | ~20 mã lỗi server → i18n | mất mã gốc quá sớm ở tầng infra → tất cả rơi về `networkError` chung |

**Lịch sử bug thật (git log):** luồng này đã vá đúng những chỗ mong manh nhất mà tách lớp
sẽ chạm lại — `1a012bba fix(register): robust error code extraction`, `4d343533
fix(register): extract error code token from PG message` (map mã lỗi, mục lo #7),
`0b131bd7` + `5eff4b79` + `9cd38819` (3 commit vật lộn với watchdog/disabled-button của
Turnstile, mục lo Turnstile), `c8e79acb fix(ui/ux): inline registration validation`
(field error thay toast). Đây chính là danh sách "nơi từng chảy máu" — parity test phải
phủ đúng những chỗ này.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | **0 test parity tồn tại** cho cả 2 luồng → cam kết "không đổi hành vi" trên money-path không kiểm chứng được. | Viết characterization tests TRƯỚC (danh sách ở mục dưới), chạy xanh trên code hiện tại, rồi mới tách lớp, rồi chạy lại nguyên si. Đây là gate, không phải nice-to-have. |
| 2 | **Blocker** | **Copy Step-5 TeamMatchSetup ~20 chuỗi `language==='vi'?...:...` cứng inline** (label phí, placeholder, dòng preview giảm giá, hint QR). Tách Step 5 thành component/hook = mỗi mảnh tự chép lại ternary → lệch VI trên đúng màn tiền của BTC. | Chuyển copy Step 5 sang i18n `teamMatch.fees.*` **byte-for-byte** như một commit riêng TRƯỚC extraction. Giữ nguyên dấu, `%`, `−` vs `-`, `đ`. Không "cải thiện" tiếng Việt trong commit này. |
| 3 | **Blocker** | **Reset 13 field + stale-async trong RegistrationModal.** Tách state vào hook mà sót 1 field reset → `paymentOrder`/`reference_code`/slot của Event A rò sang Event B; hoặc RPC trễ của A cập nhật session B. Court-side: người dùng thấy **số tiền QR / mã tham chiếu của event khác** → chuyển sai tiền. | Gom về 1 `initialState(eventId)` + 1 `RESET_SESSION`; reset trên cả `open:false` VÀ đổi `eventId`; thêm **generation-id**, bỏ qua response async không khớp session hiện tại. Test A1 phải khẳng định TỪNG field reset, không chỉ `step`. |
| 4 | Nên sửa | Turnstile token single-use — dễ chỉ reset sau lần gửi THÀNH CÔNG, cho phép replay token đã fail. | 1 hàm `invalidateCaptcha(reason)` xoá token + clear watchdog + disable nút, gọi ở đủ 4 điểm (gửi/đổi-số/đóng/reload). UI không được tự xoá CAPTCHA hình mà hook vẫn giữ token. |
| 5 | Nên sửa | 2 lần `saveMyRegistration` (verify → fold `reference_code` sau khi có order). Refactor dễ "dedup" thành 1 → mất mã tham chiếu trong bản lưu localStorage. | Mô hình hoá 2 điểm ghi cố ý; lần 2 **merge** vào bản ghi cũ, không ghi đè. Test A8. |
| 6 | Nên sửa | Nhánh `payment_not_enabled` (CLB chưa bật thanh toán) phải im lặng về `success`. Tách lớp dễ biến nó thành lỗi đỏ hoặc đẩy mọi paid-event vào QR step chỉ theo `price>0`. | Giữ 1 hàm transition tầng application trả union rõ ràng: `payment_order_created | payment_unavailable | failed`; map `payment_unavailable` → success không render lỗi. Test A6 (ma trận 4 dòng). |
| 7 | Nên sửa | Member skip-OTP có thể bỏ qua slot validation nếu gộp vào `submitRegistration()` chung giả định luôn có OTP. | Tách lệnh: `registerMember`/`requestGuestOtp`/`verifyGuestOtp`, cả 2 dùng CHUNG validator slot (`slot_required/not_found/full`). Test A2. |
| 8 | Nên sửa | Flow B: `feeStepValid` là bất biến cross-field (fee>0 ⇒ bank+account 6–20 số+tên≥3). Dễ vỡ khi fee-logic sang helper còn bank-check ở lại component. | 1 hàm thuần `validateFeesStep(...)` dùng chung cho disable Next/Submit + inline error + submit cuối. Normalize số trước khi so `>0` (đừng truthiness `"0"`). Test B1 (ma trận 10 dòng). |
| 9 | Nên sửa | Flow B: toán bậc giảm giá + preview "Slot 1–10: X đ (−20%)" dễ off-by-one, sort sai theo % thay vì thứ tự đăng ký, hoặc áp giảm 2 lần cho fee/VĐV lẫn fee/đội. | 1 hàm thuần trả `{fromSlot,toSlot,baseAmount,discountedAmount,percent}`; UI chỉ format. Không nhân đôi phép toán ở validation và preview. Test B2 (fixture cố định slot 1/10/11/last/no-discount). |
| 10 | Nit | Chip "đã báo chuyển khoản, chờ BTC xác nhận" ở `TeamMatchPaymentSection` dùng token đỏ `--tl-live`. Đỏ/live = trận đang chạy / lỗi / huỷ, KHÔNG phải "đã nộp chờ xác nhận" → court-side đọc thành báo động. | **Đáng sửa nhưng KHÔNG trong refactor** — đổi sang amber/neutral pending, giữ xanh cho `confirmed`. Commit UX riêng, có test parity ghi lại màu đỏ hiện tại rồi đổi. (design-tokens.md: `live` = "only for actually-live states".) |
| 11 | Nit | 4 chuỗi VI cứng trong RegistrationModal ("Đang xác minh trình duyệt…", "Tải lại CAPTCHA", "Dev mode OTP", dòng bookmark footer) + badge "Full" chữ EN trong VI. | Chuyển sang i18n byte-for-byte cùng đợt copy (mục #2). Badge "Full" là defect có sẵn — **giữ nguyên** trong refactor, vá ở commit copy riêng. |

## Trạng thái màn hình (giữ nguyên — refactor không được đổi)

- **Empty:** slot picker khi 0 slot cấu hình = không hiện (gate legacy theo `max_players`). Giữ.
- **Loading:** nút submit có `Loader2` spinner + `reg.submitting`; QR ảnh `loading="lazy"`.
  Đừng thêm skeleton/spinner mới — parity nghĩa là y hệt.
- **Error:** ~20 mã server → i18n; unknown → `reg.networkError`. Giữ map exhaustive (mục #6/#11 recon).
- **Offline / Capacitor:** modal chạy trong WebView remote; `saveMyRegistration` localStorage là
  handle duy nhất khi SMS chưa tới → save-link card là cứu cánh. Tách lớp không được làm mất
  lần ghi thứ 2 (mục #5).

## Accessibility (WCAG 2.1 AA) — chỉ soát vùng refactor chạm

- `aria-label` trên nút copy (mã ref, bank number, save-link) — có, giữ.
- `aria-invalid` trên input tên khi lỗi — có (dòng 872). Slot radio dùng `disabled` + `opacity-60`
  cho full: **chỉ opacity không đủ tương phản trạng thái** cho screen-reader; đã có `disabled`
  nên OK về semantics, badge "Full" text bù thị giác.
- **Điểm cần giữ:** nút submit disabled tới khi có Turnstile token — đúng, nhưng phải chắc lý do
  disabled có text kèm ("Đang xác minh trình duyệt…") để người dùng không tưởng app treo. Giữ.
- Touch target: nút copy `size="icon"` (h-7 w-7 ≈ 28px ở QRPaymentStep dòng 266) **dưới 44px** —
  defect có sẵn, không phải do refactor; ghi nhận, đừng sửa trong refactor này.
- Không thấy regression a11y nào do bản thân việc tách lớp gây ra (JSX giữ nguyên nếu làm đúng).

## Danh sách test parity phải viết TRƯỚC refactor (gate cam kết "không đổi hành vi")

**Flow A (RegistrationModal):** A1 reset đủ 13 field + stale-async cross-session • A2 member
skip-OTP vẫn ép slot • A3 slot render "X/Y chỗ"/"Full"/disabled + map slot errors • A4 vòng đời
Turnstile (disable→enable, đổi số xoá token, mỗi lần gửi xoá token, 20s→reload) • A5 cooldown 59s/60s
+ link SMS chỉ khi zalo + devOTP chỉ khi dev • A6 ma trận routing thanh toán 4 dòng (gồm
`payment_not_enabled`→success im lặng) • A7 pre-claim/post-claim + prepayment amber/deadline •
A8 2 lần saveMyRegistration có `reference_code` • A9 5 card success + điều kiện • A10 bảng map 20 mã lỗi.

**Flow B (TeamMatchSetup):** B1 ma trận feeStepValid 10 dòng (6/20/21 số, tên 2/3 ký tự) • B2 boundary
giảm giá slot 1/10/11/last/no-discount, số tiền + text chính xác • B3 add/remove tier tính lại range •
B4 QR đồng bộ theo bank/account/name/amount + bỏ qua async cũ • B5 back Step4→Step5 giữ nguyên field
tiền • B6 chuyển fee về 0 → bank hết bắt buộc • B7 kiểm kê copy song ngữ Step 5 (viết TRƯỚC khi
chuyển ternary sang i18n).

## Copy đề xuất (VI / EN) — chỉ để CHUYỂN, không đổi chữ

Không đề xuất chữ mới (vi phạm scope). Việc copy là **di dời byte-for-byte** sang key:
- `teamMatch.fees.rulesSummary` / `.feePerPlayer.{label,placeholder}` / `.feePerTeam.label` /
  `.discount.{addTier,slotRange,preview,remaining}` / `.bank.{label,select}` /
  `.accountNumber.{label,invalid}` / `.accountName.label` / `.qr.{hint,fillPrompt}` / `.freeHint`.
- `registration.captcha.{verifying,timeout,reload}` / `registration.otp.devMode` /
  `registration.success.bookmarkHint`.
Yêu cầu: interpolation cho số/tham số (đừng nối chuỗi dịch), giữ nguyên `%`, `−`, `đ`, dấu cách.

## Panel đa model

- **Đồng thuận Claude + GPT-5.6 (tín hiệu mạnh, độc lập cùng kết luận):**
  1. Trình tự bắt buộc: (1) viết characterization tests → (2) chuyển copy cứng sang i18n
     byte-for-byte → (3) tách lớp → (4) chạy lại test nguyên si → (5) sửa chip đỏ ở commit riêng.
  2. 3 rủi ro cao nhất Flow A: reset-13-field/stale-async, vòng đời Turnstile token, 2 lần
     saveMyRegistration.
  3. Rủi ro copy-drift cao nhất = Step 5 TeamMatchSetup (~20 ternary cứng); guard = i18n hoá trước.
  4. Chip pending màu `--tl-live` đỏ đáng sửa NHƯNG là commit UX tách rời, không nhét vào refactor.
- **Bất đồng:** không có bất đồng thực chất. Khác biệt duy nhất về nhấn mạnh: GPT-5.6 đề nghị
  "centralized TS copy object" như guard tạm nếu i18n full quá to. **Quyết định của tôi: đi thẳng
  i18n `teamMatch.fees.*`** — repo đã có hạ tầng i18n keyed (`src/i18n/{vi,en}.ts`), một object TS
  trung gian chỉ đẻ thêm chỗ để drift lần hai; lý do "i18n quá to" không đứng vững khi đây đúng là
  20 chuỗi có sẵn chỉ việc dời. Rung 1 → i18n luôn.
