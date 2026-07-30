# Runbook: Prerender canonical poisoning — legacy `prerender-worker`

**Ngày phát hiện:** 2026-07-30 (seo-guardian)
**Mức độ:** cao (rủi ro rớt index) nhưng **gián đoạn, hiếm, tự hồi phục**
**Trạng thái repo:** Pages middleware SẠCH — fix KHÔNG nằm trong repo này.

---

## 1. Triệu chứng đã quan sát

Trong ~vài giây, 4 route khác nhau cùng trả về NGUYÊN 1 trang venue:

| Route yêu cầu | Nội dung trả về (sai) |
| --- | --- |
| `/` | venue "The Cage Dempsey – Singapore" |
| `/blog/singapore-open-2026-recap` | venue "The Cage Dempsey – Singapore" |
| `/tournament/amway-mlp-orlando` | venue "The Cage Dempsey – Singapore" |
| `/news` | venue "The Cage Dempsey – Singapore" |

Cả `<title>`, `canonical`, `og:url`, và `hreflang` en/vi/x-default đều trỏ
`/vi/san/the-cage-dempsey-singapore`. → **canonical poisoning**: nếu Googlebot
crawl trúng cửa sổ này, mọi URL bị khai báo trùng canonical về 1 trang venue →
gộp/rớt index hàng loạt.

Tự hồi phục. KHÔNG tái hiện qua 250+ request kế tiếp (kể cả ép cache MISS đồng
thời 12 path venue lạnh → 0/12; burst 200 request → 200/200 đúng).

---

## 2. Bằng chứng: thủ phạm là legacy `prerender-worker`, KHÔNG phải Pages middleware

**Loại trừ Pages middleware (`functions/_middleware.ts` + `_lib/render/`):**
- cacheKey per-path `pr:v28:${url.pathname}` (dòng 453) — không collide theo key.
- Routing `/` → `renderHome` chuẩn (dòng 549); `routeAndRender(pathname,…)` stateless.
- Supabase client tạo mới mỗi request (dòng 528), không phải singleton module-scope.
- `_lib/` không có biến `let/var` top-level hay `Map/Set` cache module-scope → không có state rò rỉ giữa request trong 1 isolate.

**Dấu vân tay HTTP (bằng chứng quyết định):** cả 2 nhánh Pages (cache HIT dòng
456-468 và MISS dòng 488-514) đều gọi `applySecurityHeaders` và set
`X-Prerender-Cache`. Vân tay Pages khỏe:

```
x-prerender-cache: HIT | MISS
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
```

Response lúc bị poisoning **thiếu sạch** cả 3 header trên — chỉ có:

```
content-type: text/html; charset=utf-8
cf-cache-status: DYNAMIC        <-- loại trừ CF edge cache
cache-control: no-store
vary: User-Agent, accept-encoding
```

`cf-cache-status: DYNAMIC` ⇒ không phải edge cache. Thiếu vân tay Pages ⇒ **một
worker khác phục vụ** = legacy `prerender-worker` (đang giữ 1 entry venue trong
KV riêng và trả nó cho nhiều path trong cửa sổ ngắn).

**Bối cảnh:** audit note I-18 (growth-tasks/seo-audit-2026-05-14.md) đã ghi legacy
worker "chưa verify còn active hay đã idle" + cân nhắc retire. Nay có bằng chứng
nó **vẫn active** và **là nguồn poisoning**. Vì Pages middleware giờ lo toàn bộ
prerender (mọi response khỏe đều mang vân tay Pages), legacy worker vừa **dư
thừa** vừa **gây hại**.

---

## 3. Xác nhận dứt điểm (cần Cloudflare access của Cuong)

```sh
# 3.1 — Worker còn deploy & có route trỏ thepicklehub.net không?
npx wrangler deployments list --name prerender-worker
# Dashboard: Workers & Pages > prerender-worker > Settings > Triggers > Routes
#   Tìm route kiểu *thepicklehub.net/*  (đặc biệt route ăn bot UA)

# 3.2 — Xem log realtime, lọc lúc trả sai path
npx wrangler tail prerender-worker --format pretty
#   Trong lúc tail, chạy: python3 canonical_monitor.py --rounds 30
#   Nếu bắt được poisoning → xem worker log dòng tương ứng: nó đọc KV key nào,
#   trả path nào. Đây là bằng chứng cuối cùng.

# 3.3 — Soi KV của legacy worker (nếu có binding riêng)
npx wrangler kv:namespace list
npx wrangler kv:key list --namespace-id <ID_CUA_LEGACY_WORKER> | head
#   Tìm entry chứa "the-cage-dempsey" gắn với key KHÔNG phải venue đó
#   (vd key "/", "/news" mà value là HTML venue) = KV bị nhiễm.
```

