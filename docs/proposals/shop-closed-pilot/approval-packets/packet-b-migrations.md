# Packet B — Migration cơ sở dữ liệu

> **TRẠNG THÁI: CHƯA DUYỆT. Không lệnh nào đã chạy.**
> Tier: 🔴 **RED** — `git revert` không hoàn tác SQL đã chạy.
> Nền: [`../migration-deployment.md`](../migration-deployment.md)
>
> **Cập nhật 2026-08-12:** Product Owner quyết định #1 — packet này chạy
> **HAI LẦN**: lần một lên **staging**, lần hai lên production sau khi nghiệm
> thu preview. Mỗi lần cần một chữ ký riêng ở §10.

---

## 1. Mục tiêu

| Lần | Project ref | Khi nào |
|---|---|---|
| **B-1** | **`utokwfcljxjkpkaqgheo`** — Packet S cung cấp | Sau Packet S |
| **B-2** | **`ajvlcamxemgbxduhiqrl`** (`thepicklehub-prod`) | Chỉ sau khi Product Owner nghiệm thu preview |

| Thứ | Giá trị |
|---|---|
| Phương thức | Management API query endpoint (`ops-runbook.md` §1) |
| Nền tảng | nhánh `feat/shop-closed-pilot` |
| Số file | **20** |

🔴 **Trước MỌI lần ghi, chạy và ĐỌC câu chứng minh mục tiêu**
([`packet-s-staging.md` §8](./packet-s-staging.md)). `users` hàng nghìn nghĩa là
production; ở B-1 đó là lệnh dừng.

---

## 2. Vì sao an toàn để làm trước khi có ai duyệt pilot

| Sự thật | Đo bằng |
|---|---|
| Remote **chưa có** object Shop nào — 0 bảng, 0 type, 0 function, 0 bucket, 0 cron job | probe chỉ đọc 2026-08-12 |
| **Không va chạm tên** với bất cứ thứ gì đang chạy | như trên |
| Gần như mọi object đều **thêm mới**; 1 constraint được **widen** và 1 hàm bị **thay chữ ký** (§3) | đọc 20 file |
| `main` **không có** route Shop ⇒ web production không đổi một pixel | `git diff` |
| `shop_pilot_members` rỗng ⇒ mọi hành động người bán bị từ chối | thiết kế |
| Thao tác đắt nhất là revalidate constraint trên `audit_logs` (2 851 dòng / 2 328 kB) | **< 1 giây** |

Không cần cửa sổ bảo trì. Không cần dừng cron.

---

## 3. Migration đang chờ — 20, đúng thứ tự

```
 1  20260811090000_shop_phase1_seller_onboarding.sql
 2  20260811120000_shop_phase2a_catalog.sql
 3  20260811140000_shop_phase2a_media_lifecycle.sql
 4  20260811150000_shop_media_cleanup_cron.sql          ← chỉ áp SAU Packet C
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
18  20260814090000_shop_seller_rules_acceptance.sql     ← CP12
19  20260814100000_shop_seller_rules_v1_publish.sql     ← CP15
20  20260814110000_shop_media_reconcile_profile_gap.sql ← CP17 (B13)
```

**#18 là thứ đóng blocker B5.** Nó tạo `legal_documents` / `legal_acceptances`,
và **thay chữ ký của `shop_application_submit()`**: `DROP FUNCTION IF EXISTS
public.shop_application_submit();` rồi tạo lại với một tham số có mặc định.

Đây là **đối tượng có sẵn duy nhất bị thay thế** trong cả 20 file. `DROP` là bắt
buộc: `CREATE OR REPLACE` sẽ để lại cả hai và một lời gọi không tham số trở nên
nhập nhằng — 42725, đúng lỗi từng phá mọi quyết định duyệt trong tính năng này.

Sau #18, **không ai gửi được hồ sơ** cho tới khi có một bản quy chế hiệu lực
(`seller_rules_not_published`). Đó là hành vi đúng, và **#19 là thứ mở cánh cửa
đó** — không phải một bản vá vội.

### #19 khác mọi file còn lại

Nó là file duy nhất **chèn dữ liệu** thay vì tạo object, và dữ liệu đó là một
văn bản pháp lý. Bốn điều đáng biết trước khi áp:

