# ui-ux-critic — vòng 1 (độc lập)

> **Panel one-model-down.** Không lấy được ý kiến GPT-5.6 (Codex hết hạn mức tới
> 2026-08-08 12:00 — bằng chứng nguyên văn ở `external/ui-ux-critic-gpt56.md`).
> Toàn bộ dưới đây là Claude, KHÔNG có xác nhận chéo vendor khác.

## Đánh giá tổng thể

Câu hỏi Cuong đặt ra (Presence realtime vs heartbeat 30-60s) là câu hỏi **hạng hai**.
Ở hạng nhất: hiện tại có **8 bề mặt** hiển thị livestream, chỉ **2** trong đó có số
người xem thật; **3** bề mặt đang in cứng `viewerCount={0}` nên hiển thị badge
"**0 đang xem**" trên trận ĐANG PHÁT — đúng nghĩa là biển "không ai xem, đừng bấm";
và trang `/live` — điểm đến chính của live — không có số nào cả. Còn ở hạng hiển vi:
hero trang chủ **tự track chính nó vào phòng presence**, nên mọi người ghé trang chủ
mà không hề bấm play đều bị đếm là "đang xem". Số hiện tại không phải "người đang xem"
mà là "tab có mở trang có nhắc tới trận này". Về trải nghiệm, độ trễ 30-60s **không
phải** vấn đề của người xem VN — hai thứ trên mới là. Chốt: khác biệt UX giữa A và B
gần bằng 0 nếu B có optimistic +1; khác biệt thật nằm ở **ai được đếm** và **bề mặt nào
có số**.

## Luồng người dùng

Thực tế deep-link (95% VN, 4G, một tay, cạnh sân ồn):

```
Facebook/Zalo link → / (trang chủ)  ─┬→ hero "XEM NGAY" → /live/:id → xem
                                     └→ (không bấm gì, rời đi)   ← VẪN BỊ ĐẾM LÀ VIEWER
Facebook/Zalo link → /live/:id trực tiếp → gate đăng nhập (30s preview) → xem
/tournaments/:slug → mục "Đang trực tiếp" → thấy "0 đang xem" → KHÔNG BẤM → thoát
/live (trang list)  → không có số nào → không có tín hiệu chọn trận nào
```

Điểm rời đi quan trọng nhất là dòng thứ 3: người dùng tới từ trang giải, thấy card live
ghi "0 đang xem", suy ra trận chán/hỏng, không bấm. Đây là chỗ số người xem có **giá trị
kinh tế** cao nhất (social proof lúc quyết định bấm) và cũng là chỗ Cách A hiện không
phục vụ được — vì gắn Presence vào từng card nghĩa là mở 1 websocket/card trên 4G.
Bằng chứng: `LiveCardWithPresence.tsx` đã được viết ra để làm đúng việc đó và **hiện
không được import ở đâu cả** (dead code, 0 consumer). Ai đó đã thử và đã bỏ.

### Bảng hiện trạng theo bề mặt (đo được, không suy đoán)

