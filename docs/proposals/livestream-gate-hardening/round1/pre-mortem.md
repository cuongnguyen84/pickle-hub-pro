# Pre-mortem — livestream-gate-hardening

Vai: postmortem cho sự cố **chưa xảy ra**. Giả định proposal đã ship (fix dual-ref
pause, re-pause liên tục khi gated, persist preview start-time vào localStorage,
gate `/embed/live/:id`, view counter chỉ đếm khi playing+không gated, presence
payload thêm `gated`, tracking click login/signup). Ba tuần sau, prod hỏng. Dưới
đây là ba câu chuyện KHÁC cơ chế. Mọi mắt xích trỏ file:line THẬT (state trước
ship — đây là code mà bản fix sẽ cắm vào).

---

## Sự cố 1 — "View count mọi video replay + video tin tức đứng im ba tuần, không ai để ý"
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** ~3 tuần (tới khi Cuong/creator soi analytics)

Đây là cái tệ nhất: không có exception, không alert, gate livestream chạy hoàn
hảo — nhưng một bảng telemetry khác âm thầm ngừng ghi.

**Timeline**
- T+0 (đêm ship): gate livestream demo đẹp, view counter livestream chỉ đếm khi
  đang phát — đúng yêu cầu. Merge.
- T+0..T+21 ngày: `view_events` với `target_type='video'` rơi về gần 0 mỗi ngày.
  Livestream vẫn đếm (WatchLive có truyền trạng thái playing). Không ai nhìn số
  video hằng ngày.
- T+21: một creator hỏi "sao replay/video của em 3 tuần nay 0 view?" hoặc Cuong
  mở GA/`view_events` thấy vách đá. Lúc này 3 tuần dữ liệu video view đã mất.