| | |
|---|---|
| Nội dung | toàn văn `seller-rules-v1.md`, **đúng từng byte** (33 568 byte) |
| `content_hash` | **không** nằm trong câu `INSERT` — cột GENERATED, Postgres tự tính |
| Kiểm tra sau khi chèn | khối `DO` đọc lại dòng vừa ghi và **RAISE nếu hash ≠ `fb62bd47…c70c98`**, hoặc nếu `scope`/`approved_by`/`approved_at`/`effective_at` khác quyết định |
| Chạy lại | `ON CONFLICT DO NOTHING` ⇒ vô hại; nhưng nếu môi trường **đã có** một `seller-rules/v1` khác, migration **ĐỎ** thay vì im lặng |

Nghĩa là ở §5, kiểm cho #19 không phải "có dòng nào không" mà là: migration
chạy xong **không lỗi**. Nếu nó lỗi, môi trường đó đang giữ một văn bản khác và
**không được sửa bằng UPDATE** — trigger bất biến sẽ từ chối, và đúng như vậy.

> ⏰ **`effective_at = 2026-08-14T00:00:00+07:00`.** Áp #19 trước thời điểm đó
> là hợp lệ và **không** mở cửa ngay: `legal_current_document()` chưa trả về gì,
> nên `shop_application_submit()` vẫn từ chối bằng `seller_rules_not_published`
> cho tới nửa đêm 14/08. Đó là hành vi đúng, không phải một lần áp hỏng.

**Thứ tự thi hành:** file 1-3 → **Packet C** (deploy function) → file 4-20.

🔴 **#20 phải được áp TRƯỚC khi bất kỳ môi trường nào bật cron dọn ảnh.** Nó là
bản vá B13: trước nó, vòng quét orphan coi logo/ảnh bìa đang sống là rác. Bật
cron trước #20 là mất ảnh của người bán, không phải một cảnh báo.

Nếu áp #4 trước khi function tồn tại, cron sẽ ghi 404 vào `net._http_response`
mỗi 5 phút. Không nguy hiểm, nhưng nó làm mờ tín hiệu sức khoẻ đầu tiên — và
tín hiệu đó là thứ ta cần đọc được ngay lúc đó.

---

## 4. Lệnh chính xác

```sh
PAT=$(grep -o 'sbp_[A-Za-z0-9_]*' ~/Downloads/secrets.local.md | head -1)

# B-1: REF=utokwfcljxjkpkaqgheo      B-2: REF=ajvlcamxemgbxduhiqrl
# Gõ tường minh, mỗi lần. Không để một biến từ phiên trước quyết định hộ.
REF=<ĐIỀN>

# Chứng minh mục tiêu TRƯỚC — packet-s-staging.md §8. Đọc kết quả, đừng liếc.
curl -s -H "Authorization: Bearer $PAT" \
  "https://api.supabase.com/v1/projects/$REF" | jq '{name, region}'

apply() {   # apply <đường-dẫn-file>
  echo "── $1"
  jq -Rs '{query: ("SELECT 1;\n" + .)}' "$1" > /tmp/q.json
  curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
    -d @/tmp/q.json
  echo
}

apply supabase/migrations/20260811090000_shop_phase1_seller_onboarding.sql
# … KIỂM (§5) … rồi file tiếp theo. MỘT file mỗi lần. KHÔNG dồn.
```

Bốn điều bắt buộc, đều là bài học từ production:

1. **Chứng minh mục tiêu trước lần ghi đầu tiên.** Ở B-1, `name` trả về
   `thepicklehub-prod` là lệnh dừng.
2. **`SELECT 1;` ở đầu mỗi payload.** Câu lệnh đầu tiên đôi khi bị nuốt im lặng
   và trả về `[]` mà không làm gì.
3. **Một file mỗi lần, kiểm sau mỗi file.** Không dồn 20 file vào một request.
4. **Không `db push`, không `db push --include-all`.** Ledger remote có drift
   nặng có sẵn.

