# Packet C — Worker dọn ảnh và cron

> **TRẠNG THÁI: CHƯA DUYỆT. Không lệnh nào đã chạy.**
> Tier: 🟡 AMBER — xoá function được, hàng đợi không mất dữ liệu.
> Nền: [`../media-worker-deployment.md`](../media-worker-deployment.md)
>
> **Cập nhật 2026-08-12:** Product Owner quyết định #1 — packet này chạy **HAI
> LẦN**: C-1 lên **staging**, C-2 lên production sau khi nghiệm thu preview.
> **Hai lần KHÔNG giống nhau** — xem §2.

---

## 1. Mục tiêu

| Lần | Project ref | Khi nào |
|---|---|---|
| **C-1** | **`utokwfcljxjkpkaqgheo`** | Giữa file #3 và #4 của B-1 |
| **C-2** | **`ajvlcamxemgbxduhiqrl`** | Giữa file #3 và #4 của B-2 |

| Thứ | Giá trị |
|---|---|
| Function | **`shop-media-lifecycle`** |
| Source | `supabase/functions/shop-media-lifecycle/` (`index.ts` 219 dòng + `webp.ts` 68 dòng) |
| `verify_jwt` | `false` — đã khai ở `supabase/config.toml:425` |
| Trạng thái production hôm nay | **chưa deploy** (80 function ACTIVE, không có nó) |

---

## 2. Secret — staging và production KHÁC NHAU ở đây

Đây là chỗ hai lần chạy tách ra, và trộn chúng là cách làm hỏng cron của cả hệ
thống.

### C-1 — staging: **PHẢI tạo secret**

Staging là một project mới; chưa có gì trong đó.

| Tên | Việc |
|---|---|
| `CRON_SECRET` | **tạo, giá trị MỚI** — sinh ngẫu nhiên |
| `cron_secret` (vault) | **tạo, CÙNG giá trị** với dòng trên |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | Supabase tự đặt |

```sh
# Giá trị mới, không in ra, không sao chép từ production.
CRON=$(openssl rand -hex 32)
npx supabase secrets set CRON_SECRET="$CRON" --project-ref utokwfcljxjkpkaqgheo
# rồi nạp CÙNG giá trị vào vault của staging:
#   SELECT vault.create_secret('<giá trị>', 'cron_secret');
```

🔴 **Không sao chép `CRON_SECRET` của production sang staging.** Một secret dùng
chung nghĩa là một máy chủ staging bị lộ gọi được cron của production.

### C-2 — production: **KHÔNG tạo, KHÔNG sửa gì**

| Tên | Có sẵn? | Việc |
|---|---|---|
| `CRON_SECRET` | ✅ | **không làm gì** |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | ✅ | không |
| `cron_secret` trong vault | ✅ | không |

🔴 **C-2 KHÔNG chứa bước `supabase secrets set`, và đó là có chủ đích.**

Secret của Supabase Edge Functions là **cấp project**. Trên production
`CRON_SECRET` đã tồn tại và **5 caller cron khác đang dùng nó**. Chạy
`secrets set` ở đó có nguy cơ rotate nó, và theo `ops-runbook.md` §2.1 rotate
đòi cập nhật vault trong cùng một nhịp — nếu không, **mọi cron trên hệ thống
401**.

`shop-media-lifecycle` đọc được `CRON_SECRET` production ngay khi deploy.

---

## 3. Lịch cron — do migration tạo, không phải lệnh riêng

