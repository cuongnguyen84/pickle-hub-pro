# Pre-mortem: arch-02-03-refactor

> Ba postmortem của ba sự cố CHƯA xảy ra. Feature "ARCH-02/03 refactor
> Social Event registration/payment thành layers + Team Match orchestration
> hooks" đã lên prod ba tuần trước và đã hỏng theo ba cách khác nhau. Đây là
> tường thuật, không phải checklist. Mọi mắt xích trỏ tới file thật; chỉ hậu
> quả là hư cấu.

---

## Sự cố 1 — "Chuyển 300k VietQR xong bị huỷ đăng ký, tiền không ai trả lại" (đăng ký paid cho slot server đã từ chối)

**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** 1–3 ngày (khi cron auto-cancel huỷ chỗ, user mới lên Zalo chửi)

**Timeline**
- T+0: ARCH-02 tách `RegistrationModal.tsx` (1398 dòng) thành application-layer
  `useEventRegistration` — gộp bước `phone-otp-verify` + `create-payment-order`
  thành một "đăng-ký-rồi-trả-tiền" cho gọn.
- T+4 ngày: một event 32 chỗ gần đầy. Hai người cùng bấm đăng ký slot còn 1 chỗ.
- T+4 ngày +2s: cả hai qua được gate capacity phía client. Server DB-01 cho một
  người thắng race, người kia bị `slot_full`. Nhưng client của người thua đã
  hiện QR VietQR.
- T+4 ngày +30s: người thua quét QR, chuyển 300.000đ.
- T+5 ngày: cron `auto-cancel-unpaid-registrations` (hourly) huỷ chỗ pending của
  người thua vì quá `prepayment_deadline_hours`. User đã trả tiền nhưng bị huỷ.
- T+6 ngày: user nhắn Zalo tổ chức "mình chuyển rồi mà báo huỷ".

**Cơ chế**
`src/components/social-events/RegistrationModal.tsx:441-456` → gate capacity
duy nhất phía client (`taken >= slot.capacity`) chỉ chặn trước OTP, không phải
trước thanh toán → `RegistrationModal.tsx:498` `if (!data || !data.ok)` là chỗ
DUY NHẤT khớp kết quả verify server với nhánh payment ở dòng 517-566 →
khi ARCH-02 kéo hai lời gọi này vào một handler "register+pay", nhánh
`create-payment-order` (dòng 517) không còn nằm sau cùng-một-guard `data.ok` →
người thua race (server trả `slot_full`, map ở `RegistrationModal.tsx:149-156`)
vẫn được đẩy sang bước QR → `create-payment-order/handler.ts:151`
`amountVnd = event.price_vnd` sinh order/QR cho một registration server đã bỏ →
user chuyển tiền vào reference_code mồ côi (hoặc gắn với chỗ pending sắp bị huỷ) →
`mark-payment-claimed/handler.ts:141` không có order khớp để đối soát.

**Vì sao mọi gate vẫn xanh**
- Panel duyệt "trích xuất thuần tuý, không đổi hành vi" — đúng với happy path.
- CI xanh: recon xác nhận KHÔNG có unit test nào cho `RegistrationModal` /
  `useRegistration` / `useTeamRegistration`. QA-08 (`payment-handlers.test.ts`)
  chỉ phủ `create-payment-order` handler ĐỘC LẬP — handler vẫn đúng; bug là
  CLIENT gọi nó sai thứ tự, không test nào chạm.
- Soak 30 phút sạch: solo dev tự đăng ký một mình, trả tiền, chạy ngon. Bug chỉ
  nổ với NGƯỜI THUA race trên slot gần đầy — cần hai người đăng ký đồng thời,
  soak một tay không dựng được.

**Ai báo, sau bao lâu**
User trên Zalo, 1–3 ngày sau (sau khi cron huỷ chỗ). `errors-telegram-alert`
KHÔNG nổ: một cú chuyển VietQR thành công vào reference mồ côi không ném
exception ở đâu cả — client hiện QR (thành công), server không tạo row xung đột
(im lặng). Không có gì để alert.