> Trên **staging** ledger bắt đầu từ 0 và 20 file Shop là 20 file cuối trong một
> lượt áp đầy đủ 353 file. Cách rẻ hơn nhiều: `npx supabase db reset` không dùng
> được với remote, nên staging vẫn phải nhận đủ 353 file qua cùng cơ chế này,
> hoặc qua `supabase db push` **trên một project sạch, không có drift** — đó là
> lựa chọn duy nhất trong tài liệu này nơi `db push` an toàn, chính xác vì
> staging chưa có gì để lệch.

### Ghi ledger — chỉ cho file THẬT SỰ áp

```sh
# Sau mỗi file, và chỉ khi §5 xanh:
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260811090000', 'shop_phase1_seller_onboarding')
ON CONFLICT (version) DO NOTHING;
```

⚠️ **Không chèn ledger cho 12 migration không thuộc Shop.** 11 trong số đó đã
áp và chỉ thiếu dòng ledger, nhưng **file thứ 12 —
`20260805150000_news_source_ppa_tour_pause` — thật sự CHƯA áp**. Chèn cả lô sẽ
đánh dấu nó "đã áp" trong khi nguồn tin PPA vẫn hỏng trên production. Đó là việc
riêng, không thuộc packet này.

---

## 5. Xác nhận sau mỗi file

Truy vấn đầy đủ: [`../migration-deployment.md` §8](../migration-deployment.md).
Sáu cột mốc:

| Sau file | Kiểm | Kỳ vọng |
|---|---|---|
| #1 | `to_regclass('public.shop_pilot_members')`, `shop_pilot_has_access` tồn tại, `audit_logs_resource_type_check` chứa `shop_product` | đều đúng |
| #2 | `to_regclass('public.products')`, 2 bucket Shop, `shop-product-media-draft` có `public = false` | đều đúng |
| #3 | `to_regclass('public.shop_media_cleanup_jobs')` và `…_health` | đều đúng |
| #17 | `to_regclass('public.shop_slug_history')` | đúng |
| #18 | `to_regclass('public.legal_documents')`, `legal_acceptances`; **đúng 1** `shop_application_submit`; `legal_current_document('seller-rules')` trả **0 dòng** | đúng — 0 dòng là tình trạng đúng: chưa có quy chế nào được ban hành |
| #19 | `SELECT version, content_hash, approved_by, approved_at, effective_at FROM public.legal_documents WHERE document_key='seller-rules'` | **đúng 1 dòng**: `v1` · `fb62bd471d7b6b27c53d9eeded57dd636aa2f1f1f03db9a4a20abd49d7c70c98` · `Cuong Nguyen — Product Owner, ThePickleHub` · `2026-08-13 07:30:00+07` · `2026-08-14 00:00:00+07`. Migration tự kiểm bốn thứ này rồi, nên **lỗi khi áp = môi trường đang giữ văn bản khác** |
| #20 | `SELECT count(*) FROM public.shop_media_referenced_objects();` chạy được, và `to_regprocedure('public.shop_media_referenced_objects()')` không NULL | có hàm, và **không** cấp quyền cho `authenticated` — chỉ `service_role`. 🔴 Không bật cron dọn ảnh trước file này |

Smoke ẩn danh sau #17, trước khi có bất kỳ người dùng nào:

```sql
SELECT 1;
SELECT (SELECT count(*) FROM public.shop_applications)  AS apps,        -- 0 hoặc lỗi quyền
       (SELECT count(*) FROM public.product_categories) AS categories,  -- > 0
       (SELECT count(*) FROM public.public_products)    AS public_prods,-- 0
       (SELECT count(*) FROM public.shop_pilot_members) AS pilot;       -- 0
```

Bốn số đó là chân dung đúng của một pilot chưa mở: cổng đóng, danh mục sẵn sàng,
catalog rỗng, dữ liệu riêng tư không đọc được.

---

## 6. Thay đổi kỳ vọng

