# GPT-5.6 reply — ui-ux-critic second opinion

- Provider: openai, model `gpt-5.6-sol`, reasoning effort xhigh, via `codex exec` (CLI 0.145.0)
- Session id: 019fa442-26a3-79f1-88f3-16db83ee726d
- Date: 2026-07-27
- Prompt sent: [`ui-ux-critic-gpt56-prompt.md`](./ui-ux-critic-gpt56-prompt.md) (self-contained brief, model had no repo access to the /apple sources)

> Verbatim below. Reconciliation with the Claude position lives in `round1/ui-ux-critic.md` — do not read this file as the panel verdict.

---

The right plan is not “port all 11.” Six need native redesign, three can keep their web information model, and two should stay out of the phone UI.

“Port as-is” below means feature/content parity—not copying the web layout.

## 1. Decision and court-side ranking

Ranking reflects a typical player between games, not an organizer setting up a venue.

1. **Remote push — REDESIGN — rank 1.**  
   Add APNs, but do not request permission on first launch. Show a native pre-permission `TLSheet` after the user follows a club, registers for an event, or watches a tournament. Offer granular preferences:

   - “Kết quả cần xác nhận”
   - “Livestream sắp bắt đầu”
   - “Sự kiện mới từ CLB”

   Every notification must deep-link to the exact native match/event/tournament. “Xác nhận kết quả” should open the confirmation screen, not confirm directly from the notification.

2. **Pro tournament detail — REDESIGN — rank 2.**  
   Remove “Xem trên web” as the primary action. Build a native detail with:

   - Summary header: status, title, date, organizer.
   - `TLSegmented`: “Thông tin / Lịch đấu / Nhánh đấu”.
   - “Lịch đấu”: vertical match cards grouped by day, with live matches first.
   - “Nhánh đấu”: a `TLSelect` for the round, followed by a vertical match list. Do not shrink a desktop bracket canvas onto the phone.
   - Native registration CTA in a bottom `safeAreaInset`, with corresponding scroll inset.
   - “Mở trang web” only as a secondary overflow action.

   If signed out, show native authentication and resume registration afterward.

3. **Organizer TV dashboard — DO NOT PORT to the phone — rank 11.**  
   A six-item, ten-second rotating venue display is not a phone interface. Keep the existing web dashboard as the normal solution. A legitimate native option would be an external-display companion, described below—not a miniature dashboard on the iPhone.

4. **Tournament tabs and filters — REDESIGN — rank 3.**  
   Keep the three content domains but replace the three stacked web tab rows with one primary switch plus filters. Detailed IA is below.

5. **Parent tournament page — PORT AS-IS — rank 6.**  
   Preserve the stage model, but render stages as a chronological vertical list of `TLCard`s. Each card gets its text status pill—“Sắp diễn ra”, “Vòng bảng”, “Playoff”, “Hoàn thành”—and opens that stage. Highlight the current stage with hierarchy plus text, not lime alone.

6. **Slots, perks, weekly recurrence — REDESIGN — rank 4.**  
   Do not add three more dense blocks to the existing event form.

   - “Nhóm đăng ký”: summary cards plus “Thêm nhóm”. Add/edit happens in a `TLSheet` containing time, level range, capacity, and other existing registration fields.
   - “Quyền lợi miễn phí”: repeatable rows, not a comma-separated text field.
   - “Lặp lại hằng tuần”: a toggle that reveals weekday and an explicit end condition.
   - Player registration: before confirmation, present a slot-selection `TLSheet` with radio-style cards showing time, level, availability, and capacity. Primary action: “Đăng ký nhóm này”.

   Autosave organizer drafts. Confirm before dismissing with unsaved edits.

7. **Invite club member — PORT AS-IS — rank 9.**  
   Add a full-height searchable sheet titled “Mời thành viên”. Use `.searchable`, debounce input, and show a vertical result list. Each result has avatar, name, username, membership state, and a 44pt “Mời” button. Do not expose phone numbers in results unless the current privacy model explicitly permits it.

8. **DUPR connect/disconnect — REDESIGN immediately — rank 8 for frequency, P0 for defect severity.**  
   Never send the user to the current signed-out `SafariView`.

   Tapping the disconnected chip should open a native `TLSheet` explaining the connection, then start `ASWebAuthenticationSession`. The backend should exchange the native session for a short-lived, single-use handoff and return through a callback URL. Never put the Supabase access token directly in a URL.

   Disconnect belongs in the DUPR/account screen behind a `TLDialog`:

   - Title: “Ngắt kết nối DUPR?”
   - Body: “Điểm DUPR sẽ không còn được đồng bộ với ThePickleHub.”
   - Actions: “Giữ kết nối” / “Ngắt kết nối”

