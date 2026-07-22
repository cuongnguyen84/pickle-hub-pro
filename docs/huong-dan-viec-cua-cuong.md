# Hướng dẫn việc thủ công của Cuong — 2026-07-22

> Phần code của roadmap 8.5→9 đã cạn (QA-04 inc4 là mảnh cuối, shipped).
> Còn lại đúng 6 việc máy không tự làm được. Xếp theo thứ tự rẻ → đắt.
> Mỗi mục ghi rõ: làm gì, ở đâu, bao lâu, xong thì tick gì.

## 1. Set secret `PLAYWRIGHT_ORGANIZER_CLUB_SLUG` (~2 phút) → đóng QA-04

Hai journey organizer (J5 autosave, J6 validation panel) tự skip tới khi CI
biết một club mà tài khoản admin test (thecuong@gmail.com) quản lý.

1. Chọn slug một club anh quản lý trên prod (URL `/clb/<slug>` — nên dùng club
   test, không dùng club thật đông người vì test mở wizard tạo sự kiện,
   dù KHÔNG publish gì).
2. GitHub → repo `pickle-hub-pro` → Settings → Secrets and variables →
   Actions → New repository secret:
   - Name: `PLAYWRIGHT_ORGANIZER_CLUB_SLUG`
   - Value: `<slug>`
3. (Workflow đã wire sẵn env này — không cần sửa gì thêm.)
4. Re-run job smoke bất kỳ → thấy J5/J6 chuyển từ `skipped` → `passed`
   → sửa dòng QA-04 trong `docs/roadmap-8.5-9.md` thành `done`.

## 2. Backlog test tay mục 16 (~10 phút, trên điện thoại)

Đã liệt kê ở `docs/manual-test-backlog.md` §16:
- Sáng 24/07 nhìn Telegram lúc ~08:05: có ping mốc PERF-05 → máy nhắc chạy đúng.
- Mở modal "Kết nối DUPR" trên iPhone thật (Safari, /dupr) — iframe SSO hiện.
- Uptime alert: KHÔNG nhận gì = đúng (chỉ ping khi site sập 2 probe liên tiếp).

## 3. OPS-02 — Restore drill database (~45 phút, cần quyền dashboard)

Mục tiêu: chứng minh backup Supabase khôi phục ĐƯỢC, ghi lại thời gian thật.
Máy không làm được vì restore điều khiển qua dashboard + cần quyết định của anh.

1. Supabase Dashboard → project `ajvlcamxemgbxduhiqrl` → Database → Backups.
   Chụp màn hình danh sách backup (bằng chứng backup đang chạy hằng ngày).
2. KHÔNG restore đè prod. Cách drill an toàn: tạo project MỚI (free tier) →
   dùng "Restore to new project" nếu plan cho phép; nếu không có nút đó thì
   drill bằng pg_dump: từ máy anh chạy
   `pg_dump "<connection-string-prod>" --schema=public -Fc -f drill.dump`
   rồi `pg_restore` vào project mới / Postgres local, đo thời gian từng bước.
3. Verify sau restore: đếm 3 bảng lớn (`profiles`, `social_events`,
   `registrations`) khớp số prod ±rows phát sinh trong lúc dump.
4. Ghi kết quả vào `docs/ops-runbook.md` (mục Restore): ngày drill, phương
   pháp, thời gian dump/restore, số liệu verify → tick OPS-02 trong roadmap.

## 4. A11Y-05 — Audit tay VoiceOver / Dynamic Type / contrast (~1 buổi)

Thiết bị: iPhone thật + Mac. Phạm vi: đúng 8 màn hình journey
(`docs/journey-screens.md`) — P1-P4 (chi tiết sự kiện + modal đăng ký),
O1-O4 (club hub + wizard tạo sự kiện).

- **VoiceOver (iPhone):** Cài đặt → Trợ năng → VoiceOver. Đi trọn journey
  player: từ link sự kiện → mở modal → điền số điện thoại (dừng trước gửi
  OTP). Ghi lại mọi chỗ: đọc sai/không đọc, thứ tự đọc loạn, nút không có
  nhãn, không thoát được modal.
- **Dynamic Type:** Cài đặt → Màn hình & Độ sáng → Cỡ chữ → kéo MAX. Đi lại
  2 journey, chụp màn hình chỗ vỡ layout / chữ bị cắt.
- **Keyboard-only (Mac, Safari/Chrome):** Tab xuyên 8 màn hình — focus thấy
  được không, có bẫy focus không, Enter/Space kích hoạt đúng không, skip
  link hoạt động (Tab đầu tiên từ đầu trang).
- **Contrast:** rọi bằng mắt các chip/badge/nút phụ trên 8 màn đó; nghi ngờ
  thì đo bằng https://webaim.org/resources/contrastchecker/.

Kết quả: ghi từng phát hiện vào `docs/manual-test-backlog.md` (mục mới
"A11Y-05 findings") — phiên Claude sau sẽ chuyển thành task sửa. Tick A11Y-05.

## 5. BASE-07 — 5+5 phiên usability baseline (~2 tuần lịch hẹn, mỗi phiên 30')

Tuyển 5 người chơi + 5 organizer từ cộng đồng (nhóm Zalo pickleball là đủ,
KHÔNG cần người lạ; tránh người đã dùng app quá quen).

**Kịch bản người chơi (không gợi ý, chỉ quan sát):**
1. "Anh/chị nhận được link này từ bạn — hãy đăng ký chơi." (gửi link
   `/social/<slug>` một sự kiện test đang mở đăng ký)
2. Đo: có tới được bước OTP không, mất bao lâu, kẹt ở đâu, nói gì khi kẹt.

**Kịch bản organizer:**
1. "Hãy tạo một buổi chơi tối thứ 7 tuần sau, 12 người, có thu phí 50k."
   (trên club test của họ hoặc anh cấp quyền club test)
2. Đo: tới được bước publish không, có dùng draft/autosave không, bỏ cuộc ở đâu.

**Ghi mỗi phiên:** hoàn thành Y/N, thời gian, 3 điểm kẹt lớn nhất, câu SUS
(10 câu chuẩn — https://measuringu.com/sus/ — chấm 0-100).

Kết quả → file mới `docs/usability-baseline-2026-07.md` (bảng 10 dòng ×
{hoàn thành, thời gian, SUS, điểm kẹt}). Tick BASE-07. UX-09 lặp lại đúng
quy trình này SAU khi cụm UX-01..08 đã sống vài tuần — đừng chạy gộp.

## 6. Đọc-data theo mốc — KHÔNG cần làm gì, máy tự nhắc

Telegram sẽ ping 08:05 các ngày mốc: PERF-05 (24/07, thực chất đủ data
27/07), THELINE-HARD (01/08), UX-07-FUNNEL (02/08), BADGE (04/08). Khi ping
tới, mở phiên Claude và nói "chạy mốc hôm nay" — predicate đã ghi trong
`docs/milestones.md`, máy tự đọc số và trả verdict.
