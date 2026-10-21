# CP5 — Gói triển khai migration

> **Không lệnh nào ở đây được chạy.** Bản thi hành:
> [`approval-packets/packet-b-migrations.md`](./approval-packets/packet-b-migrations.md).
>
> Nền tảng `f172a441` · nhánh `feat/shop-closed-pilot`.

---

## 1. Danh sách chính xác, đúng thứ tự

17 file. Thứ tự áp = thứ tự tên file. Không được đảo, không được gộp.

```
 1  20260811090000_shop_phase1_seller_onboarding.sql
 2  20260811120000_shop_phase2a_catalog.sql
 3  20260811140000_shop_phase2a_media_lifecycle.sql
 4  20260811150000_shop_media_cleanup_cron.sql
 5  20260811160000_shop_service_role_grants.sql
 6  20260811170000_shop_draft_media_least_privilege.sql
 7  20260811180000_shop_profile.sql
 8  20260811190000_shop_contact_business_phone.sql
 9  20260811200000_shop_product_editor.sql
10  20260811210000_shop_variants_inventory.sql
11  20260811220000_shop_media_ordering_profile.sql
12  20260811230000_shop_preview_submit.sql
13  20260812090000_shop_p2b_status_suspended.sql
14  20260812091000_shop_p2b_moderation_backend.sql
15  20260812120000_shop_p2b_q5_q6_closure.sql
16  20260813090000_shop_p2b_public_read.sql
17  20260813120000_shop_p2b_shop_slug_history.sql
```

---

## 2. Đối tượng schema

**18 bảng** · **10 enum** · **3 view** · **95 hàm** · **2 storage bucket** ·
**7 storage policy**. Liệt kê đầy đủ ở
[`release-inventory.md` §3](./release-inventory.md).

Tất cả đều **thêm mới**. Không cột nào của bảng có sẵn bị đổi kiểu. Đúng **một**
đối tượng có sẵn bị sửa:

```sql
-- migration #1, dòng 717
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IS NULL OR resource_type IN (
    …14 giá trị cũ…, 'shop_application', 'shop', 'shop_product'
  ));
```

Đã đối chiếu: 14 giá trị cũ khớp **chính xác** định nghĩa đang chạy trên remote.
Đây là widen thuần — không giá trị nào bị bỏ.

---

## 3. Khoá và rủi ro — ước lượng

| Thao tác | Khoá | Thời gian ước tính | Vì sao |
|---|---|---|---|
| `CREATE TABLE` × 18 | không đụng bảng có sẵn | tức thì | |
| `CREATE TYPE` × 10 | không | tức thì | |
| `CREATE FUNCTION` × 95 | không | vài giây | |
| `CREATE INDEX` (không `CONCURRENTLY`) | ACCESS EXCLUSIVE trên **bảng vừa tạo, rỗng** | tức thì | Bảng rỗng ⇒ `CONCURRENTLY` không mua được gì |
| `DROP/ADD CONSTRAINT` trên `audit_logs` | **ACCESS EXCLUSIVE + quét toàn bảng** | **< 1 giây** | `audit_logs` = 2 851 dòng / 2 328 kB (đo remote) |
| `INSERT INTO storage.buckets` | ROW EXCLUSIVE trên `storage.buckets` (5 dòng) | tức thì | `ON CONFLICT DO NOTHING` |
| `CREATE POLICY` trên `storage.objects` | ACCESS EXCLUSIVE, **không** quét dữ liệu | tức thì | 27 object |

**Thao tác đắt nhất là constraint trên `audit_logs`, và nó dưới một giây.** Không
cần cửa sổ bảo trì. Không cần dừng cron.

**Cửa sổ duy nhất đáng bận tâm:** trong lúc `audit_logs_resource_type_check` bị
DROP rồi chưa ADD lại, một INSERT đồng thời có `resource_type` rác sẽ lọt. Cửa sổ
đó tính bằng mili-giây, `audit_logs` chỉ được ghi bởi `log_audit_event` (giá trị
đến từ code, không từ người dùng), và xác suất là không đáng kể. Ghi ở đây vì
"gap policy/constraint" là câu hỏi bắt buộc phải trả lời, không phải vì nó là
rủi ro thật.

### Hành vi transaction

Mỗi file được áp như **một** transaction. Nếu một câu lệnh lỗi, cả file rollback
— không có nửa migration. Điều này đúng khi áp qua Management API query endpoint
với toàn bộ nội dung file trong một `query`.

