# Intake — champion-on-event-card

Ngày: 2026-07-27
Ý tưởng gốc (Cuong): "khi 1 event kết thúc, thêm tên người vô địch vào card — tất cả các loại event"
Ảnh tham chiếu: card FEATURED MULTI-EVENT trên /tournaments — "TPP Cúp Mùa Hè Rực Lửa 2026", 2 sub-event badge COMPLETED nhưng không thấy ai vô địch.

## Trả lời clarify

1. **Phạm vi hiển thị:** MỌI NƠI — card danh sách, trang chi tiết event, và OG image khi share link event đã kết thúc.
2. **Đôi/đội:** hiện tên cả 2 người với đôi ("Cường & Nam"); tên đội với team.
3. **Loại event:** Tournament 4 format (single/double elim, round robin, doubles elimination, flex). KHÔNG gồm social event, team match MLP, quick table (Cuong chỉ chọn tournament).

## Chốt lại sau recon (2026-07-27)

- **Scope thật = TẤT CẢ format cộng đồng**: `quick_tables` (round robin + large_playoff — chính là card trong ảnh), `doubles_elimination_tournaments`, `flex_tournaments`. Mọi card trên tab Community của /tournaments + multi-event card. (Ranh giới "quick table bị loại" ban đầu là hiểu nhầm khái niệm — round robin nằm trong bảng quick_tables.)
- **Không suy ra được champion** (vd auto-archive 14 ngày set completed khi chưa xong chung kết): **ẨN dòng vô địch**, card giữ nguyên như hiện tại.

## Ràng buộc từ memory/repo

- Mọi feature web phải có native parity (/apple SwiftUI) — [[fix-both-web-and-native]].
- OG image = Supabase edge functions og-* (og-tournament, og-doubles-elimination, og-flex-tournament, og-quick-table).
- SSR bot = functions/_lib/render/renderTournament, cache key pr:v30.
