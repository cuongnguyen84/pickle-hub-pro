# CP4 — Gói triển khai worker dọn ảnh và cron

> **Không lệnh nào trong tài liệu này được chạy.** Chúng nằm ở đây để được đọc,
> phản đối, rồi mới duyệt — bản thi hành ở
> [`approval-packets/packet-c-worker-cron.md`](./approval-packets/packet-c-worker-cron.md).
>
> Vận hành hằng ngày **sau khi** deploy đã có runbook riêng:
> [`docs/ops/shop-media-lifecycle-runbook.md`](../../ops/shop-media-lifecycle-runbook.md).
> Tài liệu này chỉ nói về việc đưa nó lên và biết là nó sống.

---

## 1. Vì sao đây là blocker nặng nhất

Cho tới khi worker chạy, `unpublish` / `reject` / `suspend` chỉ xoá **con trỏ**
trong cơ sở dữ liệu. Byte vẫn tải được với bất kỳ ai đang giữ URL.

P2b làm điều này tệ hơn **về bản chất**, không phải về code: trước P2b không ai
nhìn thấy sản phẩm, nên "gỡ hàng" là chuyện nội bộ. Từ P2b, gỡ hàng là **một lời
hứa hiển thị cho người mua**. Một sàn nói "sản phẩm này đã gỡ" trong khi ảnh vẫn
tải được là một sàn nói dối, dù bảng dữ liệu hoàn toàn đúng.

---

## 2. Nhận dạng

| Thứ | Giá trị |
|---|---|
| Tên function | `shop-media-lifecycle` |
| Source | `supabase/functions/shop-media-lifecycle/index.ts` (219 dòng) + `webp.ts` (68 dòng) |
| Entry | `Deno.serve` — POST duy nhất, phân nhánh theo `body.action` |
| `verify_jwt` | **`false`** — `supabase/config.toml:425-426` (đúng cách giải ES256/HS256) |
| Ba hành động | `publish` · `cleanup` · `reconcile` |
| Trạng thái remote hôm nay | **CHƯA DEPLOY** — 80 function ACTIVE, không có nó |

### Xác thực từng hành động

| Action | Ai gọi | Xác thực |
|---|---|---|
| `publish` | trình duyệt người bán | JWT **của chính người gọi** được chuyển tiếp tới `product_publish_prepare`; Postgres từ chối nếu không phải thành viên pilot **và** manager của shop sở hữu sản phẩm **và** sản phẩm chưa được duyệt |
| `cleanup` | pg_cron | `requireCronRequest(req, CRON_SECRET)` — header `x-cron-secret` |
| `reconcile` | pg_cron | như trên |

Uỷ quyền cho `publish` nằm ở Postgres, không ở function. Function không tự quyết
định ai được publish cái gì — nó chỉ chuyển tiếp JWT và làm theo kế hoạch trả về.

---

## 3. Secret cần có

| Tên | Đã có trên remote? | Việc phải làm |
|---|---|---|
| `CRON_SECRET` | ✅ **có** | **không làm gì** |
| `SUPABASE_URL` | ✅ | không |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | không |
| `SUPABASE_ANON_KEY` | ✅ | không |

> ⚠️ **Đính chính `deployment-readiness.md` A2.** Mục đó yêu cầu "đặt secret
> `CRON_SECRET` cho function". Secret của Supabase Edge Functions là **cấp
> project**, không phải cấp function. `CRON_SECRET` đã tồn tại và 5 caller cron
> khác đang dùng nó. Chạy `supabase secrets set CRON_SECRET=…` trong lúc deploy
> Shop có nguy cơ **rotate nhầm** một secret đang phục vụ 5 job khác — và theo
> `ops-runbook.md` §2.1, rotate đòi cập nhật vault trong cùng một nhịp, nếu
> không mọi cron sẽ 401.
>
> **Packet C do đó KHÔNG chứa bước `secrets set`.**

`vault.decrypted_secrets` tên `cron_secret` cũng đã tồn tại (đếm = 1). Không đọc
giá trị; bằng chứng gián tiếp rằng vault và edge secret đang khớp là 17 cron job
hiện tại chạy sạch và `ops_cron_alert_state` không báo `caller_auth_failed`.

---

## 4. Lịch cron

Do migration `20260811150000_shop_media_cleanup_cron.sql` tạo, **không** phải
lệnh riêng.

