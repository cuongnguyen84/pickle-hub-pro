# idea-recon — champion-on-event-card (nguyên văn output agent)

## Prior art
Feature **CHƯA tồn tại** ở cấp card danh sách / trang chi tiết (ngoài bracket tab) / OG image. Đã có "champion banner" nhưng chỉ nằm sâu trong bracket-view của 2/4 format, không xuất hiện ở card hay meta description.

- `src/components/tournament/PlayoffBracket.tsx:59-163` — banner "Vô địch" cho **single elimination / large_playoff** (quick_tables), lấy từ `finalMatch.winner_id` (trận cuối trong mảng `matches` truyền vào, không phải cột DB).
- `src/components/tournament/DoublesEliminationBracket.tsx:222-418` — banner champion cho **doubles elimination**, cũng suy từ `finalMatch?.winner_id`.
- `src/components/teamMatch/PlayoffBracket.tsx:332-424` — banner champion cho **Team Match (MLP)** — NGOÀI phạm vi (loại trừ theo yêu cầu).
- **Round robin** (quick_tables format=`round_robin`) và **Flex** (`flex_tournaments`): grep không thấy champion/winner banner nào — `src/pages/FlexTournamentView.tsx`, `src/hooks/useQuickTable.ts` không có logic này. Round robin không có 1 trận chung kết đơn để suy ra "winner" — phải lấy top-1 bảng xếp hạng (chưa có sẵn RPC/cột nào đánh dấu).
- Native `/apple`: có sẵn `champion`/`championID` computed property cho DoublesElim (`apple/ThePickleHub/Core/DoublesElim/DoublesElimModels.swift:289`) + banner UI (`DoublesElimDetailView.swift:323-428`), và cho QuickTable (`QuickTableModels.swift:346`, `QuickTableDetailView.swift:804-911` — large_playoff only). Không có cho Flex, không có ở card list.

## Phát hiện quan trọng — nhầm lẫn khái niệm "round robin" vs "quick table"
Yêu cầu loại trừ "quick table" nhưng **round robin trong 4-format-scope thực chất được lưu trong chính bảng `quick_tables`** (`format` enum `"round_robin" | "large_playoff"` — `src/integrations/supabase/types.ts:5367+`). `/tournaments` tab "Community" cũng gộp cả round_robin lẫn large_playoff dưới cùng 1 `fmt: "quick-tables"` (`src/pages/Tournaments.tsx:88-107`, cards dùng chung hook `useCompletedPublicQuickTables`). Không tách được "round robin" khỏi "quick table" ở tầng UI/data hiện tại — cần hỏi Cuong.

## "FEATURED MULTI-EVENT" card = quick_tables only
`src/hooks/useFeaturedParentTournaments.ts:44-68` — query `parent_tournaments` join **chỉ `quick_tables(...)`**. Cột `parent_tournament_id` FK **chỉ tồn tại trên bảng `quick_tables`** (`types.ts:5442-5443`), KHÔNG có trên `doubles_elimination_tournaments`, `flex_tournaments`, hay `tournaments`. → Doubles-elim/flex hiện **không thể** là sub-event của 1 multi-event card — giới hạn kiến trúc, không phải lỗi. Card render: `src/components/quicktable/ParentTournamentCard.tsx:1-45` (status pill "Hoàn thành"/"Completed" tại dòng 35-40), sub-event pills render tiếp phía dưới dòng 250+.

Ngoài ra còn 1 bảng `tournaments` khác (id/name/slug/organization_id/status enum `upcoming|ongoing|ended`) — dùng cho tab "Watch"/Pro tournaments có livestream (`src/hooks/useTournamentData.ts:27`, `src/pages/Tournaments.tsx:185`), **không** phải bảng chứa 4-format bracket. Trạng thái "kết thúc" ở đây là `ended`, không có `completed`.

