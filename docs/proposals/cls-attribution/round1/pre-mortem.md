# Pre-mortem — cls-attribution

Viết ngày 2026-08-09, **giả định feature đã ship 3 tuần trước và đã hỏng**. Ba câu chuyện, ba cơ chế khác nhau. Mọi mắt xích trỏ tới file có thật trong repo; hậu quả là hư cấu, cơ chế thì không.

Phạm vi feature giả định đã ship: (a) đăng ký GA4 dims `cls_shift_target` / `cls_load_state`, (b) harness repro CLS bằng Playwright + PerformanceObserver, (c) fix layout `src/pages/WatchLive.tsx` + `src/pages/Login.tsx`, (d) `onCLS(..., { reportAllChanges: true })` trong `src/lib/webVitalsRum.ts`.

---

## Sự cố 1 — "Chat chết và mất 'đang xem' suốt hiệp cuối giải lớn, chỉ trên điện thoại"

**Xác suất:** trung bình-cao (chỉ cần một đêm giải đông) · **Thời gian tới lúc phát hiện:** 20-40 phút, nhưng đúng vào 40 phút đắt nhất trong quý

### Timeline

- **T+0 (19:05, đêm chung kết):** stream lên sóng, khán giả mobile VN đổ vào `/live/<id>`. Mỗi người mở nhiều Realtime channel hơn trước bản fix, nhưng không ai đo lại vì "quota đã verify 06/08".
- **T+18':** peak concurrent connections vượt ngưỡng project. Người vào sau bị `subscribe()` timeout.
- **T+22':** khán giả đến sau thấy khung chat trống trơn (đã reserve chỗ đẹp đẽ, không skeleton, không lỗi) và badge "đang xem" biến mất — đúng triệu chứng mà #555 (`4353d6fc`) vừa đóng.
- **T+25':** người đang xem từ trước vẫn thấy chat chạy bình thường → Cuong mở máy mình kiểm tra thì **mọi thứ ổn**.
- **T+40':** một khán giả chửi trên Facebook page kèm ảnh chụp màn hình chat trống.
- **T+3 ngày:** dashboard Supabase → Usage mới cho thấy đường peak connections dựng đứng đúng tối đó.

### Cơ chế

`src/pages/WatchLive.tsx:371-379` → panel chat mobile hiện đang **unmount khi thu gọn** (`{!isChatCollapsed && ...}`), nên bung/thu nó đổi chiều cao 400px → đây chính là "shift lớn" mà bất kỳ ai đọc code cũng chọn để fix. Cách fix rẻ nhất và tự nhiên nhất: giữ panel **luôn mounted**, ẩn bằng CSS (`hidden` / `max-h-0`) để chỗ được reserve sẵn.

`src/components/chat/ChatPanel.tsx:272-296` → mọi hook chạy **trước** early-return: `useLiveChat`, `useChatLeaderboard`, `useChatHighlights`, `useChatMessageLikes`. Ẩn bằng CSS không cắt được hook nào.

`src/hooks/useChatMessages.ts:128` → mỗi instance tạo channel riêng `chat:unified:<id>:${uniqueChannelSuffix()}` — **không có registry refcount**. Đối chiếu `src/hooks/useLivePresence.ts:13-16`, presence *có* registry refcount và comment giải thích tại sao; chat thì không, và suffix ngẫu nhiên khiến realtime-js không dedupe được.

`src/components/chat/ChatPanel.tsx:642-651` → mỗi instance còn mở thêm channel thứ hai `chat_pin:<id>:<random>`.

Cộng lại, một khán giả mobile:
- trước fix: 1 (ChatPanel header-controls ở `WatchLive.tsx:369`) × 2 channel + presence share = **3 connection**
- sau fix: 2 ChatPanel luôn mounted × 2 channel + presence = **5 connection** (+67%)

