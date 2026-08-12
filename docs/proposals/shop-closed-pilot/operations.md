# CP8 — Vận hành: giám sát, cảnh báo, kill switch

> Vận hành hằng ngày của riêng vòng đời ảnh đã có runbook:
> [`docs/ops/shop-media-lifecycle-runbook.md`](../../ops/shop-media-lifecycle-runbook.md).
> Tài liệu này bao trùm cả pilot: nhìn cái gì, báo động khi nào, và tắt bằng nút nào.
>
> **Chưa có truy vấn nào được cài vào hệ thống cảnh báo.** Đây là danh sách chờ
> duyệt, và nó cố ý dùng lại `ops_cron_monitors` + `errors-telegram-alert` sẵn có
> thay vì dựng hệ mới.

---

## 1. Một bảng điều khiển, một truy vấn

Chạy bằng psql hoặc admin JWT (aal2). Đây là câu duy nhất cần đọc mỗi ngày.

```sql
SELECT 1;
SELECT
  -- Kiểm duyệt
  (SELECT count(*) FROM public.shop_applications WHERE status IN ('submitted','under_review'))          AS app_pending,
  (SELECT round(extract(epoch FROM now() - min(submitted_at))/3600, 1)
     FROM public.shop_applications WHERE status IN ('submitted','under_review'))                        AS app_oldest_hours,
  (SELECT count(*) FROM public.products WHERE status = 'pending_review')                                AS prod_pending,
  (SELECT round(extract(epoch FROM now() - min(updated_at))/3600, 1)
     FROM public.products WHERE status = 'pending_review')                                              AS prod_oldest_hours,
  (SELECT count(*) FROM public.shop_contact_channels WHERE state = 'pending_review')                    AS contact_pending,

  -- Quy mô pilot
  (SELECT count(*) FROM public.shop_pilot_members)                                                      AS pilot_members,
  (SELECT count(*) FROM public.shops WHERE state = 'active')                                            AS shops_active,
  (SELECT count(*) FROM public.shops WHERE state = 'suspended')                                         AS shops_suspended,
  (SELECT count(*) FROM public.public_products)                                                         AS products_public,

  -- Vòng đời ảnh
  (SELECT pending    FROM public.shop_media_cleanup_health)                                             AS media_pending,
  (SELECT due_now    FROM public.shop_media_cleanup_health)                                             AS media_due_now,
  (SELECT stuck      FROM public.shop_media_cleanup_health)                                             AS media_stuck,
  (SELECT failed     FROM public.shop_media_cleanup_health)                                             AS media_failed,
  (SELECT oldest_failure_at FROM public.shop_media_cleanup_health)                                      AS media_oldest_failure,

  -- Cron
  (SELECT max(start_time) FROM cron.job_run_details
    WHERE jobname = 'shop-media-cleanup-every-5m' AND status = 'succeeded')                             AS cron_last_ok;
```

Chân dung của một pilot khoẻ: `media_*` đều 0 hoặc đang giảm · `cron_last_ok`
trong vòng 10 phút · `*_oldest_hours` dưới ngưỡng SLA · `shops_suspended` bằng
con số bạn tự tay tạo ra.

---

## 2. Ba truy vấn còn lại

### 2.1 Lỗi phía trình duyệt trên route Shop

```sql
SELECT 1;
SELECT left(message, 120) AS signature, count(*) AS n, max(created_at) AS last_seen
FROM public.client_errors
WHERE created_at > now() - interval '24 hours'
  AND (url LIKE '%/shop%' OR url LIKE '%/seller%' OR url LIKE '%/admin/shop%')
GROUP BY 1 ORDER BY n DESC LIMIT 20;
```

### 2.2 Từ chối quyền — lớp RLS đang làm việc, hay đang chặn nhầm?

```sql
SELECT 1;
SELECT event_type, count(*) AS n, max(created_at) AS last_seen
FROM public.audit_logs
WHERE created_at > now() - interval '24 hours'
  AND resource_type IN ('shop','shop_product','shop_application')
GROUP BY 1 ORDER BY n DESC;
```

