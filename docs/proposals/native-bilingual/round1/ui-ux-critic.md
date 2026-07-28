# ui-ux-critic — native-bilingual (nguyên văn, vòng 1, 28/07)

# UI/UX review — native `/apple` VI-only → VI+EN (String Catalog)

## Đánh giá tổng thể

Kế hoạch này về cơ bản khả thi và blast radius thấp (app chưa phân phối), nhưng **tiền đề rủi ro trong brief bị đảo ngược**: trong app này EN hầu hết **ngắn hơn** VI ("Trang chủ"→"Home", "Bảng xếp hạng"→"Rankings", "Phát lại"→"Replays"), nên chuyện tràn nút không phải mối lo chính. Ba thứ thật sự giết trải nghiệm là: (1) key trùng nghĩa vì `DEVELOPMENT_LANGUAGE: vi` + key = literal VI, (2) 25 thông báo lỗi được **ghép câu** theo ngữ pháp VI nên không thể dịch sang EN đúng ngữ pháp, (3) 14 formatter ghim cứng `vi_VN` sẽ đọc "Thứ Tư, thg 7" giữa một màn hình tiếng Anh — kể cả VoiceOver.

Quyết định "không toggle trong app" là chỗ tôi **không đồng ý với intake**, nhưng cách sửa rẻ hơn nhiều so với đề xuất của GPT-5.6 (chi tiết ở phần Panel).

---

## Luồng người dùng

Thực tế vào app **không phải qua Home**. `apple/project.yml:38-40` khai `applinks:www.thepicklehub.net` — người dùng bấm link Facebook → universal link → mở thẳng `/tournaments/<slug>` hoặc `/live`. Nghĩa là:

- **Frame đầu tiên người dùng thấy là một màn chi tiết, không phải Settings.** Nếu ngôn ngữ sai, không có cơ hội "vào Cài đặt sửa trước" — họ đang đứng ở sân, cần xem tỉ số trong 5 giây.
- Đường thoát duy nhất hiện tại theo intake: thoát app → iOS Settings → cuộn tìm ThePickleHub → Language. Bốn bước, và phải **biết** mục đó tồn tại.
- Sau khi xem xong họ share ngược ra Zalo/Facebook. Chuỗi share (`LiveComponents.swift:186`, `TeamMatchDetailView.swift:283` "Mở trên web") cũng nằm trong surface dịch.

Kết luận về luồng: mismatch ngôn ngữ ở first frame là lỗi **không tự phục hồi được** trong ngữ cảnh deep-link. Đó là lý do tôi nâng nó lên Blocker chứ không phải "nên sửa".

---

## Vấn đề tìm thấy

### Blocker

