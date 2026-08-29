# ui-ux-critic — cls-attribution (2026-08-09)

Đọc trước khi viết: `00-intake.md`, `round1/idea-recon.md`, `src/pages/WatchLive.tsx`,
`src/pages/Login.tsx`, `src/components/video/MuxPlayer.tsx`,
`src/components/chat/ChatPanel.tsx`, `src/components/home/LiveSection.tsx`,
`src/pages/Index.tsx:580-630`, `index.html:56-89`, `src/index.css:479`,
`docs/design-tokens.md`, `scripts/check-theline.mjs`.

## Đánh giá tổng thể

CLS 0.67 ở đây **không phải** lỗi của một cái badge. Trên `/live/<id>` có ba lớp
dịch chuyển chồng lên nhau: (1) cây DOM lúc `isLoading` khác hẳn cây DOM thật —
kể cả hộp video cũng đổi kích thước 358→390px; (2) một hàng metadata `flex-wrap`
chứa ba giá trị async có độ dài không đoán trước; (3) font tiếng Việt `swap`
không preload, reflow toàn trang sau khi Inter VI về. Lớp (3) là lớp duy nhất
giải thích được vì sao `/login` — một trang gần như không có dữ liệu async —
vẫn ăn 15 event poor.

Tin tốt cho người đứng ở sân: **không có fix nào bắt buộc phải hy sinh trải
nghiệm.** Nỗi lo của Cuong ("reserve chỗ = khoảng trống rỗng", "giữ skeleton lâu
= cảm giác chậm", "min-height chat = mất chỗ video") đều tránh được, vì chỗ cần
giữ nằm **bên trong những hàng vốn đã tồn tại**, không phải hàng mới. Ngược lại,
có hai "fix CLS" phải bị chặn ngay từ vòng 1 vì chúng làm xấu trải nghiệm mà
không đổi được điểm nào: đưa chat thành overlay đè lên video, và giữ skeleton
toàn trang cho tới khi mọi query xong.

## Luồng người dùng

**Entry (đa số):** link Facebook → `/live/<id>` deep link, cold start, 4G, một
tay, đứng cạnh sân ồn. Không có tab trước đó, không có cache. Việc duy nhất
người này muốn trong 3 giây đầu: **thấy khung hình trận đấu và bấm play.**

**Task:** xem 30-60 phút. Đây là điểm mấu chốt mà recon nói đúng: CLS ở đây tích
lũy theo **vòng đời phiên**, không phải theo lần paint đầu. Mọi thứ nhúc nhích ở
phút thứ 12 (presence reconnect khi 4G chớp, số viewer 9→10, comment mới về,
bàn phím bật lên) đều cộng vào cùng một điểm CLS.

**Exit:** hoặc bấm Chat, hoặc cuộn xuống đọc mô tả/bình luận, hoặc rời trang.
Sidebar "stream khác" nằm dưới đáy trên mobile — gần như không ai tới.

Hệ quả thiết kế: thứ tự ưu tiên hình học phải là **player → thanh chat → tiêu đề
→ metadata → mô tả → bình luận**. Mọi thứ đứng *trên* player phải cố định kích
thước từ byte HTML đầu tiên. Mọi thứ *dưới* metadata được phép lớn dần, miễn là
lớn xuống dưới chứ không chèn ngược lên.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | `WatchLive.tsx:108-122` — nhánh `isLoading` render một cây khác hoàn toàn: container `tl-shell` + `paddingTop:32` (thật: `container-wide section-spacing`), **không có back link** (thật: link + `mb-4` ≈ 40px), skeleton player nằm trong padding nên rộng ~358px → cao 201px, trong khi player thật full-bleed `-mx-4` rộng 390px → cao 219px. Khi data về, **mọi pixel trên màn hình đều đổi chỗ**. Đây là cú shift lớn nhất và recon không bắt được. | Bỏ hẳn early-return. Render một shell duy nhất: back link + `<div className="lg:hidden sticky top-14 -mx-4 aspect-video">` + thanh chat + slot tiêu đề, rồi *bên trong* các hộp đó mới swap skeleton ↔ nội dung. Hộp player phải là **cùng một node DOM** ở cả hai trạng thái. Lợi thêm: focus của back link không bị huỷ khi data về (hiện tại đang mất). |
| 2 | **Blocker** | `WatchLive.tsx:391-477` — hàng metadata `flex flex-wrap gap-4` chứa 3 giá trị async: chip viewer chèn vào sau 1-4s (`isConnected && concurrentViewers > 0`), `viewCount` render `0 lượt xem` rồi đổi thành `1.234 lượt xem`, và số viewer đổi số chữ (9→10→100). Với `flex-wrap`, mỗi thay đổi bề rộng có thể đẩy mục sau xuống dòng mới → hàng cao thêm ~20px → đẩy toàn bộ nút Like/Share, mô tả, bình luận. Xảy ra **lặp lại suốt phiên**, khớp giả thuyết tích luỹ. | Tách 2 tầng: (a) organizer đứng riêng một hàng (nó là mục dài nhất, tiếng Việt lại dài hơn EN); (b) hàng số liệu thành `grid grid-cols-[auto_auto_1fr]`, `whitespace-nowrap`, `tabular-nums`. Slot viewer **luôn tồn tại**, dùng `visibility:hidden` khi chưa connect — chiếm chỗ nhưng vô hình, không có khung, không có nền, nên không ai thấy "ô trống". `viewCount` khi `undefined` render skeleton `h-4 w-24` chứ không render `0`. Số ≥ 10.000 rút gọn `12,4 N` để chuỗi không dài vô hạn. |
| 3 | **Blocker** | `LiveSection.tsx:79` — `if (streams.length === 0 && endedStreams.length === 0) return null`, và `Index.tsx:594-606` chỉ dựng `liveNode` khi `liveLeads`. Khi query livestream về, cả khối hero ~350px được **chèn vào đầu** stack, đẩy editorial + news xuống. Đúng thủ phạm cho 37 poor của home. | Section wrapper luôn render với slot media chiều cao cố định. Ba trạng thái **cùng chiều cao**: loading → skeleton; có live → hero; không có live (phần lớn thời gian trong ngày) → **không để trống**, đổ "Sắp phát sóng"/"Vừa phát sóng" (dữ liệu đã có sẵn trong cùng component) vào đúng slot đó. Reserve mà rỗng là tệ hơn bệnh; reserve mà luôn có nội dung là đúng. |
| 4 | **Blocker** | `index.html:56-63` — `inter-vietnamese.woff2` là `font-display:swap` và **không được preload** (chỉ 2 subset Geist được preload), trong khi `html{font-family:Inter}` và Tailwind `sans` = Inter. Trên 4G, toàn bộ chữ tiếng Việt paint bằng font hệ thống rồi reflow khi Inter VI về → dịch chuyển toàn trang, **mọi trang**. Đây là lời giải duy nhất hợp lý cho `/login` (15 poor) vì trang đó gần như không có gì async. Tệ hơn: `inter-latin` là `optional` còn `inter-vietnamese` là `swap` → trên máy chậm, chữ "nghề" render `n·g·h` bằng font hệ thống + `ề` bằng Inter → **chữ lai font trong cùng một từ**. Đây là lỗi chất lượng chữ Việt, không chỉ lỗi số đo. | (a) `<link rel=preload as=font crossorigin href="/fonts/inter-vietnamese.woff2">`; (b) `inter-latin` đổi `optional` → `swap` cho đồng bộ (hết chữ lai); (c) thêm `@font-face` fallback metric-match (`size-adjust` / `ascent-override` / `descent-override`) đo từ chính file production so với Roboto (Android tầm trung = đúng segment), để lúc swap chữ không đổi bề rộng. Chuỗi test: `nghề nghiệp · Trực tiếp · 1.234 lượt xem · Nguyễn Thị Hồng` ở 14/16/24px, viewport 320/390/414 — điểm xuống dòng phải giống nhau trước và sau khi font về. (d) Nếu Geist không phải body font của trang đang xét, cân nhắc hạ ưu tiên 1 trong 2 preload Geist: 3 preload font tranh băng thông với manifest Mux trên 4G. |
| 5 | Nên sửa | `Login.tsx:283-306` — `authLoading` render một cây riêng (spinner giữa màn) rồi thay bằng header + wordmark + form. Với auth restore 200-800ms, người dùng thấy màn hình trắng có spinner rồi giật sang form; và bất kỳ node nào React tái sử dụng đều đổi vị trí. | Bỏ early-return. Render luôn form thật với `aria-busy={authLoading}`, input + nút submit `disabled` trong lúc restore. Nhãn nút giữ nguyên `Đăng nhập`, chỉ đổi thành `Đang kiểm tra phiên…` nếu restore vượt 300ms (tránh nháy chữ ở kết nối nhanh). Spinner nếu có thì nằm **trong** nút ở slot cố định, không đẩy nhãn ngang. |
| 6 | Nên sửa | `Index.tsx:626` — `HomeLogMatchCTA` tự guard bằng `useAuth` nên với người đã đăng nhập nó **xuất hiện sau** khi auth resolve, đẩy mọi thứ dưới nó xuống. | Một slot chiều cao cố định, hai trạng thái cùng cao: chưa đăng nhập → `Đăng nhập để ghi trận`; đã đăng nhập → `Ghi lại trận đấu`. Không còn nhánh render-nothing. |
| 7 | Nên sửa | `ChatPanel.tsx:990` — `{user && <NicknameInput />}`, mà `NicknameInput` lại `return null` khi `!user` (`:111`). Auth resolve muộn hơn chat load → một hàng ~40px chèn vào giữa danh sách tin và ô nhập → tin nhắn nhảy. Desktop luôn dính (chat mở sẵn `h-[500px]`); mobile dính khi user đã mở chat từ trước — lúc auth về thì đã quá 500ms sau cú chạm nên **không được miễn trừ** input. | Giữ chỗ hàng nickname bằng `min-h-10` khi `authLoading`, hoặc chỉ mount `NicknameInput` sau khi auth đã resolve dứt điểm (`!authLoading`) để nó không xuất hiện giữa chừng. |
| 8 | Nên sửa (a11y, không phải CLS) | `MuxPlayer.tsx:396-413` — `<select>` chất lượng video (WIP chưa commit) có `h-9` = 36px, dưới ngưỡng 44px, và `aria-label="Chất lượng video"` **hardcode tiếng Việt**, không đi qua `t.*`. Người dùng EN thấy nhãn Việt. | `h-11` (44px) và đưa nhãn vào i18n: `t.player.quality` (`Chất lượng video` / `Video quality`). Không ảnh hưởng CLS (absolute), nhưng nó nằm đúng trong file đang sửa nên gộp luôn. |
| 9 | Nit | `ChatLeaderboardPanel.tsx:18` — `return null` khi loading rồi hiện một thanh sau đó, đẩy danh sách tin trong panel chat. | Chỉ ảnh hưởng người đã mở chat. Giữ chỗ `min-h-8` hoặc chấp nhận. Không đáng cho vòng này. |
| 10 | Nit | `ChatPanel.tsx:746-756` — chip số tin nhắn ở `renderHeaderControls` chỉ render cho moderator (`if (!isModerator) return null`). Với 1 admin trên 1669 user, tác động thống kê = 0. | Bỏ qua. |
| 11 | **Chống-fix (chặn)** | "Đặt `min-height` cho vùng chat" / "cho chat overlay đè lên video". Chat mobile mở bằng **thao tác chạm** → mọi shift trong 500ms sau input **bị CLS loại trừ**. Fix này ăn chỗ video (219px player trên màn 390px đã là tất cả những gì người ta có) mà **không đổi được một điểm CLS nào**. | Không làm. Nếu ai đó đề xuất ở vòng 2, đây là lý do bác. |
| 12 | **Chống-fix (chặn)** | "Giữ skeleton toàn trang cho tới khi mọi query xong" (zero-shift nhưng người dùng chờ). Người đứng ở sân bỏ trang trước khi thấy trận. | Không làm. Shell thật + hydrate từng vùng (mục 1) cho CLS tương đương mà player chạy ngay khi có playback URL. |
| 13 | Nit | GPT đề xuất `-webkit-line-clamp: 2` cho `<h1>` tiêu đề stream. `livestream.title` đến **cùng payload** với phần còn lại của trang — nó không phải nguồn shift. Cắt tiêu đề Việt ("Bán kết đôi nam · Sân 3 · CLB …") là giấu đúng thông tin người ta cần để biết mình mở đúng trận. | Không clamp. |

**Đếm: 4 Blocker · 4 Nên sửa · 3 Nit · 2 chống-fix cần chặn.**

## Trạng thái màn hình

### `/live/<id>` — slot viewer count
- **Chưa connect (0-4s, và mọi lúc `concurrentViewers === 0`)**: slot tồn tại, `visibility:hidden`. Không copy, không skeleton nhấp nháy, không `0 đang xem`. Người dùng không nhận ra có gì ở đó — đó là mục tiêu. `visibility:hidden` cũng bị loại khỏi accessibility tree nên screen reader không đọc slot rỗng.
- **Có số**: `1.234 đang xem` / `1,234 watching`. ≥10.000: `12,4 N đang xem` / `12.4K watching`.
- **Presence rớt (4G chớp)**: **giữ số cuối cùng 30 giây**, không xoá ngay. Quá 30s không reconnect → `visibility:hidden` trở lại. Hiện tại code xoá chip ngay khi `isConnected` false → vừa nhấp nháy vừa shift.

### `/live/<id>` — trang
- **Loading**: shell thật + skeleton trong hộp. Player box đen `aspect-video` full-bleed hiện ngay (không spinner giữa màn); tiêu đề 2 dòng skeleton; hàng số liệu skeleton. **Skeleton chứ không spinner** — vì hình dạng cuối đã biết chắc, skeleton vừa báo "sắp có gì" vừa khoá hình học. Spinner chỉ đúng khi không biết trước layout.
- **Error (stream không tồn tại)**: giữ nguyên `t.errors.notFound` hiện tại, nhưng render trong **cùng shell** (có back link) chứ không phải cây riêng.
- **Player lỗi**: đã có (`MuxPlayer.tsx:350-361`) — `aspect-video` giữ nguyên hộp, đúng.
- **Offline (PWA / Capacitor WebView)**: native dùng remote URL nên mất mạng = trắng. Hộp player giữ nguyên kích thước + copy: VI `Mất kết nối. Kiểm tra mạng rồi thử lại.` / EN `Connection lost. Check your network and try again.` + nút `Thử lại` (44px). Không đổi chiều cao hộp.

### `/` home — slot media đầu trang
- **Loading**: skeleton đúng chiều cao module.
- **Có live**: `Đang trực tiếp` + hero.
- **Không có live** (phần lớn thời gian): cùng slot, heading `Sắp phát sóng` hoặc `Vừa phát sóng` — dữ liệu đã nằm sẵn trong `LiveSection`. **Không bao giờ để slot rỗng.**
- **Không có gì cả** (không live, không lịch, không replay 7 ngày): lúc này mới cho phép section biến mất — nhưng phải biến mất **trước lần paint đầu**, tức quyết định bằng dữ liệu đã có, không phải bằng `return null` sau khi query về.

### `/login`
- **Restoring**: form thật, `aria-busy="true"`, input disabled, nhãn nút giữ `Đăng nhập`; sau 300ms mới đổi `Đang kiểm tra phiên…`.
- **Error**: giữ toast hiện tại.
- **Offline**: nút disabled + copy dưới nút: VI `Không có mạng. Đăng nhập cần kết nối.` / EN `You're offline. Signing in needs a connection.`

## Accessibility (WCAG 2.1 AA)

Đã kiểm: touch target, live region, reduced-motion, focus khi DOM thay cây, ngôn ngữ nhãn.

- **Sạch — reduced-motion**: `src/index.css:479` đã ép `animation-duration: 0.01ms` cho `*` khi `prefers-reduced-motion: reduce`, nên mọi `animate-pulse` của skeleton tự tắt. Fix skeleton không cần thêm guard.
- **Không được thêm `aria-live="polite"` vào chip viewer** (GPT đề xuất). Số viewer đổi liên tục suốt 45 phút; live region sẽ khiến TalkBack/VoiceOver đọc lại "1.235 người đang xem" hàng chục lần, đè lên bình luận âm thanh của chính trận đấu. Giữ `aria-label` tĩnh như hiện tại (`WatchLive.tsx:423`). Nếu muốn người mù biết số, đặt nó ở nơi họ chủ động đọc, đừng đẩy vào tai họ.
- **Focus loss**: nhánh `isLoading` thay cả cây → nếu người dùng đã Tab tới back link, focus rơi về `<body>` khi data về. Fix #1 giải quyết luôn.
- **Touch target < 44px**: `<select>` chất lượng trong `MuxPlayer.tsx:397` là `h-9` (36px). Cũng lưu ý `ChatPanel` có một loạt `h-6 w-6` (24px) cho nút reply/like/unpin — nợ cũ, ngoài phạm vi CLS, ghi lại thôi.
- **Nhãn hardcode tiếng Việt** trong `MuxPlayer.tsx:399,402` (`Chất lượng video`) và `ChatPanel.tsx:998,1043` (`Trả lời …`) — không qua i18n. Người dùng EN thấy tiếng Việt.
- **Chưa kiểm được, cần đo khi implement**: contrast của `text-live` trên nền `--tl-bg` cho chip viewer, và contrast của skeleton `bg-muted` (skeleton không cần đạt 4.5:1 vì không phải text, nhưng phải phân biệt được với nền).

## Copy đề xuất (VI / EN)

Dùng nguyên chuỗi i18n đã có ở `src/i18n/vi.ts:3401-3412` — không đẻ key mới cho cái đã tồn tại.

```
live.watching        : "đang xem"                      / "watching"        (giữ nguyên)
live.totalViews      : "lượt xem"                      / "views"           (giữ nguyên)
live.watchingAria    : "{count} người đang xem trực tiếp" / "{count} people watching live" (giữ nguyên)

# mới
live.viewersCompact  : "{count} N đang xem"            / "{count}K watching"
player.quality       : "Chất lượng video"              / "Video quality"
player.offline       : "Mất kết nối. Kiểm tra mạng rồi thử lại." / "Connection lost. Check your network and try again."
auth.restoringSession: "Đang kiểm tra phiên…"          / "Checking your session…"
auth.offlineHint     : "Không có mạng. Đăng nhập cần kết nối." / "You're offline. Signing in needs a connection."
home.upcomingHeading : "Sắp phát sóng"                 / "Upcoming broadcast"   (đã có trong LiveSection)
home.recentHeading   : "Vừa phát sóng"                 / "Recently live"        (đã có trong LiveSection)
```

Ghi chú độ dài: `Đang kiểm tra phiên…` (20 ký tự) dài hơn `Checking your session…` không đáng kể, nhưng nó **dài gấp đôi** `Đăng nhập` — nút submit phải là `w-full`, không phải nút co theo nội dung, nếu không nút sẽ đổi bề rộng lúc restore xong (lại là một shift nữa). Chuỗi `12,4 N đang xem` dùng dấu phẩy thập phân và `N` (nghìn) theo cách người Việt viết; **không** dùng `12.4K`.

## Panel đa model

Chạy `codex exec` (GPT). Ghi chú quy trình: `scripts/agents/ask-model.mjs` **không tồn tại**
trong repo (trùng gotcha đã biết về `/idea` thiếu script), và `--model gpt-5.6` bị tài khoản
ChatGPT từ chối (HTTP 400) → chạy `codex exec` với model mặc định của CLI. Prompt nguyên văn:
`docs/proposals/cls-attribution/external/ui-ux-gpt-prompt.md`; reply nguyên văn:
`external/ui-ux-gpt-reply.md`.

**Đồng thuận Claude + GPT (nói một lần rồi thôi — hai model độc lập cùng kết luận là tín hiệu thật):**
- `opacity`/fade **không** sửa CLS: phần tử `opacity:0` vẫn nằm trong flow và vẫn đẩy nội dung. Chỉ fade *sau khi* đã giữ chỗ.
- **Không overlay metadata lên footage.** Video 219px trên màn 390px là tất cả những gì người xem có.
- Giữ chỗ đúng cách = giữ chỗ **bên trong hàng đã có sẵn**, dùng `visibility:hidden`, không tạo hàng mới → không có "ô trống" nào lộ ra. Đây chính là câu trả lời cho lo ngại của Cuong.
- `tabular-nums` + `whitespace-nowrap` + rút gọn số lớn cho mọi con số động.
- Cây loading phải là **cùng markup ngoài** với cây thật; player skeleton 358px → player thật 390px là lỗi.
- `/login`: full-page spinner sai cho auth restore 200-800ms; render form disabled.
- Home: không reserve 350px rỗng; dùng một module cùng chiều cao có nội dung ở mọi trạng thái.
- Font: giữ `swap` cho tiếng Việt (không quay lại `optional`), sửa bằng preload + fallback metric-match.
- Presence reconnect: giữ số cuối cùng, đừng xoá chip ngay.
- Không cần đợi 7 ngày GA4 attribution mới bắt đầu sửa — các thủ phạm này đọc thẳng từ code.

**Bất đồng:**

1. **Chip viewer đặt ở đâu.**
   - *GPT*: dời lên thanh chat, `grid-cols-[minmax(0,1fr)_auto]`, reserve `w-[9.5rem]` bên phải nút Chat.
   - *Claude*: giữ trong khối metadata, nhưng tách hàng organizer ra riêng và biến hàng số liệu thành grid nowrap.
   - **Chọn: Claude.** Lý do: trên 390px, khoá cứng 152px bên phải làm nút Chat (`flex-1`, có icon + chữ + chevron) co lại dưới ngưỡng dễ bấm một tay, và hàng đó **còn phải chứa** `ChatPanel renderHeaderControls` cho moderator (`WatchLive.tsx:369`) — GPT không biết mục này tồn tại. Hàng metadata vẫn nằm above-the-fold khi tải (player 219 + thanh chat 48 + tiêu đề ~64 ≈ 331px trên viewport 844), nên không mất tính hiển thị. Diff cũng nhỏ hơn: sửa một khối, không đụng vào thanh điều khiển.

2. **`aria-live="polite"` cho chip viewer.**
   - *GPT*: có.
   - *Claude*: không.
   - **Chọn: Claude.** Lý do ở mục Accessibility: số đổi vài giây một lần suốt 45 phút = live region spam. GPT tối ưu cho "thông báo nội dung xuất hiện muộn" đúng về nguyên tắc chung, nhưng sai với một giá trị thay đổi liên tục. Giữ `aria-label` tĩnh.

3. **Clamp `<h1>` 2 dòng + nút "Xem đầy đủ".**
   - *GPT*: có, để khoá chiều cao tiêu đề.
   - *Claude*: không.
   - **Chọn: Claude.** Lý do: tiêu đề đến cùng payload với phần còn lại, nó không phải nguồn shift — clamp là sửa thứ không hỏng. Và tiêu đề stream Việt mang thông tin phân biệt trận ("… · Sân 3 · Bán kết"), cắt đi là lấy mất lý do người ta bấm vào link. Thêm nút "Xem đầy đủ" còn đẻ thêm một touch target 44px trên màn hình vốn đã chật.

## Thứ tự nên làm (theo tác động lên người dùng, không theo độ khó)

1. #1 shell `/live` (lớn nhất, và sửa luôn focus loss)
2. #4 font (ảnh hưởng **mọi** trang, và đang tạo chữ lai font tiếng Việt — lỗi chất lượng chữ, không chỉ số đo)
3. #2 hàng metadata
4. #3 home live slot
5. #5 login shell
6. #6/#7/#8 dọn nốt
