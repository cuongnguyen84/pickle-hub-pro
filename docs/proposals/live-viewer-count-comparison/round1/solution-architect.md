# Solution Architect — live-viewer-count-comparison (Vòng 1)

> Nhiệm vụ SO SÁNH, không thiết kế feature mới. Mọi con số dưới đây đều ghi rõ
> nguồn: `[verified]` = em tự mở file/`node_modules` kiểm chứng trong phiên này,
> `[unverified]` = suy luận hoặc kiến thức nền về Supabase, **chưa đo được**.

---

## Tóm tắt kiến trúc

Cách A (hiện tại) là Supabase Realtime Presence, chi phí Postgres **bằng 0** cho
chính con số viewer, và — điểm recon bỏ sót — nó chỉ còn **đúng một consumer sống
trong prod** là `src/pages/WatchLive.tsx:75`, một trang vốn đã mở WebSocket cho
chat, nên viewer count hiện **không tốn thêm một connection nào**. Cách B (bảng ô
nóng + heartbeat) đổi 0 write DB lấy ~2.4V write/phút + ~4V read/phút, chậm hơn ở
đúng bước Cuong quan tâm nhất ("ai rời đi": 60-85s so với tức thì), và kém chính
xác hơn vì phải tự bịa `viewer_key`. Thứ Cách B thắng thật sự chỉ có hai: **lịch
sử** (Presence không nhớ gì, hết stream là mất số) và **dễ port sang native** —
cả hai đều mua được bằng 1 INSERT/phút/livestream thay vì cả một bảng heartbeat.

---

## 1. Cách A — Supabase Realtime Presence (hiện trạng, mô tả trung thực)

### 1.1 Cơ chế

`src/hooks/useLivePresence.ts` `[verified]`:

- Topic cố định `livestream_presence:<id>` (dòng 51), presence key ngẫu nhiên
  per-tab `viewer_<suffix>` (dòng 75). Comment dòng 8-11 ghi lại sự cố 2026-07-08:
  suffix từng nằm ở topic → mỗi client một "phòng" riêng, ai cũng thấy 1 viewer.
- `channel.track()` khi `SUBSCRIBED` (dòng 107) với payload
  `{ joined_at, user_id, user_agent (100 ký tự), gated }`.
- Đếm = `Object.keys(channel.presenceState()).filter(k => !k.startsWith("admin_watcher_"))`
  (dòng 41-43), chạy lại mỗi event `presence:sync`.
- Registry refcount per-client (dòng 133-154): nhiều component cùng trang chia
  chung **1 channel**.
- Retry: exponential 2s→30s, `MAX_RETRIES=10`, sau đó 60s cố định (dòng 37-38, 116-118).

**Ba bước của Cuong đã có sẵn trong Cách A**, chỉ là làm ở tầng Realtime chứ
không phải Postgres:

| Bước Cuong | Cách A làm ở đâu |
|---|---|
| 1. Ô nóng | Chính cái channel topic `livestream_presence:<id>` — state sống trong RAM node Realtime, GC khi socket đóng |
| 2. Đếm người | `countViewers()` `useLivePresence.ts:41` |
| 3. Ai rời đi | Phoenix Presence tự xoá key khi socket close/timeout — **app không viết một dòng code nào** |

### 1.2 Consumer thật trong prod — recon nói 3, thực tế là 1

`[verified]` grep toàn `src/` (loại `graphify-out/`):

- `src/pages/WatchLive.tsx:75` — **consumer sống duy nhất**.
- `src/components/home/LiveBroadcastHero.tsx:151` — file định nghĩa component,
  **không file nào import**. Dead code.
- `src/components/content/LiveCardWithPresence.tsx:45` — chỉ được re-export ở
  `src/components/content/index.ts:3`; 6 file import từ barrel đó đều lấy
  `EmptyState`/`ContentCard`/`LiveCard`, **không ai lấy `LiveCardWithPresence`**.
  Dead code.

**Hệ quả cho bài toán chi phí:** hôm nay Presence *không* bắt khách vào trang chủ
hay `/feed` phải giữ WebSocket. Chỉ người đang ở trang xem mới join — mà trang đó
đã mount `ChatPanel` (`WatchLive.tsx:356,360,549`) → `useChatMessages.ts:128` mở
channel Realtime rồi. **Presence hiện cộng thêm 0 connection, chỉ thêm 1 channel
ghép kênh trên socket đã có.**