Migration `20260811150000_shop_media_cleanup_cron.sql` (**file #4 của Packet B**)
tạo hai job:

| jobname | schedule | action |
|---|---|---|
| `shop-media-cleanup-every-5m` | `*/5 * * * *` | `{"action":"cleanup"}` |
| `shop-media-reconcile-hourly` | `17 * * * *` | `{"action":"reconcile"}` |

⇒ **Packet C phải chạy GIỮA file #3 và file #4 của Packet B.**

---

## 4. Thứ tự thi hành

```
Packet B, file 1-3      bảng, hàng đợi, view sức khoẻ
Packet C, bước 1-3      deploy function, xác nhận, kiểm cổng 401
Packet B, file 4        tạo hai cron job
Packet C, bước 4-6      kiểm 200, kiểm cron nổ, (tuỳ chọn) thêm monitor
Packet B, file 5-18     phần còn lại
```

---

## 5. Lệnh chính xác

> `REF` là `utokwfcljxjkpkaqgheo` ở C-1 và `ajvlcamxemgbxduhiqrl` ở C-2. Gõ tường
> minh mỗi lần; đừng để một biến từ phiên trước quyết định hộ.

### Bước 1 — deploy

```sh
npx supabase functions deploy shop-media-lifecycle --project-ref $REF
```

### Bước 2 — xác nhận nó thật sự tồn tại

```sh
npx supabase functions list --project-ref $REF | grep shop-media-lifecycle
```

**Code trong repo ≠ đã deploy.** Đây không phải nghi thức: đó là lớp lỗi đã bị
bắt nhiều lần trong repo này.

### Bước 3 — cổng fail-closed (chạy được NGAY, trước file #4)

```sh
curl -s -o /dev/null -w 'secret sai → %{http_code}\n' \
  -X POST "https://$REF.supabase.co/functions/v1/shop-media-lifecycle" \
  -H "Content-Type: application/json" -H "x-cron-secret: definitely-wrong" \
  -d '{"action":"cleanup"}'
# kỳ vọng: 401

curl -s -o /dev/null -w 'GET → %{http_code}\n' \
  "https://$REF.supabase.co/functions/v1/shop-media-lifecycle"
# kỳ vọng: 405
```

Bước này chứng minh **cổng đóng** trước khi ta chứng minh cổng mở. Thứ tự đó
quan trọng: một hàm cho qua tất cả cũng trả 200 ở bước 4.

### Bước 4 — secret đúng phải 200 (SAU file #3, vì cần bảng hàng đợi)

```sh
CRON=<đọc từ vault hoặc dashboard — KHÔNG in ra>
curl -s -X POST "https://$REF.supabase.co/functions/v1/shop-media-lifecycle" \
  -H "Content-Type: application/json" -H "x-cron-secret: $CRON" \
  -d '{"action":"cleanup"}'
# kỳ vọng: {"ok":true,"claimed":0,"deleted":0,"failed":0}
```

### Bước 5 — cron thật sự nổ (SAU file #4, đợi ~6 phút)

```sql
SELECT 1;
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'shop-media-%';
-- kỳ vọng: 2 dòng, active = true

SELECT jobname, status, start_time FROM cron.job_run_details
WHERE jobname LIKE 'shop-media-%' ORDER BY start_time DESC LIMIT 5;
-- kỳ vọng: succeeded

SELECT status_code FROM net._http_response ORDER BY id DESC LIMIT 5;
-- kỳ vọng: 200 cho hai lần gọi Shop
```

⚠️ **pg_cron "succeeded" chỉ nghĩa là SQL chạy xong.** Lời gọi HTTP vẫn có thể
401 hoặc 503 — đó chính xác là thứ OPS-00 đã tìm thấy. **Phải đọc `net._http_response`,
không chỉ `cron.job_run_details`.**

### Bước 6 — tuỳ chọn: đưa hai job vào hệ giám sát sẵn có

```sql
SELECT 1;
INSERT INTO public.ops_cron_monitors
  (monitor_key, cron_job_name, display_name, expected_interval_seconds, grace_seconds, enabled, source)
VALUES
  ('shop-media-cleanup',   'shop-media-cleanup-every-5m',  'Shop — dọn ảnh',      300,  180, true, 'pg_cron'),
  ('shop-media-reconcile', 'shop-media-reconcile-hourly',  'Shop — đối soát ảnh', 3600, 900, true, 'pg_cron')
ON CONFLICT (monitor_key) DO NOTHING;
```

Hai dòng này biến "worker chết lúc 2 giờ sáng" thành một tin nhắn Telegram thay
vì một phát hiện ba ngày sau. **Khuyến nghị làm.**

---

## 6. Xác minh sức khoẻ

| Kiểm | Kỳ vọng |
|---|---|
| `functions list` có `shop-media-lifecycle` | ✅ |
| secret sai → 401 | ✅ |
| GET → 405 | ✅ |
| secret đúng → 200 `{"ok":true,…}` | ✅ |
| 2 cron job `active = true` | ✅ |
| `cron.job_run_details` succeeded trong 10 phút | ✅ |
| `net._http_response` = **200** | ✅ |
| `SELECT * FROM shop_media_cleanup_health` | `pending`/`due_now`/`stuck`/`failed` đều **0** |

---

## 7. Rollback

```sql
-- Cron TRƯỚC — nếu không, cron gọi một URL không tồn tại mỗi 5 phút.
-- Câu lệnh cấp cao nhất, KHÔNG bọc trong DO-block (ops-runbook §3).
SELECT 1;
SELECT cron.unschedule('shop-media-cleanup-every-5m');
SELECT cron.unschedule('shop-media-reconcile-hourly');
```

```sh
npx supabase functions delete shop-media-lifecycle --project-ref $REF
```

Hàng đợi `shop_media_cleanup_jobs` nằm im. **Không mất dữ liệu.** Ảnh đã thu hồi
sẽ **không** bị xoá cho tới khi worker quay lại — đó là chi phí thật của
rollback này, và nó là lý do rollback function gần như không bao giờ đúng.

### Không rotate secret trong rollback

Trên production `CRON_SECRET` dùng chung với 5 caller; rollback Shop **không**
đụng tới nó. Trên staging nó chỉ phục vụ Shop, nên rollback ở đó cũng không cần
rotate — xoá cả project là cách dọn dứt điểm.

---

## 8. Ô ký

```
Packet C — deploy shop-media-lifecycle và xác nhận cron.

Lần này là:  [ ] C-1 staging (utokwfcljxjkpkaqgheo)   [ ] C-2 production (ajvlcamxemgbxduhiqrl)

Tôi hiểu rằng:
  - C-1 TẠO một CRON_SECRET mới cho staging; C-2 KHÔNG đụng secret nào;
  - không sao chép CRON_SECRET giữa hai môi trường;
  - hai cron job do migration của Packet B tạo, không phải packet này;
  - packet này chạy GIỮA file #3 và #4 của Packet B;
  - rollback = unschedule rồi delete; hàng đợi giữ nguyên dữ liệu.

[ ] DUYỆT — ký: ____________  ngày: __________
[ ] TỪ CHỐI — lý do: _______________________________________________

Bước 6 (ops_cron_monitors):  [ ] có   [ ] không

Người thi hành: _____________
function version sau deploy: _____
net._http_response status_code quan sát được: _____
```