Nếu legacy worker KHÔNG còn route nào ăn traffic thepicklehub.net → nó đã idle,
poisoning phải đến từ chỗ khác (báo lại seo-guardian để mở lại điều tra).

---

## 4. Quyết định: RETIRE (khuyến nghị) hay FIX

**Khuyến nghị RETIRE** — Pages middleware đã thay thế hoàn toàn. Bỏ legacy worker
xóa luôn vector poisoning + hết cảnh "patch 2 chỗ".

```sh
# 4.1 — Chụp lại cấu hình để rollback được
npx wrangler deployments list --name prerender-worker > /tmp/prerender-worker-backup.txt
#   Ghi lại routes (dashboard) + KV namespace id + biến env trước khi xóa.

# 4.2 — Gỡ ROUTE trước (không xóa worker vội) — traffic lập tức về Pages
#   Dashboard > prerender-worker > Settings > Triggers > xóa route thepicklehub.net
#   (Giữ worker + KV nguyên trong ~14 ngày để rollback nếu cần.)

# 4.3 — Theo dõi 24-48h
python3 canonical_monitor.py --rounds 50 --alert
#   + kiểm GSC Coverage/Pages 3-7 ngày: không có tụt index bất thường.

# 4.4 — Sau 14 ngày sạch → xóa hẳn worker + KV namespace của nó.
```

**Rollback:** thêm lại route trỏ về `prerender-worker` (worker + KV vẫn còn trong
14 ngày). TTL KV cũ sẽ tự hết; nếu KV nhiễm, `wrangler kv:key delete` entry xấu.

**Nếu BẮT BUỘC giữ legacy worker:** purge KV của nó (`kv:key delete` các entry
value≠key) + thêm chính guard mục 5 vào code worker (nếu còn source ở máy Cuong).

---

## 5. Phòng thủ nhiều lớp phía Pages (bổ sung, không thay cho mục 4)

Áp trên `origin/main` hiện tại (đã có #452), KHÔNG áp trên branch cũ:

**5a. Integrity guard — không PUT KV nếu canonical không khớp path.** Trong
`functions/_middleware.ts` nhánh MISS, TRƯỚC `PRERENDER_CACHE.put(...)`, kiểm
canonical trong `html` có nhất quán với `url.pathname` không (tôn trọng ngoại lệ
`/vi/tournament`, `/vi/org`, `/vi/tran-dau`, `/vi/live` → EN canonical theo thiết
kế). Lệch → bỏ cache + record `client_errors` (tái dùng đường alert của #452,
prefix `prerender-canon:`). Chặn KV Pages tự nhiễm (nghi phạm #2).

**5b. Synthetic monitor** — `scripts/seo/canonical_monitor.py` (kèm file này).
Curl N route self-canonical bằng Googlebot UA + kiểm collision; exit≠0 + Telegram
khi phát hiện. Đã test trên prod: `OK — 10 routes self-canonical, no collisions`.
Wiring gợi ý: cron 15' (CF Worker cron hoặc Cowork scheduled task) chạy
`--rounds 3 --alert`. Bắt tái phát ở BẤT KỲ layer nào (kể cả legacy worker).

---

## 6. Ghi chú áp dụng

- Repo hiện checkout branch `strictnull-postmerge`, **sau `origin/main` 5 commit**
  và có WIP chưa commit (bài `vietnam-hosts-ppa-tour-asia-2026` dở). Mọi thay đổi
  mục 5 phải base trên `origin/main` mới nhất (đã có #452 sửa cùng `_middleware.ts`)
  để tránh conflict.
- seo-guardian là read-only agent — runbook này để Cuong / pipeline bug-fixer thực
  thi qua Cloudflare + PR chờ duyệt.