`docs/proposals/live-viewer-count-comparison/proposal.md:151` → quota verify 06/08: **peak 43/500 connection (9%)**, và chính doc đó viết "mở lại khi peak tiến gần 300-400". 43 đó đo vào một tối thường. Đêm giải lớn ×5 khán giả = ~215 ở kiến trúc cũ (an toàn), ×1.67 vì bản fix = **~360**, và mỗi tab/thiết bị/lần reload cộng thêm. Ngưỡng không phải 500 tuyệt đối — nó là chỗ Realtime bắt đầu từ chối và retry backoff (`useLivePresence.ts:36-37`, max 10 lần, delay tới 30s) khiến cả presence lẫn chat cùng chết.

Chưa kể mỗi ChatPanel còn tự chạy batch fetch profile riêng (`ChatPanel.tsx:317-340`, debounce 2s, 20 id/lượt) → REST QPS cũng ×2.

### Vì sao mọi gate vẫn xanh

- **Panel duyệt:** diff là "bọc panel trong div ẩn thay vì unmount" — đọc như một thay đổi CSS thuần. Không ai truy từ `WatchLive.tsx:373` xuống `useChatMessages.ts:128` để đếm channel; đó là 3 file cách nhau.
- **CI:** không có test nào đếm số Realtime channel. `src/lib/__tests__/layout-stability-surfaces.test.ts` chỉ so string. Playwright `mobile-webkit` (`docs/ops-runbook.md:315-317`) mở **một** trang với **một** viewer — 5 connection của 1 người không phá gì cả.
- **Soak 30 phút:** `scripts/agents/soak-watch.mjs` theo dõi `client_errors` theo signature (`docs/ops-runbook.md:349+`). `subscribe()` timeout của supabase-js **không throw** — nó gọi callback với status `TIMED_OUT`/`CHANNEL_ERROR`. Không có exception → không có row `client_errors` → soak sạch tuyệt đối.
- **Quan trọng nhất:** lỗi là hàm của **tải đồng thời**, không phải hàm của code path. Soak chạy lúc 2 giờ sáng với 0 khán giả. Mọi gate của pipeline này đo một-người-một-lúc.

### Ai báo, sau bao lâu

Khán giả trên Facebook, ~40 phút. Không phải alert — không có alert nào cho "Realtime từ chối connection". `ops_cron_alert_state` không phủ Realtime; Telegram bot chỉ nghe `client_errors`.

### Vì sao khó sửa

`git revert` sửa được code (tier AMBER theo `scripts/agents/risk-tier.mjs`), nhưng: (1) trận chung kết đã qua, chat của nó mất vĩnh viễn — không có "dữ liệu hỏng" nào để phục hồi, có **sự kiện** không lặp lại; (2) chẩn đoán mới là chỗ tốn thời gian: triệu chứng ("chat trống") trùng khít với sự cố Realtime cũ 08/07 và với PGRST002 02/08, nên 2 giờ đầu sẽ đi tìm ở Supabase status page chứ không ở PR CLS ba tuần trước; (3) đúng cái badge "0 đang xem" vừa được sửa hai ngày trước lại xuất hiện → niềm tin vào #555 mất theo.

### Dấu hiệu sớm lẽ ra phải có

Một dòng duy nhất: log `supabase.getChannels().length` khi vào `/live` trong DEV, hoặc một assert trong test render rằng /live mobile mở đúng N channel. Không tồn tại. Dashboard Realtime Usage có số nhưng chỉ được đọc thủ công, một lần, ngày 06/08, và kết luận "9%, thoải mái" đã trở thành sự thật đóng băng.

---

## Sự cố 2 — "CLS %good VN+mobile nhảy 32% → 89% sau một đêm; ba tuần sau CrUX vẫn 0.67 và Google vẫn đánh Failed"

**Xác suất:** cao (gần như chắc chắn nếu (d) ship) · **Thời gian tới lúc phát hiện:** 30-60 ngày, và cửa sổ dữ liệu mất là **vĩnh viễn**

### Timeline