| Bề mặt | File:line | Nguồn số | Hiển thị thực tế |
|---|---|---|---|
| Hero trang chủ | `LiveBroadcastHero.tsx:151,222` | Presence thật | ẩn khi 0; `toLocaleString("en-US")` |
| Trang xem | `WatchLive.tsx:75,410` | Presence thật | `"—"` khi chưa connect |
| Trang giải, mục live | `TournamentDetail.tsx:166` | **hardcode 0** | **"0 đang xem"** trên card LIVE |
| Trang tổ chức, mục live | `OrganizationDetail.tsx:236` | **hardcode 0** | **"0 đang xem"** |
| Sidebar "Đang phát" | `WatchLive.tsx:564` | **hardcode 0** | **"0 đang xem"** |
| Tìm kiếm | `Search.tsx:168` | không truyền | badge ẩn (đúng, nhưng do may) |
| `/live` (list chính) | `Live.tsx` | không có | không có số |
| Native iOS | `apple/.../LiveView.swift:76` | không có | không có số; poll REST 20s |
| `LiveCardWithPresence` | — | Presence | **dead code, 0 import** |

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | 3 bề mặt prod in cứng `viewerCount={0}` trên card `status="live"`; `LiveCard.tsx:107` render badge khi `viewerCount !== undefined` nên `0` lọt qua → "0 đang xem" trên trận đang phát. Social proof đảo dấu, đây là mất click thật. | Sửa `LiveCard.tsx:107` thành `viewerCount !== undefined && viewerCount >= 3` (xem #6 về ngưỡng), VÀ bỏ hẳn 3 chỗ truyền `viewerCount={0}` (`TournamentDetail.tsx:166`, `OrganizationDetail.tsx:236`, `WatchLive.tsx:564`) — truyền `undefined` cho tới khi có nguồn số thật. Sửa ở `LiveCard` là fix gốc: mọi caller khác cùng được bảo vệ. |
| 2 | **Blocker** | Hero trang chủ `track()` chính nó vào `livestream_presence:<id>` (`LiveBroadcastHero.tsx:151`). Mọi khách trang chủ = 1 viewer, kể cả người không bấm play. Với site nhận traffic Facebook về `/`, đây nhiều khả năng là **nguồn lớn nhất** của con số. Con số đang nói dối một cách có hệ thống, và người xem kiểm chứng được: mở chat thấy 2 người trong khi badge ghi 23. | Hero **đọc** số, không **tham gia**. Cần chế độ observe-only: `useLivePresence(id, enabled, gated, { track: false })` — subscribe + đếm nhưng không `channel.track()`. Nếu không muốn đụng hook, giải pháp lười hơn: hero lấy số từ snapshot server (xem "Khuyến nghị"). Người xem ở trang `/live/:id` mới là viewer. |
| 3 | **Blocker (a11y)** | Tooltip giải thích con số không tới được bằng cả cảm ứng lẫn bàn phím. `LiveCard.tsx:108-118`: `TooltipTrigger asChild` bọc một `<div>` không `tabIndex` → không focus được (WCAG 2.1.1); và cả badge nằm **bên trong `<Link to="/live/:id">`** nên chạm vào badge = điều hướng, tooltip không bao giờ mở trên mobile. Với 95% user mobile, tooltip = trang trí. Cùng lỗi ở `WatchLive.tsx:405-418`. | Bỏ tooltip khỏi `LiveCard` hoàn toàn; nghĩa nằm luôn trong nhãn. Ở `WatchLive` (badge không nằm trong link) đổi sang `Popover` với `<button>` thật ≥44×44px, hoặc cũng bỏ và thêm `aria-label` đầy đủ. Không giữ `cursor-help` trên mobile. |
| 4 | Nên sửa | Người kẹt ở cổng đăng nhập vẫn được đếm là "đang xem". `countViewers()` (`useLivePresence.ts:41-43`) chỉ lọc `admin_watcher_*`; meta `gated: true` đã được track (`useLivePresence.ts:107`) nhưng không ai dùng để lọc số công khai. Người chưa qua gate không xem gì cả. | 3 dòng: đọc `presenceState()` theo entry, loại key có meta `gated === true` khỏi số công khai (admin list vẫn thấy đủ, đó là chỗ cần phân biệt). |
| 5 | Nên sửa | Ba bề mặt, ba trạng thái "chưa có số" khác nhau: hero ẩn hẳn, card in `0`, trang xem in `"—"`. `"—"` đọc như "hỏng" chứ không như "đang tải" — trên 4G yếu nó xuất hiện 1-3 giây mỗi lần vào trang, và lại xuất hiện mỗi lần reconnect (backoff 2s→30s ở `useLivePresence.ts:38`). | Một máy trạng thái duy nhất, xem mục "Trạng thái màn hình". Tóm tắt: chưa connect = **giữ chỗ rỗng** (skeleton pill trên card, spacer trong hero), mất kết nối = **giữ số cuối cùng, làm mờ**, không bao giờ in `0` hay `—`. |
| 6 | Nên sửa | Không có sàn hiển thị. Presence đếm cả chính người đang đọc màn hình, nên "1 đang xem" = "chỉ có mày". "2 đang xem" cũng gần như vậy. | Sàn = **3**. `n < 3` → ẩn badge (không phải hiện 0, không phải hiện "ít người"). `n >= 3` → hiện số chính xác. Ở quy mô này (1-50) không làm tròn, không dùng "~", không animate đếm lên. |
| 7 | Nên sửa | `concurrentViewers.toLocaleString("en-US")` hardcode ở `LiveBroadcastHero.tsx:229` → người Việt thấy `1,234` trong khi VI viết `1.234`. `formatViewers()` (`LiveCard.tsx:43-48`) cũng hardcode dấu chấm ở `1.2K`. | `toLocaleString(language === "vi" ? "vi-VN" : "en-US")`. Nhánh `>= 1000` ở quy mô hiện tại chưa bao giờ chạy — sửa cùng lúc hoặc bỏ luôn nhánh đó, đừng làm riêng một PR. |
| 8 | Nit | Hero: badge "pop-in" sau 1-3s. **Không gây CLS** — `.tl-lh-bar` là `space-between`, cụm `.tl-lh-meta` neo phải nên timecode không dịch (`the-line.css:734-798`). Nhưng vẫn là một mảnh nội dung nhấp nháy vào giữa vùng gần LCP. | Giữ chỗ bằng `visibility: hidden` thay vì unmount, hoặc chấp nhận. Ưu tiên thấp. |
| 9 | Nit | `LiveCardWithPresence.tsx` không được import ở đâu (`grep -rln` → chỉ chính nó). | Xoá file. Nếu chọn hướng snapshot ở dưới thì nó vĩnh viễn không có việc để làm. |

## Trả lời trực tiếp 4 câu hỏi được giao

### 1. Cần tươi tới mức nào? 30-60s có ai nhận ra không?

**Không, trừ đúng một trường hợp: sự xuất hiện của chính mình.** Ở quy mô 1-50 người xem,
người dùng không có cách nào đối chiếu con số với thực tế — trừ hai thứ: (a) hoạt động
trong chat, (b) việc chính họ vừa vào. (b) là chỗ duy nhất độ trễ trở thành vấn đề niềm
tin: vào trận, badge ghi "4 đang xem" và 30 giây sau vẫn "4" — người dùng biết chắc phải
là 5. Đây là lỗ hổng UX **duy nhất** của Cách B, và nó vá được bằng một thủ thuật rẻ:
**optimistic +1 phía client** (đếm chính mình ngay lập tức, để số server ghi đè ở nhịp
sau). Có nó rồi thì độ trễ 30-60s là vô hình với người xem VN.

Ngược lại, **flicker mới là thứ người dùng nhìn thấy được ngay**. Ở n=7, một tab
reconnect làm số nhảy 7→6→8 trong vài giây = dao động ~15%, và trên 4G VN yếu chuyện
reconnect là thường (retry backoff của chính ta là 2s→30s, `useLivePresence.ts:38`).
Một con số nhảy giật trước mắt đọc như "app đếm bậy", còn một con số đứng yên 45 giây
đọc như "app đang đếm". **Ở khía cạnh cảm nhận, B (mượt, cũ) thắng A (thật, giật).**

Kỹ thuật làm mượt được phép: giữ tối thiểu 10 giây giữa hai lần đổi số; không animate
đếm lên; không bao giờ animate đếm xuống. Không được phép: sàn giả (hiện "5+" khi thực
là 1), nhân hệ số, gộp lượt xem tích luỹ vào số concurrent.

### 2. count=0 / count thấp — hiện hay ẩn? Copy VI hiện tại ổn chưa?

**Ẩn dưới ngưỡng 3.** Chi tiết ở #1 và #6 trên. Nhắc lại phần quan trọng: hiện tại code
đang hiện `0` ở 3 bề mặt prod và đó là lỗi nặng nhất tìm được trong cả buổi review này —
nặng hơn bất kỳ điều gì liên quan tới cách tính.

Copy VI: **ổn nhưng chưa tối ưu.**
- `"đang xem"` (`vi.ts:3400`) đứng sau số, kèm icon `Users` — icon gánh nghĩa "người",
  nên "23 đang xem" đọc tự nhiên và ngắn. **Giữ.** ("23 người đang xem" đúng hơn về ngữ
  pháp nhưng dài thêm 5 ký tự trong một badge chật ở 390px — chỉ dùng cho `aria-label`.)
- Tooltip `"Số người đang xem trực tiếp ngay bây giờ"` (`vi.ts:3410`) **thừa**: "trực
  tiếp" + "ngay bây giờ" là lặp nghĩa, và câu này dịch từ EN thấy rõ. Rút gọn.
- Hero dùng nhãn `ĐANG XEM` viết hoa — hợp với ngôn ngữ typographic của TheLine. Giữ.
- `aria-label` ở hero (`LiveBroadcastHero.tsx:225`) đã đúng: "23 người đang xem". Nhưng
  `LiveCard` không có `aria-label` nào — screen reader đọc "23 đang xem", cụt.

### 3. Mạng di động VN yếu — ai đếm "ma" nhiều hơn?

**Cách A, rõ ràng và có cấu trúc**, vì hai lý do — một do ta tự gây ra, một do nền tảng:

- *Ta gây ra:* hero trang chủ track chính nó (#2). Ma này không phải "người rời đi chưa
  bị phát hiện" mà là "người chưa bao giờ xem". Nó lớn hơn mọi loại ma khác cộng lại, và
  nó là loại ma **người dùng phát hiện được** (badge 23 vs chat 2 người).
- *Nền tảng:* lợi thế "phát hiện rời đi tức thì" của Presence **phần lớn là lý thuyết
  trên mobile**. Khoá màn hình / chuyển sang Zalo → WebView giữ socket sống một lúc rồi
  OS mới treo; sau đó server Realtime còn phải chờ timeout của nó mới xoá key. Trên iOS
  Safari và Capacitor WebView, "rời đi" của A đã trễ sẵn hàng chục giây. B với
  `visibilitychange`/`pagehide` dừng heartbeat trễ tối đa một bucket.

Kết luận: **quyết định độ chính xác không nằm ở transport, mà nằm ở luật "ai được đếm"**
phía client — chỉ đếm khi (a) đang ở trang xem, (b) `document.visibilityState === "visible"`,
(c) player đã bắt đầu phát. Ba luật này áp được cho cả A lẫn B, và nếu áp thì cả hai đều
"đủ đúng" theo tiêu chuẩn của Cuong. Nếu không áp thì cả hai đều sai, chỉ khác kiểu sai.

Một điểm nữa nghiêng về B trên mạng yếu: một trang list 6 trận live theo cách A cần 6
websocket đồng thời trên 4G — tốn INP, tốn pin, và mỗi socket có vòng retry riêng.
Theo B (hoặc snapshot), 6 con số đi kèm đúng cái query đã có sẵn để render list, 0
kết nối thêm. Đây là lý do trang list hiện **không có số nào cả**, và là lợi ích UX
cụ thể nhất mà B mang lại.

### 4. Native có đáng thêm không?

**Đáng, nhưng chỉ khi số đến từ payload có sẵn — không đáng để thêm một websocket client
vào native chỉ vì một badge.** Lý do thật không phải là social proof (ở n≈10 nó yếu) mà
là **tính nhất quán giữa hai thiết bị**: cùng một trận, web hero ghi "23 ĐANG XEM", native
không ghi gì. Người dùng thấy hai câu trả lời khác nhau cho cùng một câu hỏi.

Và có một hệ quả ít ai để ý: **nếu native chỉ ĐỌC mà không THAM GIA, người xem trên native
sẽ vô hình trong con số của web.** Hai bề mặt sẽ mâu thuẫn nhau vĩnh viễn. Đây là lập luận
UX mạnh nhất ủng hộ một bộ đếm phía server (B, hoặc A+snapshot) thay vì presence thuần
client: chỉ có bộ đếm chung mới cho ra **một** con số cho **mọi** bề mặt.

Native đã poll REST 20 giây/lần khi ở tab Live (`LiveView.swift:106-115`). 20 giây là thừa
tươi cho một con số như thế này. Đường port ít rủi ro nhất: thêm một cột vào payload poll,
render bằng đúng máy trạng thái + ngưỡng 3 ở dưới. Không thêm dependency, không thêm socket.

## Trạng thái màn hình

Một máy trạng thái duy nhất, dùng chung cho web card / web hero / trang xem / native:

- **Connecting** (0 → ~1.5s, hoặc chưa có dữ liệu): **giữ chỗ, không chữ.** Card: skeleton
  pill ~56×20px ở đúng vị trí badge. Hero: spacer vô hình. Trang xem: spacer.
  *Vì sao skeleton chứ không spinner:* đây là một mẩu nội dung có kích thước biết trước,
  spinner ở đây là báo động cho một thứ không ai chờ. *Vì sao không `—`:* `—` đọc như
  "không có dữ liệu / hỏng", không phải "đang tải".
- **Connected, n ≥ 3**: `◉ 23 đang xem`. Đổi số tối đa 1 lần/10 giây. Không animate.
- **Connected, n < 3**: **ẩn hoàn toàn.** Không "0 đang xem", không "1 đang xem", không
  "ít người xem" (câu đó tệ hơn cả số 0 — nó phán xét trận đấu). Badge LIVE góc trên
  trái vẫn còn, đó mới là tín hiệu cần thiết.
- **Disconnected** (mất kết nối > 6s): **giữ số cuối cùng, giảm opacity ~0.55**, thêm
  `aria-label` "Số người xem có thể chưa cập nhật". Sau 60 giây mất kết nối liên tục thì
  ẩn hẳn. Không bao giờ về `—`, không bao giờ về `0`.
- **Ended**: ẩn concurrent, hiện tổng lượt xem — hiện tại đã đúng
  (`LiveCard.tsx:121`, `WatchLive.tsx:430`). Không đụng.
- **Offline (PWA / Capacitor)**: ẩn badge. Khi video đã không chạy được thì con số người
  xem là thứ ít quan trọng nhất trên màn hình; hiện một số cũ lúc đó chỉ làm người dùng
  nghi ngờ mọi thứ khác trên trang.

## Accessibility (WCAG 2.1 AA)

Đã kiểm: focus/keyboard path của badge, touch target, `aria-label`, live region, tương
phản (theo token), reduced motion.

- **FAIL 2.1.1 (Keyboard) + 2.5.x (target)** — tooltip ở `LiveCard.tsx:108-118` và
  `WatchLive.tsx:405-418`: trigger là `<div>`/`<span>` không focus được, và ở `LiveCard`
  còn nằm trong `<Link>` nên chạm = điều hướng. Nội dung tooltip không tới được bằng
  bàn phím lẫn cảm ứng. → Vấn đề #3.
- **FAIL 1.3.1 (nhẹ)** — badge ở `LiveCard` không có `aria-label`; screen reader đọc
  "23 đang xem" (cụt). Hero đã đúng (`LiveBroadcastHero.tsx:223-227`). → thêm
  `aria-label` như phần "Copy đề xuất".
- **PASS 4.1.3 (Status Messages)** — con số **không** có `aria-live`, và như vậy là
  **đúng**. Nếu thêm `aria-live="polite"`, VoiceOver sẽ đọc lại số mỗi lần đổi; theo
  cách A (đổi vài giây/lần) màn hình sẽ nói liên tục và trận đấu thành không nghe được.
  **Cảnh báo cho cả hai phương án: đừng thêm `aria-live` vào con số này.**
- **PASS 2.3.3 / prefers-reduced-motion** — `.tl-lh-eye` có tắt animation
  (`the-line.css:824-825`). Nếu thêm hiệu ứng đổi số thì phải nằm trong cùng media query
  đó. (Khuyến nghị: đừng thêm.)
- **Tương phản** — chưa đo bằng máy. `.tl-lh-viewers-lbl` dùng `--lh-fg-3` ở
  `font-size: 10.5px` uppercase (`the-line.css:739,819-822`) — bậc màu mờ nhất trên chữ
  nhỏ nhất là đúng hồ sơ rủi ro của một FAIL 1.4.3. Badge trên card dùng
  `bg-live/90` + `text-foreground` với `backdrop-blur` chồng lên ảnh thumbnail bất kỳ —
  cũng cần đo. **Việc cần làm: đo hai cặp này bằng axe/DevTools trước khi ship bất kỳ
  thay đổi nào ở khu vực này** (gate axe của repo đang TẮT `color-contrast`, nên CI sẽ
  không bắt hộ).

## Copy đề xuất (VI / EN)

Sửa tại chỗ trong `src/i18n/vi.ts` / `src/i18n/en.ts`, mục `live`:

```ts
// vi.ts  (mục live)
watching: "đang xem",                              // GIỮ NGUYÊN — icon Users đã gánh nghĩa "người"
watchingTooltip: "Số người đang xem lúc này",      // was: "Số người đang xem trực tiếp ngay bây giờ" (lặp nghĩa, dịch máy)
watchingAria: "{count} người đang xem trực tiếp",  // MỚI — dùng cho aria-label ở LiveCard + WatchLive
watchingStale: "Số người xem có thể chưa cập nhật",// MỚI — aria-label trạng thái mất kết nối

// en.ts  (mục live)
watching: "watching",                              // unchanged
watchingTooltip: "People watching right now",      // was: "Number of people watching live right now"
watchingAria: "{count} people watching live",      // new
watchingStale: "Viewer count may be out of date",  // new
```

Không cần chuỗi cho `connecting` và `n < 3` — cả hai trạng thái đều **không có chữ**
(skeleton / ẩn). Một chuỗi thừa ở đây là một chuỗi sẽ bị hiện nhầm.

Nếu Cuong muốn báo độ tươi khi chọn cách B: **không** đưa vào badge (chật, và không ai
hỏi). Đưa vào tooltip/aria thôi:
`"Số người đang xem lúc này · cập nhật mỗi 30 giây"` / `"People watching right now · updates every 30s"`.
Và **không** dùng tiền tố `"~"` trước số — ở n=23 việc xin lỗi trước cho sai số làm con
số trông kém tin hơn chính sai số đó.

## Khuyến nghị của ui-ux-critic

Tách làm hai quyết định, đừng gộp:

1. **Sửa trước, không phụ thuộc A hay B** — vấn đề #1 (bỏ `viewerCount={0}` + ngưỡng 3
   ở `LiveCard.tsx:107`), #2 (hero ngừng `track()`), #3 (bỏ tooltip mobile), #4 (loại
   gated khỏi số), #5 (một máy trạng thái). Đây là phần lớn giá trị UX của cả proposal
   này và nó đúng với bất kỳ cách tính nào thắng.

