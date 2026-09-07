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
| 2026-08-28 | 102 | 7481 | 9.0 | −14.3% | W36 (chạy 31/08 đúng hạn): clicks 119→102, impr 8671→7481 (−13,7%), pos 8.9→9.0. Dưới ngưỡng cảnh báo −20% → KHÔNG hành động. **World Cup chưa vào window** (kết thúc 28/08, khai mạc 30/08): `/san/khu-vuc/da-nang` 0 click, không lọt top-25; hai hub trong top-25 là `/san/khu-vuc/ha-noi` (1 click / 71 impr) và `/san/khu-vuc/ha-giang` (1 click / 1 impr). **Nhận định #533 + #574 sau 4 tuần:** 126 → 106 → 119 → 102 = dao động ±14% quanh nền ~113, so với nền trước #533 là 93 → cụm /san cao hơn nền tháng 7 ~20% và đang ĐI NGANG; không có nhóm chứng nên KHÔNG quy nhân quả cho deep-link, và spike HCMC Open 6–9/8 nằm trọn trong W33 làm hỏng phép so trước/sau. Trang top vẫn là `/vi/san/*` chi tiết, không phải hub. |
| 2026-09-04 | 138 | 7818 | 8.9 | +35.3% | W37 (chạy 07/09 đúng hạn): clicks 102→138, impr 7481→7818 (+4,5%), pos 9.0→8.9. Trên ngưỡng cảnh báo, KHÔNG hành động. **Nhiễu World Cup: KHÔNG có.** Window 29/08–04/09 nuốt trọn 6 ngày đầu giải, nhưng `/san/khu-vuc/da-nang` = 0 click — y hệt W36 — và không trang /san nào chứa `da-nang` có click. Tăng trưởng đến từ trang chi tiết `/vi/san/*`: nga-tu-la-hung-ha 11, baca-nguyen-chanh-ha-noi 5, nguyen-du-tp-hcm 4, minh-khang-ha-noi 3. **Câu hỏi mở cho W38:** cùng window đó toàn site có 7.823 clicks nhờ World Cup, cụm /san chỉ 138 — traffic giải KHÔNG chảy sang cụm sân. Đây là vấn đề internal-linking, không phải vấn đề của /san. |