- **T+0:** deploy. `src/lib/webVitalsRum.ts:285` đổi `onCLS(report)` → `onCLS(report, { reportAllChanges: true })`.
- **T+1 ngày:** GA4 realtime hiển thị event `web_vital` tăng ~15-40× trên các phiên `/live`. Không ai nhìn — GA4 event count không có ngưỡng cảnh báo, và số tăng được đọc là "instrumentation mới đang chạy tốt".
- **T+7 ngày:** đọc predicate PERF-05B (`docs/milestones.md:16`): `%good = count(rating=good) / count(all)`. Kết quả **89% good**. Vượt xa mục tiêu 75% ghi trong `00-intake.md:9`.
- **T+8 ngày:** mốc tick `[x]`, proposal đóng "SHIPPED", lessons-learned ghi "fix reserve-space trên /live hiệu quả".
- **T+30 ngày:** đọc CrUX theo thói quen → **CLS p75 mobile vẫn 0.67, PSI vẫn Failed**. Mâu thuẫn trực diện với GA4.
- **T+31 ngày:** điều tra. Phát hiện không thể tái dựng số cũ, vì không dedupe được theo phiên.

### Cơ chế

`src/lib/webVitalsRum.ts:285` → với `reportAllChanges`, `onCLS` gọi callback **mỗi lần CLS thay đổi**, không phải một lần lúc trang ẩn.

`src/lib/webVitalsRum.ts:278-283` → mỗi callback đi thẳng vào `trackEvent("web_vital", ...)`. Không throttle, không buffer.

`src/utils/ga.ts:32-38` → mỗi lần gọi là **một gtag event riêng biệt**. GA4 không biết chúng thuộc cùng một phép đo.

**Đây là mắt xích giết người:** CLS **tích luỹ đơn điệu tăng**. Report đầu tiên trong phiên có value ~0.01 → `metric_rating: "good"`. Report thứ hai 0.03 → good. … Report cuối cùng 0.68 → poor. Một phiên `/live` dài 25 phút với chat chạy liên tục sinh ra ví dụ 40 report: **37 good, 2 needs-improvement, 1 poor**. Trước fix, phiên đó đóng góp đúng **1 event, rating = poor**.

`docs/perf-05-report-2026-07-28.md:47-48` định nghĩa cứng: "%good ≥75% ⇔ p75 đạt target". Quy tắc đó **chỉ đúng khi mỗi phiên đóng góp một mẫu**. `reportAllChanges` phá đúng tiên đề đó, và tệ nhất: nó thiên vị theo hướng **có lợi** — trang càng tệ, phiên càng dài, càng nhiều report "good" đầu phiên được bơm vào mẫu số. Trang `/live` — thủ phạm 78% poor — trở thành trang **đóng góp nhiều "good" nhất**.

Ba lớp không thể phục hồi:

1. `src/lib/webVitalsRum.ts:157` gửi `metric_id` (duy nhất mỗi phép đo) nhưng `metric_id` **chưa bao giờ được đăng ký làm custom dimension** — `docs/perf-05-report-2026-07-28.md:45-47` liệt kê chỉ `metric_name` + `metric_rating` được thêm 28/07. Không có `metric_id` trong GA4 UI ⇒ **không dedupe hậu kỳ được**.
2. `docs/perf-05-report-2026-07-28.md:39-43` — custom dimension GA4 **không hồi tố**. Đăng ký `metric_id` hôm nay chỉ cứu được từ hôm nay; 30 ngày đã thu là rác vĩnh viễn.
3. **Cardinality:** `src/lib/webVitalsRum.ts:181` cắt `largestShiftTarget` còn 100 ký tự nhưng không hạ cardinality. Với `reportAllChanges`, mỗi shift trong chat sinh một selector khác nhau (`...div:nth-child(37)`, `:nth-child(38)`…). GA4 đẩy các hàng vượt ngưỡng cardinality vào `(other)` — và một khi báo cáo dính `(other)`, chính cái dimension vừa đăng ký để tìm thủ phạm trở nên vô dụng **đúng trên trang cần nó nhất**. Không có lỗi, không có cảnh báo, chỉ là một hàng tên `(other)`.

Phụ phẩm: `src/utils/ga.ts:38` `console.log` **mỗi event, trong production**. Vài nghìn dòng log giữ tham chiếu tới object params trong một tab Safari mở 25 phút.

### Vì sao mọi gate vẫn xanh