| jobname | schedule | action | timeout |
|---|---|---|---|
| `shop-media-cleanup-every-5m` | `*/5 * * * *` | `{"action":"cleanup"}` | 60 000 ms |
| `shop-media-reconcile-hourly` | `17 * * * *` | `{"action":"reconcile"}` | 120 000 ms |

Thân job đọc `vault.decrypted_secrets` **tại thời điểm chạy** và
`RAISE EXCEPTION 'cron_secret is not configured'` nếu rỗng.

> ⚠️ **Đính chính `deployment-readiness.md` A1.** Mục đó nói migration sẽ
> `RAISE EXCEPTION` nếu vault trống, và vì thế phải nạp secret **trước** khi áp.
> Exception nằm **trong thân job** (`$command$…$job$`), không nằm trong migration.
> Áp migration khi vault rỗng vẫn thành công; job mới đỏ ở lần chạy đầu. Vault
> đã có secret nên điểm này moot — nhưng ràng buộc thứ tự nó tạo ra là ảo, và
> một ràng buộc ảo trong runbook triển khai là thứ khiến người ta đảo thứ tự
> thật khi vội.

**Ràng buộc thứ tự THẬT:** cron gọi một URL. Nếu job tồn tại trước khi function
được deploy, mỗi 5 phút sẽ ghi một 404 vào `net._http_response`. Không nguy hiểm,
nhưng nó là nhiễu và nó làm mờ tín hiệu sức khoẻ đầu tiên. Vì migration tạo job,
điều này nghĩa là: **deploy function TRƯỚC khi áp migration #4**, hoặc chấp nhận
một cửa sổ 404 ngắn. Packet C chọn cách thứ nhất.

Khe `*/5` sẽ có hai job (`ops-edge-health-every-5m` và job mới). pg_cron chạy
song song bình thường; ghi ra đây để không ai coi là bất thường.

---

## 5. Mục tiêu vận hành, retry, và những gì chúng KHÔNG hứa

| Thứ | Giá trị | Loại |
|---|---|---|
| Chu kỳ dọn | 5 phút | **cấu hình**, đổi ở migration |
| Mục tiêu p95 xoá | ~10 phút sau thu hồi | **mục tiêu vận hành**, không phải SLA sản phẩm |
| Thang retry | 1m → 5m → 25m → 2h → 10h → trần 24h | 8 lần, rồi `failed` |
| Lô mỗi lần | 25 job | `CLEANUP_BATCH` |
| Ngưỡng "kẹt" | `in_progress` > 15 phút → reconcile trả về `pending` | |
| Ân hạn mồ côi | public > 1 giờ, private > 24 giờ | để bản copy đang bay không bị quét |

**Xoá cơ sở dữ liệu là tức thì. Xoá byte là bất đồng bộ.** Nếu ai đó cần "biến
mất trong N giây", đó là một quyết định khác và một thiết kế khác (signed URL
TTL ngắn trên bề mặt công khai — đúng thứ D1 cố ý từ chối vì nó phá cache và SEO).

---

## 6. Bảo mật — kiểm từng dòng

| Yêu cầu | Trạng thái | Bằng chứng |
|---|---|---|
| Worker giữ service role, và **chỉ** worker | ✅ | `admin()` dùng `SUPABASE_SERVICE_ROLE_KEY`; không client nào có key này |
| Cron dùng helper sẵn có | ✅ | `_shared/cron-auth.ts` → `requireCronRequest` |
| Secret không vào repo/log/client | ✅ | không có literal secret; `safeError()` bóc query string |
| So sánh constant-time | ⚠️ **KHÔNG** — `presentedSecret !== expectedSecret` | Xem §6.1 |
| JWT người dùng / anon không claim được job | ✅ | `cleanup`/`reconcile` chặn trước khi chạm DB; `shop_media_cleanup_claim` chỉ grant cho `service_role` |
| Object đã mất tính là thành công idempotent | ✅ | Storage trả success cho key vắng mặt; chỉ lỗi transport mới giữ job mở |
| Job thất bại **không** thành `done` | ✅ | `shop_media_cleanup_complete(_ok := false)` ở nhánh catch |
| Job kẹt được reconcile | ✅ | `shop_media_reconcile` |
| Thu hồi rendition công khai quan sát được | ✅ | `shop_media_cleanup_health` view + GET ẩn danh trả 404 |

### 6.1 So sánh secret không phải constant-time — đánh giá

