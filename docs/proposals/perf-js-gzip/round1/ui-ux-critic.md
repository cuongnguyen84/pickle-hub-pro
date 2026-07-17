# UI/UX Critic — perf-js-gzip (round 1)

_Panel: Claude (Opus 4.8) + GPT-5.6. Cả hai model chạy độc lập trên cùng brief._
_Brief gửi đi: `../external/ui-ux-critic-prompt.md` · Reply GPT-5.6: `../external/ui-ux-critic-gpt56-reply.md`_

## Đánh giá tổng thể

Giảm JS là đúng hướng cho user cầm Android tầm trung, 4G, đứng cạnh sân — nhưng
"lazy sâu hơn" **không phải** một nút bấm an toàn để kéo hết cỡ. Vấn đề không nằm ở
việc tách chunk, mà ở **fallback**: hiện mọi route lazy rơi vào một spinner trắng
trần (`PageLoader`), và 11 dialog trong `TeamMatchView` có `Suspense fallback={null}`
— bấm nút, màn hình không đổi gì cho tới khi chunk về. Lazy thêm mà không sửa hai chỗ
này là **nhân bản cái tệ**. Ngoài ra phải nói thẳng với Cuong một sự thật đo được:
lazy sâu hơn **không kéo tổng gzip 1.930 → 1.800 KB** — nó chỉ dời byte sang chunk
khác. Mục tiêu tổng cần xoá/thay dependency, không phải split.

## Luồng người dùng (deep-link reality)

Entry điển hình: click từ Facebook → rơi thẳng vào **một** trang sâu (`/live/:id`,
`/tran-dau/:slug`, `/tournament/:slug`, hoặc referee vào `/tools/team-match/match/:id/score`).
Không có "trang trước" để làm ấm chunk. Với các route lazy, cold-load trên 3G qua
Facebook in-app WebView **không thể** chắc chắn dưới 500ms — connection setup + radio
wake + parse JS ăn hết ngân sách. Nghĩa là:

- **Deep-link vào trang scoring/live** = worst case: user thấy spinner trắng trần
  trong lúc chunk + data cùng về. Đây là điểm chạm phải xử lý trước khi lazy thêm.
- **Trong app**: referee đang ở trang trận → bấm "Bắt đầu chấm điểm" → điều hướng
  sang route scoring lazy → spinner trắng. Chunk scoring phải được **prefetch từ lúc
  nút CTA hiện trong viewport**, không đợi tap.
