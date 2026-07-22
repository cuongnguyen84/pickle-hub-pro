# ui-ux-critic — round 1 (nguyên văn, 2026-07-21)

Panel ran two-model. Both files saved to `docs/proposals/auto-milestone-run-2026-07/external/`.

## Đánh giá tổng thể

Cơ chế milestone-explosion là đúng và cần thiết — tiền lệ soak #407/#409 rơi rớt chứng minh "đã cam kết" ≠ "sẽ nổ". Góc operator-UX: thiết kế sống hay chết ở **dòng đầu tiên của notification Telegram** (thứ Cuong thấy trên lock-screen, một tay, ngoài sân) và ở **nguyên tắc "nhắc lại tới khi DONE, không phải tới khi ĐỌC"**. Hai mốc đọc-số nguy hiểm nhất — badge (#6) và funnel UX-07 (#5) — theo spec hiện tại sẽ đẻ ra report **không trả lời được câu hỏi của chính nó**; đó là Blocker phải chốt trước, không phải chi tiết format.

## Luồng người dùng (operator)

Entry: Cuong **không mở repo hằng ngày**, mở Telegram hằng ngày. Deep-link reality của operator = một dòng notification đẩy vào lúc anh đang làm việc khác.

- **Vào:** GitHub Actions cron (bề mặt date-trigger DUY NHẤT trong repo) đọc manifest `due_at` theo `Asia/Ho_Chi_Minh`, thấy mốc đến hạn & chưa done → gọi edge function `errors-telegram-alert` (tái dùng, đúng option A của Cuong).
- **Task:** Cuong đọc summary 10-14 dòng trên điện thoại, quyết trong 1 phút, hoặc mở artifact (GitHub Issue) nếu cần đào sâu.
- **Ra:** Cuong reply `/done <id>` (tái dùng `telegram_queue` sẵn có) → mốc tắt. Nếu không, **nhắc lại mỗi ngày 08:00 ICT tới khi done**. Điểm sống-còn: cơ chế cũ rơi vì fire-once; cơ chế mới phải idempotent trên điều kiện "đến hạn & chưa done", không phải "đúng phút" (GitHub cron trễ/bỏ lượt).
- **Watchdog:** workflow milestone-dispatch phải ghi heartbeat vào cron-health hiện có. Nếu không, con-chó-canh chết âm thầm = đúng cái failure mode ta đang sửa.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | Mốc #6 (telemetry badge): `reg_count_badge_impression` chỉ chứng minh badge **được nhìn thấy**, KHÔNG chứng minh nó tăng đăng ký. Report keep/kill dựa trên nó là ngụy biện. | Verdict hợp lệ duy nhất với event hiện có = `CHƯA THỂ KẾT LUẬN`. Muốn quyết thật: thêm `badge_click` + join conversion cùng session, hoặc holdout 50/50. |
| 2 | **Blocker** | Mốc #5 & #6 đọc GA4 custom event params mà `scripts/seo/ga4_report.py` KHÔNG query được, và custom dimensions GA4 **không hồi tố**. Nếu chưa đăng ký dimension NGAY thì đến ~02/08 đọc sẽ thiếu lịch sử. | Verify NGAY (không chờ ngày mốc) rằng journey-step + badge params đã đăng ký làm GA4 custom definitions. Mở rộng `ga4_report.py` thêm `runReport`/`runFunnelReport`. Nếu Data API không đủ cho ordered-events, bật BigQuery export từ bây giờ. |
| 3 | **Blocker** | QA-04 "ổn định flaky" có thể bị làm tắt = `test.skip` một test THẬT. `auth.spec.ts:76` (DUPR SSO iframe) là hard-fail, không phải flake — skip nó che regression thật (DUPR webhook auth hole CRITICAL đang mở). | Vạch line rõ: **flake** = cùng code, pass/fail ngẫu nhiên → sửa determinism. **Broken** = fail xác định → sửa product hoặc assumption test, KHÔNG skip. DUPR SSO phải triage product-or-stale. |
| 4 | **Nên sửa** | Root cause flake: spec dùng `page.waitForTimeout(1500)` cố định — nguồn flake kinh điển. | Thay bằng web-first assertions auto-retry của Playwright, bỏ timeout tùy tiện. Sửa một pattern, hết cả cụm. |
| 5 | **Nên sửa** | Dòng đầu alert hiện tại phí preview lock-screen: `🚨 *ThePickleHub error spike*`. Notification Android chỉ hiện ~1 dòng đầu. | Dồn severity + metric + verdict lên dòng 1: `🔴 P1 · LCP p75 VN 2,84s (ngưỡng 2,5s)`. |
| 6 | **Nên sửa** | Report đọc-số kết thúc bằng "tùy Cuong" = decision fatigue. | Mỗi report BẮT BUỘC 1 verb khuyến nghị (`GIỮ/ROLLBACK/BUILD/CLOSE/KEEP/KILL/CHƯA ĐỦ MẪU`) + ngưỡng pre-committed + sample size. |
| 7 | **Nit** | `errors-telegram-alert/index.ts:193` `alert_count: (dedup ? 1 : 1)` — ternary chết, luôn = 1. | OPS-04 chạm file này rồi: sửa thành `(dedup?.alert_count ?? 0) + 1`. |
| 8 | **Nit** | `.tl-btn` HARD flip: PR mở trước ngày flip, rebase sau, đột ngột đỏ CI. | Trước 01/08 chạy advisory sweep trên HEAD mọi open PR, comment file:line. Ngày flip = PR 1 dòng. |

