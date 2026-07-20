# UI/UX critique — cụm UX-06 (undo) + UX-07 (discovery→đăng ký)

Agent: `ui-ux-critic` (+ GPT-5.6, panel đủ 2 model) · 2026-07-20 · vòng 1 độc lập

> Mọi phát hiện dưới đây tôi **tự mở file kiểm chứng**, không tin recon.
> Panel ngoài: `external/ui-ux-critic-gpt.md` (prompt + reply nguyên văn, `.meta.json` pin `gpt-5.6`).

---

## 0. Kiểm chứng recon — bản đính chính ĐÚNG phần khung, SAI phần kết luận quan trọng nhất

Bản đính chính vòng 0 đúng về cấu trúc tab (`Tournaments.tsx:25,338-341,64-111,459,553,125` — tôi đọc lại toàn file, khớp).

**Nhưng nó vẫn sai một dòng, và đúng cái dòng quyết định trải nghiệm thật:**

> Đính chính viết: *"`Tournaments.tsx:145` — mặc định rơi về tab `community` khi không có nội dung watch"*

Đọc code thật:

```
Tournaments.tsx:144   const hasWatchContent = tournaments.length > 0 || liveStreams.length > 0;
Tournaments.tsx:145   const tab: Tab = userTab ?? (hasWatchContent ? "watch" : "community");
```

`tournaments` đến từ `useTournaments()` — `useTournamentData.ts:21-33` — `select("*")` **không lọc status, không limit**. Nghĩa là mọi giải pro đã kết thúc từ năm ngoái vẫn được đếm. Trên prod luôn có ít nhất một row `tournaments`, nên `hasWatchContent` **luôn true**.

→ **`/tournaments` trên production KHÔNG BAO GIỜ mặc định vào tab Cộng đồng. Luôn mở ở "Xem Pro".**

Đính chính mô tả nhánh `false` của ternary như thể đó là hành vi thực tế; nhánh đó là code chết. Người chơi nhận link Zalo "đăng ký đi anh" rơi vào danh sách phát sóng pro phần lớn đã kết thúc. Đây là **blocker của UX-07**, và nó không phải vấn đề thiết kế — nó là **bug logic mặc định**, sửa bằng vài dòng.

---

## Đánh giá tổng thể

Hai cụm này không cân nhau về mức chín. **UX-07 có một blocker thật, đo được, sửa rẻ** (tab mặc định + tường đăng nhập). **UX-06 thì Cuong nói đúng: "chưa từng đau thật"** — và dữ liệu ủng hộ việc KHÔNG xây cơ chế undo toàn cục. Nhưng khi soi file, tôi tìm thấy thứ khác hẳn thứ roadmap đặt tên: **cường độ xác nhận đang bị đảo ngược**. Thao tác KHÔI PHỤC ĐƯỢC (huỷ social event, `status='cancelled'`) bắt gõ lại tên đầy đủ; thao tác HARD DELETE cascade phá đăng ký + lịch sử trận + tiền của NGƯỜI KHÁC (`MyTournaments.tsx:549-577`) chỉ có dialog 2 nút và một câu chung chung không nêu con số nào. Undo không phải câu trả lời ở đây — **nói thật về hậu quả** mới là.

Với người đứng ở sân Sài Gòn: UX-06 gần như vô hình (họ không xoá giải). UX-07 là toàn bộ trải nghiệm của họ.

---

## Luồng người dùng

**UX-07 — người chơi (95% traffic thật của tính năng này):**

```
Zalo/Facebook link
  ├─(a) deep link thẳng /tools/<format>/<share_id>   ← đường phổ biến nhất
  │     → form → TƯỜNG ĐĂNG NHẬP (RegistrationForm.tsx:201-229) → CHẾT
  └─(b) link /tournaments
        → mở ở tab "Xem Pro" (KHÔNG phải Cộng đồng — mục 0)
        → phải tự hiểu bấm "Cộng đồng"
        → chọn 1 trong 4 sub-tab thể thức (mà họ không biết bạn mình dùng cái nào)
        → cuộn ~1.070px
        → item giải → /tools/<format>/<share_id> → TƯỜNG ĐĂNG NHẬP → CHẾT
```

Cả hai nhánh kết thúc ở cùng một bức tường. Đường (a) bỏ qua toàn bộ vấn đề trang list — nên **sửa tường đăng nhập có đòn bẩy cao hơn sửa trang list**, dù trang list hỏng rõ hơn.