**Cơ chế**
Yêu cầu "useIntervalViewCounter chỉ đếm khi playing+không gated" buộc phải thêm
tham số vào **hook dùng chung** `src/hooks/useIntervalViewCounter.ts:27-34`. Cách
tự nhiên nhất: thêm `isActive`/`isPlaying` optional, default `false` ("mặc định
tắt, caller nào cần thì bật"), rồi gác cái tick `src/hooks/useIntervalViewCounter.ts:53-57`.
- Livestream callers được sửa để truyền cờ: `src/pages/WatchLive.tsx:106-109`,
  `src/components/home/HomeLivePlayer.tsx:60-63`.
- Nhưng hook này CÒN ba caller video thường **không đụng tới trong proposal**:
  `src/pages/WatchVideo.tsx:64-67`, `src/pages/embed/EmbedVideo.tsx:30-34`, và
  livestream embed `src/pages/embed/EmbedLive.tsx:19-23`.
- Param optional + default `false` ⇒ TypeScript **không báo lỗi** ở ba caller cũ ⇒
  tick không bao giờ push event ⇒ `batch-view-events` không nhận row video nữa.

Ba thứ vô hại gặp nhau: (1) hook dùng chung video-lẫn-livestream, (2) param mới
để optional cho khỏi vỡ call site, (3) default an toàn-nghe-có-lý là `false`.

**Vì sao mọi gate vẫn xanh**
- CI TypeScript: param optional → compile sạch, không call site nào đỏ.
- Unit test: recon ghi rõ **zero** test cho `useIntervalViewCounter`,
  `WatchVideo`, `EmbedVideo` (`round1/idea-recon.md:38`). Không có gì fail.
- Panel review đọc đúng các file livestream (đúng scope proposal), thấy gate +
  đếm-khi-playing chạy chuẩn; ba file video nằm ngoài diff review kỹ.
- Soak/visual: `tests/visual.spec.ts:41` chỉ chụp `/live` (hub), không mở
  `/watch/:id`; và view count vô hình trong screenshot. Soak 30' mở livestream →
  livestream vẫn đếm → xanh.

**Ai báo, sau bao lâu**
Không user nào — view count không phải thứ user nhìn realtime. Creator hoặc chính
Cuong phát hiện khi soi số, tính bằng tuần.

**Vì sao khó sửa**
`git revert` phục hồi việc đếm nhưng mở lại lỗ thổi phồng livestream. Sửa đúng
(bật lại 3 caller video) thì nhanh — nhưng **3 tuần view_events video đã mất vĩnh
viễn**; telemetry append-only, không tái dựng được ai đã xem.

**Dấu hiệu sớm lẽ ra phải có**
Một canary đếm row `view_events` theo `target_type` mỗi ngày sẽ thấy `video` rơi
cliff ngay hôm sau. Không có dashboard/alert nào trên đó. Rẻ nhất: một test
render `WatchVideo` khẳng định hook được gọi với cờ khiến nó đếm (hoặc test hook
với `target_type='video'` mặc định vẫn tick).

---

## Sự cố 2 — "Tính năng presence-gated là no-op: admin vẫn thấy người kẹt ở gate là 'đang xem', ai cũng tưởng đã fix"
**Xác suất:** TB-cao · **Thời gian tới lúc phát hiện:** có thể không bao giờ (feature tự tin sai)

Không phải hỏng ồn ào — hỏng bằng cách **trông như đã sửa**. Nguy hiểm hơn: nó
đóng lại một bug thật mà mọi người tin đã xử lý.

**Timeline**
- T+0: thêm `gated` vào payload presence, admin viewer list dự kiến phân biệt
  người xem thật vs người kẹt gate. Ship, tick xong mục "presence phản ánh gated".
- T+0..∞: mọi viewer luôn báo `gated:false`. Bảng "đang xem" của admin vẫn gồm cả
  người ngồi trước overlay đăng nhập — y hệt bug proposal định sửa — nhưng giờ
  không ai điều tra nữa vì "đã fix rồi".

**Cơ chế**
`channel.track({...})` chỉ chạy **đúng một lần**, trong `connect()` tại thời điểm
`SUBSCRIBED`: `src/hooks/useLivePresence.ts:88-98`. Payload chụp trạng thái ngay
lúc subscribe — mà lúc đó user **vừa mở trang, preview đang chạy, chưa gated**.
Gate nổ ~15s sau; không có gì track lại. ⇒ `gated` chết cứng ở `false`.

Tệ hơn vì kiến trúc refcount dùng chung: `acquire()` chỉ tăng ref và trả lại
entry cũ nếu đã tồn tại — `src/hooks/useLivePresence.ts:124-128`. Một client mở
homepage (hero, không gated) rồi vào `/live/:id` sẽ **tái dùng đúng channel cũ**,
không track lại. Và effect cố ý loại `user?.id`/mọi state khỏi deps
(`src/hooks/useLivePresence.ts:180-182` + comment) nên hook không hề nhận `isGated`
để re-track. Muốn `gated` cập nhật thật thì phải đục lại lõi shared-channel —
nếu làm ẩu (re-track mỗi lần đổi gated) thì gọi `track()` liên tục trên channel
mà hàng ngàn người đêm live thứ 7 dùng chung (đúng lo ngại scaling
`.claude/memory/lessons-learned.md:247-256`).

**Vì sao mọi gate vẫn xanh**
- Payload static CÓ field `gated` — grep/review tĩnh thấy "đã thêm", tick.
- Zero test presence (`round1/idea-recon.md:38`) → CI không có gì phản chứng.
- Test tay: dev mở admin panel + 1 tab viewer, liếc thấy có cột gated → tưởng
  xong; để ý cột đó **đổi giá trị sau 15s** mới lộ, mà không ai chờ.
- Soak không mở admin viewer panel; social-proof count vẫn hiện số nên "trông sống".

**Ai báo, sau bao lâu**
Gần như không ai. Đây là dữ liệu nội bộ admin; sai lệch không gây lỗi thấy được.
Có thể lộ tình cờ khi Cuong đối chiếu "đang xem" với conversion và thấy vô lý.

**Vì sao khó sửa**
Không phải revert-là-xong: fix đúng đòi re-track theo gated trên một channel
refcount dùng chung — dễ kéo theo bug channel-collision cũ
(`.claude/memory/lessons-learned.md:118-133`) và storm sync khi scale. Đây là
"nợ tin cậy": suốt 3 tuần mọi report dựa trên "presence đã lọc gated" đều sai mà
không ai biết.

**Dấu hiệu sớm lẽ ra phải có**
Một assert: sau khi gate nổ, đọc `channel.presenceState()` của chính client phải
thấy meta `gated:true`. Không có test nào chạm điều đó. Rẻ nhất: một test khẳng
định `track` được gọi LẠI khi `isGated` chuyển true — nó sẽ đỏ ngay vì kiến trúc
hiện tại không cho re-track.

---

## Sự cố 3 — "Đêm live thứ 7: user bấm vào stream từ trang chủ là bị chặn ngay, 0 giây preview — phễu đăng ký sập đúng lúc traffic đỉnh"
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** ~vài ngày tới 1 tuần (qua số signup, không qua lỗi)

Success metric của proposal là **tăng đăng ký**. Sự cố này khiến nó đạt ngược:
gate quá tay, chặn người xem trước khi họ kịp muốn xem.

**Timeline**
- T+0: ship. Gate homepage (`HomeLivePlayer`) giờ arm thật + persist start-time.
- Thứ 7 T+n: `LiveSection` mount `HomeLivePlayer` cho stream featured trên trang
  chủ (`src/components/home/LiveSection.tsx:112`) — tức **mọi người đổ vào `/`
  đêm live đều thấy player nhỏ này**.
- User lướt trang chủ, player home phát vài giây (tap-to-play), đốt hết 15s
  preview ngay trên ô nhỏ mà họ chưa định xem nghiêm túc.
- Họ bấm vào `/live/:id` để xem thật → **dính tường đăng nhập tức thì, 0 giây
  preview** trên trang xem chính. Nhiều người bounce.
- Vài ngày sau: signup từ overlay không tăng như kỳ vọng (thậm chí giảm giờ xem),
  nhưng nhìn số liệu thì "gate hoạt động" nên khó quy tội.

**Cơ chế**
`useLivestreamGate` khoá "đã xem preview" bằng localStorage key **chỉ theo
livestreamId**: `src/hooks/useLivestreamGate.ts:20-38` (`pkl_preview_seen_<id>`),
đánh dấu seen khi đếm về 0 (`:77`). Cả hai bề mặt gọi **cùng một hook với cùng
id**:
- Homepage: `src/components/home/HomeLivePlayer.tsx:46-52` (previewSeconds mặc
  định 15).
- Trang xem: `src/pages/WatchLive.tsx:67-73`.

⇒ preview đốt ở đâu cũng ghi chung một key ⇒ trang xem đọc `hasSeenPreview()` =
true (`:24-30, :55-61`) ⇒ gated ngay. Proposal thêm "gate homepage thật" +
"persist start-time" biến kịch bản này từ hiếm thành **gần như chắc chắn** đêm
live (ai vào `/` cũng chạm player home trước).

Ba thứ vô hại: (1) key gate không phân biệt bề mặt, (2) homepage giờ arm gate
thật, (3) trang chủ là cửa vào chính đêm live → preview bị tiêu ở nơi user chưa
định xem.

**Vì sao mọi gate vẫn xanh**
- Đúng đặc tả: "persist preview để reload không reset 15s" — key dùng chung
  chính là cơ chế được yêu cầu, không phải bug theo checklist.
- Test tay điển hình: dev mở thẳng `/live/:id` (không qua homepage) → thấy đủ 15s
  preview → xanh. Không ai test luồng `/` → click card → `/live/:id` liên tục.
- CI/soak: zero test cho `useLivestreamGate` (`round1/idea-recon.md:38`); visual
  chỉ `/live` hub, không phủ trạng thái overlay
  (`tests/visual.spec.ts:41`).
- Panel duyệt logic gate đúng từng file; sự cố nằm ở **chỗ nối hai bề mặt**, không
  file nào sai một mình.

**Ai báo, sau bao lâu**
Không phải bug-report — là "conversion không lên". Lộ qua số signup/giờ xem sau
đêm live, tính bằng ngày. User Việt bực thì chửi trên Facebook ("mới bấm vô đã bắt
đăng nhập") chứ không mở ticket.

**Vì sao khó sửa**
Revert được (mất tính năng gate-home + persist). Sửa đúng cần tách key theo bề mặt
hoặc chỉ tính preview trên trang xem — nhưng dữ liệu đã mất là **những signup lẽ ra
có** đêm đó; không phục hồi. Niềm tin "gate là phễu" bị nghi ngờ.

**Dấu hiệu sớm lẽ ra phải có**
Tracking overlay (đã có trong scope) sẽ cho thấy tỉ lệ **gate hiện ở giây 0** trên
`/live/:id` cao bất thường — nhưng chỉ hữu ích nếu ai đó nhìn phân bố thời-điểm-
gate, không chỉ đếm click. Rẻ nhất: log `secondsWatchedBeforeGate`; nếu phần lớn =0
là chuông báo preview bị tiêu nơi khác.

---

## Xếp hạng (xác suất × độ khó phát hiện)

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|-------|----------|---------------|---------|
| 1 | Video view telemetry đứng im 3 tuần | cao | rất cao (im lặng, mất data vĩnh viễn) | **P0** |
| 2 | Presence-gated là no-op, "fix" giả | TB-cao | cực cao (trông như đã fix) | **P0/P1** |
| 3 | Homepage đốt preview → gate giây-0 đêm live | cao | TB (lộ qua conversion vài ngày) | **P1** |

Cái tệ nhất là **Sự cố 1**: thảm hoạ dữ liệu im lặng — không exception, không
alert, mất 3 tuần view_events video không lấy lại được. Sự cố 2 xếp ngang vì nó
tệ theo kiểu khác: không mất data nhưng **đóng một bug thật dưới vỏ "đã fix"**,
ăn mòn niềm tin vào mọi số presence. Sự cố 3 hữu hình hơn (đo được qua conversion)
nên dễ bắt hơn.

## Rẻ nhất để chặn từ bây giờ
1. **Sự cố 1:** khi thêm cờ vào `useIntervalViewCounter`, để param **required**
   (không default) — TS sẽ đỏ ở cả 3 caller video, buộc quyết định tường minh.
   Kèm một test render `WatchVideo` xác nhận hook vẫn đếm cho `target_type='video'`.
2. **Sự cố 2:** một test khẳng định presence `track` được gọi LẠI khi `isGated`
   chuyển true — nó đỏ ngay hôm nay, phơi bày rằng "gated trong payload" là no-op
   trước khi ship.
3. **Sự cố 3:** một guard/log `secondsWatchedBeforeGate` + tách hoặc phân-biệt key
   localStorage giữa homepage và trang xem (thêm prefix bề mặt vào `getSeenKey`).

## Khoảng hở của pipeline mà bài này lộ ra
- **Gate CI không phủ hook dùng chung ngoài scope.** Ba caller video của
  `useIntervalViewCounter` nằm ngoài diff mà không check nào ép nhìn tới. Đề nghị
  cho `/idea`: khi một hook/dùng-chung bị đổi chữ ký, liệt kê **mọi caller** và
  yêu cầu risk-auditor/architect xác nhận từng caller — param mới nên required.
- **Soak + visual mù bề mặt.** Soak chỉ chạy livestream; visual chỉ `/live` hub
  (`tests/visual.spec.ts:41`). Không có gate nào chạm `/watch/:id`, `/embed/*`,
  luồng `/`→`/live/:id`, hay admin viewer panel — đúng ba nơi ba sự cố sống. Đề
  nghị: thêm ít nhất một soak-path đi từ homepage vào watch page, và một smoke đọc
  số row `view_events` theo `target_type` trước/sau.
- **Không ai đo "feature có thật sự làm gì không".** Sự cố 2 qua mọi gate vì gate
  chỉ kiểm tra "field có tồn tại", không kiểm tra "field có đúng giá trị runtime".
  Panel nên có bước: với mỗi claim "payload phản ánh trạng thái X", đòi một assert
  runtime rằng giá trị đổi khi X đổi.