**Vì sao khó sửa**
`git revert` khôi phục được code, nhưng tiền đã nằm trong tài khoản Cuong với
reference_code không map được sang registration nào. Phải đối soát sao kê ngân
hàng thủ công, tìm từng nạn nhân, hoàn tiền tay. Càng để lâu càng nhiều nạn nhân.

**Dấu hiệu sớm lẽ ra phải có**
Một cảnh báo khi `create-payment-order` được gọi mà registration không ở trạng
thái active (order mồ côi). Hiện tại không có: handler tin tưởng caller đã xác
nhận đăng ký thành công.

---

## Sự cố 2 — "Tỷ số live đứng im suốt trận chung kết team match" (gộp hook realtime → thêm 1 binding bảng ngoài publication → câm cả channel)

**Xác suất:** cao (đây là bug tái phát NHIỀU NHẤT repo này) · **Thời gian tới lúc phát hiện:** 10–60 phút, nhưng bị đổ cho "wifi sân yếu"

**Timeline**
- T+0: ARCH-03 "chuẩn hoá orchestration hooks" gộp `useTeamMatchRealtime` +
  `useTeamMatchMatchRealtime` (hiện là 4 channel riêng) thành MỘT channel
  nhiều binding cho gọn, tiện thể thêm binding theo dõi bảng envelope ARCH-04
  (`referee_live_state`) hoặc `team_match_teams` để "thống nhất realtime".
- T+18 ngày: một giải team match đang đá vòng chung kết, khán giả mở
  `TeamMatchView` xem tỷ số live.
- T+18 ngày, phút thứ 3: trọng tài cập nhật tỷ số. Bảng khán giả... đứng im.
- T+18 ngày, phút thứ 20: có người ở sân bấm refresh tay, thấy tỷ số nhảy một
  phát rồi lại đứng. Đổ cho mạng.

**Cơ chế**
`src/hooks/useTeamMatchRealtime.ts:18-42` và `:50-76` → hiện là HAI channel tách
biệt, mỗi channel một binding (`team_match_matches`, `team_match_games`) — cả
hai bảng ĐÃ có trong publication (`20260122133725...sql:2-3`), nên chạy tốt hôm
nay → khi ARCH-03 gộp thành một channel với nhiều `.on('postgres_changes')`, nếu
MỘT binding trỏ tới bảng CHƯA nằm trong `supabase_realtime` (vd
`referee_live_state`/`team_match_teams`) → Supabase JS câm TOÀN BỘ channel, kể cả
binding `team_match_matches`/`team_match_games` đang tốt → tỷ số live đứng im.
Đây đúng cơ chế "1 binding trên bảng ngoài publication làm câm cả channel" ghi
trong `.claude/memory/` (realtime-publication-binding-gotcha, fix
`chat_room_settings` 2026-07-07) và migration `20260717170000_realtime_match_tables.sql`
vừa vá đúng bệnh này cho `quick_table_matches`/`doubles_elimination_matches`
(comment nói rõ chúng "silently dead" trên prod).

**Vì sao mọi gate vẫn xanh**
- Panel duyệt: "gộp 4 channel thành 1, ít kết nối WS hơn, sạch hơn" — nghe hợp lý.
- CI xanh: recon xác nhận ZERO test cho bất kỳ `useTeamMatch*` hook nào, không có
  test realtime.
- Soak 30 phút SẠCH VÌ DRIFT: replay Postgres local đã có bảng đó trong
  publication (chính kịch bản migration `20260717170000` mô tả — local có
  `quick_table_matches` published qua migration local-only cũ, prod thì không).
  Trên máy dev, tỷ số nhảy realtime ngon. Trên prod, binding chết. Xanh khắp nơi.

**Ai báo, sau bao lâu**
Trọng tài/tổ chức thấy bảng đứng giữa trận — 10–60 phút. Nhưng
`errors-telegram-alert` KHÔNG nổ (không có exception: channel `subscribe()`
trả về `CHANNEL_ERROR`/không status, được nuốt trong `try/catch` ở
`useTeamMatchRealtime.ts:43-45,77-79` bằng `console.warn`, không throw). Con
người phát hiện nhanh nhưng đổ nhầm cho "wifi".