Đo chiều cao thật trên 390px (từ CSS, không ước lượng mò):

| Khối | file:line | Cao |
|---|---|---|
| breadcrumb | `Tournaments.tsx:222-226` | ~40px |
| `.tl-page-head` (kicker + h1 3 dòng 34px + p 3-4 dòng) | `the-line.css:2156-2182`, `Tournaments.tsx:228-248` | ~274px |
| `.tl-hub-cards` — 1 cột ở ≤800px, 2 thẻ × `min-height:260px` | `the-line.css:3464,3473` | ~530px |
| tabs chính | `Tournaments.tsx:328-343` | ~48px |
| sub-tab thể thức | `:488-502` | ~44px |
| sub-tab trạng thái | `:505-519` | ~44px |
| section head | `:523-534` | ~90px |
| **Cộng trước item giải đầu tiên** | | **~1.070px** |

Viewport hữu dụng Android tầm trung ≈ 780-800px → **~1,4 màn hình, 2 lần vuốt đầy**, và đó là khi đã ở đúng tab.

**UX-06 — organizer:** vào `/my-tournaments` → icon thùng rác → dialog → xoá. Không có bước nào cho họ biết đang phá cái gì.

---

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** (UX-07) | `/tournaments` luôn mở ở tab "Xem Pro" vì `hasWatchContent` đếm cả giải pro đã kết thúc — `Tournaments.tsx:144-145` + `useTournamentData.ts:21-33` (`select("*")`, không lọc status). Người chơi đến để đăng ký rơi vào danh sách phát sóng cũ. | Đảo mặc định: `const tab = userTab ?? "community"`. Không cần "sửa query cho thông minh hơn" — người chơi là đa số, `?tab=watch` vẫn deep-link được (`:125`). 1 dòng. |
| 2 | **Blocker** (UX-07) | Tường đăng nhập cứng ở đúng đỉnh ý định: `RegistrationForm.tsx:201-229` `if (!user)` → `navigate("/login?redirect=...")`. Social event cho khách đăng ký bằng OTP; 4 thể thức giải thì không có đường khách nào. Người nhận link Zalo phải tạo tài khoản trước khi ghi tên. | Tái dùng đúng cặp RPC + OTP của social event cho đường giải. **Không** thiết kế cơ chế thứ hai. Chi tiết §"Đề xuất" bên dưới. |
| 3 | **Blocker** (UX-06) | Cường độ xác nhận ĐẢO NGƯỢC. Hard delete cascade (`MyTournaments.tsx:549-577`) = dialog 2 nút, body `"<name>" sẽ bị xóa vĩnh viễn cùng tất cả dữ liệu liên quan` — **không nêu số đăng ký, không nêu ai đã trả tiền**. Trong khi `cancel_social_event` (SOFT, `status='cancelled'`) bắt gõ lại tên (`EditSocialEvent.tsx:843-871`) VÀ có nêu số (`vi.ts:5218-5219`). | Không làm undo. Làm **dialog nói thật**: nêu số đăng ký + số đã xác nhận thanh toán. Nếu có thanh toán đã xác nhận → **không render nút xoá**, đổi thành trạng thái chặn. Copy §"Copy đề xuất". |
| 4 | **Blocker** (a11y) | Modal huỷ sự kiện là `<div class="fixed inset-0">` tự dựng (`EditSocialEvent.tsx:830-882`): không `role="alertdialog"`, không `aria-modal`, không `aria-labelledby`, **không focus trap**, không xử lý phím Escape, và backdrop click đóng được (`:832`). VoiceOver vuốt ra được nội dung sau lưng modal. Mọi confirm khác trong app dùng shadcn `AlertDialog`. | Xoá div tự dựng, dựng lại bằng `AlertDialog` như `MyTournaments.tsx:549`. Diff nhỏ hơn việc vá từng thuộc tính, và được toàn bộ hành vi focus/Escape miễn phí. |
| 5 | **Nên sửa** (UX-06) | Nút "Từ chối" yêu cầu vào đội: icon-only `<X>`, `padding:'6px 10px', fontSize:12` → cao ~26px, nằm sát nút "Duyệt" xanh ~10px, **không confirm gì cả**, xoá thẳng (`TeamOverviewCard.tsx:259-268`). Đây là chỗ dễ bấm nhầm nhất trong toàn app: hai hành động ngược nhau, cạnh nhau, tí xíu, một chạm là xong. Người bị từ chối không được báo. | Nhãn chữ `Duyệt` / `Từ chối` (bỏ icon-only), mỗi nút ≥44×44, cách nhau ≥12px, + `AlertDialog` cho nhánh từ chối. Không dựa vào riêng màu xanh/đỏ để phân biệt. |
| 6 | **Nên sửa** (UX-07) | "Giải của bạn" (`Tournaments.tsx:440-482`) chỉ chứa Quick Tables. `useUserRegisteredTournaments`/`useUserCompletedTournaments` (`useInteractionData.ts:117-140,208-230`) chỉ query `quick_table_registrations` + `quick_table_teams`; link hardcode `/tools/quick-tables/${share_id}` (`:459`) và nhãn meta hardcode `"Quick Table"` (`:467`). Người đăng ký Doubles Elim / Flex / Team Match **không thấy giải của mình ở đây** — dù tiêu đề hứa "Các giải bạn đã đăng ký" (`:446`). Đây là lối tắt tự nhiên nhất cho người quay lại, và nó phủ 1/4 thể thức. Recon lẫn GPT-5.6 đều không thấy chỗ này. | Mở rộng 2 hook sang 3 bảng đăng ký còn lại, link theo `linkBase` của format thật. Nếu chưa làm kịp: sửa tiêu đề thành "Quick Table của bạn" — **đừng để copy hứa nhiều hơn code làm**. |
| 7 | **Nên sửa** (UX-07) | Hai hero card `min-height:260px` (`the-line.css:3473`) chiếm ~530px trên mobile mà **không cái nào dành cho người muốn ĐĂNG KÝ**: một cái "Xem giải pro" (`Tournaments.tsx:253-290`), một cái "Tự tổ chức" → `/tools` (`:292-324`). Người chơi được mời đọc hết 530px rồi vẫn chưa thấy đường vào. | Trên mobile: bỏ cả hai khỏi vị trí trên list. Đẩy "Tự tổ chức" xuống sau 4-6 item giải dưới dạng banner mảnh. Desktop giữ nguyên hero. |
| 8 | **Nên sửa** (UX-07) | 4 sub-tab thể thức để nguyên tên tiếng Anh trong chế độ VI: `Quick Tables / Doubles Elimination / Flex Format / Team Match` (`Tournaments.tsx:498` render `f.title`, không có bản VI trong `FormatDef`). Mô tả VI (`:70,83,95,109`) viết cho organizer — "tự định nghĩa vòng đấu, bảng, luật xếp hạt giống" là ngôn ngữ người TẠO giải, không phải người ĐĂNG KÝ. | Ghép nhãn VI: `Quick Tables · Chia bảng`, `Doubles Elim · Loại kép`, `Flex · Tùy chỉnh`, `Team Match · Đồng đội`. Mô tả thể thức chuyển xuống trang chi tiết giải, không chiếm chỗ ở phễu người chơi. |
| 9 | **Nên sửa** (UX-06) | `.tl-btn` không có `min-height` (`the-line.css:531-539`: `padding:11px 18px; font-size:14px` → cao ~41px). Mọi nút destructive dùng class này đều dưới 44px, gồm nút "Rời đội" (`TeamJoinPanel.tsx:135`). A11Y-02 đã ship 44px cho control non-button nhưng `.tl-btn` lọt lưới. | **Không** thêm `min-height` vào `.tl-btn` — class này đang bị ratchet DS-03 siết, HARD sau 2026-08-01 (`check-theline.mjs:16-22,142-163`). Mọi nút MỚI của cụm này phải là shadcn `<Button>` (đã 44px từ DS-03), không phải `.tl-btn`. |
| 10 | **Nên sửa** (UX-06) | Rời đội / rút đăng ký không confirm (`TeamJoinPanel.tsx:135`). Nhẹ hơn #5 (tự làm với chính mình, đăng ký lại được) nhưng nếu giải đã đủ suất thì không quay lại được. | `AlertDialog` một bước, copy §dưới. |
| 11 | **Nên sửa** (đo lường) | Zero instrumentation trên toàn đường giải: `RegistrationForm.tsx` và `Tournaments.tsx` không gọi `startJourney`/`trackJourneyStep` (grep sạch); `journeys.ts:17-22` có `player_registration` nhưng chỉ wire ở `RegistrationModal` social. Không có baseline nào cho UX-07. | Gắn `player_registration` + prop `format` cho đường giải, + event `auth_wall_viewed` ở `RegistrationForm.tsx:201` — chính con số này biện minh (hoặc bác bỏ) việc làm đường khách. Ship TRƯỚC hoặc CÙNG, xem §Panel. |
| 12 | Nit | Tab "Xem Pro" đếm `tournaments.length` (`:334`) gồm cả giải đã kết thúc → badge thổi phồng. | Đếm `ongoing + upcoming` cho khớp badge Cộng đồng (chỉ đếm `ongoing`, `:189-193`). |
| 13 | Nit | Sub-tab trạng thái dùng "Đang diễn ra" (`:515`) — sai trọng tâm cho người tìm chỗ đăng ký. | Thêm/đổi thành `Đang mở đăng ký` làm mặc định (`STATUS_LABEL.registration` đã có sẵn nhãn này, `:31`). |