## Touch surface (likely)
- `src/pages/Tournaments.tsx` — `CommunityBracket` interface (dòng 46-58) + `FORMATS[].renderMeta` (dòng 88-153) render text mỗi card, chưa có field champion.
- `src/components/quicktable/ParentTournamentCard.tsx` + `src/hooks/useFeaturedParentTournaments.ts` — multi-event card + query (chỉ select quick_tables, cần thêm cột nếu muốn hiện champion trên sub-event pill).
- `src/hooks/useTournamentData.ts` — 4 cặp hook `useActive*/useCompleted*` (dòng 209, 327, 409 và tương ứng "active") — nơi cần mở rộng `.select()` để lấy dữ liệu suy ra winner (hiện chỉ select `id,name,share_id,status,...` không có match/winner).
- `src/components/tournament/PlayoffBracket.tsx`, `src/components/tournament/DoublesEliminationBracket.tsx` — nơi logic "champion" đã viết, có thể tách ra hook dùng chung.
- `src/pages/FlexTournamentView.tsx`, `src/pages/QuickTableView.tsx` (round_robin path) — chưa có logic winner cho 2 format này, phải viết mới.
- `supabase/functions/og-tournament`, `og-quick-table`, `og-doubles-elimination`, `og-flex-tournament` — mỗi cái hiện chỉ query đếm số trận, cần thêm query lấy trận chung kết/standings.
- `functions/_lib/render/tournaments.ts` (dòng 27-192) — SSR meta description cho `/tools/*` — cache key hiện tại **`pr:v32`** (`functions/_middleware.ts:462`, CLAUDE.md ghi v30 đã lỗi thời).
- `apple/ThePickleHub/Core/Flex/FlexModels.swift`, `apple/ThePickleHub/Features/Bracket/FlexDetailView.swift`, list/card views native — chưa có champion.

## Data
- `doubles_elimination_matches.winner_id`, `doubles_elimination_tournaments.status` (string, không strict enum).
- `matches` (large_playoff single-elim trong quick_tables) — không thấy bảng riêng `quick_table_matches` có cột winner_id rõ trong dump nhanh; `PlayoffBracket.tsx` nhận `matches` prop và tự suy finalMatch = round cuối cùng, không có cột "winner" trực tiếp trên `quick_tables`.
- `flex_matches.winner_side`, `flex_player_stats`/`flex_pair_stats` (bảng standings — chưa xác nhận cột rank/points, cần đọc thêm nếu làm phần round-robin/flex).
- Không có cột `winner_id`/`champion_id` denormalized trên `quick_tables`, `flex_tournaments`, `doubles_elimination_tournaments`, hay `parent_tournaments` — phải suy diễn mỗi lần từ bảng match con, không có cache/materialized field.
- `auto-archive-tournaments/index.ts:18-65` — set `status='completed'` thuần theo **14 ngày không hoạt động** (`updated_at` cũ), KHÔNG gắn với việc trận chung kết đã có kết quả hay chưa. → 1 giải có thể ở status `completed` mà chưa từng có finalMatch.winner_id (bị auto-archive giữa chừng) — cần xử lý trường hợp completed nhưng không tìm được champion.

## Binding constraints found
- `CLAUDE.md` §SEO Prerender — cache key thực tế `pr:v32:${pathname}` (đã bump so với v30 trong doc), bump version bắt buộc nếu đổi SSR output; dùng `?nocache=1` để refresh 1 URL.
- `CLAUDE.md` §Coding Standards — file `.legacy.tsx` không được sửa trừ khi rollback (không thấy `.legacy.tsx` nào cho các file touch surface trên qua ls nhanh, nhưng cần re-check trước khi sửa).
- Không tìm thấy ADR/docs riêng cho "champion display" trong `docs/adr/`, `docs/north-star-journeys.md`.

## Test coverage today
- Không tìm thấy test nào chứa "champion" trong `src/**/*.test.ts` hay `tests/`. `apple/Tests/DoublesElimResultTests.swift`, `QuickTableResultTests.swift` test logic kết quả nhưng chưa rõ có assert champion không (chưa mở file — cần đọc nếu cần chi tiết).
- Gap: chưa có test nào cho card list `/tournaments`, OG image content, hay SSR meta liên quan winner.

## Bilingual surface
Có sẵn key: `i18n/vi.ts:3956` `"champion": "Nhà vô địch"`, `i18n/vi.ts:4507` `"champion": "Vô địch"` (2 namespace khác nhau — quickTable.playoff và teamMatch), `i18n/en.ts:971,1522` `"champion": "Champion"`. Card/list text mới sẽ cần thêm key riêng (label kiểu "Vô địch: X" khác với banner hiện có).

## Unknowns worth asking Cuong
1. "Round robin" trong scope có đúng nghĩa là `quick_tables.format='round_robin'` không — vậy có tính luôn `large_playoff` (cùng bảng, cùng card, cùng hook) hay chỉ round_robin thuần? Ranh giới với "quick table" bị loại trừ nằm ở đâu.
2. Multi-event card hiện chỉ gộp được sub-event kiểu quick_tables (do FK `parent_tournament_id` chỉ có ở bảng đó) — doubles-elim/flex không group được vào parent. Có cần mở rộng schema (thêm cột) hay chỉ áp dụng champion cho sub-event quick_tables trong card đó trước?
3. Tournament ở status `completed` do auto-archive 14 ngày (không có trận chung kết thắng rõ ràng) — hiển thị gì khi không suy ra được champion?