- **Panel duyệt:** `reportAllChanges` là gợi ý được viết sẵn trong `docs/perf-05-report-2026-07-28.md:59-60` bởi chính báo cáo PERF-05. Nó **đã được một tài liệu nội bộ chuẩn thuận**. Reviewer đọc thấy "làm đúng theo khuyến nghị" và duyệt.
- **CI:** `src/lib/__tests__/webVitalsRum.test.ts` test `buildWebVitalEvent` — một hàm **thuần**, nhận metric và trả object. Nó không biết callback được gọi bao nhiêu lần. Chữ ký hàm không đổi, mọi test xanh. Đây là điểm mù cấu trúc: bug nằm ở **tần suất gọi**, test phủ **nội dung một lời gọi**.
- **Soak 30 phút:** không có exception nào. Đây là hỏng **kiểu dữ liệu-đúng-về-cú-pháp**; `client_errors` trống hoàn toàn.
- **Bundle budget:** không đổi byte nào (`docs/ops-runbook.md:276-291`).
- Và tầng cuối: bản thân **số liệu dùng để nghiệm thu đã bị chính bản deploy đó làm hỏng**. Gate cuối cùng của pipeline này là "đọc GA4 sau 7 ngày" — và đó là gate mà lỗi này ăn thẳng vào.

### Ai báo, sau bao lâu

Không ai. Không có user-facing symptom. Chỉ được phát hiện khi ai đó **tình cờ** đối chiếu với CrUX/PSI — một hành động không nằm trong predicate nào. 30-60 ngày là lạc quan; nếu không có thói quen mở PSI thì nó sống mãi.

Có một cảnh báo lịch sử đã bị bỏ qua: `ce5da34c` (30/07) ghi trong commit message "Confirmation via GA4 `cls_shift_target`/`cls_load_state` (#502)" — nhưng hai dim đó **chưa bao giờ được đăng ký** (`00-intake.md:14`). Nghĩa là 3 tuần trước đã có một fix CLS tuyên bố "xác nhận qua GA4" trong khi kênh xác nhận đó không tồn tại. Không ai bắt lỗi. Vòng lặp verify của lĩnh vực này đã hỏng sẵn từ trước bản fix này.

### Vì sao khó sửa

`git revert` gỡ được `reportAllChanges` trong 5 phút. Nhưng:
- 30 ngày dữ liệu GA4 **không dựng lại được** (không hồi tố + không có `metric_id` dim).
- Không thể biết bản fix layout (c) có tác dụng hay không, vì cửa sổ đo trùng khít cửa sổ nhiễm bẩn → phải **đợi thêm 28 ngày** sau khi revert mới có baseline sạch.
- Mốc PERF-05B đã tick `[x]` với bằng chứng sai; roadmap đã ghi CLS "đóng". Sửa lại một kết luận đã công bố tốn nhiều hơn sửa code.
- Và câu hỏi gốc — "phần tử nào gây shift trên /live" — vẫn chưa có câu trả lời sau 2 tháng.

### Dấu hiệu sớm lẽ ra phải có

- Một dòng trong PR: `n` mẫu CLS VN+mobile **trước và sau**. Nếu n nhảy từ ~210/7 ngày (`docs/perf-05-report-2026-07-28.md:30-33`) lên 8.000, đó là cờ đỏ đọc trong 5 giây.
- Đăng ký `metric_id` làm dimension **cùng lúc** với hai dim kia — chi phí bằng 0, và nó là bảo hiểm duy nhất cho phép dedupe hậu kỳ.
- Predicate PERF-05C lẽ ra phải viết "%good tính theo **phiên**" chứ không "theo event". Cách viết hiện tại giả định ngầm 1 phiên = 1 event, và giả định đó không được ghi ở đâu cả.

---

## Sự cố 3 — "Bản fix CLS biến mất khỏi production mà không ai nhận ra, vì gate duy nhất canh nó đang xanh nhờ file chưa commit"

**Xác suất:** trung bình-cao (điều kiện khởi phát **đang tồn tại ngay lúc này** trong working tree) · **Thời gian tới lúc phát hiện:** không bao giờ, bằng cơ chế hiện có

### Timeline