**Không phải blocker, và tôi nói rõ:** cơ chế undo toàn cục (soft-delete + cửa sổ khôi phục X phút) cho 4 bảng tournament. Cuong nói chưa từng đau thật; không có cột `deleted_at` ở đâu; xây restore cho một cascade nhiều bảng là việc lớn. **Vấn đề #3 giải quyết 90% rủi ro với ~5% công.** Nếu sau này có sự cố thật thì mới nâng cấp — và khi đó là soft-delete bền vài ngày, không phải toast.

---

## Toast "Hoàn tác" 5 giây — trả lời thẳng: KHÔNG

Tôi và GPT-5.6 độc lập cùng bác, cùng lý do, cộng thêm lý do của tôi:

- Người dùng ThePickleHub đứng ngoài trời. Họ khoá màn hình, nhảy sang Zalo trả lời tin, có người gọi ra sân. Toast chết khi chuyển tab / khoá màn hình / điều hướng. 5 giây là thời gian của người ngồi bàn làm việc.
- Xoá hiện tại là hard delete cascade nhiều bảng. Nút ghi "Hoàn tác" mà hệ thống không khôi phục nổi mọi record phụ thuộc là **nói dối trong UI** — tệ hơn không có nút.
- Trong app **chưa có pattern nào là toast-with-undo**. Dựng mới một cơ chế cho một nỗi đau chưa từng xảy ra là đúng thứ YAGNI cấm.
- Riêng của tôi: Capacitor. Trong native shell, app đi nền là WebView bị treo — toast biến mất còn chắc chắn hơn trên web. Không thiết kế lưới an toàn quanh một thứ không tồn tại khi cần nhất.

