# Kế hoạch nâng cấp Form chấm điểm trọng tài (MatchScoring)

## Tổng quan

Nâng cấp toàn diện trang `/matches/:matchId/score` dựa trên yêu cầu: tùy chọn hỗ trợ nhiều set, đồng hồ bấm giờ timeout (khi trọng tài bấm vào timeout bên vđv nào thì mới hiện đồng hồ bên đó), đổi sân/đổi giao bóng, hoàn tác (undo), và hỗ trợ đánh đôi (doubles). Giữ nguyên cách ghi điểm +1/-1.

---

## 1. Thay đổi Database

Thêm các cột mới vào bảng `quick_table_matches`:


| Cột                           | Kiểu                      | Mục đích                                                                |
| ----------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `set_scores`                  | `jsonb`                   | Lưu điểm từng set, VD: `[{"s1":11,"s2":9},{"s1":7,"s2":11}]`            |
| `current_set`                 | `integer` (default 1)     | Set đang thi đấu                                                        |
| `total_sets`                  | `integer` (default 1)     | Tổng số set (1, 3, hoặc 5)                                              |
| `serving_side`                | `integer` (default 1)     | Bên đang giao bóng (1 hoặc 2)                                           |
| `sides_swapped`               | `boolean` (default false) | Đã đổi sân chưa                                                         |
| `score_history`               | `jsonb`                   | Lịch sử thao tác để undo, VD: `[{"action":"score","player":1,"set":1}]` |
| `match_timer_started_at`      | `timestamptz`             | Thời điểm bắt đầu đồng hồ                                               |
| `match_timer_elapsed_seconds` | `integer` (default 0)     | Tổng giây đã trôi qua                                                   |


---

## 2. Cấu trúc UI mới

```text
┌──────────────────────────────────────────┐
│ ← Quay lại    Tên giải / Vòng    🔴 LIVE │
├──────────────────────────────────────────┤
│  [Kết thúc]  [Hoàn tác ↩]  [Đổi sân]   │  ← Toolbar (hiện khi đã Bắt đầu)
├──────────────────────────────────────────┤
│                                          │
│   Player1A          Player2A             │
│   Player1B          Player2B             │  ← Doubles: 2 tên mỗi bên
│                                          │
│         SET 1   SET 2   SET 3            │
│           11-9   7-11    ·-·             │  ← Bảng điểm các set
│                                          │
│              5  —  3                     │  ← Điểm set hiện tại (to)
│                                          │
│   ⏱ 05:23       Giao: Bên trái 🏓       │  ← Timer + serving indicator
│                                          │
├──────────────────────────────────────────┤
│  [+1 Bên trái]              [+1 Bên phải]│  ← Nút cộng điểm chính
│  [-1 Bên trái]   [Đổi giao]  [-1 Bên phải]│
└──────────────────────────────────────────┘
```

---

## 3. Chi tiết triển khai

### 3.1 Database Migration

- Thêm các cột mới vào `quick_table_matches`
- Cột `total_sets` cũng cần được cấu hình ở bảng `quick_tables` (thêm cột `default_sets` để BTC thiết lập trước)

### 3.2 Logic nhiều set

- Điểm `score1`/`score2` vẫn giữ cho set hiện tại (backward compatible)
- `set_scores` lưu kết quả các set đã hoàn thành
- Khi kết thúc 1 set: lưu điểm vào `set_scores`, reset `score1`/`score2` về 0, tăng `current_set`
- Xác định người thắng trận: best of N (VD: thắng 2/3 set)

### 3.3 Đồng hồ bấm giờ

- Nút "Bắt đầu" để start timer, lưu `match_timer_started_at`
- Hiển thị thời gian trôi qua (MM:SS) tính từ `started_at` + `elapsed_seconds`
- Khi pause: cập nhật `elapsed_seconds`, clear `started_at`

### 3.4 Đổi sân & Đổi giao bóng

- Nút "Đổi sân": toggle `sides_swapped` → hoán vị hiển thị bên trái/phải (không đổi data player1/player2)
- Nút "Đổi giao": toggle `serving_side` (1↔2), hiển thị icon 🏓 bên đang giao

### 3.5 Hoàn tác (Undo)

- Mỗi thao tác (cộng/trừ điểm, đổi giao, đổi sân, kết thúc set) được push vào `score_history`
- Nút "Hoàn tác": pop thao tác cuối và revert state tương ứng
- Lưu history vào DB để đồng bộ realtime

### 3.6 Hỗ trợ Doubles

- Bảng `quick_table_matches` đã có `player1_id`/`player2_id` trỏ đến `quick_table_players`
- Với doubles (bảng `quick_tables.is_doubles = true`): mỗi "player" thực chất là 1 team
- Fetch thêm thông tin team từ `quick_table_teams` nếu `is_doubles`, hiển thị 2 tên mỗi bên

### 3.7 Cập nhật i18n

- Thêm các key mới cho EN/VI: "Đổi sân", "Đổi giao", "Hoàn tác", "Set", "Bắt đầu", v.v.

---

## 4. Các file cần sửa/tạo


| File                         | Thay đổi                                                 |
| ---------------------------- | -------------------------------------------------------- |
| DB Migration                 | Thêm cột mới vào `quick_table_matches` và `quick_tables` |
| `src/pages/MatchScoring.tsx` | Viết lại UI + logic chính                                |
| `src/i18n/vi.ts`             | Thêm key dịch mới                                        |
| `src/i18n/en.ts`             | Thêm key dịch mới                                        |


---

## 5. Backward Compatibility

- Các trận cũ có `total_sets = 1` và `set_scores = null` → hoạt động như hiện tại
- Logic xác định winner vẫn dựa trên `score1 > score2` cho single-set, hoặc đếm set thắng cho multi-set