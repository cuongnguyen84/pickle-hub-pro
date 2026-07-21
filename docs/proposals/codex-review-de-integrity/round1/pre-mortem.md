# Pre-mortem: codex-review-de-integrity (telemetry + registration integrity)

Agent: `pre-mortem` · 2026-07-21 · read-only. Ba postmortem của sự cố **chưa** xảy ra.
Mọi mắt xích trỏ file thật; hậu quả là hư cấu, cơ chế thì không.

Bối cảnh có sức nặng: cả cụm này sinh ra vì Codex bắt được 4 defect mà pipeline ship
XANH — test assert ÍT hơn tuyên bố. Recon lại lòi thêm 1 blocker (JourneyKind collision)
mà cả Codex lẫn orchestrator bỏ sót. Mô-típ xuyên suốt: **cổng cho tín hiệu xanh SAI.**
Ba câu chuyện dưới đây đều là biến thể của đúng mô-típ đó, lần này cho telemetry.

---

## Sự cố 1 — "Wall không giết ai" là con số của Social Event, không phải của giải đấu. Cuong đóng UX-07 nhầm.

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** không bao giờ (đầu ra là một quyết định sai, không phải một alert)

Đây là sự cố tệ nhất và tinh vi nhất. Không có exception, không có màn hình đỏ,
không có đội nào biến mất. Cái mất là **niềm tin vào chính con số** — và `git revert`
không lấy lại được một quyết định sản phẩm đã ra.

**Timeline**
- T+0 (đợt này ship): P3 được vá đúng như đặt hàng — re-mint join anon→login được sửa,
  `auth_wall_viewed`/`registration_complete` join sạch trong nhánh singles QuickTable.
  CI xanh, panel gật, soak 30 phút sạch. Mọi người tin telemetry giờ "đo được D5".
- T+3 tuần (~02/08): Cuong mở dashboard funnel `player_registration` để quyết UX-07 —
  đúng mốc đã hẹn trong handoff ("02/08 đọc funnel organizer_tournament + player").
- T+3 tuần + 5 phút: tỉ lệ hoàn thành `player_registration` hiện ~70-80%, đẹp.
  Kết luận: "login wall không giết ai" → đóng UX-07, không xây guest path.
- Vĩnh viễn: nhánh **giải đấu** (QuickTable/DE) — cái D5 thực sự nói tới — rớt ở wall,
  nhưng tín hiệu đó đã bị nuốt. Không ai biết mình vừa quyết dựa trên số của luồng khác.

**Cơ chế**
`src/lib/journeys.ts:29` → sessionStorage key = `journey_${kind}_id`, tức MỌI luồng dùng
chung một `JourneyKind` string thì dùng chung một key và chung một namespace `journey_id`.
`src/components/social-events/RegistrationModal.tsx:282` → Social Event OTP/member gọi
`startJourney("player_registration")`, complete tại `:475`/`:591` với
`player_registration_completed` — đúng contract `docs/north-star-journeys.md:53-59`.
`src/components/quicktable/RegistrationForm.tsx:209` → QuickTable **cũng** gọi
`startJourney('player_registration')`, complete tại `:366` với `registration_complete`.
→ Hai luồng contract-lệch (Social Event vs giải đấu) đổ vào **cùng một journey name**.
Dashboard D5 dựng trên "player_registration journey" (`north-star-journeys.md:75-77`:
`unique journey_id completed / started`) gộp `journey_id` của cả hai.
Social Event là luồng đang sống (Cuong xác nhận 2026-07-21: 0 đăng ký giải MLP Hà Nội,
trong khi social event chạy đều) → **tỉ lệ blended = gần như 100% tỉ lệ của Social Event**,
vốn cao (member đã quan tâm, OTP free). Nhánh giải đấu volume gần 0 → vô hình trong mẫu số.