| # | Vấn đề | Căn cứ | Sửa thế nào |
|---|---|---|---|
| B1 | **Key = literal VI ⇒ trùng nghĩa.** `"Sân"` mang 6 nghĩa khác nhau, String Catalog gộp thành 1 key ⇒ dịch 1 chỗ đổi cả 6 | `apple/project.yml:13`; `SocialHubView.swift:12` (tab tìm sân), `QuickTableDetailView.swift:622` (tab phân sân trong giải), `HomeVideosSection.swift:11` `"Sân đấu."` (mục video highlight), `QuickTableModels.swift:132` `"Sân \(id)"`, `VenueModels.swift:129` `"Sân cứng"`, `LiveView.swift:200` `"\(n) sân"`. Tương tự `Text("Thêm")` ×6 (`VenuesListView.swift:95` vs `TeamMatchTeamRosterSheet.swift:138`) | Dùng **symbolic key ngay từ pass đầu**, không extract literal rồi re-key sau (sẽ phải chạm 151 file hai lần): `LocalizedStringResource("social.tab.courts", defaultValue: "Sân", comment: "…")`. Giữ `DEVELOPMENT_LANGUAGE: vi` — vấn đề là key identity, không phải source language |
| B2 | **Lỗi ghép câu theo ngữ pháp VI.** `"\(action) không thành công. \(detail)"` — 25 call site truyền cụm động từ ("Gửi tin nhắn"). EN dịch máy ra `"Send message failed."` = sai ngữ pháp, xuất hiện ở **mọi** lỗi mutation trong app | `apple/ThePickleHub/Core/Errors/UserFacingError.swift:24`, 25 call site. **Kèm bug VI đang sống**: `MatchProposalRepository.swift:94,101` truyền `action: "verify"` / `"dispute"` ⇒ user VI hiện thấy `"verify không thành công."` | Đổi chữ ký thành `message(failure: LocalizedStringResource, error:)`, mỗi call site truyền **câu kết quả hoàn chỉnh** đã localize (`error.sendMessage` → VI `"Không gửi được tin nhắn."` / EN `"Couldn't send the message."`). Sửa luôn 2 call site tiếng Anh lẫn vào |
| B3 | **Không có control ngôn ngữ + default sai.** Người VN để máy EN (rất phổ biến) mở app ra thấy tiếng Anh, deep-link nên không có cơ hội sửa trước | Quyết định ở `00-intake.md:7`; không có file settings ngôn ngữ nào trong `apple/ThePickleHub/Features/Profile/` | Xem phần Panel — tôi chọn **default theo Region chứ không theo Language**, + 1 hàng trong Profile |
| B4 | **Ngày/thứ tiếng Việt trong app tiếng Anh.** 14 chỗ ghim `Locale(identifier: "vi_VN")`, 1 bảng thứ hardcode, 1 relative-time viết tay | `SocialModels.swift:208-209` `"EEE, dd/MM · HH:mm"`, `TeamMatchModels.swift:62-63` `"EEEE, d/M/yyyy"`, `LiveComponents.swift:7,10`, `ClubDetailView.swift:307,323,354`, `SocialEventsTab.swift:23,30,219`, `FindPlayersView.swift:248`, `ToolsModels.swift:163`, `MessagesView.swift:275`, `CreateTeamMatchView.swift:369`; `VenueModels.swift:106-107` bảng `["mon":"Thứ 2"…]`; `FeedFormat.swift:98-109` `"\(minutes) phút trước"` | Bỏ hết ghim locale. Thay `dateFormat` template bằng `Date.FormatStyle` components (`.weekday(.abbreviated).day().month()`) — thứ tự và dấu phân cách tự đổi theo locale. `VenueModels` giữ token `mon/tue` và lấy tên từ `Calendar.weekdaySymbols`. `FeedFormat.relative` → `.formatted(.relative(presentation: .named))` |
| B5 | **Enum lưu chuỗi VI làm `rawValue`** ⇒ dịch là hỏng so sánh/persist | `apple/ThePickleHub/Features/Bracket/TeamMatchDetailView.swift:1366` `enum Mode: String { case random = "Ngẫu nhiên", manual = "Thủ công" }` | Bỏ `: String`, thêm `var title: LocalizedStringResource`. Phải làm **trước** khi bắt đầu migrate chuỗi |
| B6 | **~36 chuỗi có số đếm, không có plural variant.** VI không chia số nhiều nên hiện không lộ; EN sẽ ra `"1 teams"`, `"1 courts"`, `"1 players"` | `ToolsModels.swift:134,141`; `TeamMatchDetailView.swift:922,1024,1040,1056,1292,1353,1405,1475,1484,1592`; `SocialDetailView.swift:79,197`; `LiveView.swift:200`; `FeedFormat.swift:103,105,107`; `ToolsView.swift:368`; … | Mọi key có số ⇒ khai plural variant trong `.xcstrings` (`%lld`, one/other). Không nối chuỗi thủ công |
| B7 | **`project.yml` không khai `knownRegions`** ⇒ bản dịch EN không được đóng gói và **iOS không hiện mục Language per-app** — tức cơ chế mà cả quyết định intake dựa vào sẽ không tồn tại | `apple/project.yml` (không có key `knownRegions`); `apple/ThePickleHub/App/Info.plist` không có `CFBundleLocalizations` | Thêm `options.knownRegions: [vi, en, Base]` vào `project.yml` và verify sau `xcodegen` bằng cách mở Settings → ThePickleHub trên máy thật |

