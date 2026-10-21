# Intake — cls-attribution (2026-08-09)

Ý tưởng (Cuong): đọc GA4 cls_shift_target (VN mobile) tìm thủ phạm layout shift lớn nhất, đề xuất fix kéo CLS p75 mobile (~0.67, 63.7% poor) về good.

Không hỏi intake — mọi câu trả lời derivable từ context:

- **Ai dùng:** toàn bộ khách mobile VN (~95% audience). Nạn nhân nặng nhất: người xem livestream.
- **Đau ở đâu:** trang nhảy layout khi đang xem/đang bấm. PERF-05B (milestones.md): CLS %good chỉ 32,4%, poor 63,7% (n=457, VN+mobile 29/07–08/08).
- **Thành công:** CLS %good VN+mobile ≥75% ở lần đọc GA4 kế tiếp (cùng predicate PERF-05B).
- **Ràng buộc:** perf budget INITIAL/CODE gần trần (headroom ~65KB); fix phải cả web lẫn WebView native (native dùng remote URL); không phá signed playback / player Mux.

## Data đã kéo sẵn (orchestrator, 09/08) — `00-data-ga4-raw.txt`

1. **`cls_shift_target` / `cls_load_state` / `route` CHƯA đăng ký custom dimension GA4** → Data API không query được, và GA4 không hồi tố (gotcha đã biết từ PERF-05). Element-level attribution từ field data hiện KHÔNG có.
2. `pagePath × metric_rating` (dim chuẩn, CLS, VN mobile, 29/07–08/08) — thủ phạm cấp trang:
   - `/live/<id>` (các trang livestream): ~226/291 poor ≈ **78% tổng CLS poor** — stream đông nhất 179 poor / 20 good / 10 ni
   - `/` (home): 37 poor / 15 good
   - `/login`: 15 poor / 90 good
   - Còn lại: lẻ tẻ 1-3 events/trang
3. Hệ quả cho thiết kế: câu hỏi trung tâm KHÔNG phải "trang nào" (đã biết: /live) mà là (a) tìm phần tử thủ phạm bằng cách nào — repro local trên /live vs đăng ký dims + đợi 7 ngày, và (b) fix gì trên /live + home.