**Vì sao mọi gate vẫn xanh**
- **CI:** `src/lib/__tests__/journeys.test.ts:50-52` chỉ chạy `player_registration` với
  **bộ event của Social Event** (`player_registration_started/...`). `:87-92` test
  "các KIND khác nhau không giao thoa" — nhưng KHÔNG có test nào cho "cùng một kind,
  hai bề mặt, chung key". Event vocab của QuickTable (`auth_wall_viewed`,
  `registration_complete`) có **0 test**. Đây đúng là mô-típ đã đẻ ra cụm: test assert
  ít hơn cái nó tuyên bố bảo vệ.
- **Panel + Codex:** collision này chỉ lộ ở recon vòng 0 (`idea-recon.md:14,45`). Codex
  review lẫn orchestrator đều bỏ sót — vì nó không nằm trong một file, nó nằm ở **chỗ nối**
  giữa hai file cách nhau cả thư mục.
- **Soak 30 phút:** telemetry-correctness không quan sát được trong 30 phút. Cần nhiều tuần
  dữ liệu prod + cả hai luồng cùng chạy mới thấy blend. Soak thấy "event bắn ra" = xanh.

**Ai báo, sau bao lâu**
Không ai. Người duy nhất "phát hiện" là Cuong — nhưng ông phát hiện SAI: đọc con số đẹp,
quyết đóng UX-07, tin rằng mình vừa dùng dữ liệu. Đây là failure mode nguy hiểm nhất:
gate xanh, dữ liệu "có", quyết định tự tin, và sai.

**Vì sao khó sửa**
Revert code thì được, nhưng quyết định đã ra. Nếu UX-07 bị đóng và guest-path bị gạch khỏi
roadmap, chi phí là 3 tuần → 3 tháng mù tiếp theo. Dữ liệu funnel lịch sử đã trộn không tách
lại được (event cũ không mang cờ phân biệt luồng — chỉ prop `format:'quicktable'` ở QuickTable,
Social Event không có prop đối xứng để lọc ngược).

**Dấu hiệu sớm lẽ ra phải có**
Một test khẳng định "hai file gọi `startJourney` với cùng string kind = fail" hoặc một
assertion rằng key `journey_player_registration_id` chỉ có một bề mặt ghi. Cả hai đều không tồn tại.
Prop `format` chỉ có ở QuickTable → nếu dashboard lọc `format='quicktable'` thì thoát được,
nhưng không có gì BẮT BUỘC người dựng dashboard lọc — và contract north-star không nhắc tới
`format` vì nó viết cho Social Event.

---

## Sự cố 2 — Bản vá re-mint làm hai lần đăng ký khác nhau dính thành một journey; tỉ lệ hoàn thành đọc ra thấp giả.

**Xác suất:** trung bình-cao · **Thời gian tới lúc phát hiện:** 2-4 tuần (khi số funnel "kỳ cục" đủ lâu để ai đó soi)

Bản vá cho P3 tự đẻ ra bug mới — kinh điển "vá triệu chứng ở caller, để hở vòng đời state".

**Timeline**
- T+0: Fix re-mint được làm theo cách lazy nhất và đúng nhất về mặt diff: thêm guard ở
  **caller** (`RegistrationForm.tsx` effect) kiểu `if (!readActiveId('player_registration')) startJourney(...)`,
  để không đè id khi anon→login. Module `journeys.ts` không đổi.
- T+0: CI xanh. `journeys.test.ts:81-85` ("restart mints new id") vẫn PASS vì module không đổi —
  guard nằm ở caller, test không chạm caller.
- T+vài ngày: user thật trên mobile VN mở tab đăng ký giải A, bỏ giữa chừng (không complete).
  sessionStorage `journey_player_registration_id` **sống nguyên** — `journeys.ts` chỉ xoá key
  ở `completeJourney` (`:104`); abandon không xoá gì. Tab mobile sống nhiều ngày.
- T+vài ngày: cùng tab đó, user mở giải B (hoặc một social event). Guard thấy key còn active
  → **bỏ qua** `startJourney` → dùng lại `journey_id` cũ của giải A.