### Nên sửa

| # | Vấn đề | Căn cứ | Sửa thế nào |
|---|---|---|---|
| N1 | `TLSegmented` không có `lineLimit` ⇒ nhãn dài sẽ **wrap 2 dòng, capsule cao lên** thay vì truncate (component dùng lại ở 5 màn) | `apple/ThePickleHub/DesignSystem/Components/TLSegmented.swift:32` `Text(label(option))` không `.lineLimit`, `.frame(maxWidth: .infinity)` | Thêm `.lineLimit(1).minimumScaleFactor(0.8).allowsTightening(true)` ngay trên `Text(label(option))` |
| N2 | `DuprHeaderChip` có `.fixedSize(horizontal: true)` **triệt tiêu** `.layoutPriority(-1)` ở call site ⇒ chip không bao giờ nhường chỗ, toolbar tràn viền (khớp memory) | `DuprHeaderChip.swift:54` vs `AppTabView.swift:107` | Bỏ `.fixedSize(horizontal:)`, giữ `.lineLimit(1)` + thêm `.minimumScaleFactor(0.8)` |
| N3 | **Hai dấu phân cách nghìn khác nhau trong cùng app** — Home ra `1,816`, Social ra `80.000` | `HomeModels.swift:53-55` `groupingSeparator = ","` vs `SocialModels.swift:54-57` `groupingSeparator = "."` | Xoá cả hai, dùng `value.formatted(.number)`. Bug VI đang sống (`1,816` sai chuẩn VI) |
| N4 | **`"Doubles Elimination"` là dịch sai.** "Loại kép" = double elimination. EN "Doubles Elimination" đọc thành "loại trực tiếp dành cho đôi". Web tự mâu thuẫn: title "Doubles Elimination" nhưng description "Double elimination" | `src/i18n/en.ts:222-223`; native `ToolsModels.swift:134`, `DoublesElimDetailView.swift:262` | Sửa **ở web trước** (`en.ts:222`) rồi port. Route/edge-function `og-doubles-elimination` là ID nội bộ, giữ nguyên |
| N5 | **"Chia bảng" có 3 bản EN khác nhau trên web** | `src/i18n/en.ts:210` "Quick Bracket", `:832` "Round Robin", `:883` "Create Brackets" | Tách 3 key: format = "Round Robin"; hành động = "Draw groups"; nút bước 3 = "Create groups". **Không** dùng "Bracket" cho "chia bảng" |
| N6 | **Viết tắt VI 3 ký tự không có tương đương EN.** `sourceBadge` có `.textCase(.uppercase)` nên "BTC THÊM" (8) → "ADDED BY ORGANIZER" (18) | `SocialRosterManageView.swift:153,216-221`; `TeamMatchDetailView.swift:482,801-805` | EN cho badge phải **ngắn hơn nghĩa**: `"BTC thêm"`→`"ORGANIZER"`, `"Chờ BTC xác nhận"`→`"AWAITING ORGANIZER"` |
| N7 | **47 `accessibilityLabel` + label shared state chưa vào surface dịch** | `TLStateViews.swift:27` `"Đang tải"`; `AppTabView.swift:95,125`; `DuprHeaderChip.swift:76-81`; `ToolsView.swift:280,301,537,571,591`; `TeamMatchScoringSheet.swift:319,325`; `QuickTableDetailView.swift:669-675` (0 label) | Localize hết. Header bảng xếp hạng giữ `W / P / +/–` nhìn thấy nhưng a11y đọc đủ "Wins"/"Played"/"Point differential" |
| N8 | **Không có trạng thái offline**, audience đứng sân 4G chập chờn | `TLStateViews.swift` chỉ có Loading/Empty/Error; grep `offline` → chỉ `SessionStore.swift:123` | Thêm `TLOfflineState` dùng lại layout `TLEmptyState` (icon `wifi.slash`), tự retry bằng `NWPathMonitor` |
| N9 | **2 test assert chuỗi VI verbatim** | `Tests/UserFacingErrorTests.swift:13-14,23`; `Tests/TournamentMutationErrorTests.swift:11,18` | Assert identity (key/case), không assert bản dịch |
| N10 | `Text(meta)` card Tools không `lineLimit` | `ToolsView.swift:291` | `.lineLimit(1)` |
| N11 | **`appName` web = `"The PickleHub"` (có dấu cách)** vs brand `"ThePickleHub"` | `src/i18n/en.ts:6`, `src/i18n/vi.ts:2991` vs Info.plist | Tên app không dịch, không port từ web — giữ literal `ThePickleHub` cả hai locale |
| N12 | `"Sân đấu."` là tiêu đề mục biên tập, dấu chấm cuối là ký hiệu typographic (cùng hệ "Tin mới.") | `HomeVideosSection.swift:11`, `HomeSectionHeader.swift:4` | EN = `"Highlights."` — giữ dấu chấm |