- Exit: sau khi chấm/xem xong, quay lại list — route đã cache, không vấn đề.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | `PageLoader` (App.tsx:239) — spinner trắng trần, không header/nav/skeleton — là fallback cho **mọi** route lazy, gồm cả `TeamMatchScoring`, `QuickTableRefereeScoring`, `DoublesEliminationScoring`, `WatchLive`. Lazy sâu hơn khuếch đại đúng màn hình này. Vi phạm điều kiện Cuong ("phải có skeleton"). | Thay bằng **route-specific skeleton shell** cho các trang critical: scoring giữ tên đội + ô điểm cố định + nút điểm dạng skeleton disabled + "Đang tải bảng điểm…"; live giữ khung poster 16:9. Không dựng layout thứ 2 gây CLS. |
| 2 | **Blocker** | Nếu plan "lazy sâu" đụng tới **scoring controls** (+1/−1, undo, đổi sân, timeout, sửa điểm, xác nhận game/trận): mỗi tap phụ thuộc một cold chunk = referee tap 2 lần, sai điểm. INP budget 200ms không cho phép. | **Cấm** tách scoring controls + dialog sửa điểm/xác nhận ra chunk interaction-time. Bundle thẳng vào route chunk scoring. Tap cập nhật state đồng bộ, không có Suspense giữa nút và kết quả. Chỉ tách phần phụ: lịch sử audit, share sheet, thống kê nâng cao. |
| 3 | **Blocker** | Nếu plan đụng icon: per-icon dynamic import trên bottom-nav / +1−1 / Play / back-close = icon pop-in, đổi width nút, trễ nhận diện control. Anti-pattern đã biết. | Không bao giờ lazy per-icon. Dùng static named import (không import barrel để tree-shake được), verify bundle chỉ chứa icon dùng. Icon admin đi theo chunk admin (đã lazy sẵn) là đủ. |
| 4 | **Nên sửa** | 11 dialog `TeamMatchView` (App.tsx pattern PERF-02) dùng `Suspense fallback={null}` → **dead-tap**: bấm "Tạo đội"/"Xếp đội hình"/"Mời đội"… màn hình đứng im tới khi chunk về. User không phân biệt được "đang tải" với "nút hỏng". _(Không phải Blocker vì đây là flow setup của organizer, không phải giữa trận — nhưng vẫn cảm giác vỡ.)_ | Giữ **modal shell eager**: tap → set `open` đồng bộ → render ngay scrim + khung dialog + title + skeleton field + footer disabled + "Đang tải…". Chỉ lazy phần thân. Disable nút mở sau tap đầu chống mở trùng. KHÔNG bọc 1 Suspense quanh cả trang (sẽ nuốt luôn page khi dialog suspend). |
| 5 | **Nên sửa** | Livestream play: fallback hiện là ô xám `tl-live-thumb-ph` (đã ok về geometry) nhưng **câm** — không chữ, không phản hồi tap. | Giữ poster + tỉ lệ khung, animate nút Play ngay khi tap, thêm chữ trong khung **"Đang tải video trực tiếp…"**, chặn tap trùng. Prefetch Mux chunk khi card live đầu tiên (playable) vào viewport — KHÔNG prefetch mỗi card, chỉ 1 vendor chunk chung. |
| 6 | **Nên sửa** | Rankings có nguy cơ **double-wait**: spinner route → trang hiện → spinner chart lần 2. Cảm giác chậm hơn cả thời gian mạng thật. | Render danh sách (tên, hạng, điểm, filter, ngày) + skeleton chart **chiều cao cố định** trước; lazy chart khi container cách viewport ~400–600px. recharts đã lazy sẵn — tách sâu hơn trong recharts vô ích. |
| 7 | **Nên sửa** | Chưa có **prefetch strategy** — điều kiện <500ms của Cuong không thể đạt trên cold 3G nếu chờ tới lúc tap. | Thứ tự: (A) viewport prefetch cho CTA dự đoán mạnh ("Bắt đầu chấm điểm", "Xếp đội hình", link rankings) với IntersectionObserver rootMargin dương; (B) route-idle prefetch theo role sau LCP (referee → warm route scoring ngay; organizer → warm lineup+registration, KHÔNG cả 11 dialog); (C) `pointerdown`/`touchstart` bắt đầu import trước `click`; (D) deep-link: import route khớp URL ngay, không xếp sau analytics/admin. Gate mọi speculative fetch bằng `Save-Data` + `effectiveType`. |
| 8 | **Nit** | Nếu swap recharts sang lib nhẹ (candidate 2): rủi ro UX ẩn — nhãn tiếng Việt, tooltip cảm ứng, responsive, a11y, đủ loại chart. | Trước khi chọn lib thay: verify VI labels không tràn, tooltip mở được bằng chạm (không hover), có focus/ARIA. Đây là việc của architect nhưng UX phải ký duyệt checklist. |
| 9 | **Nit** | `PageLoader` cho các route **không critical** (blog, terms, privacy, forum) — spinner trần vẫn chấp nhận được nhưng có thể nâng nhẹ. | Có thể dùng 1 skeleton chung giữ header + 3 dòng xám cho nhóm content page, để cùng token với `SkeletonLoader` đã có (`src/components/content/`). Ưu tiên thấp. |

## Trạng thái màn hình

Áp cho các route/dialog bị lazy — đây mới là "loading" thật user thấy nhiều nhất:

- **Loading (route critical: scoring/live)** — **skeleton, không spinner.** Scoring:
  giữ tên đội + ô điểm + nút skeleton disabled + "Đang tải bảng điểm… / Loading scoreboard…".
  Live: khung poster 16:9 + "Đang tải video trực tiếp… / Loading live video…".
- **Loading (dialog)** — modal shell eager + skeleton thân + "Đang tải… / Loading…".
  Không bao giờ `fallback={null}` trên surface tương tác.