- T+2-4 tuần: mẫu số funnel undercount (hai lần vào đếm thành một journey), hoặc "completed"
  rơi ngoài cửa sổ 30 phút (`north-star-journeys.md:77`) vì start thật là mấy ngày trước →
  tỉ lệ hoàn thành đọc ra **thấp giả**. Ngược pha với Sự cố 1 nhưng cùng bản chất: số sai.

**Cơ chế**
`src/lib/journeys.ts:104` → key chỉ bị `removeItem` khi `completeJourney`. Không có đường
nào xoá khi user bỏ dở. `:44` → `startJourney` luôn mint mới (đúng), nên bug KHÔNG ở module —
ở caller quyết định *khi nào gọi*. Guard "đừng mint nếu đã active" biến sessionStorage
(sống suốt vòng đời tab, `idea-recon.md:7`) thành nơi id cũ tồn đọng. Vì key dùng chung
(Sự cố 1), id đọng có thể là của Social Event, rồi QuickTable `completeJourney('player_registration',
'registration_complete')` (`RegistrationForm.tsx:366`) xoá key và bắn completion mang id của
luồng Social Event → chéo luồng.

**Vì sao mọi gate vẫn xanh**
- Test hiện có (`journeys.test.ts`) chạy trong một `beforeEach` sạch sessionStorage giữa mỗi
  test → **không bao giờ mô phỏng một tab sống qua nhiều lần đăng ký**. Vòng đời đa-attempt
  không có ô nào để tick.
- Guard đặt ở caller → module test xanh nguyên. Reviewer đọc diff thấy "chỉ thêm một `if`,
  bớt re-mint" → hợp lý, merge.
- Soak 30 phút chỉ đi một journey một lần → không chạm bug (bug cần attempt thứ HAI trong
  cùng tab).

**Ai báo, sau bao lâu**
Không user nào báo (họ đăng ký bình thường, chả thấy gì). Cuong hoặc người đọc funnel sẽ
thấy "tỉ lệ hoàn thành sao thấp thế / sao denominator lệch" sau 2-4 tuần — nếu để ý. Nếu
không để ý, nó lặng lẽ kéo số D5 lệch và củng cố một quyết định sai (vòng lại Sự cố 1).

**Vì sao khó sửa**
Bản thân vá dễ, nhưng dữ liệu đã bắn thì mang id trộn, không tách lại. Và bug này SINH RA
từ chính bản sửa được ship như "đã giải quyết P3" — dễ bị coi là done và không ai quay lại.

**Dấu hiệu sớm lẽ ra phải có**
Một test dựng một tab, đăng ký-bỏ-dở, rồi đăng ký lần hai, assert hai `journey_id` khác nhau.
Không tồn tại. Và guard đúng phải xoá/re-scope key khi rời form (unmount) hoặc khi `tableId`
đổi — không chỉ "đừng mint".

---

## Sự cố 3 — Progress bar "thật" đếm cả đơn chờ duyệt → hiện "đầy" giả → người chơi thật thấy đầy nên không đăng ký.

**Xác suất:** trung bình-cao · **Thời gian tới lúc phát hiện:** vô định (mất đăng ký thì không nhìn thấy được)

Cuong đã quyết P2: KHÔNG cap cứng, chỉ **sửa progress bar hard-code 25% → hiện số thật**
(`00-intake.md:80`). Câu chuyện là: "số thật" nào?

**Timeline**
- T+0: Progress bar `OpenRegistrationSection.tsx:59` (`width:'25%'`) được thay bằng query đếm
  thật trên `quick_table_registrations`. Cách lazy nhất: `count(*) where table_id = X`.
- T+0: Dev test trên một bàn mới/bàn test (0-2 đăng ký) → bar hiện ~10%, trông đúng. Ship.
  CI xanh (không có test nào assert *ngữ nghĩa* của count). Soak sạch (bàn quiet).
- T+nhiều ngày: một bàn public đang mở gom dần **đơn `pending`** — đăng ký QuickTable mặc định
  là "đơn xin", status `pending` (`00-intake.md:36`, `20251225041737` policy "own pending").
  Người tò mò bấm đăng ký rồi bỏ, tổ chức chưa duyệt. Count(*) đếm hết cả pending.
