# UI/UX critic — Codex review follow-up (DE integrity + funnel telemetry)

Agent: `ui-ux-critic` · 2026-07-21 · panel 2 model (Claude Opus 4.8 + GPT-5.6 qua `ask-model.mjs`).
Prompt+reply GPT: `external/ui-ux-critic-gpt.md`.

Phạm vi vai này HẸP: phần lớn task là telemetry ẩn (journey re-mint, join anon→login,
instrument doubles) — **không có bề mặt người dùng để phê bình**. Đúng 2 chỗ CHẠM người
dùng đáng nói: (1) progress bar QuickTable hard-code 25%, (2) CTA anon cho DoublesElim /
TeamMatch. Ngoài 2 chỗ này, phần telemetry không có gì cho critic — nói thẳng vậy.

## Đánh giá tổng thể

Cả hai thay đổi phục vụ đúng người dùng court-side, và cả hai là **fix UX độc lập**, không
phải trang trí cho analytics. Progress bar 25% cứng đang bịa dữ liệu: mọi giải đang mở luôn
hiện "mới 25%, còn nhiều chỗ" — sai với người chơi đang cân nhắc đăng ký. CTA anon: TeamMatch
để người vào từ link Facebook rơi vào ngõ cụt không nút bấm nào — đó là lỗi luồng thật, sửa
đáng làm kể cả nếu bỏ mục tiêu đo D5.

## Luồng người dùng

Entry điển hình: người chơi bấm link Facebook → rơi thẳng vào 1 trang giải (QuickTable /
DoublesElim / TeamMatch) trên Android tầm trung, 4G, dọc màn 390px, chưa đăng nhập.

- **QuickTable card** xuất hiện ở home + list (không phải trang chi tiết): người dùng lướt,
  progress bar là tín hiệu "giải này còn chỗ / đang hot không". Bar 25% cứng nói dối tín hiệu
  đó. Bấm card → trang QuickTable → form đăng ký (`pending`, chờ BTC duyệt).
