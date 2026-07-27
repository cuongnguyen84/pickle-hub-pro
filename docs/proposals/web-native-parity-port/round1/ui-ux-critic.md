# UI/UX critic — vòng 1 (độc lập)

Panel: Claude (agent này, đọc repo) + GPT-5.6 `gpt-5.6-sol` (brief tự chứa, không
thấy repo). Prompt gửi đi + reply nguyên văn:
`../external/ui-ux-critic-gpt56-prompt.md` / `../external/ui-ux-critic-gpt56-reply.md`.

---

## Đánh giá tổng thể

"Port đầy đủ 11 gap trong một đêm" là một mệnh đề đếm màn hình, không phải mệnh đề
UX. Trong 11 gap thì **6 cái không được port 1:1** (port nguyên layout web sang là
tệ hơn hiện trạng), **2 cái không nên port lên phone chút nào vì lý do UX** (chứ
không phải vì tốn công), và **1 lỗi đang sống trên app hôm nay quan trọng hơn bất
kỳ gap nào trong danh sách**: người dùng đã đăng nhập trong app bị đá ra
`SFSafariViewController` ở trạng thái ĐĂNG XUẤT, tới một trang không có nút đăng
nhập. Cái đó phải sửa trước khi thêm bất cứ màn hình mới nào, vì mọi tính năng port
kiểu web-hop sẽ tái tạo lại đúng vách đá đó.

Với người đứng ở sân lúc 19h, cầm một tay, 4G phập phù: thứ họ cần không phải 11
màn hình mới. Họ cần **một luồng không đứt** từ link Facebook → màn hình đúng →
đăng nhập native → làm xong việc. Ba gap phục vụ điều đó (push, tournament detail
native, match permalink + deep link). Số còn lại là nice-to-have.

---

## Luồng người dùng

Thực tế deep-link, không phải IA:

```
Facebook/Zalo link  ──►  cold launch app (universal link)
        │                        │
        │                        ├─► chưa đăng nhập ──► ??? (xem Blocker #1)
        │                        └─► đã đăng nhập  ──► màn hình đích
        │
        └─► không có app ──► web prod (đây là lý do /tran-dau/:slug phải ở lại web)
```

Ba điểm đứt luồng đang tồn tại trong `/apple` hôm nay:

1. **Đứt ở ranh giới auth.** `Features/Clubs/ClubsListView.swift:81` và
   `Features/Clubs/ClubDetailView.swift:215` — khi `uid == nil`, app mở
   `WebRoutes.base/login` trong `SafariView` thay vì màn hình `LoginView` mà app
   ĐÃ CÓ SẴN. Người dùng native đăng nhập bằng Google/phone-OTP (session ở
   keychain); `SFSafariViewController` dùng cookie jar của Safari.app, nên họ tới
   một form đăng nhập trống, phải nhập lại bằng một cơ chế khác, rồi quay lại app
   và vẫn chưa vào được CLB vì ý định (`joinClub(id)`) đã mất.

2. **Đứt ở DUPR.** `AppTabView.swift:104` mở `WebRoutes.dupr` khi chưa kết nối.
   Trang đó (`src/pages/DuprConnect.tsx:72-86`) khi `!user` render đúng hai dòng
   chữ: *"Cần đăng nhập" / "Anh đăng nhập ThePickleHub rồi quay lại trang này để
   kết nối DUPR."* — **không có nút đăng nhập nào cả**. Đây là ngõ cụt hoàn toàn,
   và nó nằm ngay trên thanh top bar của Home.

3. **Đứt ở tournament.** `TournamentDetailView.swift` kết thúc bằng một nút lime
   full-width "Xem trên web" — nút to nhất, sáng nhất màn hình, và nó dẫn ra khỏi
   app tới một trang cũng đăng xuất.

Điểm ra (exit) mà thiết kế hiện tại KHÔNG có: sau khi đăng nhập, quay lại đúng
chỗ đang dở. Không có `pendingIntent` nào trong `/apple`.

