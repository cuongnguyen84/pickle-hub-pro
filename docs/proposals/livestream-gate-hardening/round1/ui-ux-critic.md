# UI/UX critique — livestream-gate-hardening (round 1)

Agent: ui-ux-critic · Ngày: 2026-07-20 · Panel: Claude (Opus) + GPT-5.6 (external, độc lập).
Cơ sở: đọc code thật (`WatchLive.tsx`, `HomeLivePlayer.tsx`, `EmbedLive.tsx`,
`useLivestreamGate.ts`, `LivestreamGateOverlay.tsx`, `PreviewCountdown.tsx`,
`AdminLivestreamViewers.tsx`, `ViewerListTable.tsx`, `Login.tsx`, `MuxPlayer.tsx`).
External raw: `../external/ui-ux-critic-gpt56.md`.

## Đánh giá tổng thể
Hướng vá (pause đúng player, re-pause liên tục, chống reload-reset, gate embed) là đúng và cần thiết — hiện gate đang thủng thật. NHƯNG bản thân overlay đang phản mục tiêu: nút to nhất là "Đăng nhập" trong khi metric thành công là **đăng ký mới**, và nút "Tạo tài khoản" trỏ sai tham số nên mở nhầm tab. Trước khi hardening cơ chế chặn, phải sửa cái phễu — nếu không ta chặn kín hơn một cái phễu rò.