⚠️ **Ngoại lệ: `INSERT INTO storage.buckets`** trong migration #2. Bucket thuộc
schema `storage` do Supabase quản lý; INSERT vẫn transactional, nhưng nếu bucket
đã tồn tại từ một lần chạy trước, `ON CONFLICT DO NOTHING` khiến file là
idempotent — chạy lại an toàn.

### Backfill dữ liệu

**Không có.** Không migration nào `UPDATE` hay `INSERT` dữ liệu người dùng. Chỉ
`product_categories` được seed (taxonomy do nền tảng sở hữu — Q3).

### Ảnh hưởng auth / RLS

- Mọi bảng mới **bật RLS** và có policy tường minh **cùng** khối `GRANT` — đây
  là lớp lỗi lặp lại nhiều nhất của repo (hai đợt "missing grants sweep"), và
  17 file này viết theo đúng bài học đó.
- **Không** policy nào của bảng có sẵn bị sửa hay xoá.
- `is_admin()` được **gọi**, không được định nghĩa lại. Cưỡng chế AAL2 hiện có
  áp dụng nguyên vẹn cho mọi RPC kiểm duyệt Shop.
- `shop_pilot_has_access()` là hàm mới, `STABLE SECURITY DEFINER`,
  `SET search_path = public`, `REVOKE ALL FROM PUBLIC` rồi grant lại cho
  `authenticated` + `service_role`.

### Ảnh hưởng storage

Hai bucket mới. `shop-product-media-draft` là bucket **đầu tiên có
`public = false`** của toàn dự án — 5 bucket hiện tại đều public. Nếu có công cụ
vận hành nào giả định "mọi bucket đều public", đây là chỗ nó sẽ ngạc nhiên.

### Phụ thuộc edge function

`shop-media-lifecycle` gọi 4 RPC: `product_publish_prepare`,
`product_publish_commit`, `shop_media_cleanup_claim`, `shop_media_cleanup_complete`,
`shop_media_reconcile`. Cả năm do migration #3 tạo.

⇒ **Function phải deploy TRƯỚC hoặc SAU migration #3, nhưng cron chỉ được sống
sau cả hai.** Thứ tự trong Packet C/B: function → migration 1-3 → migration 4
(tạo cron). Ràng buộc thật này ghi ở [`media-worker-deployment.md` §4](./media-worker-deployment.md).

---

## 4. Preflight trên cơ sở dữ liệu cục bộ sạch

Chạy trên nền tảng closed-pilot, cơ sở dữ liệu dựng lại từ số không. Kết quả:
[`acceptance.md` §1](./acceptance.md).

| Kiểm | Lệnh | Kết quả |
|---|---|---|
| Reset toàn bộ | `npx supabase db reset --local` | exit 0 |
| Ledger parity | `SELECT count(*) FROM supabase_migrations.schema_migrations` | **350 / 350 file** |
| Bảng Shop tồn tại | `information_schema.tables … LIKE 'shop%'` | **11** (+ 7 bảng `product*`) |
| Bucket | `storage.buckets … LIKE 'shop%'` | **2** |
| pgTAP toàn bộ | `npx supabase test db --local supabase/tests` | xem `acceptance.md` |
| Generated types | so với schema tracked | xem §5 |
| Không có migration untracked | `git ls-files` = `ls` | **350 = 350** |
| Không có câu lệnh destructive ngoài dự kiến | grep `DROP TABLE`/`DROP COLUMN`/`ALTER … TYPE` trong 17 file | chỉ `DROP … IF EXISTS` cho policy/constraint do chính chúng tạo |
| Không có cửa sổ trống policy | mọi `DROP POLICY IF EXISTS` đi liền `CREATE POLICY` trong cùng file | ✅ |

**Migration lint:** repo không có linter migration. `scripts/check-migration-drift.mjs`
(`npm run drift`) so ledger, không so nội dung.

---

## 5. Sau khi áp — chuỗi generated types

Đúng thứ tự này, không đảo:

```sh
# 1. Sinh lại types từ schema remote THẬT
npx supabase gen types typescript \
  --project-id ajvlcamxemgbxduhiqrl --schema public \
  > src/integrations/supabase/types.ts
```

`--schema public` là **bắt buộc** — không có nó, các lần chạy CLI cũ đã im lặng
bỏ bảng.

