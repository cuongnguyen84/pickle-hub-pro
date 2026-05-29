# Telegram alerts for runtime errors — setup

Anh làm 1 lần, ~5 phút. Sau khi xong, bot sẽ tự push alert vào chat của anh khi có error spike.

## 1. Tạo bot Telegram

1. Mở Telegram → search **@BotFather** → start chat
2. Gõ `/newbot`
3. Đặt tên bot (vd `ThePickleHub Alerts`) → BotFather hỏi username → gõ tên ko trùng (vd `picklehub_alerts_bot`)
4. BotFather trả về **bot token** dạng `123456:ABCdefGHIjklMNOpqrSTUvwxyz` — **copy lại**

## 2. Lấy chat_id của anh

1. Search bot anh vừa tạo trên Telegram → start chat → gõ `/start`
2. Mở browser → paste URL (thay `<TOKEN>` bằng token vừa lấy):
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
3. Tìm `"chat":{"id":1234567890,...}` — số đó là **chat_id** của anh

## 3. Set 2 secrets vào Supabase

```bash
# Trong terminal:
cd ~/pickle-hub-pro
supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABCdefGHI... --project-ref ajvlcamxemgbxduhiqrl
supabase secrets set TELEGRAM_CHAT_ID=1234567890 --project-ref ajvlcamxemgbxduhiqrl
```

Hoặc dùng Supabase Dashboard → Project Settings → Edge Functions → Secrets → Add new secret.

## 4. Test ngay

```bash
# Bot có online ko + chat_id đúng ko?
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<CHAT_ID>&text=Hello from ThePickleHub"
# → Phải thấy message trên Telegram ngay

# Edge function chạy thử (kể cả không có error cũng OK):
curl -X POST "https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/errors-telegram-alert" \
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" -d "{}"
# → {"scanned":0,"unique_fingerprints":0,"alerts_sent":0,"alerts_suppressed":0}
```

## 5. Trigger 1 error thật để verify pipeline

Mở DevTools console trên www.thepicklehub.net và chạy:

```js
// Fire 3 lần để vượt threshold
for (let i = 0; i < 3; i++) {
  setTimeout(() => { throw new Error('Telegram smoke test — ' + Date.now()); }, i * 10);
}
```

Trong vòng 10 phút sau (theo cron schedule `*/10 * * * *`), anh sẽ nhận được message Telegram dạng:

```
🚨 ThePickleHub error spike
Type: js_error
Count: 3 in last 10m
Message: Telegram smoke test — ...
URL: https://www.thepicklehub.net/
[Open admin dashboard]
```

## Tuning

**Threshold mặc định:**
- ≥ 3 errors cùng fingerprint trong 10 phút → alert
- Cùng fingerprint không alert lại trong 60 phút (chống spam)

**Đổi threshold:** Sửa 3 hằng số đầu file `supabase/functions/errors-telegram-alert/index.ts`:
```ts
const SPIKE_THRESHOLD = 3;     // ngưỡng số lần
const SPIKE_WINDOW_MIN = 10;   // cửa sổ phút
const DEDUPE_WINDOW_MIN = 60;  // im lặng sau khi alert
```

Rồi `supabase functions deploy errors-telegram-alert --project-ref ajvlcamxemgbxduhiqrl --no-verify-jwt`.

**Tạm dừng alert:** Trong Supabase SQL Editor:
```sql
SELECT cron.unschedule('errors-telegram-alert-10min');
```

Bật lại:
```sql
-- Re-apply migration 20260527140000_errors_telegram_alert_cron.sql
```

## Xem admin dashboard

URL: **https://www.thepicklehub.net/admin/errors**

- Filter type (js_error / unhandled_rejection / csp_violation)
- Filter window (1h / 24h / 7d / 30d)
- Group theo fingerprint (không bị 50 row giống nhau)
- Realtime — leave open trong khi deploy, error mới xuất hiện ngay
- Click row → modal hiện full stack trace + URL + user agent + user_id