### 1.3 Presence tính vào quota nào của Supabase

Supabase tính tiền Realtime theo **hai** trục riêng biệt:

| Trục | Presence có ăn không | Ghi chú |
|---|---|---|
| **Peak concurrent connections** | Ăn, nhưng **1 socket/tab** bất kể bao nhiêu channel `[verified: realtime-js multiplex]` | Ở prod hôm nay = 0 connection tăng thêm vì chat đã mở socket |
| **Realtime messages** | Ăn — mỗi `presence_diff`/`presence_state` là 1 message tới mỗi subscriber `[unverified: cách Supabase đếm chính xác]` | Đây mới là trục đắt, xem 1.4 |
| Postgres (compute/IO/WAL) | **Không ăn gì cả** `[verified: không có query nào trong đường đếm]` | Presence không phải object Postgres, RLS không áp dụng |

Gói Pro (mặc định của repo, compute Micro): ~500 peak connection và ~5 triệu
message/tháng nằm trong giá, vượt thì ~$10/1000 conn và ~$2.50/triệu message
`[unverified: bảng giá theo trí nhớ, phải mở dashboard Billing xác nhận]`.

### 1.4 Chi phí message — công thức và ceiling thật

Với V viewer, mỗi người join 1 lần và leave 1 lần:

- join → server đẩy `presence_diff` cho V subscriber = V message; joiner nhận
  `presence_state` đầy đủ = 1 message **kích thước O(V)**.
- leave → `presence_diff` cho V-1 subscriber ≈ V message.
- Tổng ≈ **2V² message/stream** (chưa tính reconnect).

| V | message/stream (1 join + 1 leave/người) | Đọc thế nào |
|---:|---:|---|
| 50 | ~5.000 | Không đáng kể |
| 500 | ~500.000 | 10 stream/tháng là hết quota Pro |
| 5.000 | ~50.000.000 | 1 stream = ~$112 overage |

4G Việt Nam rớt sóng nhiều; mỗi lần reconnect = 1 leave + 1 join = thêm 2V
message. Với c lần reconnect/viewer/giờ thì message/giờ ≈ 2·c·V².

**Ceiling cứng ít người để ý — kích thước `presence_state`:**
payload mỗi key hiện tại ≈ `joined_at` 24B + `user_id` 36B + `user_agent` 100B +
`gated` + tên key + overhead JSON ≈ **200-220 byte/viewer** `[verified: payload ở
useLivePresence.ts:102-107]`. `presence_state` gửi **toàn bộ** state cho mỗi
người mới vào:

- V=1.000 → ~210 KB
- V=1.250 → ~260 KB → **chạm trần payload Realtime (~250 KB mặc định)** `[unverified: con số 250KB là mặc định Broadcast; phải đo xem presence_state có bị chặn cùng ngưỡng không]`
- V=5.000 → ~1,05 MB → chắc chắn vỡ

**Và `user_agent` không ai đọc** `[verified]`: `useLiveViewerList.ts:127-133` chỉ
đọc `user_id`, `joined_at`, `gated`. 100 byte/viewer đang được truyền đi cho 0
người tiêu thụ — chiếm ~45% payload. Xoá 1 dòng là **gấp đôi trần V**.

### 1.5 Độ trễ join/leave, hành vi reconnect / tab ẩn

`[verified: node_modules/@supabase/realtime-js@2.110.7/dist/main/RealtimeClient.js:12`
`HEARTBEAT_INTERVAL: 25000`, và `disconnectOnEmptyChannelsAfterMs = 2 × heartbeat]`

| Tình huống | Độ trễ |
|---|---|
| Join | ~tức thì (1 round-trip WebSocket) |
| Đóng tab / rời route **sạch** | Tức thì — `untrack()` + `removeChannel()` ở `release()` dòng 187-188 |
| Kill app / mất mạng | ~25-50s (1-2 nhịp heartbeat 25s trượt) `[unverified: timeout phía server Supabase, chưa đo]` |
| Tab ẩn (background) | Browser throttle timer nhưng **không đóng WebSocket** → viewer vẫn được đếm. Đây là **overcount có thật**: người mở tab rồi bỏ đó vẫn tính là đang xem. |
| iOS Safari khoá màn hình | Socket bị OS đóng → biến mất sau timeout. Vào lại → key mới → không double-count vì key cũ đã hết hạn (trừ khi vào lại trong <50s → **double-count tạm thời**) |
| Reconnect sau `CHANNEL_ERROR` | `entry.payload ??=` giữ nguyên `joined_at` (dòng 102) nhưng key `viewer_<suffix>` được sinh **mới** ở dòng 75 → trong cửa sổ timeout, 1 người = 2 key |