### Nit

| # | Vấn đề | Căn cứ | Sửa thế nào |
|---|---|---|---|
| n1 | Ký hiệu tiền native `đ` vs web `₫` | `SocialModels.swift:41`, `TeamMatchDetailView.swift:761,771`, `TeamMatchPaymentSheet.swift:138` | `"80.000đ"` là cách người Việt viết thật — không nâng mức, chỉ đáng ở nhánh EN dùng `.currency(code:"VND")` |
| n2 | "Giao lưu" → web dịch "social" | `src/content/social-event-templates.ts:45,77` | Buổi xoay vòng = **"Open Play"**; "Social" cho sự kiện giao lưu thật |
| n3 | Không xử lý timezone ở 14 formatter | — | Hậu tố "ICT" khi timezone thiết bị khác; chỉ cần khi có user ngoài VN |
| n4 | Thiếu `NS*UsageDescription` | `ImagePipeline.swift:68` PhotosPicker, `LiveReminderStore.swift:65` UNUserNotificationCenter — API mới không cần key plist | Ảnh hưởng = 0, thêm khi dùng camera trực tiếp |
| n5 | "Xé vé" là thành ngữ VI | `SocialHubView.swift:12` | EN "Tickets" |
| n6 | Lỗi Supabase/PostgREST tiếng Anh lọt vào `detail` | `UserFacingError.swift:19-22` | Lỗi có sẵn, ngoài phạm vi, backlog |

---

## Trạng thái màn hình

Bốn trạng thái phải có key riêng cho cả VI và EN, dùng lại `TLEmptyState` (`TLStateViews.swift:32`).

- **Empty** — giữ pattern hiện có, thêm bản EN.
- **Loading** — skeleton, không spinner. `TLLoadingView` (`TLStateViews.swift:8-27`) đã đúng; chỉ localize `accessibilityLabel`.
- **Error** — `"Không tải được"` / `"Couldn't load"`, CTA `"Thử lại"` / `"Try again"`. Message từ B2, câu hoàn chỉnh đã localize.
- **Offline** — chưa tồn tại, phải thêm (N8). `URLError.notConnectedToInternet` → offline state icon `wifi.slash`, tự retry khi mạng về (`NWPathMonitor`).

---

## Accessibility (WCAG 2.1 AA / iOS)