9. **Registration recovery — DO NOT PORT as native UI — rank 10.**  
   This is a rare exception flow initiated from a recovery link, and Turnstile is better handled in a full browser context. Do not recreate the captcha in SwiftUI or an embedded `WKWebView`.

   Keep `/khoi-phuc-dang-ky` on the web and exclude it from native Universal Link interception. If surfaced from the app, open an authentication browser session with callback to the app after successful recovery. The web page needs a complete sign-in/recovery path, not another dead-end message.

10. **Public match permalink — REDESIGN — rank 5.**  
    Keep one canonical HTTPS URL for Facebook, Zalo, and SEO. In native:

    - Add “Chia sẻ” to the existing match-log screen using the system share sheet.
    - Map the HTTPS Universal Link to a read-only native match detail.
    - Allow that detail to load while signed out.
    - Reuse the normal match presentation; do not create a separate “native permalink” concept.
    - Recipients without the app continue to see the public web page.

11. **All videos page — PORT AS-IS — rank 7.**  
    “Xem tất cả” on Home should push `VideoBrowseView`. On a 390pt phone, use a vertical lazy list of full-width 16:9 thumbnails, title, source, duration, and live status. A two-column grid makes Vietnamese titles and touch targets too cramped. Do not autoplay while browsing.

## 2. Correct tournament IA at 390pt

Use this hierarchy:

1. Navigation title: **“Giải đấu”**
2. Primary control: `TLSegmented` with exactly:

   - “Nổi bật”
   - “Theo dõi”
   - “Cộng đồng”

3. Content-specific controls appear only under “Cộng đồng”:

   - Left `TLSelect`: visible value such as “Bàn nhanh”; accessibility label “Thể thức”.
   - Right `TLSelect`: visible value “Đang diễn ra”; accessibility label “Trạng thái”.

   Options:

   - Thể thức: “Bàn nhanh”, “Loại kép”, “Linh hoạt”, “Đấu đồng đội”
   - Trạng thái: “Đang diễn ra”, “Đã kết thúc”

At normal Dynamic Type, place the two selects side-by-side with an 8pt gap. At accessibility sizes, stack them full-width. They are filters, not another navigation tier, so they should not look like tabs.

Remove the count from “Cộng đồng N”. A changing count makes the segment width unstable and will truncate in Vietnamese. Put it in the content header instead: “24 giải đang diễn ra”.

At AX Dynamic Type sizes, replace the three-way segmented control with one full-width `TLSelect` labeled “Danh mục”. Do not shrink text with `minimumScaleFactor`.

State must deep-link and restore:

```text
/tournaments?tab=community&format=quick-tables&state=ongoing
```

The native router should apply all three values before first render, preserve each tab’s scroll/filter state, and avoid briefly showing “Nổi bật” when opening a Community deep link.

## 3. The real native answer for TV mode

The dashboard itself is inherently a large-display feature. The iPhone can be the controller.

A proper native version would contain two separate scenes:

**External screen**

- Landscape 16:9.
- 2×3 court-card grid: still exactly six items per page.
- Large score figures, court name, team names, and explicit “TRỰC TIẾP” or “TIẾP THEO” labels.
- Page indicator and connection status in a narrow header.
- Ten-second rotation.
- Visual match-ended indication accompanying every sound cue.
- No phone navigation, tab bar, or editing controls.

**Phone controller**

- Title: “Bảng hiển thị sân”
- Connection row: TV name and “Đã kết nối”
- Noninteractive preview thumbnail
- Large “Tạm dừng” or “Tiếp tục” button
- Previous / “Trang 2/4” / Next controls
- “Tự chuyển sau 10 giây” toggle
- “Âm báo khi trận kết thúc” toggle
- Destructive “Kết thúc trình chiếu”

If no external display is connected, show setup instructions and “Mở bản dành cho TV trên web”. Do not display the six-card grid on the phone.

Hardware keyboard shortcuts may remain as a bonus, but all actions need visible phone controls. Auto-rotation must stop while VoiceOver focus is interacting with the controller, and Reduced Motion should replace page animation with an immediate cross-fade.

## 4. Accessibility risks

