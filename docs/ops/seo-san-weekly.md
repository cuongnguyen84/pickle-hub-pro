# Tracker organic cụm /san — hàng tuần

> Checklist docs/seo-followup-2026-08.md mục 6. KHÔNG SLO nào canh organic — file này LÀ
> monitoring. Cron tuần (thứ 2) chạy:
> `python3 scripts/seo/gsc_report.py --page-contains /san/`
> (GSC lag ~3 ngày nên cửa sổ là 7 ngày kết thúc 3 ngày trước). Cảnh báo nếu clicks
> giảm >20% WoW — đó là hình dạng sự cố "noindex/link nhầm" mà panel 02/08 mô tả.
> Mốc so sánh quan trọng: PR #533 (fix VI links + title byte) deploy 03/08 — hiệu ứng
> đọc được từ ~tuần 31/08.

| Tuần (end) | Clicks | Impr | Pos | WoW clicks | Ghi chú |
|---|---|---|---|---|---|
| 2026-07-31 | 93 | 7543 | 7.8 | +4.5% | Baseline TRƯỚC PR #533 (chạy tay 03/08) |
| 2026-08-08 | 126 | 8056 | 7.8 | +41.6% | W33 (chạy 11/08, trễ 1d): hồi mạnh sau lull t7 — HCMC Open 6–9/8 + PR #574 deep-links (11/8, chưa ảnh hưởng window này) |
