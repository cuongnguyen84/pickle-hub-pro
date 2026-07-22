# ui-ux-critic — referee-pin (vòng 1, nguyên văn)

> Ghi chú orchestrator: script `scripts/agents/ask-model.mjs` không tồn tại trong worktree lúc chạy — agent gọi OpenAI `/v1/responses` API trực tiếp với cùng system prompt. Raw exchange: `external/ui-ux-critic-gpt56.md`. Harness gắn security-warning về việc gửi chi tiết thiết kế nội bộ ra API ngoài (đúng nhiệm vụ /idea giao nhưng ghi lại để Cuong biết).

Confirmed: shadcn `Input` is `h-10` (40px), under the 44px rule — the PIN field needs an explicit taller height.

Raw GPT-5.6 exchange saved verbatim to `docs/proposals/referee-pin/external/ui-ux-critic-gpt56.md`. Panel ran two-model (Claude + GPT-5.6).

---

## Đánh giá tổng thể

Ý tưởng đúng và nền tảng đã có sẵn 70% (cơ chế referee thủ công đồng nhất cho cả 4 format). Nhưng thiết kế "gõ PIN là thành trọng tài" **chưa phục vụ được người ở sân** cho tới khi giải quyết ba thực tế của repo mà bản intake bỏ qua: (1) 4 format = 4 bảng id riêng, PIN 6 số **không unique toàn cục** nên ô nhập PIN trơ trọi không tự resolve được giải nào; (2) Quick Table tạo giải bằng wizard 2 bước **chưa có server id** nên không thể sinh PIN thật trong wizard; (3) Doubles Elim + Flex **không có enum "completed"** nên lời hứa "PIN tự hết hạn khi có nhà vô địch" không bắn được cho một nửa số format. Ba điểm này là blocker thiết kế, không phải nit.

## Luồng người dùng

**Organizer:** vào giải đang chạy (QuickTableView / TeamMatchView / settings dialog nơi `RefereeManagement` đang sống) → bật switch PIN → server sinh mã → copy / share link+QR. **KHÔNG** đặt trong wizard tạo Quick Table (bước `input`/`assignment`) vì chưa có id.

**Trọng tài tại sân (thực tế deep-link):** nhận link/QR từ Zalo/Facebook → mở `/referee/join/:format/:id` (URL phải mang format+id vì PIN không unique) → nếu chưa login: thấy tên giải + nút "Đăng nhập để nhập mã" → login → **quay lại đúng màn join** → gõ PIN 6 số → "Bắt đầu chấm điểm" → vào thẳng danh sách trận. Fallback không có link: `/referee/join` để dán link hoặc tìm giải.

`safeInternalPath` là guard **định dạng** (phải bắt đầu `/`, chặn `//`, scheme), không phải allowlist — nên `/referee/join/...` sẽ sống qua redirect **nếu** trang mới dùng `buildLoginRedirect()` và đọc lại param. Đây đúng là class bug UX-07 vừa vá; phải test lại, không được tin là "tự nhiên chạy".

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | PIN 6 số không unique toàn cục + 4 bảng id riêng → ô nhập PIN đơn độc không resolve được giải | Entry ở sân **bắt buộc** mang `:format/:id` qua deep-link/QR. Ô PIN trơ (`/referee/join` không tham số) chỉ là fallback "dán link/tìm giải", không phải luồng chính |
| 2 | **Blocker** | Deep-link + login redirect có thể lại rớt param (bug UX-07) | Trang join dùng `buildLoginRedirect(location.pathname)`; test FB in-app browser, Chrome Android, Capacitor universal-link, user đã login mở QR. **Không** nhét PIN vào `?redirect` |
| 3 | **Blocker** | Quick Table wizard chưa có server id → không sinh được PIN thật trong wizard | Đặt control PIN ở **QuickTableView post-create** (nơi `RefereeManagement` đã render, dòng 1137), không phải bước wizard. Intake nói "setup" nhưng setup Quick Table = tạo mới, referee sống ở view |
| 4 | **Blocker** | Doubles Elim + Flex không có `status="completed"` → "PIN tự hết hạn khi có nhà vô địch" không bắn được cho 2/4 format | Cần architect chốt tín hiệu completion cho 2 format này (dựa `final_placement=1`?) TRƯỚC khi hứa auto-expire. Nếu không, copy trạng thái "hết hạn" nói dối |
| 5 | **Blocker** | Cấp quyền trọng tài = đổi permission, không được queue offline | Offline: chặn nhập PIN, hiện "Không thể xác nhận mã khi ngoại tuyến", nút "Thử lại". Không grant cục bộ |
| 6 | Nên sửa | `RefereeManagement` nằm **dưới cả nút Save** trong `TeamMatchSettingsDialog` (dòng 300-308) — dễ bị bỏ sót | Đưa card Trọng tài lên **sau Tên/Ngày, trước Lệ phí/DUPR**. Áp cho cả 4 format |
| 7 | Nên sửa | Nút PIN mới (hiện/copy/share/tạo mã) nếu dùng `className="tl-btn"` sẽ dính ratchet DS-03 (`check-theline.mjs` rule 4), sắp thành HARD sau 2026-08-01 | Dùng `<Button variant="outline\|tl-primary">`, không thêm `.tl-btn` mới |
| 8 | Nên sửa | shadcn `Input` mặc định `h-10` = **40px < 44px** — quá thấp cho tay ướt ngoài nắng | Ô PIN join screen ép cao ≥56px, chữ số `tabular-nums` to, một `<input>` duy nhất (không phải 6 ô), `inputmode="numeric"` `autocomplete="one-time-code"` `type="text"` (không `number`), **không** auto-submit ở số thứ 6 |
| 9 | Nit | Không phân biệt được trọng tài vào bằng email hay PIN | Badge nguồn "Email" / "Mã PIN" trong danh sách; nút "Gỡ quyền trọng tài" từng người |
| 10 | Nit | QR có thể kéo dependency nặng vào bundle wizard | Render QR chỉ khi bấm "Hiện mã QR"; QR encode **URL join**, PIN in to bên dưới dạng text |