Nếu sau này thật sự cần undo: soft-delete bền vài giờ/ngày + màn "Thùng rác", không phải toast tạm.

---

## Về việc gõ lại tên sự kiện — trả lời câu hỏi của Cuong

Prompt hỏi: ma sát lớn, hay ma sát ĐÁNG GIÁ?

**Ma sát đặt sai chỗ.** Không phải quá lớn về nguyên tắc — mà sai đối tượng. Tên sự kiện VI thật dài và đủ dấu ("Giao lưu pickleball tối thứ Ba — sân Tân Bình"), gõ Telex một tay ngoài sân là bài kiểm tra độ chính xác bàn phím, không phải kiểm tra sự hiểu. Người dùng đã quyết định rồi. Và nó gác một thao tác **khôi phục được**.

Cái gác thật sự có ích ở modal đó là dòng `{n} đăng ký sẽ bị huỷ tự động` (`vi.ts:5219`) — con số. **Giữ số, bỏ ô gõ.** Rồi đem đúng nguyên tắc "nói số thật" sang chỗ hard delete, chứ đừng đem ô gõ tên sang.

Tôi và GPT-5.6 trùng khớp ở đây, độc lập.

**Sự KHÔNG nhất quán có phải vấn đề UX chính không** — prompt hỏi đúng hướng nhưng chưa tới. Vấn đề không phải "không nhất quán" (nhất quán không phải giá trị tự thân). Vấn đề là **nhất quán ngược**: mức gác tỉ lệ NGHỊCH với mức thiệt hại. Đó mới là điều đáng gọi tên.

---

## Trạng thái màn hình

**UX-06 — dialog xoá giải (thay `MyTournaments.tsx:549-577`):**