**Vì sao khó sửa**
Revert hook thì được, nhưng nếu ai đó "sửa" bằng cách thêm binding bảng thiếu
publication mà quên ADD TABLE thì bệnh còn nguyên. Fix gốc là một dòng migration
`ALTER PUBLICATION`, nhưng phải phát hiện ra đúng bảng nào bị thiếu — mà local
không tái hiện được vì drift.

**Dấu hiệu sớm lẽ ra phải có**
`useTeamMatchRealtime.ts:42,76` nuốt trạng thái `subscribe()` bằng `console.warn`.
Nếu callback `.subscribe((status) => ...)` bắt `CHANNEL_ERROR`/`TIMED_OUT` và bắn
lên `client_errors`, `errors-telegram-alert` đã nổ ngay giây đầu thay vì chờ
người ở sân bấm refresh.

---

## Sự cố 3 — "Đội trưởng chuyển sai lệ phí hàng loạt suốt 3 tuần, không ai biết" (rebase feat/team-match-event-discounts sau refactor → conflict resolve sai làm sống lại semantic slot-index cũ)

**Xác suất:** trung bình-cao · **Thời gian tới lúc phát hiện:** 3+ tuần, hoặc không bao giờ cho tới khi có người tự cộng lại tiền

**Timeline**
- T+0: ARCH-03 refactor `useTeamMatch.ts`, di chuyển xử lý `discount_tiers` /
  cách đếm thứ tự slot vào orchestration hook mới.
- T+2 ngày: rebase nhánh `origin/feat/team-match-event-discounts` (đã diverge,
  ~401 dòng đè lên đúng các file ARCH-03 sửa) lên main mới.
- T+2 ngày: conflict trong `useTeamMatch.ts` + `TeamMatchPaymentSection.tsx`.
  Resolve kiểu "giữ cả hai / accept theirs" làm sống lại cách tính `mySlotIndex`
  CŨ (đếm cả đăng ký cancelled/pending) trong khi code mới chỉ đếm confirmed.
- T+3 ngày → T+24 ngày: mỗi đội trưởng đăng ký được hiện QR VietQR với số tiền
  discount TÍNH SAI (lệch một bậc tier). Ai cũng chuyển đúng số trên QR.
- T+24 ngày: một tổ chức ngồi cộng lại lệ phí thu được, thấy hụt/dư so với bảng
  giá, mới lần ra.

**Cơ chế**
`src/components/teamMatch/TeamMatchPaymentSection.tsx:104-120` → số tiền VietQR
tính HOÀN TOÀN phía client: `baseAmount * (100 - myDiscount) / 100` với
`myDiscount = discountPercentForSlot(tiers, mySlotIndex)` (dòng 111-112), rồi
đổ thẳng vào QR (`amount: teamAmount`, dòng 120) → `mySlotIndex` phụ thuộc cách
đếm thứ tự đăng ký → rebase resolve sai làm sống lại semantic đếm cũ →
`discountPercentForSlot` (migration `20260708100000` nói "cộng dồn từ bậc đầu"
theo `created_at`) trả nhầm bậc → QR hiện sai số → KHÔNG có bản ghi server nào
về "số tiền đáng lẽ phải trả": khác social event, lệ phí team match KHÔNG đi qua
`create-payment-order`, QR dựng tay client-side, tổ chức xác nhận thủ công
"Đã nộp lệ phí" (`TeamMatchPaymentSection.tsx:61`) → không đối soát tự động,
không exception, không alert.

**Vì sao mọi gate vẫn xanh**
- Panel KHÔNG BAO GIỜ thấy: đây là rebase trên feature branch, xảy ra SAU khi
  panel duyệt ARCH-03.
- CI trên nhánh xanh: `discountPercentForSlot` có thể có lib test, nhưng ghost
  nằm ở phía CALLER — cách tính `mySlotIndex` trong component (untested). Test
  lib pass vì hàm thuần vẫn đúng; input truyền vào mới sai.
- Soak sạch: discount chỉ lệch ở ĐÚNG các ngưỡng tier (vd slot thứ 5, thứ 10).
  Đăng ký đầu tiên discount=0, hai semantic ra kết quả GIỐNG nhau — happy path
  người test đầu tiên không lệch.