```sh
# 2. Xác nhận bảng Shop đã có trong types
grep -c "shop_pilot_members\|product_variants\|shop_media_cleanup_jobs" src/integrations/supabase/types.ts
# kỳ vọng ≥ 3

# 3. CHỈ KHI bước 2 xanh mới xoá hai file tạm
git rm src/integrations/supabase/shop-schema.ts src/integrations/supabase/shop-client.ts
```

```sh
# 4. Sửa mọi import trỏ vào shop-client, rồi
npx tsc -b && npm test && npm run build
```

⚠️ Đây là **thay đổi mã nguồn**, không phải thao tác triển khai. Nó thuộc một
commit riêng, sau khi migration đã áp, và nó phải qua đủ cổng kiểm tra. Đừng làm
nó trong cùng nhịp với `db push`.

---

## 6. Đối chiếu remote — chỉ đọc, đã đo

Đo 2026-08-12 trên `ajvlcamxemgbxduhiqrl`. Chi tiết:
[`environment-audit.md`](./environment-audit.md).

| Kiểm | Kết quả |
|---|---|
| Ledger hiện tại | 325 dòng, version cao nhất `20260804090000` |
| Migration Shop đang chờ | **17 — không file nào đã áp** |
| Object drift trong phạm vi Shop | **0** — không bảng/type/function/bucket/cron nào tên `shop*` hay `product*` |
| Va chạm enum | **0** |
| Va chạm overload hàm | **0**. `log_audit_event` remote có đúng 1 overload; Shop gọi bằng ép kiểu tường minh khớp chữ ký đó |
| Extension cần thêm | **0** — `unaccent_immutable()` là regexp thuần, không cần `unaccent` |
| Số dòng bảng bị tác động | `audit_logs` 2 851 · `storage.buckets` 5 · `storage.objects` 27 · `auth.users` 2 219 (chỉ tham chiếu FK) |
| `pg_cron` / `pg_net` / `vault` | cả ba có; `cron_secret` tồn tại |

**Không chạy `db push` hay tương đương.**

---

## 7. Drift ngoài phạm vi Shop — không sửa trong đợt này

29 file local vắng mặt trong ledger remote: 17 của Shop, 12 không thuộc Shop.
Đã probe object thật cho cả 12 (bảng đầy đủ ở
[`release-inventory.md` §11](./release-inventory.md)):

- **11/12 đã áp**, chỉ thiếu dòng ledger — hệ quả của việc áp qua Management API
  từ 04/08.
- **1/12 THẬT SỰ CHƯA ÁP:** `20260805150000_news_source_ppa_tour_pause`. Nguồn
  `ppa-tour` vẫn `active=true` trên production dù feed đã 404 từ 05/08.
- **4 version trong ledger remote không có file local.**

**Ba mệnh lệnh:**

1. **Không chèn ledger mù.** Chèn 12 dòng sẽ đánh dấu file thứ 12 là "đã áp"
   trong khi nó chưa chạy — và nguồn tin hỏng sẽ ở lại vĩnh viễn.
2. **Không `db push --include-all`.**
3. Hoà giải drift là **việc riêng**, không phải một bước của Packet B. Nó không
   chặn Shop: 17 migration Shop chỉ phụ thuộc `is_admin()`, `has_role()`,
   `log_audit_event()`, `audit_logs`, `pg_cron`, `pg_net`, `vault`, `pgcrypto` —
   tất cả đã có trên remote.

---

## 8. SQL xác nhận sau mỗi file

Chạy sau **từng** file, không dồn cuối:

```sql
SELECT 1;
-- (câu đầu tiên đôi khi bị Management API nuốt — ops-runbook §1)

-- sau #1
SELECT to_regclass('public.shop_pilot_members') IS NOT NULL AS ok_pilot,
       to_regclass('public.shops')              IS NOT NULL AS ok_shops,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='shop_pilot_has_access')       AS ok_gate,
       pg_get_constraintdef((SELECT oid FROM pg_constraint
         WHERE conname='audit_logs_resource_type_check')) LIKE '%shop_product%' AS ok_audit_widened;

-- sau #2
SELECT to_regclass('public.products') IS NOT NULL AS ok_products,
       (SELECT count(*) FROM storage.buckets WHERE id LIKE 'shop%')            AS ok_buckets,   -- 2
       (SELECT public FROM storage.buckets WHERE id='shop-product-media-draft') AS draft_public, -- false
       (SELECT count(*) FROM pg_policies WHERE schemaname='storage'
          AND policyname LIKE 'shop_product_media%')                            AS ok_storage_policies;

-- sau #3
SELECT to_regclass('public.shop_media_cleanup_jobs') IS NOT NULL AS ok_queue,
       to_regclass('public.shop_media_cleanup_health') IS NOT NULL AS ok_health;

-- sau #4  (chỉ khi function ĐÃ deploy)
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'shop-media-%';

-- sau #17
SELECT to_regclass('public.shop_slug_history') IS NOT NULL AS ok_slug_history,
       (SELECT count(*) FROM supabase_migrations.schema_migrations)             AS ledger_after;
```

