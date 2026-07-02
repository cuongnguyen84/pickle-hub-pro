# Handoff — Quick Table: tên từng VĐV cho đôi (feed màn trọng tài)

*2026-06-30. Tự build qua đêm (Cuong cho toàn quyền). Đọc cùng `apple/docs/referee-live-scoring-spec.md`.*

## Mục tiêu
Wizard tạo Quick Table cho chọn **đơn/đôi** ngay từ đầu; đôi nhập **2 tên VĐV** (app gộp
"A & B" làm nhãn competitor, giữ 2 tên riêng) để màn trọng tài hiện được người giao/đỡ theo
tên. Áp dụng **native + web (prod)**, cả setup thủ công lẫn (một phần) đăng ký.

## ⚠️ BƯỚC THỦ CÔNG BẮT BUỘC TRƯỚC KHI DÙNG/DEPLOY
Máy này KHÔNG có Supabase management token (secrets file là của máy `cuongmit`), nên em
**chưa apply được migration**. Phải chạy trước, nếu không insert player sẽ lỗi (cột chưa tồn tại)
và **web deploy sẽ vỡ tạo Quick Table**:

```bash
# Cách 1: gõ trong session Claude (prefix !) để Cuong tự chạy với token của mình, hoặc:
SBP=<SUPABASE_ACCESS_TOKEN>
python3 -c "import json;print(json.dumps({'query':open('supabase/migrations/20260630120000_quick_table_player_names.sql').read()}))" > /tmp/sql.json
curl -s -X POST "https://api.supabase.com/v1/projects/ajvlcamxemgbxduhiqrl/database/query" \
  -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" --data-binary "@/tmp/sql.json"
```
Migration chỉ thêm 2 cột nullable `quick_table_players.player1_name`, `player2_name` — an toàn, không phá dữ liệu cũ.

**Thứ tự đúng:** apply migration → rồi mới deploy web. Native là dev build, không ảnh hưởng prod user.

## ĐÃ XONG (build/typecheck pass)

### Migration
- `supabase/migrations/20260630120000_quick_table_player_names.sql` — thêm `player1_name`, `player2_name`. `name` giữ nguyên = nhãn gộp cho mọi logic cũ (bảng/trận/xếp hạng/playoff).

### Native (`/apple`) — build SUCCEEDED
- `Core/QuickTable/QuickTableModels.swift`: `QTPlayer` +`player1Name`/`player2Name`; `QuickTableDetail.pairNames(for:)` trả 2 tên khi đôi.
- `Core/QuickTable/QuickTableRepository.swift`: SELECT players lấy 2 cột; `RosterEntry`/`PlayerInsert` mang 2 tên; `setupRoster` insert; **fix `_is_doubles` = lựa chọn thật** (trước hardcode true cho setup tay).
- `Features/Bracket/CreateQuickTableView.swift`: Step 1 có **segmented Đơn/Đôi** + placeholder số lượng động ("VD: 15 đôi"/"VD: 10 đơn"); roster đôi = **2 ô tên/dòng** (`doublesRosterRow`), đơn = 1 ô; `filledRoster` gộp "A & B" + lưu 2 tên.
- `Features/Bracket/QuickTableDetailView.swift`: ScoreSheet truyền `playersA/playersB = detail.pairNames(...)` cho `RefereeScoringView` → đôi side-out hiện rotation theo tên.

### Web (`/src`) — `npx tsc --noEmit` PASS
- `hooks/useQuickTable.ts`: `QuickTablePlayer` + `player1_name`/`player2_name`.
- `hooks/useQuickTableMutations.ts`: `addPlayers` nhận + insert 2 cột.
- `pages/QuickTableSetup.tsx`: `PlayerInput.name2`; `isDoubles` từ `table.is_doubles`; roster đôi 2 ô tên; `playerData` gộp nhãn + 2 tên; `filledPlayers` đôi cần đủ 2 tên.
- `pages/QuickTables.tsx`: Step 1 nút **Đơn/Đôi luôn hiện** (trước chỉ hiện khi đăng ký) + placeholder động; bỏ checkbox is-doubles trùng trong panel đăng ký.

## CÒN LẠI (cố ý chưa làm — rủi ro, cần test runtime)

### Luồng ĐĂNG KÝ đôi → tên VĐV vào trọng tài
- Web đăng ký đôi lưu ở **bảng riêng `quick_table_teams`** (`player1_display_name`, `player2_display_name`) — **2 tên ĐÃ có sẵn ở đó**.
- RPC `btc_manage_team` (migration `20260102004009...`) duyệt team nhưng **không tạo `quick_table_players` row** từ team. Chỗ team→player chuyển đổi cần rà: nếu có, phải copy `player1_display_name`/`player2_display_name` sang `player1_name`/`player2_name`.
- **Lý do dừng:** sửa RPC là migration prod em không apply/test được; sửa mù dễ vỡ luồng duyệt đăng ký đang chạy. Cần Cuong xem + test trên staging.
- Native đăng ký Quick Table hiện hand-off sang web cho phần này.

### Polish
- i18n: placeholder "VĐV 1/2" + nhãn dùng literal/`language` check, chưa thêm key vào file dịch (tránh đụng 4-file). Có thể chuẩn hoá sau.
- Đồng bộ `name` ↔ `player1/2_name`: quy ước `name` sinh tự động, không sửa tay riêng (tránh lệch).

## Verify đã làm
- Native: `xcodebuild build` SUCCEEDED. Engine trọng tài 8/8 test vẫn pass (không đụng).
- Web: `npx tsc --noEmit` sạch.
- CHƯA runtime-test (không có token apply migration + không deploy). Sau khi apply migration: tạo 1 Quick Table đôi (native + web), nhập 2 tên, vào trọng tài side-out → phải thấy "GIAO: <tên> · ĐỠ: <tên>".