- T+nhiều ngày: bar hiện "16/16 — Đã đăng ký" (hoặc >100% bị clamp). Người chơi thật vào,
  thấy "đầy", **bỏ đi**. Trong khi phần lớn là pending mà organizer sẽ loại.
- Vĩnh viễn: registration bị đè bởi một thanh bar nói dối. Đăng ký mất không đo được —
  bạn không thấy được người đã không bấm.

**Cơ chế**
`src/components/quicktable/OpenRegistrationSection.tsx:59` (bar) + `:44-47` (nhãn "{player_count}
players" = **sức chứa cấu hình**, `useTournamentData.ts:83-95`, KHÔNG phải count thật).
Count thật cần query MỚI (`idea-recon.md:36`) trên `quick_table_registrations`. RLS cho phép
anon đọc: policy "Registrations viewable for public tables"
(`supabase/migrations/20251225041737_...:42-49`) `USING (is_public = true OR creator)` →
anon count được bàn public **bình thường** (nên KHÔNG có chuyện "0/16 do RLS chặn" — giả thuyết
đó SAI, xem mục lỗ hổng cuối). Cái sai là count `count(*)` gộp mọi status: `pending` +
approved. Model đăng-ký-là-đơn-xin biến "đã đăng ký" thành "đã nộp đơn" → bar phồng.

**Vì sao mọi gate vẫn xanh**
- Panel duyệt "hiện đăng ký thật / player_count" — **không chốt là đăng ký NÀO** (applicant hay
  accepted). Quyết định mơ hồ ở tầng sản phẩm → implement mơ hồ ở tầng code, cả hai đều "đúng
  theo lời".
- CI không có test nào cho ngữ nghĩa count (pending vs approved) hay clamp ≤100%.
- Dev/soak chạy trên bàn sạch → chưa tích pending → bar trông đúng. Bug chỉ nở trên bàn
  **đã sống một thời gian**, thứ soak 30 phút không dựng được.

**Ai báo, sau bao lâu**
Người chơi không báo (họ chỉ lặng lẽ bỏ). Nếu may, một organizer nhắn "sao bàn tôi hiện đầy mà
tôi mới duyệt 2 người?" sau vài tuần → mới lộ. Nếu không, im lặng ăn mòn conversion đăng ký.

**Vì sao khó sửa**
Sửa query thì dễ (đếm `status='approved'`, clamp trần). Nhưng thiệt hại — đăng ký đã không xảy ra —
không phục hồi và không định lượng được. Đây là loại lỗi hiển thị làm hỏng số mà lại không để
lại vết trong bất kỳ bảng nào.

**Dấu hiệu sớm lẽ ra phải có**
Một assertion: count dùng cho bar chỉ đếm `approved` và display clamp ≤ 100%. Và một dòng nhắc
trong panel spec ghi rõ "số thật = accepted, không phải applicant". Cả hai vắng.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | Blended `player_registration` funnel → đóng UX-07 nhầm | Cao | Rất cao (đầu ra = quyết định sai, không alert nào nổ được) | **P0** |
| 2 | Guard re-mint + sessionStorage đọng → journey trộn, tỉ lệ thấp giả | TB-cao | Cao (số kỳ cục, không lỗi) | P1 |
| 3 | Progress bar đếm pending → "đầy" giả → mất đăng ký thật | TB-cao | Cao (đăng ký mất không nhìn thấy) | P1 |

Sự cố 1 đứng đầu không vì thảm khốc tức thời mà vì nó **im lặng làm hỏng đúng cái quyết định
mà cả cụm này sinh ra để phục vụ**. Một crash 10 giây là biết còn đỡ hơn một con số sạch-nhìn
dẫn tới đóng nhầm một hướng sản phẩm suốt 3 tuần. Niềm tin mất kiểu này thì revert không cứu.

---

## Rẻ nhất để chặn từ bây giờ

1. **Tách JourneyKind cho QuickTable** (chặn Sự cố 1). Thêm `"quicktable_registration"` vào
   union `JourneyKind` (`journeys.ts:17-26`) + đổi 4 string literal ở `RegistrationForm.tsx`
   (`:197,209,211,366`). Key riêng → funnel riêng → không blend với Social Event. Kèm MỘT test:
   grep/assert không có hai file gọi `startJourney` với cùng string kind cho hai bề mặt khác nhau.
2. **Xoá key khi rời form, không chỉ "đừng mint"** (chặn Sự cố 2). Khi vá re-mint: cleanup
   `journey_..._id` ở effect-return (unmount) hoặc khi `tableId` đổi. Một test: hai attempt
   trong cùng "tab" → hai `journey_id` khác nhau.
3. **Bar đếm `approved` + clamp ≤100%** (chặn Sự cố 3). Query count `status='approved'`, hiển thị
   `min(count, player_count)`. Một assertion cho ngữ nghĩa count.

Cả ba đều là một-vài-dòng + một test — rẻ hơn nhiều so với hậu quả của bất kỳ cái nào.

---

## Khoảng hở của pipeline mà bài này lộ ra

**Đây là feedback cho chính /idea, nói to:**

1. **Gate "journey coverage" mù với luồng thứ hai squat cùng kind.** `journeys.test.ts` pin đúng
   tên event north-star nhưng chưa bao giờ hỏi "một `JourneyKind` string có bị hai bề mặt dùng
   chung không?". Đúng lỗ đã cho collision lọt qua Codex + orchestrator + CI. Cần: một test/lint
   liệt kê mọi call-site `startJourney(kind)` và bắt mỗi kind ↔ đúng một bề mặt/bộ-event. Đây là
   phiên bản telemetry của chính mô-típ "test assert ít hơn tuyên bố" đã đẻ ra cả cụm.

2. **Test reset sessionStorage giữa mỗi case → mù hoàn toàn với vòng đời state đa-attempt.**
   Không có gate nào chạy "một tab, nhiều lần đăng ký". Mọi bug re-mint/dedup/stale-id đều rơi
   vào điểm mù này.

3. **Panel chốt "hiện số thật" nhưng không chốt số NÀO.** Quyết định sản phẩm mơ hồ (applicant vs
   accepted) đi thẳng thành code mơ hồ mà vẫn "đúng theo lời". Spec panel cần buộc chọn ngữ nghĩa
   đo lường trước khi giao, giống cách ARCH-02 buộc định lượng 83 read-site.

**Giả thuyết đã bị bác (kết quả có giá trị):** "progress bar mới bị RLS chặn cho anon → hiện 0/16"
là SAI. `20251225041737:42-49` cho anon SELECT bàn public → count chạy được cho anon. Đừng vá
một RLS-block không tồn tại.

**Residual P1 (seed=NULL) — đánh giá honest, không thổi:** self-register đọc status TRƯỚC lock
(`20260721010000:66`) nhưng **capacity-recheck DƯỚI lock** (`:83-88`) là backstop thật: full vẫn
là full, insert #17 bị từ chối. Để chèn được sau close cần một slot trống xuất hiện SAU close, mà
`cancel` (`20260529120000:202-204`) và close đều đòi status `registration_open` → sau khi close lật
`ongoing`, không nguồn nào giải phóng slot. Khe self-register vì thế gần như đóng. Cửa còn hở thật
sự là **organizer-add** (`20260529140000:60,102`, KHÔNG lấy lock — Cuong cho phép vượt cap): thêm
đội SAU khi close gán seed (`20260529120000:252-266`) + bracket đã gen (bước frontend) → đội mới
`seed=NULL`, vắng khỏi bracket. Đây là hệ quả của quyền "organizer được vượt cap", không phải race
kỹ thuật — nhưng seed=NULL/orphan là cạnh sắc đáng có một guard nhỏ (backfill seed hoặc từ chối add
khi status ≠ registration_open). Đánh giá vá/bỏ: **bỏ được** phần self-register race; **nên guard**
riêng cái organizer-add-post-close seed=NULL.