- *Đang đếm*: dialog mở ngay, vùng số hiện skeleton 1 dòng (không spinner toàn dialog — nội dung khung đã biết). Nút xoá **disabled cho tới khi có số**. Không bao giờ cho xoá khi chưa biết đang xoá gì.
- *Lỗi đếm*: `Không kiểm tra được số đăng ký. Thử lại trước khi xoá.` + nút Thử lại, nút xoá vẫn disabled. **Fail-closed.**
- *Có thanh toán đã xác nhận*: đổi hẳn sang trạng thái chặn, **không render nút xoá** (không phải disabled — disabled mời người ta đi tìm cách bật). Copy dưới.
- *Offline*: nút xoá disabled + `Không có kết nối — thử lại khi có mạng` (dùng lại `PageStates` offline pattern, `src/components/states/PageStates.tsx`).

**UX-07 — `/tournaments` tab Cộng đồng:**

- *Loading*: skeleton theo đúng hình `.tl-bracket-row`, 3 dòng. Đã có tiền lệ cho tab Watch (`Tournaments.tsx:350-363`) — tab Cộng đồng hiện **không có** loading state nào (các hook `useActivePublicQuickTables`… đổ về mảng rỗng khi đang tải → người dùng thấy empty state "Chưa có giải nào" trong lúc mạng 4G còn đang chạy). **Đây là lỗi thật, bổ sung vào bảng: Nên sửa.** Empty giả trên 4G chậm là chỗ mất người.
- *Empty*: giữ khung hiện tại (`:536-545`) nhưng CTA hiện là "Tạo giải →" — sai đối tượng cho người chơi. Copy dưới.
- *Error*: hiện không có; các hook đổ rỗng = empty giả. Dùng `PageStates` error.
- *Offline*: PWA `NetworkFirst` 3s timeout đã có; list phải hiện banner `Đang xem dữ liệu đã lưu` thay vì rỗng.

---

## Accessibility (WCAG 2.1 AA)

Đã kiểm: role/aria của dialog, focus trap, kích thước hit area, phụ thuộc màu, nhãn tab.

- **Fail 4.1.2 + 2.1.2** — modal huỷ sự kiện tự dựng, không `role="alertdialog"`, không focus trap, không Escape (`EditSocialEvent.tsx:830-882`). Blocker #4.
- **Fail 2.5.5 / 2.5.8** — nút từ chối ~26px (`TeamOverviewCard.tsx:259-268`); `.tl-btn` ~41px, không `min-height` (`the-line.css:531-539`). #5, #9.
- **Fail 1.4.1** — cặp Duyệt/Từ chối phân biệt bằng icon + màu xanh/đỏ, không có nhãn chữ (`TeamOverviewCard.tsx:251-267`). Nút từ chối có `aria-label` nên screen reader ổn; người nhìn được mà mù màu thì không.
- **Pass** — sub-tab thể thức dùng `aria-pressed` + `<button>` thật với ghi chú giải thích vì sao không dùng ARIA tab pattern (`Tournaments.tsx:485-501`). Đây là quyết định đúng và đã được ghi lại; giữ nguyên.
- **Pass** — hero card "Xem Pro" là `<button>` chứ không phải `<Link to="#">` (`:252-258`), có comment a11y. Tốt.
- **Cần Cuong test tay**: VoiceOver tiếng Việt đọc dialog xoá mới — đặc biệt chuỗi có `{n}` và tên giải trong ngoặc kép; ngoặc kép cong dễ bị đọc thành "dấu nháy".
- **Chưa kiểm được**: contrast của `var(--tl-live)` trên `var(--tl-bg)` cho chữ nút destructive — cần đo, `--tl-live` là màu đỏ cảnh báo dùng cho cả text 12px ở `TeamOverviewCard.tsx:264`, cỡ đó phải đạt 4.5:1.

---

## Copy đề xuất (VI / EN)

**Xoá giải — trường hợp cho phép (chưa ai thanh toán):**

| Key | VI | EN |
|---|---|---|
| title | `Xoá vĩnh viễn giải đấu?` | `Permanently delete tournament?` |
| body | `"{name}" đang có {n} đăng ký, chưa ai xác nhận thanh toán. Toàn bộ trận đấu, đội và phân công trọng tài sẽ bị xoá. Không thể hoàn tác.` | `"{name}" has {n} registrations and no confirmed payments. All matches, teams and referee assignments will be deleted. This cannot be undone.` |
| body (giải rỗng) | `"{name}" chưa có đăng ký nào. Giải sẽ bị xoá vĩnh viễn. Không thể hoàn tác.` | `"{name}" has no registrations yet. It will be permanently deleted. This cannot be undone.` |
| cancel | `Giữ lại` | `Keep` |
| confirm | `Xoá vĩnh viễn` | `Delete permanently` |

