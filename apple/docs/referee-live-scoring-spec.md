# Spec — Chấm điểm trực tiếp cho trọng tài (native iOS)

> Mục tiêu: trọng tài **ít kỹ năng công nghệ nhất** vẫn chấm đúng. Nguyên tắc lõi:
> trọng tài chỉ trả lời **một câu hỏi mỗi pha bóng — "đội nào vừa thắng?"** —
> bằng cách tap 1 trong 2 vùng lớn. App sở hữu toàn bộ luật (điểm, số server,
> side-out, đổi sân, hết game/trận) và hiển thị **score callout khổng lồ** để
> trọng tài chỉ việc nhìn-và-hô.

## 0. Quyết định đã chốt (Cuong, 2026-06-30)

- Hỗ trợ **cả 2 thể thức tính điểm pickleball**: **rally** và **side-out** (traditional).
- Thiết bị: **điện thoại của trọng tài** (dùng app native đã login).
- Lộ trình: viết spec này → build native.

## 1. Bám vào data model SẴN CÓ (không đổi DB)

| Format | Type | Field thể thức | Hàm ghi điểm (giữ nguyên) |
|---|---|---|---|
| Team Match (MLP) | `TMGame` | `scoringType` = `"rally21"` \| `"sideout11"`, `winTarget` (21/11) | `saveGameScore(gameID, scoreA, scoreB)` → `saveMatchResult(...)` |
| Quick Table | `QTMatch` | (không có) → referee tự chọn lúc bắt đầu | `score(tableID, match, score1, score2)` |

Referee mode **không thêm cột DB nào**. Nó chỉ là cách nhập mới: chạy engine rally-by-rally
→ tới hết game ra `(scoreA, scoreB)` cuối → gọi đúng hàm ghi cũ. Rollback = bỏ View, dữ liệu y nguyên.

## 2. Engine luật (pure, testable) — `Core/Scoring/ScoringEngine.swift`

State 1 game:

```
ScoreState {
  a, b: Int                 // điểm 2 đội
  serving: .a | .b          // đội đang giao
  serverNumber: 1 | 2       // chỉ doubles side-out; rally/singles bỏ qua
  mode: .rally | .sideOut
  isSingles: Bool
  winTarget: Int            // 11 / 21 / tuỳ
  winByTwo: Bool
}
```

`applyRally(state, winner) -> state`:

- **rally**: `winner` +1 điểm; `serving = winner` (chỉ để hiển thị/đọc).
- **side-out doubles**:
  - winner == serving → đội giao +1, server# giữ nguyên (đổi sân là cosmetic).
  - winner == receiver:
    - server# == 1 → server# = 2 (vẫn đội đó giao).
    - server# == 2 → **side-out**: đổi đội giao, server# = 1.
  - **Ngoại lệ đầu game (0-0-2)**: khởi tạo `serverNumber = 2` → đội giao đầu chỉ có 1 lượt server rồi side-out. Logic trên tự xử, không cần case riêng.
- **side-out singles**: receiver thắng → side-out ngay (đổi giao). Không có server#.

`isGameOver(state)`: `(a >= winTarget || b >= winTarget) && (winByTwo ? abs(a-b) >= 2 : true)`.
`callout(state)`: doubles side-out = "`giao`-`nhận`-`server#`"; rally/singles = "`a`-`b`".

**Undo**: View giữ stack `[ScoreState]`, undo = pop. Engine không cần biết.

Test: `apple/Tests/ScoringEngineTests.swift` — phủ: 0-0-2 đầu game, side-out chuỗi server 1→2→side-out, rally +1 mỗi pha, win-by-2, singles side-out.

## 3. Luồng màn hình

```
B1  Mở từ màn chấm sẵn có (TeamMatchScoringSheet / QuickTableDetailView):
    nút "▶ Chấm trực tiếp" cạnh stepper/textfield hiện tại.

B2  (QuickTable) chọn nhanh: Rally / Side-out + điểm thắng (11/15/21). Win by 2 mặc định bật.
    (TeamMatch) lấy thẳng từ game.scoringType + winTarget, bỏ qua bước này.

B3  (doubles side-out) tap đội giao đầu tiên → khởi tạo 0-0-2.
    (rally) bỏ qua, vào thẳng B4.

B4  MÀN CHẤM (landscape khoá):
    - Trên: callout KHỔNG LỒ + chấm sáng đội đang giao.
    - 2 vùng tap nửa màn = +1 cho đội đó (câu hỏi duy nhất: "ai thắng pha?").
    - Dưới: [↶ Hoàn tác]   [game N · tới X]   [Kết thúc game]

B5  Hết game (engine tự phát hiện hoặc bấm Kết thúc): popup
    "Đội A thắng X-Y. Xác nhận?" [Sửa] / [Xác nhận]
    → commit qua hàm ghi cũ (saveGameScore→saveMatchResult / score).
```

