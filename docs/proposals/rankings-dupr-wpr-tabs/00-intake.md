# Intake — rankings-dupr-wpr-tabs

**Ý tưởng gốc (Cuong, 2026-08-06):** khi người dùng vào /rankings, chia thành 2 tab chính là DUPR và WPR. Bấm vào DUPR thì ra UI như cũ, WPR thì ra bảng mới xử lý. Cũng cần làm WPR giống như trên trang gốc, đó là tìm theo tên VĐV được.

## Trả lời làm rõ (AskUserQuestion)

1. **Kiến trúc tab: 2 pathname.** Thanh tab DUPR | WPR hiện trên cả hai trang; bấm WPR điều hướng sang `/rankings/ppa-tour` (tận dụng nguyên PR #552 đang mở), bấm DUPR về `/rankings`. Người dùng thấy 2 tab chính; Google thấy 2 trang độc lập.
2. **Phạm vi search: PHẢI tìm được cả ~2.075 VĐV** như trang gốc — Cuong chọn phương án này dù câu hỏi đã ghi rõ ToS PPA chặn mirror toàn bộ và email xin phép chưa có hồi âm. ⚠️ Đây là điểm panel phải giải: full search có bắt buộc = full mirror (RED vòng trước) không, hay có kiến trúc thay thế.
3. **Tab mặc định:** Cuong trả lời tự do: "Hiển thị 2 tab được highlight rõ ràng" — không chọn đổi default. Diễn giải: giữ DUPR mặc định (quyết định cũ không bị mở lại), nhưng yêu cầu THIẾT KẾ là 2 tab phải nổi bật ngang hàng — không phải pill "PRO · PPA Tour ↗" nhỏ cuối cụm scope như PR #552 hiện tại.

## Bối cảnh

- PR #552 đang MỞ (chưa merge): route `/rankings/ppa-tour` + `/vi/` twin, editorial top-25/board, SSR + sitemap + hreflang, pill PRO nhỏ trên /rankings. Branch `feat/ppa-rankings-tab`, HEAD `4f02fa1c`.
- Proposal trước: `docs/proposals/ppa-rankings-tab/` — verdict RED cho scrape/mirror tự động (ToS), RESOLVED giữ /rankings default DUPR VN. Email xin phép đã gửi legal@ppatour.com, CHƯA có hồi âm.
- Ý tưởng này = bước kế tiếp trên nền PR #552: nâng pill nhỏ thành thanh tab 2 mục nổi bật + thêm search theo tên trên trang WPR.