## Trạng thái màn hình

**Card PIN (organizer):**
- Empty/off: `Chưa bật mã PIN.` (không hiện ô mã rỗng) / *"PIN not enabled."*
- Loading (đang sinh mã): skeleton ở vùng mã + `Đang tạo mã PIN…`, disable switch, **không** hiện số client bịa ra / *"Creating PIN…"*
- Enabled: mã che `••• •••` (hiện `123 456` ngay sau khi vừa sinh/rotate) + nút Hiện/Sao chép/Chia sẻ + `Mã tự hết hiệu lực khi giải kết thúc.`
- Error: `Không thể cập nhật mã PIN. Vui lòng thử lại.` — giữ nguyên trạng thái switch đã xác nhận / *"Couldn't update the PIN. Try again."*
- Offline: `Bạn đang ngoại tuyến. Kết nối mạng để bật, tắt hoặc tạo mã PIN mới.`
- Giải đã kết thúc: disable hết, `Giải đã kết thúc. Mã PIN không còn hiệu lực.`

**Màn hình join (trọng tài):**
- Loading context: skeleton tên/ngày giải, không spinner toàn màn.
- Chưa login: vẫn hiện tên giải + `Đăng nhập để nhập mã`.
- Submitting: nút `Đang kiểm tra…`, giữ nguyên số.
- Sai PIN: `Mã PIN không đúng. Kiểm tra lại mã do ban tổ chức cung cấp.`
- PIN bị tắt/đổi: `Mã PIN này không còn hiệu lực. Hãy xin mã mới từ ban tổ chức.`
- Giải kết thúc: `Giải đã kết thúc nên mã PIN không còn hiệu lực.` + nút phụ `Xem kết quả giải`.
- Đã là trọng tài: `Bạn đã là trọng tài của giải này.` + `Tiếp tục chấm điểm` (không bắt gõ lại).
- Success: `Bạn đã được thêm làm trọng tài.` → `Xem các trận đấu`.
- Offline: `Không thể xác nhận mã khi đang ngoại tuyến. Hãy kiểm tra kết nối mạng rồi thử lại.`

## Accessibility (WCAG 2.1 AA)

- **PIN input:** một `<input>` semantic (không 6 ô rời — hỏng cho screen-reader/paste), `inputmode="numeric"`, `autocomplete="one-time-code"`, `pattern="[0-9]*"`, `maxlength="6"`, chấp nhận dán `123 456`/`123-456` rồi normalize. Cao ≥44px (khuyến nghị 56px sân).
- **Lỗi:** container `role="alert" aria-live="assertive"`, focus **ở lại** ô PIN (không nhảy sang toast), liên kết `aria-describedby`.
- **Switch PIN:** shadcn `<Switch>` cần label click được + `aria-describedby` trỏ helper text; cả hàng ≥44px cao (primitive Switch đã có after-inset 44px theo DS/A11Y-02).
- **Nút Hiện/Ẩn mã:** 44×44px, `aria-label` "Hiện mã PIN"/"Ẩn mã PIN" (không dùng icon con mắt nhỏ trong field).
- **Contrast ngoài nắng:** dùng `--tl-fg`/`--tl-live`, tránh helper xám mờ; PIN/label/nút để Geist Mono (không Instrument Serif italic cho số).