## Luồng người dùng
Vào (95%): link Facebook → thẳng `/live/:id` trên Android 4G, một tay, cạnh sân ồn. Tap play → xem thử 15s → video dừng + overlay. Ra: hai ngã — (a) bấm CTA → `/login` → sau auth quay lại `/live/:id` (Login.tsx:51-64 đã redirect an toàn + về đúng trang, tốt), hoặc (b) bỏ đi. Ngã (b) là mặc định nếu CTA không thuyết phục trong ~2 giây. Với embed (iframe trên blog/FB), luồng đứt hẳn: overlay mở tab mới, iframe gốc không bao giờ biết user đã đăng nhập (storage partitioning per-top-frame trên Safari/Chrome hiện đại → session tạo ở tab `/login` không nhìn thấy được trong iframe). Native `/apple` KHÔNG có gate (recon) → phễu rò toàn bộ ở app iOS, ngoài scope nhưng ghi nhận.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | `LivestreamGateOverlay.tsx:38` — nút "Tạo tài khoản miễn phí" trỏ `/login?...&tab=signup`, nhưng `Login.tsx:32` đọc `?mode=signup`. Tham số sai → CTA đăng ký mở nhầm **tab Đăng nhập**. Đúng cái nút gánh toàn bộ metric signup lại vào sai chỗ. | Đổi `&tab=signup` → `&mode=signup` (khớp contract Login.tsx). Thêm 1 test khẳng định link chứa `mode=signup`. |
| 2 | **Blocker** | CTA hierarchy ngược mục tiêu: nút solid/primary = "Đăng nhập để xem" (`:25-32`), outline = "Tạo tài khoản" (`:33-41`). Metric là đăng ký mới → nút đăng ký phải là nút chính. | Primary solid full-width = "Tạo tài khoản miễn phí" (`?mode=signup`); dưới nó 1 dòng nhỏ căn giữa "Đã có tài khoản? Đăng nhập" (`?mode=login`). Bỏ 2 nút to ngang nhau — trên 390px chúng chiếm hết màn và không dẫn hướng. Panel Claude+GPT đồng thuận mạnh. |
| 3 | **Blocker** | Re-pause câm = cảm giác "app hỏng". Khi user thoát fullscreen/PiP hoặc bấm phím media, fix mới sẽ `pause()` lại nhưng overlay HTML không hiện được trên native video fullscreen (iOS/Android) → màn đen tự dừng, không rõ lý do. | Không re-pause mà không lộ lý do. Khi gated + phát: (a) nếu fullscreen là player-wrapper → render overlay trong wrapper, giữ fullscreen; (b) nếu là native video-only fullscreen → gọi `exitFullscreen()`/webkit tương đương RỒI hiện overlay; (c) nếu PiP → `document.exitPictureInPicture()`. `MuxPlayerHandle` (`MuxPlayer.tsx:9-12`) hiện chỉ có `play/pause` — cần thêm `exitFullscreen()`/`exitPip()` vào handle. |
| 4 | **Blocker** | Embed: mở tab `/login` rồi mong iframe tự mở khoá là bất khả thi (storage partitioning). Nếu ship như intake mô tả, user đăng nhập xong quay lại iframe vẫn bị gate → dead end, mất luôn cả conversion vừa có. | Overlay embed KHÔNG hứa mở khoá tại chỗ. CTA mở tab mới sang `/login?mode=signup&redirect=/live/:id&source=embed_live_gate` (first-party). Sau auth redirect thẳng `/live/:id` — user xem tiếp ở tab first-party nơi session tồn tại. Iframe gốc cứ để gated. Đơn giản, chắc chắn, không cần cross-tab messaging. |
| 5 | **Nên sửa** | `PreviewCountdown.tsx:8` nhận `secondsRemaining` nhưng **không dùng** — chỉ có thanh 1px co lại đổi màu green→yellow→red. Không có số đếm. (Lưu ý: tiền đề "đếm ngược 15s" trong nhiệm vụ hơi sai — hiện KHÔNG có con số nào.) Thanh 1px + dừng đột ngột ở giây 15 → user tưởng lag/mất mạng, không hiểu vì sao đơ. Dải màu green-yellow-red còn dễ nhầm là chỉ báo tín hiệu/buffering. | Thêm badge chữ trên player từ giây đầu: "Xem thử miễn phí · Còn 15 giây" (tabular-nums để width không nhảy), 5 giây cuối đổi "Còn 5 giây · Đăng ký để xem tiếp". Thanh tiến trình ≥3px, 1 màu brand, chỉ chuyển amber 5s cuối — bỏ dải 3 màu. Panel đồng thuận. |
| 6 | **Nên sửa** | A11y overlay (`LivestreamGateOverlay.tsx:13`): không `role="dialog"`/`aria-modal`, không focus trap, không đẩy focus vào overlay khi gate bật. Keyboard user vẫn tab được xuống control video đang chạy nền. | Thêm `role="dialog" aria-modal="true" aria-labelledby`, đẩy focus vào heading (`tabIndex={-1}`) khi `isGated` bật, trap focus trong overlay. Thông báo AT một lần qua `aria-live="polite"` ("15 giây xem thử đã kết thúc"), KHÔNG announce mỗi lần re-pause. |
| 7 | **Nên sửa** | Overlay `bg-black/80 backdrop-blur-md` (`:14`): `backdrop-filter` blur tốn GPU trên Android tầm trung — đúng lúc video vừa dừng, máy đang gánh player. Rủi ro giật/INP. | Thay bằng nền đục ổn định `bg-black/[0.92]`, bỏ `backdrop-blur`. Giữ frame video đứng phía sau làm context. Khớp perf-budget (INP ≤200ms Vietnam p75). |
| 8 | **Nên sửa** | Không có tracking click — phễu signup không đo được (metric thành công không quan sát được). | Giữ `<a href>` thật (đừng đổi sang onClick-navigate, mất độ tin cậy), gắn `trackEvent` cho `live_gate_shown` / `live_gate_signup_clicked` / `live_gate_login_clicked`, kèm `match_id`, `surface: web\|capacitor\|embed`, `language`, `preview_seconds_consumed`. Dùng lại pattern `journeys.ts` (recon) hoặc `sendBeacon` để không mất event khi điều hướng. Đây là điều kiện để biết proposal có đạt mục tiêu không. |
| 9 | **Nên sửa** | Admin đếm gộp: `useLivePresence` track từ lúc mở trang, `viewerCount` (`AdminLivestreamViewers.tsx:94`) gồm cả người kẹt ở gate → thổi phồng "đang xem". | Thêm field `gated` (hoặc state playback) vào presence payload. Tách con số: "Đang xem" (đang phát) vs "Chờ đăng nhập" (ở gate). Bảng `ViewerListTable` thêm 1 badge trạng thái. Vì chỉ user ẩn danh mới bị gate, "gated" ≈ anonymous đã qua 15s. |
| 10 | **Nit** | Reload-reset (intake bug #3): fix ghi localStorage sớm là đúng. GPT đề nghị lưu `consumedSeconds` (thời gian ĐÃ phát thật) thay vì boolean-tại-giây-15 để chặn cả trò reload-giây-14 lặp lại. Tốt hơn về chống lạm dụng nhưng nặng hơn. | Không phải blocker cho 95% user thường. Cơ chế lưu (boolean vs consumedSeconds vs timestamp) để `solution-architect` chốt — miễn reload không cấp thêm 15s. |
| 11 | **Nit** | Redirect an toàn (`Login.tsx:51` `safeInternalPath`) đã có — tốt. Nhưng nhớ preserve `source=live_gate` qua auth để tracking `signup_completed_from_live_gate` không đứt attribution. | Đính `source` vào redirect param, đọc lại sau auth callback. |

## Trạng thái màn hình
- **Gated (trạng thái chính)**: overlay đục, heading dẫn bằng kết quả chứ không bằng cấm đoán. VI: "Xem tiếp trận đấu" / EN: "Continue watching". (Nếu stream không phải trận đấu — talk/sự kiện — fallback "Xem tiếp".)
- **Loading**: skeleton `aspect-video` đã có (`WatchLive.tsx:117`) — giữ. Embed dùng spinner `Loader2` (`EmbedLive.tsx:26`); embed nhỏ, spinner chấp nhận được, không cần đổi.
- **Error / stream chưa sẵn sàng**: `EmbedLive.tsx:33,52` in tiếng Anh trần "Stream not available" cho ~95% user Việt. VI: "Buổi phát không khả dụng" / EN: "Stream not available".
- **Offline (PWA/Capacitor)**: nếu mất mạng khi gated, overlay + link `/login` không tải được → dead screen. Overlay nên là HTML tĩnh (không phụ thuộc fetch) để vẫn hiện; link điều hướng khi có lại mạng. Trong Capacitor shell dùng bridge native để thoát fullscreen trước khi hiện overlay web (vấn đề #3).

## Accessibility (WCAG 2.1 AA)
- **Focus / dialog**: thiếu (vấn đề #6) — Blocker-nhẹ cho keyboard/screen-reader.
- **Contrast**: subtext `text-white/70` (`LivestreamGateOverlay.tsx:21`, ~#B3B3B3) trên nền video sáng bất kỳ có thể tụt dưới 4.5:1 dù nền đục 80-92%. Nếu đổi sang `bg-black/[0.92]` thì `white/70` trên đen ~92% đạt; giữ nền càng đục càng an toàn. Border outline `border-white/30` (`:36`) không đạt non-text contrast 3:1 — nhưng khi hạ nút login xuống link chữ (vấn đề #2) thì bỏ được border này luôn.
- **Countdown color-only**: thanh green/yellow/red không kèm chữ → fail 1.4.1 Use of Color cho người mù màu. Vấn đề #5 (thêm badge chữ) giải quyết luôn.
- **Icon Lock**: trang trí — đảm bảo `aria-hidden` (lucide mặc định có).

## Copy đề xuất (VI / EN) — sẵn để dán vào `t.live.*`
Overlay:
- Heading `previewEnded` → VI: `"Xem tiếp trận đấu"` · EN: `"Continue watching"`
- Body `signupToWatch` → VI: `"15 giây xem thử đã kết thúc. Tạo tài khoản miễn phí để xem tiếp."` · EN: `"Your 15-second preview has ended. Create a free account to continue."`
- Nút chính `createAccount` → VI: `"Tạo tài khoản miễn phí"` · EN: `"Create free account"`
- Link phụ `loginToWatch` → VI: `"Đã có tài khoản? Đăng nhập"` · EN: `"Already have an account? Log in"`
- (Tuỳ chọn, chỉ nếu luôn đúng) VI: `"Miễn phí, không cần thẻ thanh toán."`

Countdown badge (i18n mới `t.live.previewBadge` / `previewBadgeLast`):
- VI: `"Xem thử miễn phí · Còn {n} giây"` → 5s cuối `"Còn {n} giây · Đăng ký để xem tiếp"`
- EN: `"Free preview · {n}s left"` → `"{n}s left · Sign up to keep watching"`

Embed overlay (`t.live.embedGate*`):
- Heading VI: `"Xem tiếp trên ThePickleHub"` · EN: `"Continue on ThePickleHub"`
- Body VI: `"15 giây xem thử đã kết thúc. Mở ThePickleHub để tạo tài khoản miễn phí và xem tiếp."` · EN: `"Your 15-second preview has ended. Open ThePickleHub to create a free account and keep watching."`

Embed error (`EmbedLive.tsx:33,52`): VI: `"Buổi phát không khả dụng"` · EN: `"Stream not available"`

Admin (`t.admin.viewers.*`):
- `"Đang xem"` (đang phát) · `"Chờ đăng nhập"` (ở gate) · giữ `"đang xem"` tổng làm nhãn "Trên trang" nếu muốn.

## Panel đa model
- **Đồng thuận Claude + GPT-5.6** (tín hiệu mạnh, hai model độc lập):
  1. CTA ngược — signup phải là nút chính solid, login hạ xuống link phụ (#2).
  2. Re-pause phải kèm lý do nhìn thấy được; chủ động thoát native fullscreen/PiP khi overlay HTML không render được ở đó (#3).
  3. Embed: KHÔNG mở khoá iframe tại chỗ; đẩy sang first-party (#4).
  4. Countdown 1px + dừng câm gây hiểu nhầm; cần badge chữ + cảnh báo 5s cuối, bỏ dải 3 màu (#5).
  5. Tách "đang xem" khỏi "kẹt gate", không tính người gated vào số công khai (#9).
  6. Thêm tracking click ngay từ bản này (#8).
- **Bất đồng / tôi chọn khác**:
  - **Embed đích đến**: tôi (vòng đầu) định mở thẳng `/live/:id`; GPT chỉ ra mở thẳng trang xem sẽ cấp **thêm một lượt preview/gate nữa**. → **CONCEDE GPT**: mở `/login?mode=signup&redirect=/live/:id` để auth trước, `/live/:id` chỉ là đích sau-auth. Lý do: tránh double-gate, giữ được attribution.
  - **Quy mô admin**: GPT đề xuất 4 thẻ đếm + cả dashboard funnel (Bắt đầu xem thử / Nhấn tạo tài khoản / Đăng ký thành công) cạnh presence. → **Tôi giữ hẹp cho vòng này**: proposal chỉ cần 1 field `gated` + tách 1 con số + 1 badge bảng (#9). Dashboard funnel là nice-to-have, không phải blocker, và dữ liệu funnel nên đến từ tracking (#8) rồi dựng sau — đừng nhồi vào scope tầng-1/tầng-2. (ponytail: thêm khi có số thật để hiển thị.)
  - **Cơ chế chống reload**: GPT muốn `consumedSeconds` phân số; tôi để mức Nit và giao cơ chế cho architect (#10) — mục tiêu "reload không cấp thêm 15s" là ràng buộc, cách lưu là chi tiết kỹ thuật.
- **Repo-grounded, GPT không thấy** (không có quyền đọc code): vấn đề #1 (`tab` vs `mode` — Blocker), #5 (`secondsRemaining` là prop chết), #7 (`backdrop-blur` GPT có đoán nhưng tôi xác nhận trên code `:14`), native `/apple` không có gate.