The main concrete failures to prevent are:

- **Segment truncation:** “Cộng đồng N”, “Đang diễn ra”, and “Nhánh đấu” will fail at AX sizes. Use the adaptive selects above; never force single-line text.
- **Bracket accessibility:** a pinch/pan bracket canvas is effectively unusable with VoiceOver. Round selector plus ordered match list is the accessible phone representation.
- **Match-card speech:** do not let VoiceOver read concatenated numbers. A card should announce something like: “Sân 2. Đội An, 11 điểm. Đội Bình, 9 điểm. Đang diễn ra.”
- **Status by color:** lime, status dots, and stage highlights must always be accompanied by “Đang diễn ra”, “Đã kết thúc”, or the stage label.
- **Custom radio cards:** slot and filter rows need `.isSelected`; unavailable slots need `.isDisabled` and an announced reason such as “Đã đủ người”.
- **Nested targets:** do not make a result row tappable while also hiding a separate “Mời” action inside it. Keep the action’s focus and label distinct.
- **Badges as buttons:** `TLBadge` can remain visually small only when noninteractive. Any tappable badge must gain a 44×44pt hit area.
- **Flexible button height:** `TLButton` must remain `minHeight: 44`, not fixed at 44. “Khôi phục đăng ký khách” and “Đăng ký nhóm này” need two-line wrapping at AX5.
- **Sticky registration CTA:** include safe-area and scroll-bottom padding so the final match or description is not hidden.
- **Live refresh:** polling must not repeatedly steal VoiceOver focus. Announce only significant transitions, such as a match becoming final.
- **TV sound:** every sound event needs a persistent visual equivalent.
- **DUPR chip:** announce both state and action: “DUPR 3 phẩy 42, đã kết nối” or “Chưa kết nối DUPR. Chạm để kết nối.”
- **Motion:** do not fire selection haptics or animations when tab state was changed programmatically by a deep link.

## 5. Vietnamese state copy

Use `TLLoadingView` for initial screen loading and only an inline button progress indicator for mutations—never both simultaneously.

### Notifications

- Prompt title: “Đừng bỏ lỡ trận đấu”
- Body: “Nhận báo khi có kết quả cần xác nhận, livestream sắp bắt đầu hoặc CLB mở buổi chơi mới.”
- Actions: “Bật thông báo” / “Để sau”
- Empty: “Chưa có thông báo” — “Kết quả, lịch phát trực tiếp và tin từ CLB sẽ xuất hiện ở đây.”
- Error: “Không tải được thông báo” — “Kiểm tra kết nối rồi thử lại.”
- Offline: “Bạn đang ngoại tuyến” — “Đang hiển thị các thông báo đã lưu.”
- Permission denied: “Thông báo đang tắt” — action “Mở Cài đặt”

### Tournament hub

- Title: “Giải đấu”
- Featured empty: “Chưa có giải nổi bật”
- Watch empty: “Chưa có giải để theo dõi”
- Filtered empty: “Không tìm thấy giải phù hợp” — action “Xóa bộ lọc”
- Loading: tournament-card skeletons
- Error: “Không tải được giải đấu” — “Kiểm tra kết nối rồi thử lại.”
- Cached offline banner: “Đang xem dữ liệu đã lưu · Cập nhật lúc 09:42”

### Tournament detail

- Sections: “Thông tin”, “Lịch đấu”, “Nhánh đấu”
- Schedule empty: “Chưa có lịch đấu” — “Lịch thi đấu sẽ xuất hiện khi ban tổ chức công bố.”
- Bracket empty: “Chưa có nhánh đấu”
- Loading: match-card skeletons
- Error: “Không tải được giải đấu”
- Offline without cache: “Bạn đang ngoại tuyến” — “Kết nối mạng để xem lịch và kết quả mới nhất.”

### Parent tournament

- Section title: “Các giai đoạn”
- Empty: “Chưa có giai đoạn” — “Các giai đoạn sẽ xuất hiện khi ban tổ chức công bố.”
- Loading: stage-card skeletons
- Error: “Không tải được các giai đoạn”
- Offline: show cached stages with the saved-data banner

### Event editor and slot selection