- **Sạch**: touch target (`DuprHeaderChip.swift:56` minHeight 44, `AppTabView.swift:136` 44×44); `TLEmptyState` dùng `@ScaledMetric`.
- **Lỗi mới do song ngữ**: B4 không sửa → VoiceOver giọng Anh đọc `"Th 4"`, `"thg 7"` phonetic tiếng Anh → truyền sai ngày. Phải sửa locale formatter, dịch label không cứu được.
- **Lỗi**: bảng xếp hạng `QuickTableDetailView.swift:669-675` — 5 cột header viết tắt, zero accessibilityLabel.
- **Danh từ riêng VI (tên CLB/giải/sân) trên màn EN**: gắn `accessibilitySpeechLanguage("vi-VN")` cho riêng element, không cả màn.
- **Chưa kiểm được** (máy thật, ghi `docs/manual-test-backlog.md`): tương phản `TLColor.fg4` trên `TLColor.surface` header bảng mono 9pt (web từng fail 3.7:1 cùng bảng màu).

---

## Copy đề xuất (VI / EN)

(Bảng key symbolic đầy đủ — settings.language.*, state.*, error.* câu hoàn chỉnh, format.* thuật ngữ chuẩn "Double Elimination"/"Round Robin"/"Draw groups", 6 key riêng cho "Sân", badge BTC ngắn, standings col + a11y, plural variant %lld one/other — xem nguyên văn trong output agent, đã chép đủ ở trên.)

```
settings.language.title          Ngôn ngữ                  / Language
settings.language.vi             Tiếng Việt                / Tiếng Việt      ← không dịch tên ngôn ngữ
settings.language.en             English                   / English
state.loading.a11y               Đang tải                  / Loading
state.error.title                Không tải được            / Couldn't load
state.error.retry                Thử lại                   / Try again
state.offline.title              Đang mất kết nối          / You're offline
state.offline.body               Kiểm tra 4G hoặc Wi-Fi. Nội dung sẽ tự tải lại khi có mạng. / Check your data or Wi-Fi. This will reload once you're back online.
error.sendMessage                Không gửi được tin nhắn.       / Couldn't send the message.
error.loadMessages               Không tải được tin nhắn.       / Couldn't load messages.
error.joinClub                   Không gửi được yêu cầu vào CLB. / Couldn't send the join request.
error.leaveClub                  Không rời được CLB.            / Couldn't leave the club.
error.confirmMatch               Không xác nhận được trận đấu.  / Couldn't confirm the match.
error.submitDispute              Không gửi được tranh chấp.     / Couldn't submit the dispute.
error.approveMember              Không duyệt được thành viên.   / Couldn't approve the member.
error.updateScore                Không cập nhật được tỉ số.     / Couldn't update the score.
error.network.detail             Kiểm tra kết nối mạng rồi thử lại. / Check your connection and try again.
error.timeout.detail             Kết nối đã hết thời gian chờ. Thử lại nhé. / The request timed out. Try again.
format.doubleElim                Loại kép                  / Double Elimination      ← KHÔNG "Doubles Elimination"
format.roundRobin                Chia bảng                 / Round Robin
format.groupStage                Vòng bảng                 / Group Stage
format.teamMatch                 Đồng đội · MLP            / MLP Team Match
format.flex                      Giải linh hoạt            / Flex Tournament
action.drawGroups                Chia bảng                 / Draw groups
social.tab.courts                Sân                       / Courts
tournament.tab.courts            Sân                       / Courts
home.section.highlights          Sân đấu.                  / Highlights.             ← giữ dấu chấm
court.number                     Sân %lld                  / Court %lld
venue.surface.hard               Sân cứng                  / Hard court
live.courtCount                  %lld sân                  / %lld court · %lld courts
action.add                       Thêm                      / Add
action.more                      Thêm                      / More
badge.addedByOrganizer           BTC thêm                  / ORGANIZER
chip.awaitingOrganizer           Chờ BTC xác nhận          / AWAITING ORGANIZER
standings.col.wins               T / W    a11y: Trận thắng / Wins
standings.col.played             TR / P   a11y: Trận đã đấu / Played
standings.col.diff               +/–      a11y: Hiệu số điểm / Point differential
tournament.teamCount             %lld đội   / one: %lld team    other: %lld teams
tournament.playerCount           %lld người / one: %lld player  other: %lld players
tournament.matchCount            %lld trận  / one: %lld match   other: %lld matches
```