Một cú nhảy vọt của `*_decide` có hai cách đọc, và chỉ một là tin tốt: hoặc
người kiểm duyệt đang làm việc, hoặc có gì đó đang thử lại trong vòng lặp. Đối
chiếu với số quyết định người kiểm duyệt nhớ mình đã bấm.

### 2.3 Sức khoẻ cron, dùng monitor sẵn có

Hai job Shop **chưa có dòng nào** trong `ops_cron_monitors`. Nếu Product Owner
muốn Telegram báo động cho chúng như 3 job đang được giám sát, đó là **hai dòng
INSERT**, không phải một hệ thống mới:

```sql
-- ĐỀ XUẤT, chưa chèn. Cột theo schema thật của bảng.
INSERT INTO public.ops_cron_monitors
  (monitor_key, cron_job_name, display_name, expected_interval_seconds, grace_seconds, enabled, source)
VALUES
  ('shop-media-cleanup',   'shop-media-cleanup-every-5m',  'Shop — dọn ảnh',      300,  180, true, 'pg_cron'),
  ('shop-media-reconcile', 'shop-media-reconcile-hourly',  'Shop — đối soát ảnh', 3600, 900, true, 'pg_cron')
ON CONFLICT (monitor_key) DO NOTHING;
```

Đây là **đề xuất Packet C**, không phải lệnh. Ghi ở đây vì nó là cách rẻ nhất
biến "worker chết lúc 2 giờ sáng" thành một tin nhắn Telegram thay vì một phát
hiện ba ngày sau.

---

## 3. Cảnh báo — mức, chủ sở hữu, ý nghĩa

Chủ sở hữu mặc định là Cuong ở mọi dòng, vì hiện chỉ có một admin. Đó **là** một
phát hiện, không phải một chỗ trống — xem câu hỏi #7 và #8 trong
[`pilot-contract.md` §6](./pilot-contract.md).

| # | Điều kiện | Mức | Ý nghĩa thật |
|---|---|---|---|
| 1 | `shop_media_cleanup_jobs` có job `pending` > 30 phút | 🔴 **P1** | **Ảnh đã gỡ vẫn tải được.** Đây là lời hứa duy nhất của pilot với người mua đang bị vi phạm |
| 2 | `media_due_now` > 0 qua hai chu kỳ liên tiếp | 🔴 P1 | Cron không nổ |
| 3 | `media_failed` > 0 | 🔴 P1 | Storage từ chối 8 lần |
| 4 | `cron_last_ok` cũ hơn 15 phút | 🔴 P1 | Worker chết |
| 5 | **Bất kỳ đường dẫn riêng tư nào lọt ra bề mặt công khai** | 🔴 **P0** | Dừng pilot. Không điều tra trước — đóng cổng trước |
| 6 | Route Shop mất `noindex`, hoặc Shop xuất hiện trong sitemap | 🔴 **P0** | Cửa một chiều. Xem §6 |
| 7 | Shop 5xx > 1% trong 15 phút | 🔴 P1 | |
| 8 | `media_stuck` > 0 sau một lần reconcile | 🟠 P2 | Reconcile không cứu được |
| 9 | Hồ sơ/sản phẩm chờ duyệt lâu nhất > 48 giờ | 🟠 **P2** | **Người kiểm duyệt đã ngừng nhìn.** Con số này nói về con người, không về hệ thống |
| 10 | Lỗi upload/finalize Storage tăng vọt | 🟠 P2 | Pipeline ảnh trình duyệt hỏng |
| 11 | Chữ ký lỗi mới trong `client_errors` trên route Shop | 🟠 P2 | Dùng `soak-watch.mjs` — cần baseline lấy **trước** deploy |
| 12 | Lỗi quyền/RLS tăng vọt | 🟠 P2 | Hoặc RLS đang chặn nhầm, hoặc ai đó đang dò |
| 13 | `orphans_queued` lớn và lặp lại | 🟡 P3 | Publish hỏng giữa copy và commit |
| 14 | 404/redirect bất thường trên `/shop/*` | 🟡 P3 | Slug đổi mà không có dòng lịch sử |

---

## 4. Không bao giờ ghi log

Áp dụng cho log, cảnh báo, tin nhắn Telegram, báo cáo và mọi ảnh chụp màn hình
được chia sẻ:

- ❌ signed URL — một signed URL trong dòng log là một credential trong dòng log;
- ❌ đường dẫn storage riêng tư;
- ❌ giá trị kênh liên hệ thô (số điện thoại, Zalo ID) — **kiểu kênh thì đi được,
  giá trị thì không**, và có assertion pgTAP kiểm điều đó;
- ❌ `internal_note`, dưới bất kỳ hình thức nào;
- ❌ giấy tờ hay dữ liệu cá nhân của người bán;
- ❌ bất cứ thứ gì của người mua.

`safeError()` trong worker đã bóc mọi thứ sau `?` và cắt còn 400 ký tự. **Nếu
bạn thấy `token=` trong `last_error`, đó là bug — báo, đừng dán vào Telegram.**

---

## 5. Kill switch

### 5.1 Nút chính — đóng cổng pilot

```sql
SELECT 1;
SELECT public.log_audit_event(
  'shop_pilot_closed'::text, 'admin'::text, 'user'::text, NULL::text, 'critical'::text,
  jsonb_build_object('reason', '<vì sao>',
                     'members', (SELECT jsonb_agg(user_id) FROM public.shop_pilot_members)),
  'user'::text);
DELETE FROM public.shop_pilot_members;
```

Thời gian: giây. Đảo ngược: chèn lại từ danh sách đã chụp trong dòng kiểm toán.

**Nó dừng cái gì:** mọi hành động ghi của người bán — tạo, sửa, gửi duyệt, upload,
publish. `shop_pilot_has_access()` gác toàn bộ.

🔴 **Nó KHÔNG dừng cái gì — phải biết trước khi bấm:**

| Vẫn hoạt động | Vì sao |
|---|---|
| Người bán **đọc** dữ liệu shop của chính họ | Q1 — `shop_members` cho quyền đọc, không phải allowlist |
| Sản phẩm **đã publish vẫn công khai** | Publish là trạng thái trên `products`, không phải quyền của người bán |
| Ảnh công khai vẫn tải được | Byte đã ở bucket public |
| Admin vẫn làm được mọi thứ | `is_admin()` luôn qua cổng |

⇒ **Đóng cổng pilot là đóng băng, không phải gỡ xuống.** Nếu cần gỡ nội dung
xuống, dùng §5.2.

### 5.2 Gỡ nội dung công khai xuống

Theo mức độ, từ hẹp tới rộng:

```sql
-- Một sản phẩm
SELECT public.product_decide('<product_id>'::uuid, 'suspend', '<lý do gửi người bán>', '<ghi chú nội bộ>');

-- Cả một shop — trigger tự thu hồi mọi rendition và xếp hàng xoá
UPDATE public.shops SET state = 'suspended' WHERE id = '<shop_id>'::uuid;
```

> ⚠️ **Bẫy đã mất một lần:** `shops.state` được bảo vệ bởi `is_admin()`, **không**
> theo cờ `shop.privileged_write`. Một `UPDATE` chạy qua psql/Management API
> **không có `auth.uid()`**, nên `is_admin()` sai và câu lệnh là **no-op câm** —
> nó báo thành công và không đổi gì. **Luôn kiểm lại:**
> ```sql
> SELECT id, state FROM public.shops WHERE id = '<shop_id>'::uuid;
> ```
> Nếu state không đổi, phải làm qua UI quản trị với phiên aal2.

Suspend shop kích hoạt `shops_revoke_media_on_state_change`: mọi `public_path`
bị xoá **ngay trong transaction**, và mỗi object được xếp hàng chờ xoá. Kiểm:

```sql
SELECT count(*) FILTER (WHERE public_path IS NOT NULL) AS still_public,
       count(*) FILTER (WHERE j.state = 'pending')     AS queued
FROM public.product_media m
LEFT JOIN public.shop_media_cleanup_jobs j ON j.media_id = m.id
WHERE m.shop_id = '<shop_id>'::uuid;
```

`still_public` phải là **0 ngay lập tức**. `queued` rút cạn trong ~10 phút.

### 5.3 Ẩn lối vào Shop

Không có cờ nào ẩn `/shop` khỏi người dùng. Nếu cần, đó là **rollback web**
(Cloudflare Pages → deployment trước), không phải một biến môi trường.

