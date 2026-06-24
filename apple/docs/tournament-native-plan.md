# Native plan — Bracket Lab (toàn bộ phần tạo giải đấu)

Kế hoạch port toàn bộ hệ thống tạo/chạy giải đấu (Tools / Bracket Lab) sang SwiftUI native.
Nguồn: web `src/pages/{QuickTables,DoublesElimination*,FlexTournament*,TeamMatch*}.tsx`,
hooks `src/hooks/use*`, migrations `supabase/migrations/*`. Backend Supabase giữ nguyên.

## 0. Bốn thể thức + độ phức tạp

| Thể thức | Bảng gốc | Cấu trúc | Độ khó native | Ưu tiên |
|---|---|---|---|---|
| **Quick Tables** | `quick_tables` (+ groups/players/matches/registrations) | Vòng tròn → playoff tự sinh | Trung bình (playoff seeding phức tạp) | **Cao** — format chủ lực, feed Tools 90% là cái này |
| **Doubles Elimination** | `doubles_elimination_tournaments` (+ teams/matches/referees) | Nhánh loại kép (winner/loser/merge) | Cao (cây nhánh) | Trung bình |
| **Team Match (MLP)** | `team_match_tournaments` (+ teams/roster/matches/games/templates) | Đội vs đội, nhiều ván con + dreambreaker | Cao (lineup + ván con) | Trung bình |
| **Flex** | `flex_tournaments` (+ players/teams/groups/matches/stats) | Tự do, kéo-thả thủ công | Rất cao (drag-drop workspace) | **Thấp** — cân nhắc để web |

Tất cả share chung: `share_id` (hex 12 ký tự), `creator_user_id`, `status`, `is_public`, timestamps;
realtime qua `postgres_changes`; tạo qua RPC `create_*_with_quota` (quota mặc định 3 giải/user).

## 1. Quyết định kiến trúc (chốt trước khi code)

**Q1 — Sinh nhánh/lịch đấu ở đâu?** (rủi ro lớn nhất)
Hiện web sinh **client-side** cho Quick Tables (`src/lib/round-robin.ts`, `quick-table-playoff.ts`:
circle method, global seeding 6 bảng, resolve trùng bảng) và Doubles; Team Match có RPC
(`generate_team_match_round_robin`, `generate_team_match_playoffs`).
- **Khuyến nghị: đẩy sinh nhánh thành RPC/edge function dùng chung** cho cả web + native.
  Một nguồn chân lý → không lệch thuật toán, không phải maintain 2 bản (TS + Swift). Cần một ít
  việc backend (port các pure-function TS sang plpgsql/edge), nhưng trả lại sự đúng đắn lâu dài.
- Phương án B (nhanh hơn, nợ kỹ thuật): port pure-function sang Swift. Chỉ chọn nếu không muốn đụng backend.
- Phương án C (MVP): native chỉ xem + chấm điểm; tạo + sinh nhánh mở web. Dùng làm bước đệm.

**Q2 — Thứ tự năng lực: XEM+CHẤM trước, TẠO sau.**
Giá trị cao nhất ở sân là **chấm điểm trên điện thoại** (organizer/referee). Xem bảng + nhập tỉ số
qua RLS là native-dễ và hữu ích ngay. Tạo giải (wizard nhiều bước) làm sau. Đây là xương sống phasing.

**Q3 — Trực quan nhánh.** Cây loại trực tiếp cần layout tùy biến (SwiftUI Canvas/scroll 2 chiều).
Tốn công. → Phase 1 dùng **danh sách trận nhóm theo vòng** (native-dễ, đủ để chấm điểm); cây nhánh
đẹp để Phase 4.

**Q4 — Lớp dữ liệu dùng chung.** 4 format share pattern → 1 `TournamentService` (lookup theo share_id,
realtime channel, mutation UPDATE, quota RPC) + repository/model riêng từng format.

## 2. Phase 0 — Nền tảng dùng chung

- `Core/Tournament/TournamentService.swift`: wrap SupabaseClient; helper realtime channel
  (`postgres_changes` filter theo tournament id, debounce 500ms như web); wrapper quota RPC
  (`get_user_quota_info`); permissions (creator / referee / captain — dùng các hàm
  `can_edit_*_scores`, `is_*_creator`).
- Models Codable dùng chung: `TournamentRef {id, shareId, type, name, status, isPublic}`,
  `BracketPlayer`, `BracketTeam`, `BracketMatch`, `MatchGame` (parse `games` JSONB).
- Mở rộng tab Tools (đã có `ToolsRepository`/`ToolsView`): "Giải của tôi" + "Đang diễn ra" cho cả 4
  format (6 query feed: `useActivePublicQuickTables` v.v. — đã map). Tap → màn view native (Phase 1)
  thay vì mở web.
- Reuse: **OpponentPickerView** (đã có từ Log trận) cho chọn người chơi/ghost + DUPR search.

## 3. Phase 1 — Xem + Chấm điểm (read + UPDATE qua RLS)  ← làm trước

Mỗi format một màn view: **standings + danh sách trận theo vòng** (chưa cần cây nhánh). Tap trận →
nhập tỉ số → UPDATE → realtime refresh. Quyền chấm = creator/referee/captain (RLS tự chặn).