---

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | Web-hop = vách đá auth. Native session (keychain) không đi vào `SFSafariViewController`. 3 call site: `ClubsListView.swift:81`, `ClubDetailView.swift:215`, `AppTabView.swift:104`. | Xoá cả 3 chỗ mở `/login` qua `SafariView`. Present `LoginView` native trong sheet. Thêm một enum ý định lưu trước khi mở login (`joinClub(UUID)`, `createClub`, `connectDUPR`, `registerTournament(UUID)`) và resume sau khi auth thành công, giữ nguyên scroll + input. Đây là contract dùng chung cho MỌI gap port sau này. |
| 2 | **Blocker** | `/dupr` web-hop dẫn tới màn hình chết không nút. Ngay cả khi sửa #1, tab DUPR vẫn không thể hoàn tất từ native vì flow kết nối nằm sau web session. | Ngắn hạn (đủ cho sáng mai): mở `TLSheet` native giải thích DUPR + nút "Tiếp tục với DUPR" chạy `ASWebAuthenticationSession` (chia sẻ được cookie có kiểm soát + callback về app), KHÔNG dùng `SafariView`. Nếu không kịp: **tắt tap của chip DUPR khi chưa kết nối** và đổi nó thành nhãn tĩnh — một chip không bấm được tốt hơn một chip dẫn vào ngõ cụt. Không được để nguyên như hôm nay. |
| 3 | **Blocker** | `TournamentDetailView` đặt "Xem trên web" làm CTA chính (`TLPrimaryButton`, lime, full-width). Trên viewport 390pt, thứ to nhất màn hình là hành động **rời khỏi app**. | Hạ xuống secondary (`TLButton(kind: .outline)`) hoặc đưa vào overflow menu, đổi nhãn "Mở trên web". Nếu chưa kịp làm detail native đầy đủ thì ít nhất phải hạ cấp nút này — đây là 1 dòng sửa, không phải một feature. |
| 4 | **Nên sửa** | `/tournaments` 3 tab + 4 tab format + ongoing/ended nếu port 1:1 = ba hàng control chồng nhau, chiếm ~140pt trên màn 390×844 trước khi có một chữ nội dung nào. Ở AX Dynamic Type thì 4 segment format ("Chia bảng"/"Loại kép"/"Tùy chỉnh"/"Đồng đội") chắc chắn tràn. | Một tầng điều hướng duy nhất là `TLSegmented` 3 mục (`Nổi bật` / `Theo dõi` / `Cộng đồng`). Format + trạng thái xuống làm **filter bằng `TLSelect`** (đã có sẵn trong DS, `minHeight: 44`, Menu-based) đặt cạnh nhau, 8pt gap; ở size AX thì stack dọc full-width. Filter không được trông giống tab. |
| 5 | **Nên sửa** | Count trong nhãn segment `"Cộng đồng \(count)"` (`TournamentsView.swift:39`) làm segment đổi độ rộng theo dữ liệu → nhảy layout khi load xong, và tràn ở AX size. | Bỏ count khỏi nhãn segment. Đưa vào header danh sách: `"24 giải đang diễn ra"`. Giữ độ rộng segment cố định. |
| 6 | **Nên sửa** | **Gap thứ 12 mà recon bỏ sót**: badge social-proof số người đăng ký (`X người đã đăng ký` / `X đội đã đăng ký`, ship web ở #429, `src/pages/Tournaments.tsx:78-84`) KHÔNG có trên native. `CommunityCard` (`TournamentsView.swift:132-158`) chỉ hiện `metaLine` + `dateText`. | Thêm vào `metaLine` của `CommunityCard` theo đúng quy tắc web: chỉ hiện khi registration-open và `n >= REG_BADGE_MIN`, và **thay thế** token quota chứ không đứng cạnh (web cố tình tránh bẫy "hai số, số nào là số nào"). Đây là S-size, giá trị/công cao nhất trong cả danh sách. |
| 7 | **Nên sửa** | Tên format lệch nhau **trong chính app native**: `ToolsView.swift:210` gọi Doubles Elimination là **"Loại trực tiếp"**, `ToolsModels.swift:134` gọi cùng thứ đó là **"Loại kép"**. Web gọi `"Doubles Elim · Loại kép"`. Người dùng thấy hai tên cho một thứ, và không có tên tiếng Anh đi kèm để đoán ra. | Chốt một tên, đồng bộ với web: **"Loại kép"**. Sửa `ToolsView.swift:210`. (Ghi chú riêng: "loại kép" dịch double-elimination là chưa chuẩn với cách cộng đồng VN nói — họ nói "nhánh thắng / nhánh thua". Nhưng đổi thuật ngữ là việc của cả web + native cùng lúc, không phải việc của đêm nay.) |
| 8 | **Nên sửa** | Bracket của tournament nếu port kiểu canvas pinch/pan sang phone = không dùng được một tay, và với VoiceOver là không dùng được hoàn toàn. | Không vẽ lại canvas. Native = `TLSelect` chọn vòng ("Tứ kết", "Bán kết"…) + danh sách match card dọc. Đọc được bằng VoiceOver, cuộn được một ngón. |
| 9 | **Nên sửa** | Slots / perks / weekly recurrence nếu nhét thẳng vào form tạo sự kiện hiện có = form đã dài lại dài thêm 3 khối, trên màn hình mà organizer thường điền lúc đang ở sân. | Mỗi thứ một affordance riêng: "Nhóm đăng ký" = list card tóm tắt + nút "Thêm nhóm" mở `TLSheet`; "Quyền lợi miễn phí" = repeatable row (KHÔNG phải text field phẩy); "Lặp lại hằng tuần" = toggle, mở ra thứ trong tuần + điều kiện kết thúc khi bật. Phía player: sheet chọn nhóm với card kiểu radio (giờ, trình, còn chỗ). |
| 10 | **Nit** | `TLButton` dùng `.frame(maxWidth: .infinity, minHeight: 44)` — đúng. Nhưng các nhãn VI dài mà gap này sinh ra ("Đăng ký nhóm này", "Khôi phục đăng ký khách") cần xuống 2 dòng ở AX5. | Giữ `minHeight` (không đổi thành `height`), và không dùng `minimumScaleFactor` để ép 1 dòng. |
| 11 | **Nit** | `TLBadge` cỡ chữ 10pt mono. Không sao khi nó là nhãn tĩnh. Nếu port `TournamentStatusBadge` thành thứ bấm được (lọc theo trạng thái) thì vùng chạm chỉ ~20pt. | Badge bấm được phải bọc `.contentShape` 44×44 hoặc chuyển sang `TLIconButton`/`TLSelect`. |

### Gap KHÔNG NÊN PORT (lý do UX, không phải lý do công sức)

- **`/tools/dashboard` TV-mode.** Web version là lưới **6 item/trang, tự xoay 10
  giây**, fullscreen, điều khiển bằng bàn phím ←/→/Space/Esc. Chức năng của nó là
  *người chơi đứng cách 4 mét nhìn xem tới lượt mình chưa*. Nhồi 6 thẻ đó vào 390pt
  cho ra chữ ~8pt — không đọc được ở khoảng cách 4 mét, mà cũng không đọc được ở
  khoảng cách 30cm vì nó quá dày. Và cái phone đó nằm trong túi của organizer chứ
  không dựng ở bàn ghi điểm. Đây là tính năng của **màn hình lớn**, không phải của
  phone. Câu trả lời native đúng là external display + phone làm remote — nhưng đó
  là một build riêng, không phải một port (xem bất đồng với GPT-5.6 bên dưới).
- **`/khoi-phuc-dang-ky` (recovery + Turnstile).** Flow ngoại lệ, tần suất gần 0,
  luôn khởi phát từ một link. Turnstile trong `WKWebView` là chỗ hỏng kinh điển
  (challenge fail câm, không có UI để báo). Để nguyên trên web. Việc phải làm là
  **loại route này khỏi Universal Link interception** để app không nuốt link rồi
  không hiển thị được gì.
- **`/tran-dau/:slug` như một "màn hình permalink native" riêng.** Không tạo khái
  niệm mới. URL HTTPS phải giữ nguyên một bản canonical cho Facebook/Zalo/SEO. Việc
  native cần làm chỉ là: (a) thêm "Chia sẻ" (system share sheet) vào màn match log
  đã có, (b) map universal link đó vào màn match detail **đọc được khi chưa đăng
  nhập**. Người nhận không có app vẫn thấy trang web như cũ.

### Gap BẮT BUỘC REDESIGN khi port

Push (pre-permission sheet + deep link chính xác, không xin quyền lúc first
launch), tournament detail (segmented Thông tin/Lịch đấu/Nhánh đấu, CTA đăng ký
native ở `safeAreaInset` đáy), tournaments IA (mục 4), slots/perks/recurrence
(mục 9), DUPR (mục 2), bracket (mục 8).

### Gap port thẳng được (giữ nguyên mô hình thông tin)

Parent tournament page (list dọc `TLCard` mỗi giai đoạn + status pill chữ), club
invite by search (`.searchable` sheet, nút "Mời" 44pt mỗi dòng), trang tất cả
video (list dọc full-width 16:9 — KHÔNG grid 2 cột, title VI sẽ vỡ).

---

## Trạng thái màn hình

Quy tắc nhà đã có sẵn, tái dùng chứ đừng chế: `TLLoadingView` (skeleton redacted)
cho tải màn hình lần đầu; spinner **chỉ** nằm trong nút (`TLButton.isLoading`) cho
mutation. Không bao giờ hai cái cùng lúc.

| Màn | Empty | Loading | Error | Offline |
|---|---|---|---|---|
| Tournaments hub | "Chưa có giải nổi bật" / lọc rỗng: "Không tìm thấy giải phù hợp" + "Xóa bộ lọc" | `TLLoadingView` skeleton card | `TLErrorState("Không tải được giải đấu", "Kiểm tra kết nối rồi thử lại.")` | Banner: "Đang xem dữ liệu đã lưu · Cập nhật 09:42" |
| Tournament detail | Lịch: "Chưa có lịch đấu" / "Lịch thi đấu sẽ xuất hiện khi ban tổ chức công bố." · Nhánh: "Chưa có nhánh đấu" | skeleton match card | "Không tải được giải đấu" | Có cache → hiện + banner. Không cache → "Bạn đang ngoại tuyến / Kết nối mạng để xem lịch và kết quả mới nhất." |
| Notifications | "Chưa có thông báo" / "Kết quả, lịch phát trực tiếp và tin từ CLB sẽ xuất hiện ở đây." | skeleton row | "Không tải được thông báo" | "Đang hiển thị các thông báo đã lưu." |
| Mời thành viên | Chưa gõ: "Nhập tên để tìm thành viên" · Không kết quả: "Không tìm thấy thành viên" | spinner trong ô search, KHÔNG skeleton (kết quả đến nhanh) | "Không gửi được lời mời" + "Thử lại" | "Cần kết nối mạng để tìm và mời thành viên." |
| Tạo/sửa sự kiện | "Chưa có nhóm đăng ký" / "Thêm ít nhất một nhóm để người chơi chọn khi đăng ký." | — | "Không lưu được sự kiện" + **giữ nguyên giá trị đã nhập**, chỉ ra field sai | "Bản nháp đã lưu trên máy. Kết nối mạng để đăng sự kiện." |
| Tất cả video | "Chưa có video" / "Video mới sẽ xuất hiện tại đây." | skeleton thumbnail + 2 dòng | "Không tải được video" | "Kết nối mạng để tải và phát video." |
| Match permalink | Không tồn tại: "Không tìm thấy trận đấu" / "Liên kết có thể đã hết hạn hoặc trận đấu đã bị xoá." | 1 skeleton detail | "Không tải được trận đấu" | "Không thể mở trận đấu khi ngoại tuyến." |

Ghi chú offline riêng cho native: app không phải PWA precached — không có shell
offline. Mọi màn hình mới phải chấp nhận "không có gì để hiện" là một trạng thái
hợp lệ, và **không được** hiện skeleton vô tận khi request fail vì mất mạng. Đó
đúng là cái `TLErrorState` sinh ra để làm.

---

## Accessibility (WCAG 2.1 AA / iOS)

Đã kiểm bằng đọc code, chưa chạy Accessibility Inspector:

**Sạch, tái dùng được:**
- `TLIconButton` bắt buộc `label` ở init — a11y label không thể quên được ở
  compile time. Đây là pattern tốt nhất trong DS; mọi icon button mới phải đi qua nó.
- `TLButton` `minHeight: 44`, `TLSelect` `minHeight: 44` — đạt chuẩn.
- `TLSegmented` set `.isSelected` đúng và ghép indicator dot vào accessibility
  label (`label + ", " + indicatorHint`) — không truyền trạng thái chỉ bằng màu.
- `TLSheet` luôn bọc `ScrollView` — chống clip nút confirm ở Dynamic Type lớn.
- `TLEmptyState` dùng `@ScaledMetric` cho icon.
- `TLLoadingView` có `.accessibilityLabel("Đang tải")`.

**Rủi ro cụ thể trong các port đề xuất:**
1. **Truncation ở AX size** — `"Cộng đồng \(count)"`, `"Đang diễn ra"`, `"Nhánh đấu"`
   trong `TLSegmented`. Ở AX3+ phải chuyển 3-way segmented thành một `TLSelect`
   full-width nhãn "Danh mục". Không `minimumScaleFactor`.
2. **Match card đọc thành chuỗi số vô nghĩa** — phải gộp `accessibilityElement(children: .combine)`
   và viết label rõ: "Sân 2. Đội An 11 điểm. Đội Bình 9 điểm. Đang diễn ra."
3. **Trạng thái chỉ bằng màu lime** — `CommunityCard` hiện `s.isAccent` đổi màu nền
   badge; chữ trong badge đã có (`s.label`) nên hiện tại OK. Giữ nguyên quy tắc đó
   cho stage pill của parent tournament.
4. **Slot card kiểu radio** — cần `.isSelected`; slot hết chỗ cần `.isDisabled` +
   lý do đọc được ("Đã đủ người").
5. **Row có nút lồng trong** — dòng kết quả tìm thành viên vừa tap được vừa chứa nút
   "Mời" thì VoiceOver focus sẽ nhập nhằng. Tách rõ hai element.
6. **DUPR chip** phải đọc cả trạng thái lẫn hành động: "Chưa kết nối DUPR. Chạm để
   kết nối." (hiện tại `AppTabView.swift` chỉ đặt label cho các icon xung quanh).
7. **Live refresh cướp focus** — polling không được reload list làm VoiceOver nhảy
   về đầu. Chỉ announce chuyển trạng thái đáng kể.
8. **Haptic/animation khi deep link đổi tab bằng code** — `TLSegmented` gọi
   `Haptics.light()` trong action của Button nên deep link (set binding trực tiếp)
   không kích hoạt; đúng rồi, đừng phá.

Chưa kiểm được (cần máy thật, ghi vào manual-test-backlog): tương phản thực tế của
`TLColor.fg3`/`fg4` trên `TLColor.surface` ở màn hình ngoài trời — bản web đã từng
fail contrast `.tl-filter.active .count` ở 3.7:1 (memory `lighthouse-ci-failing-repo-wide`),
và các token native là bản port của cùng bảng màu đó.

---

## Copy đề xuất (VI / EN)

Chuỗi sẵn để dán. Native hiện chỉ có VI (không có i18n layer) — giữ nguyên, EN chỉ
để đối chiếu nghĩa.

```
// Đăng nhập native thay cho web-hop
"Đăng nhập để tiếp tục"                    / Sign in to continue
"Đăng nhập rồi quay lại đúng chỗ anh đang xem."  ← KHÔNG dùng: xem ghi chú xưng hô
"Đăng nhập xong sẽ quay lại đúng chỗ bạn đang xem." / You'll come back to where you left off.

// DUPR
"Kết nối DUPR"                             / Connect DUPR
"Kết nối tài khoản DUPR để đồng bộ điểm số với ThePickleHub." / Connect your DUPR account to sync your rating.
"Tiếp tục với DUPR"                        / Continue with DUPR
"Chưa kết nối DUPR"                        / DUPR not connected
"Đang kết nối…"                            / Connecting…
"Không kết nối được DUPR"                  / Couldn't connect DUPR
"Phiên kết nối chưa hoàn tất. Thử lại nhé." / The connection didn't finish. Try again.
"Ngắt kết nối DUPR?"                       / Disconnect DUPR?
"Điểm DUPR sẽ không còn được đồng bộ với ThePickleHub." / Your DUPR rating will stop syncing.
"Giữ kết nối" / "Ngắt kết nối"             / Keep connected / Disconnect

// Push — pre-permission (KHÔNG hỏi lúc first launch)
"Đừng bỏ lỡ trận"                          / Don't miss a match
"Nhận báo khi có kết quả cần xác nhận, livestream sắp bắt đầu, hoặc CLB mở buổi chơi mới."
                                           / Get notified for results to confirm, livestreams starting, and new club sessions.
"Bật thông báo" / "Để sau"                 / Turn on notifications / Not now
"Thông báo đang tắt" + "Mở Cài đặt"        / Notifications are off + Open Settings

// Tournaments
"Giải đấu"                                 / Tournaments
"Nổi bật" / "Theo dõi" / "Cộng đồng"       / Featured / Watch / Community
"Thể thức" (a11y label) — giá trị: "Chia bảng" / "Loại kép" / "Tùy chỉnh" / "Đồng đội"
"Trạng thái" (a11y label) — giá trị: "Đang diễn ra" / "Đã kết thúc"
"24 giải đang diễn ra"                     / 24 tournaments in progress
"Không tìm thấy giải phù hợp" + "Xóa bộ lọc" / No tournaments match + Clear filters
"Thông tin" / "Lịch đấu" / "Nhánh đấu"     / Info / Schedule / Bracket
"Mở trên web"                              / Open on the web    ← thay "Xem trên web", và hạ xuống secondary

// Social proof (gap 12)
"\(n) người đã đăng ký"                    / n players registered
"\(n) đội đã đăng ký"                      / n teams registered

// Mời thành viên
"Mời thành viên"                           / Invite member
"Tìm theo tên hoặc tên người dùng"         / Search by name or username
"Nhập tên để tìm thành viên"               / Type a name to search
"Không tìm thấy thành viên"                / No members found
"Mời"  ← nút trong dòng. KHÔNG dùng "Mời vào câu lạc bộ" (dài, vỡ trailing control)
"Đã trong CLB" / "Đã mời" / "Đã gửi lời mời"  / Already a member / Invited / Invite sent

// Slots
"Nhóm đăng ký" / "Thêm nhóm"               / Registration slots / Add slot
"Quyền lợi miễn phí" / "Thêm quyền lợi"    / Free perks / Add perk
"Lặp lại hằng tuần"                        / Repeat weekly
"Đăng ký nhóm này"                         / Register for this slot
"Đã đủ người"                              / Slot full
"Chưa có nhóm đăng ký" / "Thêm ít nhất một nhóm để người chơi chọn khi đăng ký."
"Hiện chưa có nhóm phù hợp" / "Quay lại sau hoặc liên hệ ban tổ chức."

// Match
"Chi tiết trận đấu" / "Chia sẻ"            / Match detail / Share
"Xem kết quả trận đấu trên ThePickleHub: [link]"
"Không tìm thấy trận đấu" / "Liên kết có thể đã hết hạn hoặc trận đấu đã bị xoá."
```

**Ghi chú xưng hô — cần chốt với Cuong.** Trang web `DuprConnect.tsx:81` viết
*"Anh đăng nhập ThePickleHub rồi quay lại trang này…"*. "Anh" xưng hô người đọc là
nam và lớn tuổi hơn; với ~95% người dùng VN trong đó có nữ, đây là copy sai đối
tượng. Tôi đã kiểm: **native `/apple` không có chuỗi "Anh" nào** — copy native
hiện đã trung tính. Vậy đây là lỗi của **web**, không phải của native, và nó là
lý do thêm để không port kiểu web-hop. Đề xuất chuẩn cho cả hai: dùng "bạn" hoặc
bỏ hẳn chủ ngữ ("Đăng nhập rồi quay lại trang này…").

---

## Panel đa model

**Cảnh báo về tính độc lập:** brief gửi GPT-5.6 đã mô tả sẵn hiện trạng web-hop và
trích copy "Cần đăng nhập". Nên **sự đồng thuận về việc "web-hop là ngõ cụt" KHÔNG
phải là hai model độc lập cùng phát hiện** — tôi phát hiện, rồi kể cho nó nghe. Cái
thực sự độc lập là *hình dạng của cách sửa*.

### Đồng thuận Claude + GPT-5.6

1. **Sửa ranh giới auth trước mọi thứ khác.** Cả hai độc lập đưa ra cùng một cơ chế
   mà tôi không hề gợi ý trong brief: lưu *pending intent* (`joinClub`, `connectDUPR`,
   `registerTournament`) trước khi mở login native, resume sau khi auth xong. Hai
   vendor khác nhau tới cùng một giải pháp cụ thể → tin cậy cao.
2. **TV-mode không lên phone.** Cả hai xếp nó hạng chót và vì cùng lý do (6 item ×
   10 giây là ngôn ngữ của màn hình lớn).
3. **`/tournaments`: 3 tab giữ lại, format + trạng thái xuống làm filter dropdown,
   bỏ count khỏi nhãn segment.** Trùng khớp gần như từng chữ, kể cả lý do bỏ count
   (segment đổi độ rộng theo dữ liệu).
4. **Bracket = chọn vòng + list dọc, không phải canvas thu nhỏ.** Cùng lý do a11y.
5. **Recovery/Turnstile ở lại web** và phải loại khỏi universal-link interception.
6. **Match permalink: một URL canonical, native chỉ cần share sheet + universal
   link vào màn hình đọc-được-khi-đăng-xuất.** Không tạo khái niệm màn hình mới.
7. **Push phải có pre-permission sheet, không xin quyền lúc first launch**, và deep
   link phải tới đúng màn, không phải Home.

### Bất đồng

**(a) TV-mode: có nên build bản native "external display + phone làm remote" không?**
- *GPT-5.6:* có, và mô tả khá chi tiết hai scene (màn ngoài 2×3 landscape; phone là
  controller với "Tạm dừng", "Trang 2/4", toggle âm báo, "Kết thúc trình chiếu").
- *Tôi:* đồng ý đó là câu trả lời native **đúng**, nhưng nó là một **build mới hoàn
  toàn**, không phải một "port", và GPT không thấy được ràng buộc thời gian trong
  intake. Multi-scene external display trên iOS (`UIWindowScene` role `.external`)
  có support SwiftUI mỏng, cần thiết bị thật + adapter để test, và Cuong test tay
  **sáng mai**.
- **Chốt:** với vòng này, gap #3 = **KHÔNG PORT, KHÔNG BUILD**. Ghi bản two-scene
  của GPT vào backlog như phương án đúng cho sau này. Nếu buộc phải có gì đó trong
  app đêm nay thì thứ rẻ nhất và không sai là một dòng trong Tools: "Bảng hiển thị
  sân — mở trên web" (một `SafariView`, dashboard này organizer xem chứ không cần
  đăng nhập ở mức tương tác). Lý do chốt: một feature màn-hình-ngoài build vội,
  không test được trên phần cứng thật trước khi Cuong cầm máy, sẽ hỏng câm ngay
  trên tay Cuong sáng mai — tệ hơn là không có.