`SHOP_PUBLIC_INDEXING` **không** làm việc này — nó chỉ điều khiển header và
robots. Đừng nhầm.

### 5.4 Tạm dừng worker

```sql
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'shop-media-cleanup-every-5m'), active := false);
```

⚠️ **Gần như luôn là quyết định SAI.** Job tích luỹ ở `pending` và backoff — đó
là hành vi đã thiết kế cho sự cố Storage. Dừng worker nghĩa là **ảnh đã gỡ ở lại
vĩnh viễn**. Chỉ dừng khi worker đang xoá **nhầm**, và khi đó việc kế tiếp là
điều tra, không phải chờ.

### 5.5 Hai điều KHÔNG BAO GIỜ làm

- ❌ **Không bao giờ tắt RLS.** Không có tình huống nào trong pilot này mà tắt RLS
  là câu trả lời đúng.
- ❌ **Không bao giờ đặt `shop-product-media-draft` thành public.** Bucket đó chứa
  ảnh gốc, ảnh chưa duyệt và ảnh đã bị từ chối.

---

## 6. Sự cố lập chỉ mục — cửa một chiều

Nếu một URL Shop bị lập chỉ mục:

1. **Xác nhận** — `site:thepicklehub.net/shop` trong Google, không phải đoán.
2. **Đóng nguồn rò rỉ** — kiểm `SHOP_PUBLIC_INDEXING` trong Pages (cả hai môi
   trường), kiểm `X-Robots-Tag` trên HTTP thật, kiểm sitemap.
3. **Gỡ khẩn cấp trong GSC** — Removals → Temporary removal. Đây là băng dán, hết
   hạn sau ~6 tháng.
4. **Giữ `noindex` phục vụ** — Google phải *crawl lại* để thấy nó. `Disallow`
   trong robots.txt **ngăn** việc crawl lại đó, nên trong giai đoạn gỡ, header
   quan trọng hơn robots.
5. **Không** revert nhánh và tưởng vấn đề đã xong. Revert gỡ route; URL vẫn nằm
   trong chỉ mục và giờ trả 404.

Đây là lý do `SHOP_PUBLIC_INDEXING` là biến duy nhất trong toàn bộ gói này mà
**không ai được đặt "để thử"**.

---

## 7. Nhịp trực hằng ngày trong pilot

| Khi nào | Việc |
|---|---|
| Mỗi sáng | Chạy truy vấn §1. Bốn số `media_*` phải là 0 |
| Mỗi sáng | Dọn hàng chờ duyệt. Sau mỗi quyết định, nhắn tay theo [`notification-decision.md` §5](./notification-decision.md) |
| Mỗi sáng | Liếc §2.1 tìm chữ ký lỗi mới |
| Mỗi tuần | Đếm số lần nhắn tay, số lần quên, độ trễ trung bình quyết định→nhắn |
| Mỗi tuần | Rà lại tiêu chí dừng ở [`pilot-contract.md` §7](./pilot-contract.md) |
| Sau mỗi wave | Nghiệm thu wave trước khi mở wave sau |

Nếu nhịp này bị bỏ ba ngày liên tiếp, pilot đang chạy mà không ai nhìn — và đó
tự nó là lý do dừng.

---

## 8. Mất authenticator — đường thoát

Chỉ có **một** tài khoản admin và **một** TOTP factor đã verify. Mất điện thoại
là mất quyền quản trị, và không ai khác duyệt được sản phẩm.

Đường thoát, cần quyền SQL (PAT trong `~/Downloads/secrets.local.md`):

```sql
SELECT 1;
SELECT id, factor_type, status, created_at FROM auth.mfa_factors
WHERE user_id = '<ADMIN_UUID>'::uuid;

DELETE FROM auth.mfa_factors WHERE user_id = '<ADMIN_UUID>'::uuid;
-- Rồi đăng nhập và enrol lại tại /admin
```

**Ghi đường thoát này ở nơi Cuong đọc được khi đang bị khoá ngoài** — nghĩa là
không phải chỉ ở đây. Một runbook chỉ tồn tại sau cánh cửa bị khoá thì không
phải runbook.
