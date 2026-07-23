# Intake — notification-bell-not-clickable

**Ý tưởng gốc (Cuong):** nút thông báo bell ring ko click vào được, ko mở ra cái gì

**Loại:** BUG REPORT (không phải feature mới)

## Trả lời làm rõ (2026-07-23)

- **Nền tảng:** Web mobile (trình duyệt điện thoại) **và** Web desktop — tức là bug ở web app, không phải native.
- **Triệu chứng:** Bấm vào chuông → **không phản ứng gì hết** — không mở panel, không hiệu ứng nhấn, như bấm vào chỗ chết.

## Bối cảnh nghi vấn (orchestrator ghi nhận, chưa verify)

- Commit `375cd764` — `fix(a11y): notification bell trigger ARIA + scroll-guard false red (#447)` — vừa sửa đúng nút chuông này (merged ~2026-07-22/23). Khả năng regression từ PR này cần recon kiểm tra đầu tiên.

## Ai dùng / đau ở đâu

- Mọi user đã đăng nhập (VI là chính) — chuông là đường vào duy nhất xem thông báo trên web.
- Thành công = bấm chuông mở panel thông báo, trên cả mobile lẫn desktop web.