- **DoublesElim / TeamMatch anon**: vào trang → muốn tham gia → chưa login. DoublesElim thấy
  dòng chữ tĩnh "Đăng nhập để đăng ký đội" không nút; TeamMatch thấy TRỐNG (CTA gated `&& user`,
  `TeamMatchView.tsx:173,185`). Exit của người quyết tâm: tự mò nút login ở header → sau login
  KHÔNG quay lại đúng trang giải (nếu CTA không mang `?redirect`). Exit của người lười: thoát.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | Nên sửa | `OpenRegistrationSection.tsx:59` bar hard-code `width:'25%'` — bịa mức lấp chỗ trên MỌI giải đang mở. Người chơi đọc là "còn nhiều chỗ". | Bỏ thanh fill-toward-cap (metaphor sai cho luồng KHÔNG cap + đơn `pending`). Thay bằng dòng đếm thật `X/Y lượt đăng ký`. Count lấy trong list query, KHÔNG N+1 per-card (xem #4). |
| 2 | Nên sửa | Nhãn `OpenRegistrationSection.tsx:54` EN "Slots filled" / VI "Đã đăng ký" — "Slots filled" hàm ý đã có SUẤT, sai với đơn pending chưa duyệt. | EN → "Applications" (hoặc "Registered"); VI → "Lượt đăng ký". "Lượt đăng ký" rõ là đếm đơn, không hứa suất. |
| 3 | Blocker | `TeamMatchView.tsx:185` anon KHÔNG có CTA nào — ngõ cụt hoàn toàn cho người vào từ deep link. | Thêm CTA "Đăng nhập để đăng ký" ở đúng slot của register button, full-width, ≥44px, `<a href>` tới `?redirect=<path hiện tại>`. |
| 4 | Nên sửa (cao) | `DoublesEliminationRegistrationSection.tsx:181-184` anon chỉ có `NoticeCard` text tĩnh, không nút bấm — bảo login nhưng không cho đường. | Thay text bằng nút "Đăng nhập để đăng ký đội" (cùng chuẩn a11y + redirect như #3). |
| 5 | Nên sửa (perf) | Count đăng ký thật chưa có trong `useOpenRegistrationTables`; thêm ngây thơ = 1 COUNT/card trên list = N+1 trên 4G. | Thêm `application_count` bằng 1 query gộp `GROUP BY quick_table_id` trong list RPC. Không request riêng mỗi card. |
| 6 | Nit | Nút card "Register Now"/"Đăng ký ngay" + form không nói rõ đây là ĐƠN chờ duyệt. | (Ngoài scope Cuong chốt — chỉ flag.) Cân "Gửi đăng ký" + dòng "Đăng ký cần BTC duyệt" trong form. |
| 7 | Nên sửa (parity) | Native /apple có view đăng ký tương ứng; nếu anon tới được thì cùng ngõ cụt. Telemetry web-only nên KHÔNG chặn web. | Nếu anon tới được màn native → thêm CTA parity cùng copy + redirect-back. Nếu native chặn anon từ đầu → không cần. Cuong quyết. |

## Trạng thái màn hình

Progress bar QuickTable — các state phải định nghĩa rõ:

- **Normal (dưới target, vd 12/16):**
  - VI: `12/16 lượt đăng ký` · EN: `12/16 registered`
  - (biến thể đủ nếu card rộng) VI: `12 lượt đăng ký · mục tiêu 16` · EN: `12 applications · target 16`
- **Over target (vd 18/16 — Cuong cho phép vượt):** KHÔNG hoảng. Tránh "quá chỗ"/"Full".
  - VI: `18/16 lượt đăng ký · vẫn đang nhận` · EN: `18/16 registered · still open`
  - Dòng phụ/chip trung tính (xanh brand, KHÔNG đỏ, KHÔNG tam giác cảnh báo).
- **Loading:** text skeleton ngắn ở dòng count (bar cũ đã có skeleton card `h-52` ở `:89`). Không hiện `0/Y` khi chưa có số.
- **Error (count fail):** ẩn hẳn dòng count, giữ tên + nút. TUYỆT ĐỐI không rơi về `25%` hay `0/16` — thà không có số còn hơn số sai.

CTA anon (DoublesElim / TeamMatch):

- **Anon:** nút "Đăng nhập để đăng ký[ đội]" → `?redirect=<path>`.
- **Empty (giải chưa mở đăng ký):** giữ notice hiện có, không thêm CTA login.
- **Offline (PWA/Capacitor):** nút vẫn render (điều hướng, không cần mạng để hiện); tap khi offline → login page tự báo lỗi mạng của nó. Không cần xử lý riêng.

## Accessibility (WCAG 2.1 AA)

- **Touch target:** CTA anon PHẢI ≥44px (A11Y-02 vừa ship enforce 44px hit area). Dùng
  `<a href>` (hành vi điều hướng) render như primary button, full-width mobile — không phải
  text-link nhỏ nhét trong container không tương tác (lỗi hiện tại của DoublesElim NoticeCard).
- **Focus state:** nút cần focus ring nhìn thấy (bàn phím + đọc màn hình). Accessible name
  khớp đúng nhãn hiển thị.
- **Progress bar:** bar 25% hiện tại không có `role="progressbar"`/`aria-*` — nếu giữ dạng
  bar phải gắn `aria-valuenow/min/max` HOẶC để bar `aria-hidden` và dòng text là nguồn sự thật.
  Khuyến nghị: text là nguồn sự thật, bar (nếu giữ) chỉ trang trí `aria-hidden`.
- **Contrast:** chip over-target dùng brand/blue trên nền tối phải ≥4.5:1; tránh xám mờ trên
  `bg-white/[0.06]`.

## Copy đề xuất (VI / EN) — dán được

Nhãn count QuickTable:
- VI: `Lượt đăng ký` · EN: `Applications`

Dòng count:
- Normal: VI `12/16 lượt đăng ký` · EN `12/16 registered`
- Over:   VI `18/16 lượt đăng ký · vẫn đang nhận` · EN `18/16 registered · still open`

Nhãn capacity dòng trên (để không đọc thành cap): 
- VI: `Mục tiêu: 16 người/cặp` · EN: `Target: 16 players/pairs`

CTA anon:
- TeamMatch:   VI `Đăng nhập để đăng ký` · EN `Sign in to register`
- DoublesElim: VI `Đăng nhập để đăng ký đội` · EN `Sign in to register a team`

Kỹ thuật CTA (grounded theo repo, KHÔNG dùng `returnTo` như GPT đề xuất):
- Dùng param `?redirect=` sẵn có + helper `getLoginUrl(currentPath)` (`src/lib/auth-config.ts:93-116`)
  hoặc pattern `RegistrationForm.tsx:199`. `postLoginTarget` (`Login.tsx:15,65`, PR52 hardening)
  đã chặn open-redirect `//evil.com` — tái dùng, đừng tự viết validate mới.

## Panel đa model

- **Đồng thuận Claude + GPT-5.6:**
  - Bar fill-toward-cap là metaphor SAI cho luồng không-cap + đơn pending → thay bằng count thật.
  - Nhãn "Slots filled" sai (hàm ý đã có suất) → đổi. VI "Lượt đăng ký" là cách nói honest.
  - Copy over-target KHÔNG được dùng "quá chỗ"/"Full"/"% "/"còn X chỗ" → giữ trung tính "vẫn đang nhận".
  - Count phải lấy bằng 1 query gộp, KHÔNG N+1 per-card; error thì ẩn count, không fallback 25%/0.
  - CTA anon là fix UX THẬT, không phải analytics theater. TeamMatch anon = **Blocker**;
    DoublesElim = **Nên sửa cao**. CTA cùng slot register button, ≥44px, `<a href>`, redirect-back.
  - Native: đừng chặn web; parity issue nếu anon tới được màn native.
- **Bất đồng:**
  1. **Giữ hay bỏ hẳn dòng ratio X/Y.** GPT khuyên bỏ luôn "/target" và chỉ hiện đếm tuyệt đối
     ("12 lượt đăng ký"), vì bất kỳ tỉ lệ nào cũng gợi quota. **Tôi giữ X/Y** — vì (a) Cuong đã
     CHỐT hiện "đăng ký thật / player_count" (00-intake.md:80), không relitigate; (b) X/Y + nhãn
     "mục tiêu" cho người tổ chức lẫn người chơi một mốc kỳ vọng hữu ích mà vẫn honest khi kèm
     "vẫn đang nhận" lúc vượt. **Chọn: giữ X/Y, bỏ THANH fill** — tổng hợp cả hai: Cuong có tỉ lệ
     thật, GPT/tôi bỏ được thanh scarcity gây hiểu nhầm. Đây là cách hoà đúng ràng buộc, không phải
     hoà giải cho tiện.
  2. **Param redirect.** GPT đề xuất `?returnTo=`. **Tôi bác** — repo đã dùng `?redirect=` +
     `postLoginTarget` guard + helper `getLoginUrl`. Đặt tên mới = tách một luồng auth đã hardened.
     Dùng `?redirect=`.

## Kết luận scope

Telemetry (P3 core: re-mint fix, join anon→login, instrument doubles form) — **không có UI để
critic**, đúng như đề bài. Chỉ 2 chỗ chạm người dùng đáng nói, đã phủ trên. Trong đó **1 Blocker**
(TeamMatch anon ngõ cụt) — không phụ thuộc chuyện đo, là lỗi luồng độc lập, để lên bàn Cuong.