- Section labels: “Nhóm đăng ký”, “Quyền lợi miễn phí”, “Lặp lại hằng tuần”
- Actions: “Thêm nhóm”, “Thêm quyền lợi”, “Đăng sự kiện”
- No slots: “Chưa có nhóm đăng ký” — “Thêm ít nhất một nhóm để người chơi chọn khi đăng ký.”
- Player-facing no availability: “Hiện chưa có nhóm phù hợp” — “Hãy quay lại sau hoặc liên hệ ban tổ chức.”
- Save progress: “Đang lưu…”
- Save error: “Không lưu được sự kiện” — keep entered values and identify the invalid field
- Offline: “Bản nháp đã lưu trên máy. Kết nối mạng để đăng sự kiện.”

### Member invitation

- Title: “Mời thành viên”
- Search prompt: “Tìm theo tên hoặc tên người dùng”
- Before search: “Nhập tên để tìm thành viên”
- No results: “Không tìm thấy thành viên”
- Existing states: “Đã trong CLB”, “Đã mời”
- Success: “Đã gửi lời mời”
- Error: “Không gửi được lời mời” — action “Thử lại”
- Offline: “Cần kết nối mạng để tìm và mời thành viên.”

Use “Mời” for the compact row button. “Mời vào câu lạc bộ” is too long for a trailing control.

### DUPR

- Title: “Kết nối DUPR”
- Body: “Kết nối tài khoản DUPR để đồng bộ điểm số với ThePickleHub.”
- Primary: “Tiếp tục với DUPR”
- Empty/disconnected: “Chưa kết nối DUPR”
- Loading: button label “Đang kết nối…”
- Error: “Không thể kết nối DUPR” — “Phiên kết nối chưa hoàn tất. Vui lòng thử lại.”
- Offline: “Cần kết nối mạng để kết nối DUPR.”

Use neutral “Bạn” or “Vui lòng”; remove the current gendered “Anh”.

### Public match

- Title: “Chi tiết trận đấu”
- Action: “Chia sẻ”
- Share text: “Xem kết quả trận đấu trên ThePickleHub: [liên kết]”
- Missing/removed: “Không tìm thấy trận đấu” — “Liên kết có thể đã hết hạn hoặc trận đấu đã bị xoá.”
- Loading: one match-detail skeleton
- Error: “Không tải được trận đấu”
- Offline: “Không thể mở trận đấu khi ngoại tuyến.” If cached, show it with the saved-data banner.

### Videos

- Title: “Tất cả video”
- Empty: “Chưa có video” — “Video mới sẽ xuất hiện tại đây.”
- Loading: thumbnail-and-text skeletons
- Error: “Không tải được video”
- Offline: “Kết nối mạng để tải và phát video.”
- Cached item playback failure: “Video này cần kết nối mạng để phát.”

### TV companion

- Disconnected: “Chưa kết nối màn hình” — “Kết nối TV hoặc màn hình ngoài để bắt đầu trình chiếu.”
- Action: “Chọn màn hình”
- Loading: “Đang kết nối…”
- Error: “Không thể kết nối màn hình” — action “Thử lại”
- Offline external display: “Mất kết nối · Đang hiển thị dữ liệu gần nhất”

Do not play new match-ended sounds while showing stale data.

## 6. Fix the existing authentication behavior first

“Tạo” and “Tham gia” must present native sign-in, not `thepicklehub.net/login` inside `SafariView`. Store the pending intent:

```text
joinClub(clubID)
createClub
registerTournament(tournamentID)
connectDUPR
```

After successful native authentication, resume that intent. If the user cancels, return them to the same screen with their existing scroll and input state intact.

This same contract must be used by tournament registration, club invitations, push deep links, and DUPR. Otherwise every newly ported feature will reproduce the current broken session boundary.

## 7. Biggest unasked risk

The largest risk is **losing the user’s intent across cold launch, authentication, and unreliable connectivity**.

A Facebook link may cold-launch the app, require login, encounter weak 4G, and resume after interruption. If the app lands on Home, loses the selected slot, repeats an invitation, or opens a signed-out web page, the feature is functionally absent even though its screen exists.

Tomorrow’s test should therefore begin from links and notifications—not Home—and cover:

- Cold and warm launch
- Signed in, signed out, and expired session
- Online, offline, and connection loss during submission
- Double-tapping a submit action
- Canceling and completing native authentication
- Returning via Back without losing filters or scroll
- VoiceOver and AX5 Dynamic Type


The UI/UX review framework materially shifts “parity” here from route count to complete task continuity. A smaller set with reliable deep links, auth resumption, cached reading, and safe retries is substantially more native—and more useful court-side—than eleven visible but brittle screens.