**Xoá giải — trường hợp CHẶN (đã có thanh toán xác nhận):**

| Key | VI | EN |
|---|---|---|
| title | `Không xoá được giải đã có thanh toán` | `This tournament can't be deleted` |
| body | `{k}/{n} đăng ký đã xác nhận chuyển khoản. Giữ lại dữ liệu giải để còn đối soát và hoàn tiền cho người chơi.` | `{k} of {n} registrations have confirmed transfers. Keep the tournament so payments can be reconciled and refunded.` |
| primary | `Xem danh sách đăng ký` | `View registrations` |
| secondary | `Đóng` | `Close` |

Ghi chú ngôn ngữ: dùng **"đã xác nhận chuyển khoản"**, không dùng "đã thanh toán". Hệ thống chỉ biết organizer đã bấm xác nhận (`mark-payment-claimed`), không biết ngân hàng đã ghi có. Copy không được biết nhiều hơn dữ liệu.

Ghi chú độ dài: `Xoá vĩnh viễn` (13 ký tự) vs `Delete permanently` (18) — VI ngắn hơn ở cặp này, an toàn. Nhưng `Không xoá được giải đã có thanh toán` là 36 ký tự, trên 390px sẽ xuống 2 dòng trong `AlertDialogTitle` — chấp nhận được, **không rút gọn thành "Không thể xoá"** (mất nguyên do).

**Huỷ sự kiện (bỏ ô gõ tên):**

| Key | VI | EN |
|---|---|---|
| title | `Huỷ sự kiện này?` | `Cancel this event?` |
| body | `{n} đăng ký sẽ bị huỷ. Sự kiện sẽ không nhận thêm người tham gia.` | `{n} registrations will be cancelled. The event will stop accepting players.` |
| cancel | `Giữ sự kiện` | `Keep event` |
| confirm | `Huỷ sự kiện` | `Cancel event` |

(Chú ý bẫy song ngữ: nút `Cancel event` cạnh nút `Cancel` của dialog. Nút thoát phải là `Keep event`, không phải `Cancel`. Bản VI hiện tại đã tránh được nhờ dùng "Quay lại" — bản EN thì chưa an toàn.)

**Từ chối yêu cầu vào đội (mới):**

| Key | VI | EN |
|---|---|---|
| title | `Từ chối yêu cầu tham gia?` | `Reject this join request?` |
| body | `Yêu cầu của {name} sẽ bị gỡ. Người này có thể gửi lại yêu cầu.` | `{name}'s request will be removed. They can send a new one.` |
| cancel | `Giữ yêu cầu` | `Keep request` |
| confirm | `Từ chối` | `Reject` |

**Rời đội (mới):**

| Key | VI | EN |
|---|---|---|
| title | `Rời đội này?` | `Leave this team?` |
| body | `Bạn sẽ mất suất trong đội. Nếu đội đã đủ người, bạn có thể không quay lại được.` | `You'll lose your spot. If the team fills up, you may not be able to rejoin.` |
| cancel | `Ở lại` | `Stay` |
| confirm | `Rời đội` | `Leave` |

**Empty state tab Cộng đồng — sửa đối tượng (`Tournaments.tsx:536-545`):**

| | VI hiện tại | VI đề xuất |
|---|---|---|
| body | `Tạo giải mới chỉ trong một phút.` | `Chưa có giải nào đang mở đăng ký ở thể thức này. Xem thể thức khác, hoặc tự tạo giải trong một phút.` |
| CTA | `Tạo giải →` (primary) | `Xem thể thức khác` (primary) · `Tạo giải →` (ghost) |

**Nhãn tab chính (`Tournaments.tsx:334,341`):**

| | Hiện tại | Đề xuất |
|---|---|---|
| tab 1 | `Xem Pro` / `Watch` | `Xem giải pro` / `Watch pros` |
| tab 2 | `Cộng đồng` / `Community` | `Tham gia giải` / `Join a tournament` |

`Cộng đồng` mô tả *ai sở hữu*, không mô tả *người dùng làm được gì*. `Tham gia giải` là một động từ + tân ngữ, tự giải thích, và ngắn hơn "Giải đang mở đăng ký" (không vỡ tab trên 390px).