- **T-0 (hôm nay, 09/08 20:02):** commit `53a4476b` "test(layout): pin `fit:"contain"` in LiveSection thumb contract" landed.
- **T+0:** tác giả bản fix CLS làm việc trên working tree đang bẩn (27 file `M`, gồm **chính** `src/pages/WatchLive.tsx` và `src/components/video/MuxPlayer.tsx`), chạy `npm run test` → **xanh**, chạy `npm run build` → xanh.
- **T+1 giờ:** commit **chỉ** những hunk thuộc bản fix (thói quen bắt buộc của repo này — `git add -u` từng nuốt file bẩn của phiên khác), mở PR.
- **T+2 giờ:** CI `quality.yml` chạy `npm run test` trên checkout sạch → **đỏ**, `layout-stability-surfaces.test.ts` fail.
- **T+2 giờ 5 phút:** đỏ được phân loại là "drift đã biết, không liên quan PR này" — và **phân loại đó đúng về nguyên nhân**, sai về hệ quả. Merge.
- **T+3 tuần:** nhánh `wip/native-chat-and-news-rewrite` merge vào main. Vùng `scheduledPoster` / player wrapper trong `WatchLive.tsx` bị viết đè theo phiên bản WIP. Bản fix reserve-space biến mất khỏi 2 trong 3 chỗ.
- **T+3 tuần + 1 ngày:** không có gì xảy ra. Không alert, không user complaint, CLS trên GA4 vẫn "89% good" (xem Sự cố 2).

### Cơ chế

`src/lib/__tests__/layout-stability-surfaces.test.ts:6` → `const source = (path) => readFileSync(resolve(root, path), "utf8")`. Test **đọc working tree**, không đọc HEAD, không đọc DOM render.

`src/lib/__tests__/layout-stability-surfaces.test.ts:22` (tại HEAD) khẳng định:
```
expect(live).toContain('{ width: 768, height: 432, fit: "contain" }');
```
`git show HEAD:src/components/home/LiveSection.tsx` dòng 87 (tại HEAD):
```
const mainThumb = main ? streamThumb(main, { width: 768, height: 432 }) : undefined;
```
**Không có `fit: "contain"`.** Chuỗi chỉ tồn tại trong diff **chưa commit** (`git diff src/components/home/LiveSection.tsx`, dòng 88 của working tree).

⇒ Gate ổn-định-layout duy nhất của repo **đang xanh trên máy Cuong và đỏ trên mọi checkout sạch**, ngay lúc này, trước khi feature CLS bắt đầu. Đó không phải giả thuyết: hai lệnh trên chạy được và cho đúng kết quả đó.

Hai đặc tính của chính test này biến nó thành gate giả cho bản fix CLS:
1. Nó pin **string literal**, không pin hình học. Thêm `expect(watchLive).toContain('min-h-[400px]')` sẽ xanh ngay cả khi class đó nằm trong nhánh JSX không bao giờ render trên mobile.
2. Nó đọc file trên đĩa ⇒ trên máy dev, nó xác nhận **working tree bẩn**, không xác nhận cái sắp được push.

Tầng thứ ba, văn hoá: repo này đang sống chung với gate đỏ kinh niên — `docs/ops-runbook.md:238-255` (§5.5) dạy hẳn quy trình "nghi deploy-race trước khi nghi code, `gh run rerun --failed` trước", deploy-guard đỏ mọi commit main từ 04/08 vì migration drift, quality coverage đỏ 75%<83%. Một đỏ nữa trong biển đỏ không đổi hành vi ai cả. `visual.yml:66` thì `continue-on-error: true` theo thiết kế — pixel-diff, thứ **duy nhất** thực sự có thể thấy layout thay đổi, là advisory.

### Vì sao mọi gate vẫn xanh

Câu hỏi ở đây ngược lại: gate **đỏ**, và đỏ vẫn không chặn được gì.