---

## Panel đa model

Prompt gửi đi: `docs/proposals/native-bilingual/external/ui-ux-critic-prompt.md`
Reply nguyên văn: `docs/proposals/native-bilingual/external/ui-ux-critic-reply.md`

**Cảnh báo về tính độc lập:** brief đã mô tả sẵn collision `"Sân"`/`"Thêm"`, formatter separator lệch, `Mode` enum. Đồng thuận ở B1/B5/N3 **không phải hai model độc lập cùng phát hiện** — tôi phát hiện rồi kể cho nó nghe. Cái độc lập thật là *hình dạng cách sửa*.

### Đồng thuận Claude + GPT-5.6

1. **Symbolic key ngay từ pass đầu**, không extract literal rồi re-key (re-key sau = chạm 151 file hai lần). Đồng thuận cao.
2. **"Doubles Elimination" là dịch sai, phải là "Double Elimination"** — sửa `src/i18n/en.ts:222` trước.
3. **"Sân đấu." → "Highlights."** — cả hai độc lập chọn; giữ dấu chấm.
4. **Tab bar không cần động** — mọi nhãn EN ngắn hơn.
5. **Tên app không dịch**; App Store metadata viết riêng từng locale.
6. `.minimumScaleFactor` không rải đại trà — chỉ `TLSegmented` + `DuprHeaderChip`.

### Bất đồng

**(a) Cách sửa "không toggle" — bất đồng lớn nhất.**
- GPT-5.6: Blocker; selector trong Profile, **mặc định luôn Tiếng Việt** bất kể máy, `@AppStorage` + `.environment(\.locale,)` ở root.
- Tôi: đồng ý Blocker + cần control trong app, **không đồng ý default "luôn vi"** (phá nhánh EN, cùng lỗi đảo chiều nạn nhân).
- Chốt của tôi (để Cuong quyết): **default theo Region** (`Locale.current.region == "VN" ? "vi" : "en"`) + hàng Ngôn ngữ trong Profile (Tiếng Việt / English / Theo máy). Chi phí biên ~0 vì 14 formatter phải nhận `appLocale` dù có toggle hay không (B4). Đây là chỗ tôi không đồng ý với intake — mức Blocker, Cuong quyết.

**(b) B2 (ghép câu UserFacingError) — GPT bỏ sót hoàn toàn** dù brief đủ dữ kiện. Defect EN volume cao nhất + bug VI đang sống (`"verify không thành công."`). Giữ Blocker.

**(c) GPT liệt kê 12 Blocker = danh sách, không phải ưu tiên.** Tôi hạ 4 mục: tiền tệ đ→₫ (Nit), test VI (N9), a11y label (N7); giữ knownRegions Blocker (B7) vì là điều kiện tồn tại của cơ chế.

**(d) "Theo dõi" — GPT đoán "Following". Sai.** `TournamentsView.swift:35` enum `.watch`, bảng copy đã chốt "Watch".

**(e) GPT đề xuất hardcode `Locale(identifier: "en_US")` cho nhánh EN — không đồng ý.** Ép ngày kiểu Mỹ lên user Anh/Úc/Sing. Dùng `Locale(languageCode: .english)` hoặc giữ `Locale.current`.

## File đã tạo

- `docs/proposals/native-bilingual/external/ui-ux-critic-prompt.md` — brief nguyên văn gửi GPT-5.6 (self-contained, 191 dòng)
- `docs/proposals/native-bilingual/external/ui-ux-critic-reply.md` — reply nguyên văn (17.484 ký tự), session codex `019fa7b1-3fdb-7473-b4c1-9f2fb604020d`