- **Loading (route content thường)** — skeleton giữ header, hoặc spinner hiện tại (chấp nhận).
- **Error (chunk fail)** — đã có `ChunkErrorBoundary` (App.tsx:269) xử lý tốt: retry 1 lần
  sau 1.5s (`lazyRetry`), cap 3 reload/2 phút, nút "Tải lại trang" thủ công. **Không sửa.**
- **Offline (PWA/Capacitor)** — SW `NetworkFirst` 3s timeout cho navigation; chunk đã cache
  qua runtime cache. Cảnh báo: **đừng** precache toàn bộ lazy chunk khi install/update —
  chỉ dời tổng download sang startup path (PERF-03 đã whitelist đúng, giữ nguyên).

## Accessibility (WCAG 2.1 AA)

- `PageLoader` đã có `role="status"` + `aria-live="polite"` + sr-only label song ngữ — **clean**.
- Skeleton shell mới phải giữ `aria-busy="true"` trên vùng đang tải và trả focus về
  `#main-content` (ScrollToTop đã làm) — không để focus rơi vào spinner rồi mất khi content thay.
- Dialog shell eager: giữ focus trap + nút close hoạt động **trong lúc** thân đang tải
  (đừng để user kẹt trong modal rỗng không đóng được).
- Kiểm khi swap chart lib: tooltip phải mở bằng chạm/keyboard, không chỉ hover.

## Copy đề xuất (VI / EN)

- Scoring skeleton: `Đang tải bảng điểm…` / `Loading scoreboard…`
- Live player: `Đang tải video trực tiếp…` / `Loading live video…`
- Dialog: `Đang tải…` / `Loading…`
- Rankings chart skeleton (aria-label): `Đang tải biểu đồ…` / `Loading chart…`
- (Giữ nguyên) Chunk error give-up: `Trang không thể tải. Có thể trình duyệt đang dùng phiên bản cũ.`

## Panel đa model

- **Đồng thuận Claude + GPT-5.6** (tín hiệu mạnh, hai model độc lập trùng nhau):
  1. Scoring controls + dialog sửa/xác nhận điểm = **BLOCKER**, phải bundle vào route
     scoring, không lazy interaction-time. Skeleton **không** cứu được point-entry.
  2. `Suspense fallback={null}` trên dialog = **dead-tap bug**, sửa trước khi nhân pattern.
  3. Per-icon dynamic import = anti-pattern, không làm.
  4. Lazy sâu hơn **KHÔNG** giảm tổng gzip 1.930→1.800 — cần xoá/thay dependency
     (nghi react-dom lọt entry, đo icon barrel, thay recharts + 1 nguồn giảm khác).
  5. Prefetch phải viewport/route-idle/connection-aware, không dựa hover (mobile vô nghĩa).
  6. Mux giữ lazy là đúng; rankings phải tránh double-wait (list trước, chart sau).

- **Bất đồng / sắc thái, chốt của tôi:**
  GPT-5.6 gộp cả 11 dialog `fallback={null}` vào một verdict "bug phải fix trước khi
  làm gì tiếp". Tôi **tách mức**: 11 dialog hiện tại là **flow setup của organizer**
  (tạo đội, xếp đội hình, mời) — xảy ra **trước** trận, không phải giữa trận đang chấm
  điểm — nên tôi xếp **Nên sửa (#4)**, không Blocker. **Nhưng** bất kỳ dialog lazy MỚI
  nào chạm surface **scoring/live** thì là **Blocker (#2)**. Lý do chốt: severity phải
  theo _hậu quả tại thời điểm dùng_ — tap hỏng lúc tạo đội gây bực; tap hỏng lúc chấm
  điểm gây **sai kết quả trận**. Cùng một pattern kỹ thuật, hai mức nghiêm trọng khác nhau.

## Release gate (điều kiện chấp nhận trước khi /ship deeper lazy)

Đo cold-cache p75 trên Android tầm trung + Facebook in-app WebView, ghi:
tap→dialog-shell, tap→dialog-usable, tap→video-loading-state, route-start→scoring-controls,
chart-visible→chart-rendered, tỉ lệ tap-trùng. **Bất kỳ interaction scoring nào phụ thuộc
cold chunk fetch = FAIL gate**, kể cả median lab <500ms.
