# Intake — quicktable-registration-count

Follow-up D1 từ proposal `codex-review-de-integrity`. `OpenRegistrationSection` hiện là dead code (progress bar hard-code 25%, 0 render caller, chỉ export barrel `index.ts:4`). Câu hỏi: xây feature đếm số đăng ký thật hay xoá dead code.

## Cuong quyết (2026-07-21)

- **Mục đích: Social proof kéo đăng ký.** Hiện "N người/đội đã đăng ký" để tạo momentum, thúc người xem đăng ký theo. → KHÔNG phải chỉ-thông-tin, KHÔNG phải xoá.
- **Vị trí: Card ở `/tournaments` list.** Mỗi card giải QuickTable hiện badge số đăng ký. → cần aggregate GROUP BY cho cả list, query PHẢI tách kẻo throw sập list.
- Ràng buộc từ proposal gốc: **KHÔNG cap cứng, chỉ hiện số thật**; verify GRANT anon (badge phải hiện cho khách chưa login vì đây là social-proof công khai).

## Ẩn ý cho panel

- Social proof chỉ có tác dụng khi số đủ lớn. Số 0-2 người ở giải mới → phản tác dụng (nhiện "1 người đã đăng ký" làm giải trông chết). Cần ngưỡng ẩn/threshold — panel cân.
- Đối tượng ~95% VN mobile, song ngữ VI/EN.
- Đây là bề mặt list công khai → có SSR/SEO prerender (`/tournaments`)? risk-auditor kiểm.