### 1.6 Chi phí DB duy nhất mà Cách A đang có (và nó là bug hiệu năng)

`src/hooks/useLiveViewerList.ts:119-140` `[verified]`: mỗi lần `presence:sync`
fire, hook admin chạy `enrichViewers()` = **1 SELECT `profiles` + 1 RPC
`admin_get_profile_emails`**, `IN` list tới V uuid, **không debounce, không cache**.

Ở V=500 với 1 join/leave mỗi giây, admin mở panel = ~120 query/phút, mỗi query
kèm IN-list 500 phần tử. Đây là chi phí DB thật của Cách A hôm nay — nhưng nó bị
chặn bởi điều kiện "admin đang mở panel", và vá bằng debounce 2s + cache profile
theo `user_id` là ~15 dòng.

### 1.7 Giới hạn Presence của Supabase

`[unverified — phải tra docs, em không có số chắc]`
- Không thấy hard cap tài liệu hoá về số key/channel; ràng buộc thực tế là kích
  thước `presence_state` (1.4) và `max_events_per_second` phía client.
- Repo **không** cấu hình `eventsPerSecond` hay `heartbeatIntervalMs`
  (`src/integrations/supabase/client.ts` không truyền option `realtime`) `[verified]`
  → đang chạy mặc định.

---

## 2. Cách B — mô hình 3 bước, cụ thể hoá thành thiết kế DB khả thi nhất

### 2.1 B1 — heartbeat UPSERT (bản khả thi nhất)

```sql
-- migration: <ts>_live_viewer_heartbeats.sql   [RED — migration]
create table public.live_viewer_heartbeats (
  livestream_id uuid not null references public.livestreams(id) on delete cascade,
  viewer_key    text not null,                       -- device id hoặc user id
  last_seen     timestamptz not null default now(),
  primary key (livestream_id, viewer_key)
);
create index on public.live_viewer_heartbeats (livestream_id, last_seen desc);
alter table public.live_viewer_heartbeats enable row level security;
-- RLS: KHÔNG cho anon ghi trực tiếp (xem 2.3) → ghi qua edge function service_role
```

- **Bước 1 "ô nóng"** = cửa sổ `last_seen > now() - interval '60 seconds'`.
- **Bước 2 "đếm người"** = `count(*)` trong cửa sổ đó, qua RPC SECURITY DEFINER
  (bảng không public-readable → lộ `viewer_key`).
- **Bước 3 "ai rời đi"** = hết heartbeat, row rơi khỏi cửa sổ; `pg_cron` mỗi phút
  `delete where last_seen < now() - interval '5 minutes'`. pg_cron granularity 1
  phút đã dùng ở repo (`20260802143000_ops_job_retry_control.sql:111` cron
  `* * * * *`) `[verified]`.

### 2.2 B2 — "ô nóng" theo phút đúng nghĩa đen

`primary key (livestream_id, bucket, viewer_key)` với `bucket = date_trunc('minute', now())`.
Không dùng UPDATE nên không sinh dead tuple từ UPSERT, nhưng **tích luỹ V row/phút**
→ 1 stream 2 tiếng với V=500 = 60.000 row. Phải partition theo ngày hoặc DELETE
theo lô. **Xấu hơn B1 ở mọi mặt trừ vacuum.** Không khuyến nghị.

### 2.3 B3 — tái dùng `batch-view-events` làm heartbeat carrier (hấp dẫn trên giấy, **vỡ**)

Ý tưởng: không bảng mới, không write mới — write đã xảy ra rồi. Đếm bằng:

```sql
select count(distinct coalesce(viewer_user_id::text, viewer_ip))
from view_events
where target_type = 'livestream' and target_id = $1
  and created_at > now() - interval '90 seconds';
```

**Bốn lý do nó không dùng được** `[verified qua code]`:

1. **`maxEventsPerSession = 20`** (`useIntervalViewCounter.ts:22,43,71`) — sau
   ~10 phút xem, client **ngừng gửi hẳn**. Livestream chính là ca người ta xem
   >10 phút. Người xem lâu sẽ **biến mất khỏi ô nóng**. Bỏ cap cho livestream thì
   `view_counts` bị thổi phồng ngay, vì cùng một INSERT kích trigger
   `increment_view_count()` (`20260113014818...sql:44-48`) → phải tách đường ghi
   → mất luôn phần "miễn phí".