**Bằng chứng bắt buộc:** `ledger_after` = `325 + <số file thật sự áp>`, và
`\d public.shop_slug_history` trả về một bảng.

---

## 9. Smoke sau migration — trước khi có bất kỳ người dùng nào

Chạy với **anon key**, chưa cần deploy web:

```sql
-- Deny by default: anon không đọc được hồ sơ đăng ký nào
SELECT count(*) FROM public.shop_applications;    -- kỳ vọng: 0 hoặc lỗi quyền

-- Danh mục công khai trả về gì đó
SELECT count(*) FROM public.product_categories;   -- kỳ vọng: > 0 (seed)

-- Không có sản phẩm nào công khai — chưa ai bán gì
SELECT count(*) FROM public.public_products;      -- kỳ vọng: 0

-- Cổng pilot đang đóng
SELECT count(*) FROM public.shop_pilot_members;   -- kỳ vọng: 0
```

Bốn số đó là chân dung đúng của một pilot chưa mở: cổng đóng, danh mục sẵn sàng,
catalog rỗng, dữ liệu riêng tư không đọc được.

---

## 10. Rollback — phân loại trung thực

Repo này **forward-only**. Không có down migration, và tài liệu này **không hứa**
có. Phân loại theo cái gì thật sự đảo ngược được:

| Loại | Đảo ngược được? | Cách | Thời gian |
|---|---|---|---|
| **Cổng pilot** | ✅ **hoàn toàn** | `DELETE FROM shop_pilot_members` | giây — **kill switch chính** |
| **Web** | ✅ | Cloudflare Pages → rollback deployment | phút |
| **Cron** | ✅ | `cron.unschedule(…)` × 2 | giây |
| **Edge function** | ✅ | `functions delete shop-media-lifecycle` | giây; hàng đợi nằm im, không mất dữ liệu |
| **Secret** | n/a | không secret nào được tạo hay đổi | — |
| **Schema** | ⚠️ **forward-fix** | `DROP` theo thứ tự phụ thuộc ngược, viết trong thân PR | Mọi object đều additive nên `DROP` là đủ; nhưng nó **xoá dữ liệu người bán đã nhập** |
| **Storage object** | ❌ **không** | ảnh đã xoá là đã xoá; Storage **không** nằm trong sao lưu DB | — |
| **Khôi phục dữ liệu** | ⚠️ PITR / restore-to-new-project | `ops-runbook.md` §6 — ~4 phút cho DB, **không gồm Storage** | phút |

### Thứ tự ưu tiên khi có sự cố

```
1. Đóng cổng pilot            ← gần như luôn đủ, và không mất gì
2. Rollback web
3. unschedule cron
4. delete function
5. forward-fix migration       ← chỉ khi schema thật sự sai
6. khôi phục dữ liệu           ← cuối cùng
```

**"Đóng cổng pilot" là kill switch, và nó nên là phản xạ đầu tiên.** Nó dừng mọi
hành động ghi của người bán trong một câu lệnh, không đụng schema, không đụng
deploy, và đảo ngược lại được bằng một câu lệnh khác. Giới hạn của nó — người bán
vẫn **đọc** được dữ liệu shop của họ (Q1) — ghi ở [`operations.md`](./operations.md).

### Thứ **không** rollback được

Một sản phẩm đã bị Google lập chỉ mục. Revert gỡ route, **không** gỡ URL khỏi
Google. Đó là lý do mốc "mở công khai" tách riêng và vì sao
`SHOP_PUBLIC_INDEXING` là biến duy nhất trong toàn bộ gói này mà không ai được
đặt "để thử".