## Copy đề xuất (VI / EN)

Organizer:
- Card: `Trọng tài` / *Referees*
- Quyền: `Trọng tài chỉ có thể nhập và sửa tỷ số của giải này.` / *Referees can only enter and edit this tournament's scores.*
- Switch: `Cho phép vào bằng mã PIN` / *Allow joining by PIN*
- Giải thích: `Người đã đăng nhập có thể nhập mã này để chấm điểm. Họ không thể thay đổi cài đặt hay danh sách thi đấu.` / *Logged-in users can enter this code to score. They can't change settings or the draw.*
- Nhãn mã: `Mã PIN trọng tài` — hiển thị nhóm `123 456`, lưu/validate 6 số không dấu cách.
- Hết hạn: `Mã tự hết hiệu lực khi giải kết thúc.`
- Actions: `Sao chép mã` · `Chia sẻ` · `Tạo mã mới`; toast `Đã sao chép mã PIN.`
- Rotate dialog: `Tạo mã PIN mới?` / body `Mã hiện tại sẽ ngừng hoạt động ngay. Những trọng tài đã tham gia vẫn giữ quyền chấm điểm.` / `Hủy` · `Tạo mã mới`
- Disable dialog: `Tắt mã PIN?` / body `Người mới sẽ không thể tham gia bằng mã này. Những trọng tài đã tham gia vẫn giữ quyền.` / `Giữ mã PIN` · `Tắt mã PIN`

Share message (Web Share): `Bạn được mời làm trọng tài giải "{tên}". Mở: {link} · Mã PIN: 123 456. Bạn cần đăng nhập để chấm điểm.`

Join: `Vào chấm điểm` (title) · `Nhập mã 6 số do ban tổ chức cung cấp.` (helper) · `Bắt đầu chấm điểm` (submit) · entry point trên trang giải công khai: `Nhập mã trọng tài`.

Lưu ý dịch: **không** giải thích PIN là "số nhận dạng cá nhân" — `mã PIN 6 số` đã tự nhiên. **Không** dùng cụt lủn "Mã hết hạn" vì lẫn giữa "organizer đổi mã" và "giải kết thúc" — tách hai thông điệp như trên.

## Panel đa model

- **Đồng thuận Claude + GPT-5.6:** (a) một card `Trọng tài` thống nhất, PIN là phương thức thứ 2 bên cạnh email, không tách "PIN settings" riêng; (b) card Trọng tài đang bị chôn dưới đáy dialog Team Match → phải kéo lên trên Lệ phí/DUPR; (c) deep-link + login redirect là **blocker** phải test qua FB in-app browser + Capacitor, không nhét PIN vào query; (d) một `<input>` PIN duy nhất, `inputmode=numeric`, không auto-submit số thứ 6, lỗi `role="alert"` giữ focus tại field; (e) offline không được queue việc cấp quyền; (f) mask mặc định + reveal 44px + copy/share + badge nguồn Email/PIN; (g) bộ copy VI ở trên (hai model ra gần như trùng chữ, tôi lấy bản GPT vì tự nhiên).

- **Bất đồng:**
  - *URL join:* GPT đề xuất `/referee/join/{tournamentId}` và cảnh báo "allowlist return route". **Tôi chỉnh:** repo có **4 bảng tournament id tách biệt** và PIN 6 số **không unique toàn cục**, nên route phải là `/referee/join/:format/:id`; đồng thời `safeInternalPath` đã là guard định dạng an toàn (không cần allowlist riêng) — cái thiếu là trang mới phải *thực sự dùng* `buildLoginRedirect`. Chốt theo tôi vì tôi đọc được cấu trúc bảng GPT không thấy.
  - *Auto-expire:* GPT coi hoàn tất giải là điều kiện server bình thường. **Tôi nâng thành blocker riêng (#4):** Doubles Elim + Flex không có enum `completed`, nên lời hứa auto-expire không thực thi được cho 2/4 format nếu architect không bổ sung tín hiệu completion trước — đây là dữ kiện repo GPT không có. Chốt theo tôi.
  - *Chỗ đặt PIN:* GPT nói "nếu chưa có id thì hiện switch + thông báo mã sẽ tạo sau khi hoàn tất". **Tôi đơn giản hơn:** Quick Table không đặt PIN trong wizard tạo mới, đặt thẳng ở QuickTableView post-create nơi RefereeManagement đã sống — bớt một trạng thái "id ảo" phải xử lý. Chốt theo tôi (ít code hơn, ít bug hơn).

Các blocker #1–#5 chưa có dữ kiện mới nào phản bác thì giữ nguyên là blocker sang vòng 2; quyết định hy sinh (nếu có) là của Cuong.