Layout (landscape):

```
┌──────────────────────────────────────────────┐
│   ĐỘI A   6   —   4   ĐỘI B        ⬤ A giao   │
├───────────────────────┬──────────────────────┤
│        ĐỘI A          │        ĐỘI B         │
│      Cường / Nam      │      Hùng / Lan      │
│        ┌─────┐        │        ┌─────┐       │
│        │ +1  │        │        │ +1  │       │
│        └─────┘        │        └─────┘       │
├───────────────────────┴──────────────────────┤
│  ↶ HOÀN TÁC      game 2 · tới 11    Kết thúc │
└──────────────────────────────────────────────┘
```

## 4. UI rules cho người ít kỹ năng

- Vùng tap = nửa màn → không bấm nhầm, không cần nhìn kỹ.
- Khoá **landscape** (bài học PPA app: xoay dọc gây tap nhầm).
- Haptic mỗi tap (đã có `Haptics.light()`).
- Undo luôn hiển thị, to.
- Không có nút "side-out" / "PIP" riêng — khác hẳn app PPA, đó là chỗ người ít kỹ năng hay loạn.
- Offline-OK: chấm chạy local hoàn toàn; chỉ chạm Supabase 1 lần lúc commit cuối game.

## 5. File đụng tới

| File | Việc |
|---|---|
| `Core/Scoring/ScoringEngine.swift` | MỚI — engine thuần |
| `Tests/ScoringEngineTests.swift` | MỚI — test engine |
| `Features/Bracket/RefereeScoringView.swift` | MỚI — màn chấm |
| `Features/Bracket/TeamMatchScoringSheet.swift` | thêm nút "Chấm trực tiếp" → present RefereeScoringView, onFinish gọi saveGameScore |
| `Features/Bracket/QuickTableDetailView.swift` | thêm nút "Chấm trực tiếp" → present (kèm picker mode/target), onFinish gọi score() |
| `apple/project.yml` | XcodeGen tự nhặt file mới trong cây nguồn — chạy `xcodegen generate` lại |

Không đụng: DB schema, migrations, edge functions, web `src/`.

## 5b. Setup trước trận + vị trí giao/đỡ (doubles side-out)

Trọng tài bốc thăm/chọn đội giao trước (`Bool.random()` hoặc tap), rồi chọn **người giao
bóng trước** + **người đỡ bóng trước**. Engine dựng `ServeRotation`: người giao đứng sân
phải (chẵn), người đỡ đứng chéo. Sau mỗi pha, callout bar hiện rõ:
`GIAO: <tên> (sân phải/trái) · ĐỠ: <tên>`.

**Luật vị trí (USAP, đã verify + test):**
- Đội giao thắng pha → 2 người đội giao **đổi sân**, cùng người tiếp tục giao (đổi bên).
- Đội đỡ thắng, server #1 → **server #2** (đồng đội) giao từ **vị trí hiện tại** (KHÔNG theo
  chẵn/lẻ — chỉ server #1 mới theo chẵn=phải).
- Đội đỡ thắng, server #2 → **side-out**, server #1 đội mới = người ở sân khớp chẵn/lẻ điểm.
- Đội đỡ KHÔNG đổi sân khi không giao.

Chỉ bật cho doubles side-out có tên 2 người/đội (TeamMatch lineup). Rally/singles/QuickTable
→ hiện theo đội + server#. Test: `doublesRotation()` trong `ScoringEngineTests` (8/8 pass).

## 5c. Phân quyền trọng tài — hiện trạng

- **MLP/TeamMatch: ĐÃ CÓ SẴN** — `TeamMatchSettingsSheet` mục "Trọng tài": chủ giải thêm
  bằng **email** (RPC `lookup_user_by_email` → bảng `team_match_referees`), xoá, list.
  Note sẵn: "Người dùng phải đã có tài khoản". `scoreAuth` = creator‖referee‖captain.
- **QuickTable: CHƯA có UI thêm** — đã có `quick_table_referees` + `isReferee` (đọc), thiếu màn quản lý.
- **Trọng tài vào thế nào (đang chốt):** model hiện tại yêu cầu trọng tài là **user đã đăng ký**;
  chủ giải nhập email → trọng tài đăng nhập app, mở giải (qua link chia sẻ) → `canScore=true`.
  Còn thiếu: cách trọng tài TỰ tìm giải được giao (danh sách "Giải tôi chấm").

## 6. Thuật ngữ song ngữ (UI tiếng Việt)

Rally = "Tính điểm trực tiếp" · Side-out = "Tính điểm giao bóng" · Server = "người giao" ·
Side-out event = "mất giao" · Undo = "Hoàn tác" · Win by 2 = "Hơn 2 điểm".