2. **Trễ 30-90s** — tick 30s + flush 60s (`useIntervalViewCounter.ts:41-42`).
3. **`viewer_ip` gộp CGNAT** — dedup anon theo IP (`batch-view-events/index.ts:170`).
   Khán giả 95% Việt Nam, phần lớn 4G Viettel/VNPT sau CGNAT → **đếm thiếu nặng**.
4. **RLS SELECT `view_events` = creator-of-org hoặc admin**
   (`20251221153808...sql:412-416`) → đếm công khai phải thêm RPC SECURITY DEFINER.

### 2.4 Chi phí thật của B1 — con số

Heartbeat 25s (khớp nhịp heartbeat WebSocket hiện tại để so sánh công bằng), cửa
sổ tươi 60s, client poll count 15s/lần:

| V | UPSERT/phút | SELECT/phút | tổng stmt/s | row bảng nóng | dead tuple/phút |
|---:|---:|---:|---:|---:|---:|
| 50 | 120 | 200 | ~5,3 | 50 | 120 |
| 500 | 1.200 | 2.000 | ~53 | 500 | 1.200 |
| 5.000 | 12.000 | 20.000 | **~533** | 5.000 | 12.000 |

Đọc bảng này trên nền **compute Micro** (1 GB RAM, 2 vCPU chia sẻ):

- V=50, V=500: hoàn toàn ổn. 53 stmt/s là không đáng lo.
- V=5.000: 533 request/s qua PostgREST, mỗi cái kèm overhead HTTP + verify JWT.
  Đây là mức mà **connection handling bão hoà trước cả chi phí query**. Cộng thêm
  autovacuum chạy liên tục trên bảng 5.000 row bị update 12.000 lần/phút.
- **Ràng buộc ẩn quan trọng:** 12.000 UPSERT/phút = 12.000 record WAL/phút. Realtime
  decoder **đọc toàn bộ WAL rồi mới lọc**, kể cả bảng không nằm trong publication
  `supabase_realtime`. Nghĩa là heartbeat trong Postgres **làm chậm chính cái chat
  đang chạy postgres_changes** (`useChatMessages.ts:167-170`). Cách A không có
  ràng buộc này vì nó không sinh WAL. `[unverified: mức độ ảnh hưởng cụ thể, cần đo]`

**Nếu muốn push thay vì poll** (giảm read): bật `postgres_changes` trên bảng
aggregate → quay lại đúng Realtime mà Cách B định tránh, **cộng thêm** chi phí WAL.
Không có đường thoát.

### 2.5 Độ chính xác của B1

`viewer_key` lấy đâu ra?

| Nguồn | Vấn đề |
|---|---|
| `auth.uid()` | Xem live được phép anonymous/gated (`WatchLive.tsx:75` truyền `isGated`) → mất hết khách chưa đăng nhập |
| Random id trong sessionStorage | Giả mạo bằng vòng lặp `fetch` — rẻ hơn nhiều so với giả mạo Cách A (phải mở N WebSocket) |
| IP | CGNAT gộp — xem 2.3 |

Và **bước 3 chậm hơn Cách A ở đúng chỗ Cuong quan tâm**: heartbeat 25s + cửa sổ
60s ⇒ người đóng tab biến mất khỏi số đếm sau **60-85s**, so với **tức thì** ở
Cách A (đóng sạch) hoặc ≤50s (kill cứng).

---

## 3. Bảng so sánh theo đúng 4 tiêu chí Cuong đặt

