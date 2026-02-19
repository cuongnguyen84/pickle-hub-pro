

# Chat Leaderboard & Top Chatter Badges

## Tong quan

Xay dung he thong xep hang nguoi chat tich cuc nhat trong moi buoi livestream, kem theo badge dac biet cho top 1, 2, 3. Dieu nay se tang tuong tac va tao dong luc cho nguoi xem tham gia chat nhieu hon.

## Thiet ke Badge

| Hang | Badge | Mau sac | Y nghia |
|------|-------|---------|---------|
| Top 1 | Crown (vuong mien) | Vang (#FFD700) | "Chat King/Queen" |
| Top 2 | Medal (huy chuong) | Bac (#C0C0C0) | Runner-up |
| Top 3 | Medal (huy chuong) | Dong (#CD7F32) | Third place |

Badge se hien thi nho gon ben canh ten nguoi dung trong moi tin nhan chat.

## Pham vi tinh diem

- Dem so tin nhan **trong moi buoi livestream** (per-livestream leaderboard)
- Chi tinh tin nhan chua bi xoa
- Cap nhat realtime khi co tin nhan moi

## Cac thay doi can thuc hien

### 1. Database - Tao RPC aggregation function

Tao mot database function `get_chat_leaderboard(livestream_id)` de tra ve top chatters theo so tin nhan. Su dung server-side aggregation pattern (khong fetch raw data ve client).

### 2. Hook moi: `useChatLeaderboard`

- Goi RPC `get_chat_leaderboard` khi mount
- Luu cache top 3 user IDs vao mot Map de tra cuu nhanh O(1)
- Tu dong cap nhat moi 30 giay hoac khi co tin nhan moi (de giam tai server)
- Export ham `getChatterRank(userId)` tra ve 1, 2, 3, hoac null

### 3. Cap nhat ChatPanel

- Import `useChatLeaderboard` trong `ChatPanel`
- Truyen rank xuong `ChatMessageItem`
- Hien thi badge icon (Crown/Medal) ben canh ten nguoi chat voi mau tuong ung
- Badge hien thi nho (14x14px), nam giua ten va timestamp

### 4. Leaderboard Panel (tuy chon)

- Them mot khu vuc nho co the mo rong (collapsible) o dau khung chat
- Hien thi top 5-10 chatters voi avatar, ten, so tin nhan
- Top 3 co highlight dac biet

### 5. I18n

- Them cac key dich cho "Top chatter", "messages" trong `en.ts` va `vi.ts`

## Luu do xu ly

```text
User gui tin nhan
       |
       v
chat_messages table (INSERT)
       |
       v
useChatLeaderboard (polling moi 30s)
       |
       v
get_chat_leaderboard RPC
  (GROUP BY user_id, COUNT(*))
       |
       v
Top 3 Map -> ChatMessageItem
       |
       v
Hien thi badge Crown/Medal
```

## Chi tiet ky thuat

### Database Function (SQL)

```sql
CREATE FUNCTION get_chat_leaderboard(_livestream_id uuid, _limit int DEFAULT 10)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, message_count bigint, rank bigint)
-- GROUP BY user_id on chat_messages
-- ORDER BY count DESC
-- LIMIT _limit
```

### Badge rendering trong ChatMessageItem

```text
[Avatar] TenNguoiDung [Crown icon vang] 14:30
          Noi dung tin nhan...
```

- Top 1: Crown icon mau vang
- Top 2: Medal icon mau bac  
- Top 3: Medal icon mau dong
- Cac nguoi khac: khong co badge

### Performance

- Su dung polling 30s thay vi realtime subscription de giam tai
- Cache ket qua trong React state, chi fetch lai khi can
- RPC chay tren server, chi tra ve 10 records (khong fetch tat ca messages)
- Gioi han batch size khi fetch avatar/profile (da co san pattern)