**Ai báo, sau bao lâu**
KHÔNG AI, trong nhiều tuần. Không exception → `errors-telegram-alert` im. Không
db-race → không log. Chỉ lộ khi một tổ chức tự cộng tiền, hoặc một đội trưởng
soi "sao tôi không được giảm như quảng cáo". 3+ tuần là lạc quan.

**Vì sao khó sửa**
`git revert` không lấy lại được tiền đã thu sai. Không có bản ghi "số đáng lẽ
phải trả" để đối soát — phải dựng lại thứ tự đăng ký lịch sử của TỪNG giải để
biết ai trả thiếu/dư bao nhiêu. Và niềm tin của tổ chức vào con số tự động thì
revert không lấy lại được.

**Dấu hiệu sớm lẽ ra phải có**
Một char-test/snapshot khoá semantic `mySlotIndex` (đếm ai, bỏ ai) trước khi
refactor. Không có → rebase resolve sai không có gì để đỏ. Hoặc: ghi
`teamAmount` đã hiện cho user vào một cột server để đối soát về sau — hiện tại
số này chỉ tồn tại trong RAM của client.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 3 | Rebase ghost → sai lệ phí VietQR âm thầm | TB-cao | Rất cao (3+ tuần, có thể không bao giờ) | **1 — tệ nhất** |
| 1 | Trả VietQR cho slot server đã từ chối | TB | TB (1–3 ngày, user Zalo) | 2 |
| 2 | Gộp hook realtime → câm channel, tỷ số đứng | Cao | Thấp (10–60 phút, con người thấy) | 3 |

Sự cố 2 XÁC SUẤT cao nhất (bug tái phát nhiều nhất repo), nhưng phát hiện nhanh
và KHÔNG mất tiền → ưu tiên thấp hơn. Sự cố 3 tệ nhất đúng theo luận điểm của
vai: sai dữ liệu tiền ÂM THẦM suốt tuần ăn mòn niềm tin, `git revert` không cứu
được — trong khi sự cố 2 thảm khốc nhưng 10 phút là biết.

**Tệ nhất: Sự cố 3.**

---

## Rẻ nhất để chặn từ bây giờ

1. **Char-test khoá semantic `mySlotIndex`** (`TeamMatchPaymentSection.tsx:104-112`)
   TRƯỚC khi refactor: một `test_*.ts` assert với 6 đăng ký (2 cancelled) →
   discount ra đúng bậc. Rebase resolve sai sẽ đỏ ngay. (Chặn sự cố 3.)
2. **Một guard trong `create-payment-order/handler.ts`**: từ chối tạo order nếu
   registration không ở trạng thái active → order mồ côi thành lỗi thấy được,
   không phải QR im lặng. (Chặn sự cố 1.)
3. **Một dòng trong `.subscribe((status) => ...)`** ở `useTeamMatchRealtime.ts`:
   bắn `client_errors` khi status là `CHANNEL_ERROR`/`TIMED_OUT` thay vì nuốt
   bằng `console.warn`. (Chặn sự cố 2 — biến 60 phút mù thành alert tức thì.)

---

## Khoảng hở của pipeline mà bài này lộ ra

- **Soak 30 phút chạy trên DB local có publication drift** — chính xác kịch bản
  migration `20260717170000` mô tả (local có bảng published, prod không). Soak
  realtime PHẢI chạy trên prod hoặc replica đồng bộ publication, nếu không nó
  mù đúng loại bug realtime hay gặp nhất repo này. Đây là feedback thẳng cho /idea.
- **Money-path team match KHÔNG có server truth**: lệ phí VietQR dựng client-side
  (`TeamMatchPaymentSection.tsx:120`), không qua `create-payment-order`, không
  đối soát. QA-08 chỉ bảo vệ money-path social event. Refactor nào chạm discount
  đều không có lưới an toàn — panel nên coi đây là điều kiện tiên quyết, không
  phải "later".
- **Rebase các nhánh diverged (đặc biệt `feat/team-match-event-discounts`, 401
  dòng) SAU refactor không có char-test seam** → ghost regression không có gate
  nào bắt. Boundaries doc nói "not lint/CI enforced" — đúng là khoảng hở này.
