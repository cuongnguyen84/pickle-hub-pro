# Packet B — Migration cơ sở dữ liệu

> **TRẠNG THÁI: CHƯA DUYỆT. Không lệnh nào đã chạy.**
> Tier: 🔴 **RED** — `git revert` không hoàn tác SQL đã chạy.
> Nền: [`../migration-deployment.md`](../migration-deployment.md)

---

## 1. Mục tiêu

| Thứ | Giá trị |
|---|---|
| Project ref | **`ajvlcamxemgbxduhiqrl`** (`thepicklehub-prod`, ap-northeast-1) |
| Phương thức | Management API query endpoint (`ops-runbook.md` §1) |
| Nền tảng | `f172a441`, nhánh `feat/shop-closed-pilot` |
| Số file | **17** |

**Không có project staging.** Áp lên đây nghĩa là áp lên production. Xem
[`../environment-audit.md` §5](../environment-audit.md) — đây là quyết định
Product Owner phải nói "được", không phải điều suy ra từ việc nó an toàn.

---

## 2. Vì sao an toàn để làm trước khi có ai duyệt pilot

| Sự thật | Đo bằng |
|---|---|
| Remote **chưa có** object Shop nào — 0 bảng, 0 type, 0 function, 0 bucket, 0 cron job | probe chỉ đọc 2026-08-12 |
| **Không va chạm tên** với bất cứ thứ gì đang chạy | như trên |
| Mọi object đều **thêm mới**; đúng 1 constraint có sẵn được **widen** | đọc 17 file |
| `main` **không có** route Shop ⇒ web production không đổi một pixel | `git diff` |
| `shop_pilot_members` rỗng ⇒ mọi hành động người bán bị từ chối | thiết kế |
| Thao tác đắt nhất là revalidate constraint trên `audit_logs` (2 851 dòng / 2 328 kB) | **< 1 giây** |

Không cần cửa sổ bảo trì. Không cần dừng cron.

---

## 3. Migration đang chờ — 17, đúng thứ tự

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
```

**Thứ tự thi hành:** file 1-3 → **Packet C** (deploy function) → file 4-17.

Nếu áp #4 trước khi function tồn tại, cron sẽ ghi 404 vào `net._http_response`
mỗi 5 phút. Không nguy hiểm, nhưng nó làm mờ tín hiệu sức khoẻ đầu tiên — và
tín hiệu đó là thứ ta cần đọc được ngay lúc đó.

---

## 4. Lệnh chính xác

```sh
PAT=$(grep -o 'sbp_[A-Za-z0-9_]*' ~/Downloads/secrets.local.md | head -1)
REF=ajvlcamxemgbxduhiqrl

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

Ba điều bắt buộc, đều là bài học từ production:

1. **`SELECT 1;` ở đầu mỗi payload.** Câu lệnh đầu tiên đôi khi bị nuốt im lặng
   và trả về `[]` mà không làm gì.
2. **Một file mỗi lần, kiểm sau mỗi file.** Không dồn 17 file vào một request.
3. **Không `db push`, không `db push --include-all`.** Ledger remote có drift
   nặng có sẵn.

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
Bốn cột mốc:

| Sau file | Kiểm | Kỳ vọng |
|---|---|---|
| #1 | `to_regclass('public.shop_pilot_members')`, `shop_pilot_has_access` tồn tại, `audit_logs_resource_type_check` chứa `shop_product` | đều đúng |
| #2 | `to_regclass('public.products')`, 2 bucket Shop, `shop-product-media-draft` có `public = false` | đều đúng |
| #3 | `to_regclass('public.shop_media_cleanup_jobs')` và `…_health` | đều đúng |
| #17 | `to_regclass('public.shop_slug_history')`; `count(*) FROM schema_migrations` | `= 325 + số file đã áp` |

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
| Ledger | 325 | 342 |
| Bảng `public` | — | +18 |
| Enum | — | +10 |
| View | — | +3 |
| Hàm | — | +95 |
| Bucket | 5 | **7** |
| Policy `storage.objects` | 17 | **~24** |
| Cron job | 17 | **19** (sau #4) |
| Constraint bị sửa | — | **1** (`audit_logs_resource_type_check`, widen) |
| Dòng dữ liệu người dùng bị đổi | — | **0** |

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
Ledger trước: 325     Ledger sau: _____
```