2. **Rồi mới chọn cách tính.** Từ góc người xem:
   - Trang xem `/live/:id`: **A đã đủ tốt** và đã tồn tại. Đừng thay chỉ để cho đồng bộ.
   - Trang list (`/live`, trang giải, trang tổ chức, native): **cần một con số đi kèm
     query danh sách**. A không làm được việc này với chi phí chấp nhận được trên 4G —
     `LiveCardWithPresence` là bằng chứng chết.
   - Nghĩa là hình dạng UX tối ưu không phải "A hay B" mà là **"A + một ảnh chụp"**:
     giữ Presence cho trang xem, và có một cái gì đó phía server ghi con số đó xuống một
     cột (`livestreams.viewer_count`, làm mới ~30s) để mọi bề mặt list và native đọc.
     Với người xem, cột đó **giống hệt** cách B (trễ ~30s, đi kèm payload sẵn có) nhưng
     không cần bảng heartbeat, không cần mỗi viewer ghi DB — đúng ràng buộc "ít tốn tài
     nguyên DB" của Cuong.
   - Đây là **ưu tiên UX, không phải phán quyết kiến trúc**: nó cần một subscriber phía
     server, và đó là đất của `solution-architect`. Nếu architect nói cái subscriber đó
     đắt/mong manh hơn một bảng heartbeat thì cách B thuần là lựa chọn thay thế hoàn toàn
     chấp nhận được về UX — **miễn là có optimistic +1 cho chính người vừa vào**.