- Test xanh trên máy tác giả (working tree bẩn) → tác giả tin bản fix được canh.
- Test đỏ trên CI vì **một lý do thật sự không liên quan** (`LiveSection` literal) → tín hiệu đúng bị nuốt bởi nguyên nhân sai. Đây là điều kiện hoàn hảo để dismiss.
- Soak 30 phút chạy trên deploy **có** bản fix (T+0), sạch. Ba tuần sau khi WIP merge xoá nó đi, chẳng có soak nào chạy — soak gắn với PR, không gắn với "vùng code này còn nguyên không".
- `risk-tier.mjs` xếp `src/pages/*.tsx` là AMBER "revert được" — đúng, nhưng vấn đề không phải revert, mà là **fix bị revert ngoài ý muốn**. Không có tier nào cho "thay đổi này có thể bị merge sau xoá âm thầm".

### Ai báo, sau bao lâu

Không ai, và đây là điểm khác biệt so với hai sự cố kia: không có triệu chứng nào để báo. CLS quay lại mức cũ, người dùng VN vẫn chịu trang nhảy như 6 tháng qua — họ không biết đã từng có bản fix. Google giữ nguyên "Failed". Phát hiện chỉ đến khi có người lật lại `WatchLive.tsx` cho một /idea khác và hỏi "ủa, cái min-height reserve hồi đó đâu rồi?".

Tiền lệ trong repo: memory ghi nhánh job-health từng **mất 11 commit** vì rewrite; `--delete-branch` từng giết PR con; squash-merge làm `git merge-base --is-ancestor` báo sai nên không ai truy được. Cơ chế này đã bắn trúng repo này ít nhất hai lần rồi.

### Vì sao khó sửa

Không có gì để revert — code chỉ đơn giản là không còn ở đó. Phải đọc lại diff của PR cũ và **áp tay lại** lên `WatchLive.tsx` phiên bản mới (đã bị WIP viết lại). Tệ hơn: 3 tuần GA4 "sau fix" giờ mô tả một prod **không có fix** trong 0-21 ngày cuối, nghĩa là ngay cả khi Sự cố 2 không xảy ra, dữ liệu đo vẫn vô nghĩa. Hai sự cố này nhân với nhau chứ không cộng.

### Dấu hiệu sớm lẽ ra phải có

- `git stash list` / `git status --short` trong mọi lệnh "chạy test để verify" — nếu tree bẩn, kết quả test không nói gì về cái sắp push. Một dòng guard trong test: `if (execSync('git status --porcelain <file>')) throw` là đủ.
- Đổi `layout-stability-surfaces.test.ts` từ `readFileSync` sang render thật + assert `getBoundingClientRect` ổn định — nhưng đó là công việc lớn; rẻ hơn nhiều: cho `visual.yml` **hard-gate** đúng route `/live/<id>` mobile.
- Sửa `53a4476b` ngay hôm nay: hoặc commit `LiveSection.tsx`, hoặc revert dòng pin. Để nguyên là để một mồi lửa nằm sẵn trong hộp diêm.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 2 | `reportAllChanges` làm hỏng chính thước đo nghiệm thu → tuyên bố "đã fix" sai, mất vĩnh viễn 30 ngày dữ liệu | **Cao** (gần chắc nếu (d) ship) | **Rất cao** — 30-60 ngày, chỉ lộ nếu ai đó tình cờ mở CrUX | **P0** |
| 3 | Fix biến mất khi WIP merge; gate duy nhất xanh-nhờ-file-chưa-commit | Trung bình-cao (điều kiện đã tồn tại ngay bây giờ) | **Tối đa** — không có triệu chứng nào cả | **P1** |
| 1 | Realtime channel ×1.67/viewer → chat + presence chết đêm giải lớn | Trung bình-cao | Thấp (40 phút, có người chửi) | **P2** |

**Vì sao #2 tệ hơn #1 dù #1 mới là "outage thật":** #1 đau 40 phút rồi hết, và nó **tự tố cáo** — có người la, có log, có đường sửa. #2 không đau một giây nào, nhưng nó biến toàn bộ nỗ lực CLS thành nghi thức: bạn tick mốc, đóng proposal, ghi lessons-learned, và trang vẫn nhảy y như cũ suốt hai tháng. Nó còn tiêu huỷ khả năng **biết** — 30 ngày dữ liệu không hồi tố là thứ `git revert` không lấy lại được. #3 xếp trên #1 vì cùng lý do và vì điều kiện khởi phát đã nằm sẵn trong working tree hôm nay.