| Thứ | Trước | Sau |
|---|---|---|
| Ledger (B-2, production) | 325 | **345** |
| Ledger (B-1, staging) | 0 | **353** — staging nhận toàn bộ, không chỉ phần Shop |
| Bảng `public` | — | **+20** (18 Shop + `legal_documents` + `legal_acceptances`) |
| Enum | — | +10 |
| View | — | +3 |
| Hàm | — | +95 |
| Bucket | 5 | **7** |
| Policy `storage.objects` | 17 | **~24** |
| Cron job | 17 | **19** (sau #4) |
| Constraint bị sửa | — | **1** (`audit_logs_resource_type_check`, widen) |
| Hàm bị THAY THẾ | — | **1** (`shop_application_submit` — drop 0 tham số, tạo lại 1 tham số) |
| Dòng dữ liệu người dùng bị đổi | — | **0** |
| Dòng dữ liệu do migration ghi | — | **1** — Quy chế người bán v1 (`legal_documents`), file #19 |

---

## 7. Sau khi áp — generated types

**Không** làm trong cùng nhịp. Đây là thay đổi mã nguồn, có commit riêng và phải
qua đủ cổng:

```sh
npx supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl --schema public \
  > src/integrations/supabase/types.ts
grep -c "shop_pilot_members\|product_variants" src/integrations/supabase/types.ts   # ≥ 2
git rm src/integrations/supabase/shop-schema.ts src/integrations/supabase/shop-client.ts
# sửa import, rồi: npx tsc -b && npm test && npm run build
```

`--schema public` **bắt buộc** — không có nó, CLI cũ đã im lặng bỏ bảng.

---

## 8. Rollback

**Không có down migration. Repo forward-only.** Packet này không hứa ngược lại.

| Nếu | Làm |
|---|---|
| Một file lỗi giữa chừng | File đó chạy trong một transaction ⇒ đã tự rollback. Sửa, chạy lại file đó |
| Sai sau khi áp vài file | **Forward-fix**: viết migration mới. Không "gỡ" |
| Phải gỡ toàn bộ Shop | `DROP` theo thứ tự phụ thuộc ngược: view → function → bảng con → bảng cha → type → bucket. **Xoá dữ liệu người bán đã nhập** |
| Cần dừng gấp mà không đụng schema | **`DELETE FROM shop_pilot_members`** — đây là lối thoát đúng gần như mọi lúc |

Kịch bản cuối cùng đáng nhấn: **đóng cổng pilot dừng mọi hành động ghi của người
bán trong một câu lệnh**, không đụng schema, không đụng deploy, và đảo ngược
được. Với gần như mọi sự cố có thể tưởng tượng ở giai đoạn này, nó là câu trả
lời — không phải rollback schema.

---

## 9. Downtime / khoá

**Không downtime.** Thao tác dài nhất là revalidate constraint trên `audit_logs`:
2 851 dòng, dưới một giây, ACCESS EXCLUSIVE trên đúng bảng đó.

Cửa sổ duy nhất đáng ghi: giữa `DROP CONSTRAINT` và `ADD CONSTRAINT`, một INSERT
đồng thời có `resource_type` rác sẽ lọt. Cửa sổ tính bằng mili-giây và
`audit_logs` chỉ được ghi bởi `log_audit_event` với giá trị đến từ code. Ghi ra
vì câu hỏi phải được trả lời, không vì nó là rủi ro thật.

---

## 10. Ô ký

```
Packet B — áp 17 migration Shop lên ajvlcamxemgbxduhiqrl (PRODUCTION).

Tôi hiểu rằng:
  - không có project staging; đây là cơ sở dữ liệu production;
  - repo forward-only, không có down migration;
  - hoàn tác nghĩa là forward-fix hoặc DROP có mất dữ liệu;
  - shop_pilot_members rỗng nên không người dùng nào chạm được vào Shop;
  - main chưa có route Shop nên web production không đổi.

[ ] DUYỆT — ký: ____________  ngày: __________
[ ] TỪ CHỐI — lý do: _______________________________________________

Người thi hành: _____________  (KHÔNG phải subagent — RED tier)
Thời điểm thi hành: __________
Lần này là:  [ ] B-1 staging (utokwfcljxjkpkaqgheo)   [ ] B-2 production (ajvlcamxemgbxduhiqrl)
Câu chứng minh mục tiêu đã chạy và ĐỌC:  [ ] rồi   —  name trả về: ______________
Ledger trước: _____     Ledger sau: _____
```