---

## Đề xuất cho tường đăng nhập (blocker #2)

Không thiết kế cơ chế mới. Đường khách của social event đã tồn tại và đã được làm cứng qua DB-01/DB-01c (advisory lock, atomic capacity). Việc cần làm là **nối, không phải phát minh**:

1. `RegistrationForm.tsx:201` — thay tường bằng lựa chọn: `Đăng ký nhanh bằng số điện thoại` (chính) / `Đăng nhập` (phụ). Đăng nhập vẫn còn cho người có tài khoản, chỉ thôi làm điều kiện bắt buộc.
2. Đường khách thu đúng thứ giải cần: họ tên, số điện thoại + OTP, rồi mới tới field riêng của giải (đối/đội, DUPR nếu giải yêu cầu).
3. Giải có phí: giữ suất ở trạng thái `Chờ thanh toán` + VietQR + hạn rõ ràng. **Không** đụng field ngân hàng ở phía người chơi (ràng buộc D3 của cụm trước).
4. **Sau khi** đăng ký xong mới mời tạo tài khoản: `Lưu thông tin để lần sau đăng ký nhanh hơn?` — `Tạo tài khoản` / `Để sau`. Gắn đăng ký khách vào tài khoản khi trùng số điện thoại đã xác minh.

Lý do bắt tài khoản (phí, DUPR) không đứng vững: tài khoản mới tinh không đáng tin hơn một số điện thoại đã xác minh OTP. Tài khoản là cơ chế **lưu trữ**, không phải cơ chế **xác minh** — đang bị dùng nhầm vai. GPT-5.6 nói y hệt, độc lập.

Cảnh báo phạm vi: đây là phần nặng nhất của cụm và đụng luồng tiền. Nó nên là increment riêng, sau khi #1 (1 dòng) và #11 (đo) đã ship.

---

## Panel đa model

**Đồng thuận Claude + GPT-5.6** (2 brief độc lập, GPT không thấy repo — đồng thuận cross-vendor, trọng lượng thật):

- Toast undo 5 giây **sai** cho xoá giải; nút ghi "Hoàn tác" khi không khôi phục nổi cascade là nói dối UI. Nếu có undo thì phải là soft-delete bền, không phải toast.
- Ô gõ lại tên sự kiện = ma sát đặt sai chỗ → **bỏ ô, giữ con số**. Đừng chuyển ô gõ sang chỗ xoá giải.
- Có thanh toán đã xác nhận → **chặn hẳn, không render nút xoá**, không phải "xoá dù sao". Vì không có refund flow, xoá chính là xoá bằng chứng cần để hoàn tiền.
- Modal tự dựng → thay bằng `AlertDialog` (thay rẻ hơn vá).
- Nút Duyệt/Từ chối: nhãn chữ, ≥44px, tách xa, confirm cho nhánh từ chối.
- Xếp hạng UX-06: A (xoá giải) > D (gỡ người) > C (modal a11y) > B (ô gõ tên). Trùng khớp.
- UX-07: tường đăng nhập là đòn bẩy số 1; mặc định tab sai là số 2; 1.070px là số 3; 4 sub-tab thể thức là số 4.
- Nhãn `Cộng đồng` không tự giải thích → `Tham gia giải`.
- Đo trước khi tối ưu; nhưng các fix an toàn/a11y của UX-06 **không** phải chờ instrumentation vì chúng là sửa đúng-sai, không phải thí nghiệm conversion.
- Copy VI bị dịch máy: `Mọi tour đấu, một nguồn xem.` (`Tournaments.tsx:265-268`) và `Sóng trực tiếp từ...` (`:245`). GPT đề `Xem mọi tour tại một nơi.` và bỏ `Sóng trực tiếp` — tôi đồng ý, `sóng trực tiếp` là dịch thẳng "live feeds", người Việt nói "xem trực tiếp".

**Bất đồng:**