**(b) Xếp hạng "Mời thành viên bằng tìm kiếm" (gap 7).**
- *GPT-5.6:* hạng 9/11 (tần suất thấp).
- *Tôi:* cao hơn, nhóm giữa. GPT không thấy được thứ tôi thấy trong repo: club
  management native hiện **chỉ approve/remove** request có sẵn, nghĩa là một CLB
  mới tạo trên native **không có cách nào có thành viên đầu tiên** ngoài việc chờ
  người ta tự tìm ra. Đó không phải tần suất thấp, đó là bế tắc cold-start.
- **Chốt:** theo tôi — đẩy lên ngang hàng với parent tournament page. Nó là S-size
  và mở khoá cả một luồng.

**(c) Thứ GPT-5.6 bỏ sót hoàn toàn** (vì không đọc được repo, không phải lỗi của nó):
badge social-proof số người đăng ký thiếu trên native (mục 6 bảng trên) và tên
format lệch nhau giữa `ToolsView.swift:210` và `ToolsModels.swift:134` (mục 7). Cả
hai đều là S-size, cả hai đều nằm trên màn hình mà người dùng court-side nhìn nhiều
nhất. Đây là lý do panel cần một model **đọc được repo** bên cạnh một model không.

### Rủi ro lớn nhất của cả kế hoạch (GPT nêu, tôi đồng ý và ưu tiên cao hơn cả nó)

Mất **ý định của người dùng** qua ranh giới cold-launch → auth → mạng chập chờn. Một
link Facebook có thể cold-launch app, đòi đăng nhập, gặp 4G yếu, rồi resume. Nếu app
rơi về Home, mất slot đã chọn, gửi lại lời mời lần hai, hoặc mở một trang web đăng
xuất — thì tính năng đó **không tồn tại**, dù màn hình của nó có thật.

Vì vậy buổi test sáng mai **phải bắt đầu từ link và từ notification, không phải từ
Home**. Ma trận tối thiểu: cold launch × (đã đăng nhập / chưa / session hết hạn) ×
(online / offline / rớt mạng giữa lúc submit), cộng double-tap nút submit, huỷ giữa
chừng luồng đăng nhập, và Back mà không mất filter/scroll. Nếu chỉ test bằng cách
mở app từ icon rồi bấm quanh, sẽ không bắt được lỗi nào trong ba lỗi Blocker ở trên.
