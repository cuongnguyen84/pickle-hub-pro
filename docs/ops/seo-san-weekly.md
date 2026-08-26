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
| 2026-08-14 | 106 | 7776 | 8.3 | −10.2% | W34 (chạy 17/08 đúng hạn): hạ nhiệt sau spike HCMC Open 6–9/8 (W33 126) nhưng vẫn > nền 31/07 (93); impr −3,1%, pos 7.8→8.3. Dưới ngưỡng cảnh báo −20% → KHÔNG hành động. |
| 2026-08-21 | 119 | 8671 | 8.9 | +12.3% | W35 (chạy 24/08 đúng hạn): bật lại trên nền — clicks 106→119, impr 7776→8671 (+11,5%), pos 8.3→8.9. Trên ngưỡng cảnh báo, KHÔNG hành động. Top trang vẫn là /vi/san/* (baca-pickleballs-nguyen-chanh-ha-noi 11 click). Chưa tách được hiệu ứng PR #533/#574 khỏi mùa giải — bắt đầu ghi nhận từ W36. |