`requireCronRequest` dùng `!==` thường. Đây là **quy ước hiện hành của repo**,
dùng chung cho cả 5 caller cron đang chạy production, không phải thứ Shop tự
chọn.

Đánh giá: rủi ro timing-attack ở đây gần bằng không — kẻ tấn công phải đo được
chênh lệch vài nanosecond qua Internet, qua gateway Supabase, trên một endpoint
không nói cho họ biết họ đã đúng bao nhiêu ký tự. Nhưng nó **là** một sai lệch
so với thực hành tốt.

**Khuyến nghị: không sửa trong đợt này.** Sửa `_shared/cron-auth.ts` là chạm vào
đường xác thực của 5 function đang chạy production để phục vụ một pilot 3–5
người bán — đó là đổi rủi ro lớn lấy rủi ro nhỏ. Nếu Product Owner muốn sửa, nó
là một PR riêng, có test riêng, và deploy lại cả 6 function (`_shared/**` thay
đổi ⇒ fleet redeploy).

---

## 7. Bằng chứng cục bộ — 10 bước, chạy lại trên nền tảng closed-pilot

Kết quả và cách chạy: xem [`acceptance.md` §2](./acceptance.md#2-bằng-chứng-cục-bộ-đã-chạy-lại-trên-nền-tảng-closed-pilot).

| # | Bước | Chứng minh bởi |
|---|---|---|
| 1 | publish một rendition | `shop-media-integration.test.mjs` |
| 2 | unpublish | `shop-p2b-media-lifecycle.test.mjs` |
| 3 | projection mất **ngay** | cùng file — `public_products` trả rỗng trong cùng transaction |
| 4 | job dọn xuất hiện | `shop_media_cleanup_jobs` có dòng `pending` |
| 5 | worker drain | gọi thật `?action=cleanup` qua edge runtime cục bộ |
| 6 | object bị xoá | GET ẩn danh → **404** |
| 7 | replay | chạy lại cùng job → thành công, không lỗi |
| 8 | republish **trước** khi worker chạy | `product_publish_commit` xoá job pending cho key nó lấy lại |
| 9 | worker **không** xoá object đang sống | test thứ 5 — đỏ ngay khi bỏ dòng DELETE đó |
| 10 | hàng đợi về sạch | `shop_media_cleanup_health` — `pending`/`due_now`/`stuck`/`failed` = 0 |

Bước 8–9 là cặp quan trọng nhất và là lý do file test đó tồn tại: từng bước
riêng lẻ đều đúng, **vòng lặp** mới là chỗ có lỗi.

Ngoài ra, `shop-p2b-exif-pipeline-qa.mjs` đi theo byte thật qua đúng function
này tới một GET ẩn danh, chứng minh EXIF/GPS/XMP không sống sót — đỏ khi gỡ
inspector.

**Không deploy remote nào trong bước này.**

---

## 8. Log mong đợi

Mọi dòng log là JSON một dòng, có `function: "shop-media-lifecycle"`.

| `event` | Khi nào | Bình thường? |
|---|---|---|
| `published` | publish xong | ✅ |
| `object_deleted` | mỗi object bị xoá | ✅ |
| `reconciled` | mỗi giờ | ✅ |
| `prepare_refused` | Postgres từ chối publish | ✅ (uỷ quyền đang hoạt động) |
| `copy_source_missing` | rendition nguồn biến mất giữa chừng | ⚠️ hiếm |
| `rendition_rejected` | byte không phải WebP hợp lệ, hoặc còn metadata | ⚠️ — kiểm pipeline trình duyệt |
| `copy_failed` | Storage lỗi khi upload | 🔴 |
| `commit_failed` | copy xong nhưng pointer không chuyển | 🔴 — sinh orphan, reconcile quét |
| `claim_failed` | RPC claim lỗi | 🔴 |
| `delete_failed` | Storage từ chối xoá | 🔴 |

**Không dòng nào chứa URL.** `safeError()` bóc mọi thứ sau `?`. Nếu bạn thấy
`token=` trong `last_error`, đó là bug — báo, đừng dán vào Telegram.

---

## 9. Điều kiện cảnh báo

Chi tiết truy vấn và chủ sở hữu: [`operations.md` §3](./operations.md).

| Điều kiện | Mức | Ý nghĩa |
|---|---|---|
| `pending` job > 30 phút | 🔴 P1 | worker không chạy — ảnh đã gỡ vẫn tải được |
| `due_now` > 0 liên tục 2 chu kỳ | 🔴 P1 | cron không nổ |
| `failed` > 0 | 🔴 P1 | Storage từ chối 8 lần |
| `stuck` > 0 sau một lần reconcile | 🟠 P2 | worker chết giữa job và reconcile không cứu được |
| `orphans_queued` lớn và lặp lại | 🟠 P2 | publish đang hỏng giữa copy và commit |
| `cron.job_run_details` không có lần chạy thành công trong 15 phút | 🔴 P1 | |

---

## 10. Drain tay, tạm dừng, rollback, rotate

### Drain tay
```sh
curl -sS -X POST "https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/shop-media-lifecycle" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"action":"cleanup"}'
```

### Tạm dừng cron
```sql
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'shop-media-cleanup-every-5m'),
  active := false);
```

> ⚠️ **Tạm dừng worker gần như luôn là quyết định SAI.** Job tích luỹ ở `pending`
> và backoff — đó là hành vi đã thiết kế cho sự cố Storage. Dừng worker nghĩa là
> ảnh đã gỡ **ở lại vĩnh viễn**. Chỉ dừng khi worker đang xoá **nhầm** thứ gì đó,
> và khi đó việc kế tiếp là điều tra, không phải chờ.

### Rollback function
```sh
npx supabase functions delete shop-media-lifecycle --project-ref ajvlcamxemgbxduhiqrl
```
Hàng đợi `shop_media_cleanup_jobs` chỉ nằm im. **Không mất dữ liệu.** Nhớ
`cron.unschedule` cả hai job **trước**, nếu không cron ghi 404 mỗi 5 phút.

### Rotate `cron_secret`
Theo `ops-runbook.md` §2.1, **không** phải quy trình riêng của Shop:
1. `SELECT vault.update_secret(…)`.
2. `npx supabase secrets set CRON_SECRET=<new> --project-ref …`.
3. Không caller nào cần đổi — job đọc vault lúc chạy.
4. Xác minh bằng `net._http_response` và `ops_cron_alert_state`.

Vì `CRON_SECRET` dùng chung với 5 caller khác, rotate là thao tác toàn cục.
**Không rotate nó trong lúc deploy Shop.**

---

## 11. Lệnh chính xác — CHƯA CHẠY

Bản đầy đủ kèm ô ký duyệt: [`approval-packets/packet-c-worker-cron.md`](./approval-packets/packet-c-worker-cron.md).

```sh
# 1. Deploy (KHÔNG có bước secrets set — xem §3)
npx supabase functions deploy shop-media-lifecycle --project-ref ajvlcamxemgbxduhiqrl

# 2. Xác nhận nó thật sự tồn tại — code trong repo ≠ đã deploy
npx supabase functions list --project-ref ajvlcamxemgbxduhiqrl | grep shop-media-lifecycle

# 3. Cổng fail-closed: secret sai phải 401
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST "https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/shop-media-lifecycle" \
  -H "Content-Type: application/json" -H "x-cron-secret: wrong" \
  -d '{"action":"cleanup"}'
# kỳ vọng: 401

# 4. Secret đúng phải 200 (chạy SAU khi migration #3 tạo bảng hàng đợi)
curl -s -X POST "https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/shop-media-lifecycle" \
  -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" \
  -d '{"action":"cleanup"}'
# kỳ vọng: {"ok":true,"claimed":0,"deleted":0,"failed":0}
```

Kiểm tra cron (sau khi áp migration #4):

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'shop-media-%';
-- kỳ vọng 2 dòng, active = true

SELECT jobname, status, start_time
FROM cron.job_run_details
WHERE jobname LIKE 'shop-media-%'
ORDER BY start_time DESC LIMIT 5;

SELECT status_code FROM net._http_response ORDER BY id DESC LIMIT 5;
-- kỳ vọng 200 cho hai lần gọi Shop
```

Rollback:

```sql
SELECT cron.unschedule('shop-media-cleanup-every-5m');
SELECT cron.unschedule('shop-media-reconcile-hourly');
```
```sh
npx supabase functions delete shop-media-lifecycle --project-ref ajvlcamxemgbxduhiqrl
```

> Theo `ops-runbook.md` §3: mutation `cron.*` trong DO-block hay bị lỗi qua
> Management API — gọi `cron.schedule` / `cron.unschedule` như **câu lệnh cấp
> cao nhất**, và luôn thêm `SELECT 1;` ở đầu vì câu đầu tiên đôi khi bị nuốt.