Lưu ý cấu trúc: #2 và #3 **nhân** với nhau. Nếu cả hai xảy ra, GA4 báo 89% good cho một production không hề chứa bản fix. Đó là kịch bản tệ nhất có thể của đề tài này.

---

## Rẻ nhất để chặn từ bây giờ

1. **Đăng ký `metric_id` làm GA4 custom dimension cùng lúc với `cls_shift_target`/`cls_load_state`** — chi phí 2 phút trong GA4 UI, 0 dòng code. Đây là thứ duy nhất cho phép dedupe hậu kỳ nếu `reportAllChanges` ship. Không có nó, dữ liệu hỏng là hỏng vĩnh viễn (`docs/perf-05-report-2026-07-28.md:39-43`).
2. **Nếu ship `reportAllChanges`: chỉ bật cho `import.meta.env.DEV` hoặc sau một query-param `?cls_debug=1`, không bật trên prod.** Nó là công cụ **debug**, không phải công cụ **đo**. Và ghi vào PR body con số `n` mẫu CLS VN+mobile trước/sau — một dòng, đọc 5 giây, bắt trọn Sự cố 2.
3. **Sửa `layout-stability-surfaces.test.ts:22` hôm nay** (commit `LiveSection.tsx` hoặc gỡ dòng pin), rồi thêm một assert đếm channel: một test render `/live` mobile assert `supabase.getChannels().length` không tăng. Hai việc này chặn Sự cố 3 và Sự cố 1 bằng tổng cộng ~15 dòng.

---

## Khoảng hở của pipeline mà bài này lộ ra

1. **Không gate nào đo tần suất, chỉ đo nội dung.** `webVitalsRum.test.ts` test một hàm thuần; test không thể thấy callback được gọi 40 lần thay vì 1. Cả ba sự cố ở trên đều là bug về **số lượng** (số event, số channel, số lần code còn tồn tại), và pipeline này không có ô nào để tick cho số lượng.
2. **Soak 30 phút chỉ nghe exception.** `soak-watch.mjs` so signature trong `client_errors`. Ba sự cố trên sinh ra **0 exception**. Đây là điểm mù có hệ thống, không phải rủi ro của riêng feature này: mọi hỏng-hóc-im-lặng (dữ liệu sai, quota, code bị xoá) đi qua gate này không xước.
3. **Soak/Playwright đo một-người-một-lúc.** Bất kỳ bug nào là hàm của concurrency chỉ hiện ra vào đúng đêm đông nhất. Không có gate tải, và với repo solo thì cũng không nên có — nhưng ít nhất phải có một **con số đếm được** (số channel/viewer) để nhân tay trước khi merge.
4. **Gate đọc working tree, không đọc commit.** `layout-stability-surfaces.test.ts` là ví dụ sống, đang đỏ-trên-CI xanh-trên-máy **ngay lúc này**. Mọi test kiểu `readFileSync(source)` đều mang lỗi này.
5. **Alarm fatigue là một gate đã hỏng.** deploy-guard đỏ mọi commit từ 04/08, quality coverage đỏ kinh niên, `visual.yml` advisory theo thiết kế, `docs/ops-runbook.md:238-255` dạy rerun trước khi nghi code. Trong môi trường đó, một CI đỏ **không còn là gate** — nó là nhiễu. Feature CLS này đặc biệt phụ thuộc vào gate thị giác, và gate thị giác là gate `continue-on-error`.
6. **Predicate nghiệm thu của mốc không được version cùng code.** PERF-05B viết "%good ≥75%" với giả định ngầm 1 phiên = 1 event. Một PR thay đổi cách đo có thể phá giả định đó mà không ai thấy, vì predicate sống trong `docs/milestones.md` còn giả định sống trong đầu người viết nó. Với `/idea`: khi feature **chạm vào chính công cụ đo**, phải có một bước bắt buộc "predicate còn đúng không?" — không có bước đó thì pipeline tự chấm điểm bằng thước do chính nó vừa bẻ cong.