Một điều KHÔNG được đánh đổi ở vòng 2: dù chọn A, B hay A+snapshot, **ngưỡng 3 và việc
không bao giờ in `0`** phải đi cùng. Nó là 1 dòng code và nó là thứ duy nhất trong tài
liệu này đang trực tiếp làm mất click trên prod ngay lúc này.

## Panel đa model

- **Đồng thuận Claude + GPT-5.6:** _không có._ Panel chạy one-model-down; Codex hết hạn
  mức tới 2026-08-08 12:00. Prompt đã soạn và đã gửi thật, lưu nguyên văn ở
  `external/ui-ux-critic-gpt56.md` + `external/ui-ux-critic-gpt56.prompt.md` — chạy lại
  được sau mốc đó.
- **Bất đồng:** không áp dụng.
- **Hệ quả về trọng số:** các nhận định trong tài liệu này **không** có xác nhận chéo
  vendor. Phần cứng nhất là phần **đo được từ repo** (bảng hiện trạng theo bề mặt, dead
  code, hardcode 0, hero tự track) — những cái đó GPT-5.6 cũng không thấy được vì nó
  không đọc repo. Phần mềm nhất là các phán đoán về **cảm nhận người dùng** (ngưỡng 3,
  "flicker tệ hơn stale") — chính là phần đáng lẽ cần ý kiến thứ hai nhất. Nếu Cuong chỉ
  chạy lại được một câu hỏi cho GPT-5.6 sau 08/08, hãy chạy câu 2 và câu 3 trong file
  prompt (flicker vs stale; ngưỡng hiển thị số thấp).