| Tiêu chí | Cách A — Presence | Cách B1 — bảng ô nóng |
|---|---|---|
| **Đủ đúng** | Overcount tab ẩn; double-count tạm khi reconnect <50s | Overcount tab ẩn **y hệt**; thêm undercount CGNAT hoặc mất khách anon; dễ thổi phồng bằng fetch loop |
| **Đủ nhanh (join)** | Tức thì | 0-25s (chờ nhịp heartbeat kế) |
| **Đủ nhanh (rời đi)** | **Tức thì** khi đóng sạch; ≤50s khi kill cứng | **60-85s** luôn luôn |
| **Thuận tiện — code** | **Đã chạy.** 0 dòng mới | +1 migration (RED) + 1 RPC + 1 edge function ghi + 1 pg_cron + 1 hook client + RLS |
| **Thuận tiện — vận hành** | 0 job, 0 bảng, 0 vacuum, 0 cron để canh | +1 pg_cron phải vào roster `ops_cron_monitors` (SLO #5), +1 bảng phải canh bloat, +1 bề mặt ghi anon phải canh abuse |
| **Tài nguyên DB** | **0 write, 0 read, 0 WAL** cho đường đếm. Chi phí DB duy nhất là bug debounce ở panel admin (1.6) | 2,4V write/phút + 4V read/phút + WAL tương ứng + autovacuum |
| **Tài nguyên Realtime** | ~2V² message/stream; trần payload ~V=1.250 (≈2.500 nếu bỏ `user_agent`) | ~0 nếu poll; quay về Realtime nếu push |
| **Lịch sử / peak** | **Không có gì.** Hết stream là mất số | Có sẵn từ bảng |
| **Port native** | Cần supabase-swift Realtime + vòng đời socket + xử lý background | POST/GET qua URLSession — dễ hơn nhiều |

### Chi phí theo 3 kịch bản

| | V=50 | V=500 | V=5.000 |
|---|---|---|---|
| **A — DB** | 0 | 0 | 0 |
| **A — Realtime msg/stream** | ~5k | ~500k | ~50M (**~$112**) |
| **A — có chạy được không?** | Có | Có | **Không** — `presence_state` ~1 MB vỡ trần payload |
| **B1 — DB stmt/s** | ~5,3 | ~53 | ~533 (Micro căng) |
| **B1 — Realtime msg** | ~0 | ~0 | ~0 |
| **B1 — có chạy được không?** | Có | Có | Có, nếu nâng compute |

**Ngưỡng giao cắt: V ≈ 800-1.000.** Dưới ngưỡng đó Cách A rẻ hơn ở mọi trục.
Trên ngưỡng đó Cách A vỡ. Nền tảng hiện có ~2.000 user **đăng ký tổng cộng** —
V=5.000 đồng thời trên một stream là kịch bản giả định, không phải kịch bản gần.

---

## Option A — Giữ Presence, vá 3 chỗ (**bản rẻ nhất**)
**Effort:** 1 half-day · **Files:** `src/hooks/useLivePresence.ts`,
`src/hooks/useLiveViewerList.ts`, xoá `src/components/home/LiveBroadcastHero.tsx`
+ `src/components/content/LiveCardWithPresence.tsx` + dòng 3 của
`src/components/content/index.ts` · **Data:** không migration, không RLS, không RPC
· **Risk tier:** GREEN (chỉ `src/`) · **Bundle:** −(2 component chết), +0 KB

**How it works:**
1. Bỏ `user_agent` khỏi payload `track()` (`useLivePresence.ts:105`) — đã verify 0
   consumer. Payload 220B→120B/viewer ⇒ trần V tăng ~2×.
2. Debounce 2s + cache profile theo `user_id` trong `enrichViewers`
   (`useLiveViewerList.ts:119-140`) — xoá chi phí DB duy nhất của Cách A.
3. Xoá 2 component chết. Nếu Cuong muốn số viewer quay lại trang chủ thì đó là
   quyết định riêng, và phải biết trước: mount nó = **mọi khách trang chủ giữ 1
   WebSocket**, đúng cái chi phí hiện đang bằng 0.

**Wins:** Rẻ nhất có thể, revert được bằng `git revert`, giải quyết đúng ràng buộc
sát nhất (trần payload) mà không đụng DB.
**Loses:** Vẫn không có lịch sử. Vẫn khó port native. Vẫn vỡ ở V≈2.500.
**Forecloses:** Không đóng cửa nào — mọi option sau đều xây trên nền này.

## Option B — Presence + snapshot 1 dòng/phút (lai, **khuyến nghị**)
**Effort:** 2 half-days (gồm cả Option A) · **Files:** Option A +
`supabase/migrations/<ts>_live_viewer_snapshots.sql`, `src/hooks/useLivePresence.ts`
(+~25 dòng), `src/hooks/useLiveViewerPeak.ts` (mới, ~30 dòng) ·
**Data:** 1 migration (bảng + RLS public-select + unique index) · **Risk tier:**
**RED** (có migration — `risk-tier.mjs` xếp mọi file `supabase/migrations/` là RED,
cần Cuong duyệt) · **Bundle:** <1 KB gz, nằm trong route chunk `WatchLive` (đã lazy),
0 dependency mới

**How it works:**
```sql
create table public.live_viewer_snapshots (
  livestream_id uuid not null references public.livestreams(id) on delete cascade,
  minute        timestamptz not null,     -- date_trunc('minute', ...)
  count         int not null,
  primary key (livestream_id, minute)     -- unique = chống ghi trùng
);
-- RLS: select public (chỉ là con số tổng, không PII); insert qua RPC SECURITY
-- DEFINER có kiểm livestream đang 'live'
```
Client nào có presence key **nhỏ nhất theo thứ tự từ điển** thì làm leader và gọi
RPC mỗi 60s với `count` nó đang thấy. `ON CONFLICT DO NOTHING` biến việc bầu leader
nhấp nháy thành no-op — đó là cách sửa nhàm chán và đúng, không cần lock.

- **Chi phí: 1 INSERT/phút/livestream, độc lập hoàn toàn với V.** V=5.000 vẫn là
  1 write/phút. Không cron dọn (60 row/giờ/stream, giữ vĩnh viễn cũng được).
- Đổi lại: peak/trung bình viewer sau stream, và **một bề mặt đọc rẻ cho native**
  (`select count ... order by minute desc limit 1`).
- Text mới (nhãn "Cao nhất" / "Peak") VI+EN ngay từ đầu, cạnh `t.live.watching`
  đang dùng ở `WatchLive.tsx:410`.
- **SSR:** không có route công khai mới. Không đụng `functions/_lib/render/`,
  không đụng sitemap, không có cặp hreflang nào phát sinh.

**Wins:** Mua được **cả hai** thứ Cách B thắng (lịch sử + đường native rẻ) với
1/1000 chi phí DB. Không đụng đường đếm realtime nên không có rủi ro hồi quy với
số đang hiển thị.
**Loses:** Vẫn kế thừa trần V≈2.500 của Presence. Bầu leader là logic mới cần 1
test (assert: 2 client, chỉ 1 row/phút).
**Forecloses:** Gần như không — nếu sau này phải chuyển hẳn sang Cách B, bảng
snapshot vẫn dùng lại nguyên vẹn làm bảng lịch sử.

## Option C — Thay hẳn bằng bảng ô nóng (Cách B thuần của Cuong)
**Effort:** 5-6 half-days · **Files:** `supabase/migrations/<ts>_live_viewer_heartbeats.sql`,
`supabase/functions/live-heartbeat/index.ts` (mới), `supabase/config.toml`
(đăng ký function — **RED**), `src/hooks/useLivePresence.ts` (viết lại hoặc thay),
`src/pages/WatchLive.tsx`, `src/hooks/useLiveViewerList.ts` (viết lại — panel admin
mất nguồn dữ liệu), `docs/cron-schedules.md`, roster `ops_cron_monitors` ·
**Data:** 1 migration + 1 RPC SECURITY DEFINER + RLS + 1 pg_cron · **Risk tier:**
**RED** (migration + `config.toml`)

**How it works:** đúng thiết kế 2.1 ở trên.

**Wins:** Không trần V. Không hoá đơn Realtime message. Port native dễ nhất.
**Loses:** Bước "ai rời đi" chậm đi 60-85s — tệ hơn ở đúng tiêu chí Cuong nêu.
Thêm 2,4V write/phút lên Micro. Thêm 1 cron vào SLO #5. Thêm một bề mặt ghi anon
phải chống abuse. Và **`useLiveViewerList` + `/admin/livestream-viewers` phải viết
lại** — hiện nó lấy `user_id`/`joined_at` từ chính presence state; bảng heartbeat
muốn thay thế thì phải lưu `user_id` → bảng có PII → RLS chặt hơn → không public
count được nữa mà phải qua RPC.
**Forecloses:** Bỏ Presence là bỏ luôn khả năng "ai đang xem, vào lúc nào" gần
thời gian thực mà admin đang có miễn phí. Lấy lại thì phải trả bằng DB.

---

## Khuyến nghị

**Option B.** Một câu: Presence đang cho đúng 3 bước của Cuong với **0 write DB và
0 connection tăng thêm** (vì consumer sống duy nhất là `WatchLive`, trang vốn đã
mở socket cho chat), nên đổi sang bảng ô nóng là trả 2,4V write/phút để mua một
đáp án **chậm hơn 60-85s ở bước "ai rời đi"** — còn hai thứ Cách B thắng thật
(lịch sử + đường native) mua được bằng **1 INSERT/phút/livestream**.

- **Option A thua** vì nó đúng nhưng chưa đủ: nó không trả lời được "stream Hong
  Kong Slam đỉnh bao nhiêu người xem" — câu hỏi sẽ được hỏi ngay sau giải đầu tiên —
  và không mở đường nào cho native. Tuy vậy A **nằm gọn trong B**, cứ ship A trước.
- **Option C thua** vì nó tối ưu cho V=5.000, mức mà nền tảng ~2.000 user đăng ký
  chưa nhìn thấy, và trả giá bằng 6 half-day cộng một cron, một bảng, một bề mặt
  ghi anon phải canh vĩnh viễn — trên một hệ đã có `docs/slo.md` ghi rõ "reliability
  outranks scope". Nếu đo được V thật vượt 800 thì C mới đáng bàn lại.

### Câu trả lời trực tiếp cho câu hỏi của Cuong

> *Cách nào thuận tiện hơn và ít tốn tài nguyên database hơn?*

**Cách A, ở cả hai vế, và không sát nút.** Về database: Cách A tốn **đúng 0** —
không write, không read, không WAL, không vacuum, không cron. Về thuận tiện: Cách A
**đã chạy trên prod**, còn Cách B cần migration + RPC + edge function + cron + RLS
+ hook mới. Cách B chỉ thắng khi V vượt ~800-1.000 đồng thời trên một stream — ngưỡng
mà `presence_state` bắt đầu chạm trần payload Realtime.

---

## Increments

1. **Bỏ `user_agent` khỏi presence payload** (`useLivePresence.ts:105`, 1 dòng) —
   verify bằng: chạy `npm run test -- useLivePresence` (2 test hiện có vẫn xanh) +
   mở `/admin/livestream-viewers` với 1 stream live, danh sách viewer vẫn hiện
   đủ tên/thời điểm vào. **Đây là điểm dừng-và-nhìn tự nhiên thứ nhất** — nếu chỉ
   làm được một việc trong cả đề xuất này, làm việc này.
2. **Debounce + cache `enrichViewers`** (`useLiveViewerList.ts:119-140`) — verify:
   mở panel admin, Network tab, số request `profiles`/`admin_get_profile_emails`
   phải ≤1 mỗi 2s dù presence sync dồn dập.
3. **Xoá `LiveBroadcastHero.tsx` + `LiveCardWithPresence.tsx` + export dòng 3 của
   `components/content/index.ts`** — verify: `npm run build` + `npm run lint` xanh,
   `check-bundle-size.mjs` không đỏ. (Hoặc: nếu Cuong muốn số viewer ở trang chủ,
   dừng ở đây và quyết định — đó là đánh đổi "mọi khách trang chủ giữ 1 WebSocket".)
4. — **STOP & LOOK** — Chạy 1 stream thật, ghi lại V đỉnh quan sát được. Nếu V đỉnh
   <200 thì bước 5-6 có thể hoãn vô thời hạn; nếu >800 thì mở lại Option C.
5. **Migration `live_viewer_snapshots` + RPC insert** (RED — cần Cuong duyệt) —
   verify: chạy RPC 2 lần cùng phút, chỉ 1 row tồn tại (`ON CONFLICT DO NOTHING`).
6. **Leader election + ghi snapshot trong `useLivePresence`** — verify bằng 1 test:
   2 entry presence giả, chỉ entry key nhỏ nhất gọi RPC.
7. **Hiển thị "Đỉnh / Peak" trên trang replay** (VI+EN cùng lúc) + **native đọc 1
   row snapshot** — có thể hoãn hẳn; đây là phần "làm 30% rồi xem có ai dùng không".

---

## 5. Native (`apple/`) — cách nào dễ port hơn

`[verified: grep "presence" toàn `apple/` = 0 hit; `LiveView.swift:76` chỉ có
comment "no fabricated viewers/scores"]` → native **hiện không hiển thị viewer
count nào cả**.

| | Port Cách A (Presence) | Port Cách B (heartbeat) | Port Option B (đọc snapshot) |
|---|---|---|---|
| Việc phải làm | `LivePresenceRepository.swift` dùng supabase-swift RealtimeV2 `PresenceAction` + `track()`; xử lý background/foreground, khoá màn hình, đổi mạng | 1 POST/25s + 1 GET/15s bằng `URLSession` | **1 GET/30s đọc 1 row** |
| Effort | 2-3 half-days | 1-1,5 half-days | **0,5 half-day** |
| Rủi ro | API Presence của supabase-swift đổi nhiều giữa các version; vòng đời socket khi app vào background là chỗ dễ sai nhất | Thấp | Thấp nhất |
| Rủi ro RED | `apple/` = RED (qua App Store review, không revert được) | RED | RED |

**Kết luận ngắn:** Cách B dễ port hơn Cách A rõ rệt — nhưng **Option B dễ hơn cả
hai**, vì native chỉ cần đọc, không cần tham gia vào việc đếm. Đó là lý do thứ hai
để chọn Option B: nó biến "port viewer count sang native" từ 2-3 half-day thành
0,5 half-day mà không cần native phải hiểu Realtime.

Lưu ý: native đọc snapshot sẽ trễ tới 60s so với web. Với một con số "đang xem",
trễ 60s là chấp nhận được — nhưng phải là quyết định có ý thức, không phải phát
hiện sau khi ship.

---

## Điều em không chắc

1. **Bảng giá và cách đếm message Realtime của Supabase.** Em dùng số theo trí nhớ
   (Pro ~500 peak conn, ~5M message/tháng, $2.50/triệu vượt). Toàn bộ cột "Tài
   nguyên Realtime" phụ thuộc vào nó. **Phải mở dashboard Billing → Usage xác nhận
   trước khi dùng con số này để quyết.**
2. **Trần payload 250 KB có áp cho `presence_state` không.** Em chắc chắn
   `presence_state` là O(V) byte `[verified từ payload trong code]`, nhưng ngưỡng
   vỡ chính xác thì không. Cách đo đúng: script mở N socket vào cùng topic, tăng N
   tới khi client thứ N+1 không nhận được state. Đây là con số quyết định "Cách A
   vỡ ở V bao nhiêu" — mọi kết luận về ngưỡng giao cắt V≈800-1.000 đều treo vào nó.
3. **Timeout phía server khi socket chết đột ngột.** Em verify được client heartbeat
   = 25.000 ms `[realtime-js 2.110.7]` nhưng ngưỡng server bỏ presence key thì suy
   ra (2 nhịp trượt), chưa đo.
4. **V thật của prod.** Em không truy cập được prod trong phiên này (`~/Downloads`
   bị chặn, không có PAT). Toàn bộ khuyến nghị dựa trên giả định "V đỉnh hiện tại
   là hàng chục, không phải hàng nghìn", suy ra từ ~2.000 user đăng ký. **Nếu giả
   định này sai, khuyến nghị đổi.** Đây là lý do increment 4 là điểm STOP & LOOK.
5. **`useChatMessages.ts:128` đặt `uniqueChannelSuffix()` vào chính topic chat** —
   tức là mỗi client một topic riêng, đúng cái pattern đã gây sự cố 2026-07-08 cho
   presence. Broadcast liên client trên topic riêng thì không tới được ai; nhìn code
   thì chat đang phụ thuộc `postgres_changes` để giao tin. Em **không** khẳng định
   đây là bug — có thể có đường server-side em chưa đọc. Nhưng nó nằm ngay cạnh chủ
   đề (cùng trang, cùng socket, cùng chi phí Realtime) nên đáng soi trong một /idea
   riêng.
6. **Ảnh hưởng thật của WAL heartbeat lên Realtime decoder.** Em nêu nó như một
   ràng buộc kiến trúc của Option C (12k WAL record/phút mà decoder vẫn phải đọc rồi
   vứt). Hướng đúng về mặt cơ chế, nhưng mức độ chậm cụ thể thì em chưa đo và không
   nên dùng làm luận điểm quyết định một mình.
7. **Recon nói `useLivePresence` có 3 consumer; em verify ra 1.** Em tin kết quả
   grep của mình (đã loại `graphify-out/`, đã truy ngược barrel
   `components/content/index.ts` qua cả 6 file import). Nhưng nếu 2 component kia
   được mount qua một đường động em chưa thấy, thì luận điểm "0 connection tăng
   thêm" ở mục 1.2 yếu đi đáng kể — dù kết luận cuối vẫn giữ, vì chi phí DB của
   Cách A vẫn là 0 bất kể mount ở đâu.