## Trạng thái màn hình (bề mặt Telegram)

- **SLO breach P2:** gửi ngay giờ ngày; night-quiet 22:00–07:00 ICT (giữ tới 07:00). Chỉ gửi khi chuyển `healthy → breached`, reminder mỗi 24h nếu vẫn mở.
- **SLO breach P1 (error-budget):** gửi ngay kể cả ban đêm.
- **Recovery:** BẮT BUỘC — thiếu thì Cuong không biết sự cố tự hết hay còn mở.
- **Milestone due:** 08:00 ICT ngày đến hạn, nhắc mỗi ngày tới khi `/done`.
- **Milestone overdue >48h:** wording đỏ, tiếp tục nhắc.
- **Watchdog down:** cron-health bắn nếu milestone-dispatch không heartbeat trong 90 phút.
- **Insufficient sample:** trạng thái `BLOCKED — sửa telemetry, đọc lại ngày X`, KHÔNG giả vờ quyết.

Windowing SLO: rolling 24h, eval mỗi giờ, mở incident khi vượt ngưỡng 3 lần liên tiếp, min mẫu LCP/CLS ≥200 / INP ≥100 lượt đo VN.

## Accessibility (glanceability mid-tier Android, một tay)

- Severity mã hóa bằng **chữ P1/P2**, không chỉ emoji.
- Giữ MarkdownV2 escaping hiện có (`escapeMarkdown` dòng 56) — KHÔNG rewrite sang HTML parse mode như GPT gợi ý.
- Ngôn ngữ: SLO/milestone/report mới → **tiếng Việt**; tên metric/event giữ English trong code-format.

## Copy đề xuất (trích)

SLO P2: dòng 1 = `🟠 P2 · LCP p75 VN 2,84s (ngưỡng 2,5s)` + Duy trì/Mẫu/Bắt đầu/Ảnh hưởng/Việc cần làm + 2 nút.
Milestone due: `⏰ MỐC ĐẾN HẠN · UX-07` + hạn + câu hỏi quyết định + `Xong: trả lời /done UX-07 build hoặc /done UX-07 close`.
Badge khi thiếu control: `Khuyến nghị: CHƯA THỂ KẾT LUẬN KEEP/KILL — event chỉ chứng minh badge được hiển thị.`

Decision rule pre-commit UX-07: `BUILD` nếu cả ba — ≥100 unique users gặp login wall/14 ngày, ≥30% bỏ cuộc wall→login, ước tính ≥10 completed registrations thêm. `CLOSE` nếu đủ mẫu nhưng dưới ngưỡng. Không đủ mẫu → `BLOCKED`. (Khớp roadmap-status mục 4: nhánh "near-zero → close" rất có thể trúng; đừng xây guest-path đầu cơ.)

## Panel đa model

**Đồng thuận Claude + GPT-5.6:** Telegram = bề mặt đánh thức, GitHub Issue = bản ghi bền, markdown chỉ tham chiếu. "Nhắc tới khi DONE", idempotent trên "due & not done", watchdog heartbeat. SLO windowing + night-quiet + recovery bắt buộc. Report: VI, sample size + baseline + 1 khuyến nghị + pre-committed rule. impression-only KHÔNG kết luận được. QA-04: sửa determinism ≠ skip; DUPR SSO phải triage. .tl-btn flip cần open-PR sweep trước.

**Bất đồng nội bộ với GPT-5.6:**
1. **Channel topology.** GPT muốn supergroup 2 topic. Tôi: giữ MỘT chat, prefix P1/P2/MỐC, defer topic tới khi volume chứng minh. GPT tự nhượng "giai đoạn đầu vẫn một chat".
2. **Máy trạng thái ACK.** GPT đề 3 trạng thái due/acknowledged/done. Tôi: ship 2 trạng thái open/done + nhắc ngày; thêm `/ack` chỉ khi Cuong thấy phiền. Quyết định của Cuong.

Files: external/ui-ux-critic-gpt56-{prompt,reply}.md · errors-telegram-alert/index.ts:193 (bug) · scripts/check-theline.mjs Rule 4 · scripts/seo/ga4_report.py · tests/auth.spec.ts:76.