Thứ tự triển khai:
1. **Quick Tables**: tab Bảng xếp hạng (sort wins → point_diff → points_for) + danh sách trận theo
   nhóm. Nhập `score1/score2` → `updateMatchScore` (UPDATE `quick_table_matches` + recompute
   `quick_table_players` stats; nếu playoff thì đẩy winner sang `next_match`). Realtime trên
   `quick_table_matches` + `quick_table_players`.
2. **Doubles Elim**: danh sách trận theo `round_number`/`round_type`; sheet nhập từng ván (mảng
   `games` JSONB best-of-N) → finalize → đẩy winner theo `source_a/source_b`/`dest_*`.
3. **Team Match**: trận đội→đội → sheet các ván con (WD/MD/MX/WS/MS + dreambreaker), nhập từng ván
   (`team_match_games`), tự cộng dồn `games_won_*` lên `team_match_matches`.
4. **Flex** (nếu làm): danh sách `flex_matches` theo group, set `winner_side` + score, stats tự cập nhật.

Native-dễ vì: tất cả là query + UPDATE trực tiếp, RLS xử lý quyền; realtime có sẵn ở Supabase Swift SDK.

## 4. Phase 2 — Tạo giải (wizard)

Wizard SwiftUI từng format gọi RPC `create_*_with_quota` (đã có chữ ký payload đầy đủ trong map).
- **Quick Tables**: 3 bước (player_count + tên + registration/skill → format round_robin|large_playoff
  → group_count). RPC `create_quick_table_with_quota` rồi PATCH `rating_source/min/max`.
- **Doubles Elim**: 3 bước (info/team_count/courts → format BO1/3/5 từng vòng → nhập teams).
  RPC `create_doubles_elimination_with_quota`.
- **Team Match**: 2 bước (info/roster_size/format/dreambreaker → game templates WD/MD/MX...).
  RPC `create_team_match_with_quota` + insert `team_match_game_templates`.
- **Sinh nhánh**: theo quyết định Q1. Nếu chọn RPC dùng chung → wizard chỉ gọi RPC sinh nhánh.
  Nếu port Swift → viết `Core/Tournament/Generators/*` (circle method, seeding) + test kỹ.
- Nhập roster thủ công: dùng OpponentPicker (user thật) + nhập tên ghost.

## 5. Phase 3 — Đăng ký & roster

- **Quick Tables registration**: form tự đăng ký (INSERT `quick_table_registrations` status=pending,
  hoặc approved nếu `auto_approve`), auto-fill DUPR nếu `rating_source=dupr`; organizer duyệt
  (UPDATE status). Realtime trên `quick_table_registrations`.
- **Team Match**: captain đăng ký đội qua invite_code → điền roster 4–8 (`team_match_roster`),
  organizer duyệt.
- Ghost player + DUPR search: reuse `dupr-user-search` (đã dùng ở Log trận).
- Lưu ý: guest qua phone OTP HIỆN chưa áp cho Bracket Lab (chỉ social events) — giữ yêu cầu đăng nhập.

## 6. Phase 4 — Cây nhánh + Dashboard

- Cây nhánh native cho loại trực tiếp: SwiftUI Canvas / ScrollView 2 chiều, vẽ từ
  `next_match_id`/`source_*`. Bắt đầu từ Doubles Elim (cây chuẩn) rồi Team Match playoff.
- Organizer dashboard (`/tools/dashboard`): hàng đợi trận theo sân (court queue) — reuse shape
  `useDashboardData` (CourtData: liveMatch/nextMatch). Realtime 10s fallback như web.

## 7. Phase 5 — Hoàn thiện

Realtime toàn bộ, chịu lỗi mạng khi chấm điểm tại sân (optimistic + retry), share link
(`/tools/<format>/<share_id>`), court/time assignment.

## 8. Rủi ro & câu hỏi mở

- **Sinh nhánh (Q1)** là rủi ro chính — chốt RPC-dùng-chung vs port-Swift trước khi vào Phase 2.
- **Flex**: workspace kéo-thả rất nặng; đề xuất để web (mở Safari) trừ khi thật sự cần native.
- **Cây nhánh**: tốn UI; Phase 1 né bằng danh-sách-theo-vòng.
- **Quota**: giữ ở backend (RPC) — không tự đếm ở client.
- **Doubles status enum** khác nhau giữa các nơi ('active'/'ongoing'/'setup') — kiểm tra giá trị
  thật trước khi filter (giống bài học `quick_table_status` không có 'active').

## 9. Thứ tự đề xuất (đường tới hạn)

Phase 0 (nền) → Phase 1 Quick Tables (xem+chấm) → Phase 1 các format còn lại →
chốt Q1 → Phase 2 tạo Quick Tables → Phase 2 các format → Phase 3 đăng ký →
Phase 4 cây nhánh + dashboard → Phase 5 polish. Flex để cuối/đẩy web.

Giá trị giao sớm nhất: **Phase 1 Quick Tables** (organizer chấm điểm vòng tròn trên điện thoại).