**BĐ-1 — Quy mô tái cấu trúc `/tournaments`.**
- *GPT-5.6*: gộp 4 thể thức thành MỘT danh sách, thêm ô tìm kiếm (`Tìm giải hoặc mã mời`), nút `Lọc` mở bottom sheet (ngày/khu vực/trình độ/phí/thể thức), chip vị trí `TP.HCM`, card kiểu `12/16 suất · 200.000đ · Tân Bình · Hạn đăng ký 18/5`.
- *Tôi*: **bác**. Card mẫu của GPT dùng các trường **không tồn tại**. `CommunityBracket` (`Tournaments.tsx:40-52`) chỉ có `name, share_id, status, created_at, creator_display_name, is_doubles, player_count, format, team_count, team_roster_size` — không có địa điểm, không có phí, không có hạn đăng ký, không có sức chứa. Gộp 4 danh sách còn phải hợp nhất 4 hook trả 4 shape khác nhau và merge-sort client-side 8 query. GPT đang thiết kế cho dữ liệu sản phẩm không có — nó không thấy repo, đây đúng là chỗ nó mù.
- *Chốt: theo tôi.* Đợt này chỉ làm 3 thứ rẻ và có thật: đảo mặc định tab (#1), hạ hero card trên mobile (#7), ghép nhãn VI cho sub-tab (#8). Tìm kiếm/lọc/gộp danh sách để sau, và **chỉ khi** số từ #11 cho thấy người ta thật sự lạc ở bước chọn thể thức. Lý do: quy tắc "instrument before optimize" của cụm trước, cộng YAGNI — xây bottom sheet lọc 5 chiều cho một trang chưa từng được đo là đúng thứ chúng ta vừa hứa không làm.

**BĐ-2 — Thứ tự ship instrumentation.**
- *GPT-5.6*: instrumentation ship như một release **riêng, trước**, thu ít nhất một tuần có cuối tuần, rồi mới đổi phễu.
- *Tôi*: instrumentation + fix #1 (đảo mặc định tab) ship **cùng lúc**. Lý do: #1 không phải thí nghiệm conversion, nó là **sửa bug** — nhánh `community` của ternary là code không bao giờ chạy trên prod. Bắt một bug đã xác định phải chờ một tuần thu số để "giữ baseline sạch" là đem sự sạch sẽ của phép đo đặt trên người dùng. Baseline vẫn dùng được: gắn `ui_version` như chính GPT đề xuất, đọc trước/sau theo version.
- *Chốt: theo tôi*, có nhượng bộ — tường đăng nhập (#2, thay đổi phễu thật, có thí nghiệm thật) thì **đúng là phải chờ** đủ số. GPT đúng cho #2, tôi đúng cho #1. Tách ra là hết bất đồng.

**BĐ-3 — Nút "Xoá" nên tồn tại đến đâu.**
- *GPT-5.6*: dài hạn, hard delete **chỉ** cho nháp rỗng; có đăng ký rồi thì organizer chỉ được `Hủy giải` / `Lưu trữ`.
- *Tôi*: đồng ý về đích, nhưng đó là thay đổi mô hình dữ liệu (thêm trạng thái cancelled/archived vào 4 bảng, đụng enum — mà cụm trước đã ghi rõ **ADD VALUE enum không revert được**). Không đưa vào đợt này. Đợt này: nói thật + chặn khi có tiền. Đường đi lên có sẵn nếu cần.
- *Chốt: theo tôi cho phạm vi đợt này, ghi nhận đích của GPT làm hướng sau.*

**Điểm GPT-5.6 không thể thấy** (cần repo): vấn đề #6 ("Giải của bạn" chỉ có Quick Table), #1 nguyên nhân gốc (`select("*")` không lọc status), ràng buộc ratchet `.tl-btn` HARD 2026-08-01 ở #9, và việc tab Cộng đồng **không có loading state** nên hiện empty giả trên 4G.

---

## Trả lời trực tiếp 2 câu hỏi của intake

**"UX-06 có đáng 4 ngày không?"** — Không. Đáng khoảng **1,5-2 ngày** cho web: #3 (dialog nói thật + chặn khi có tiền), #4 (thay modal tự dựng), #5 (nút Duyệt/Từ chối), #10 (confirm rời đội). Bỏ hẳn phần undo. Native `/apple`: `TeamMatchManageTeamsView.swift` gọi `deleteTeam` thẳng từ nút, không confirm — thêm `.confirmationDialog`, ~0,5 ngày. Phần tiết kiệm được đổ sang UX-07, nơi có người dùng thật đang rớt.

**"UX-07 có cần funnel trước khi ship không?"** — Tách đôi. Fix #1 (bug mặc định tab) ship ngay cùng instrumentation. Đường khách #2 chờ đủ số — vì đó là thứ duy nhất trong cụm có thể làm hỏng luồng tiền, và là thứ duy nhất cần chứng minh bằng con số chứ không phải bằng trực giác.
