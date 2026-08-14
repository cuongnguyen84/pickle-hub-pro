# CP6 — Danh sách người bán thí điểm: công cụ và quy trình

> `shop_pilot_members` là cổng vào **và** là kill switch của pilot. Tài liệu này
> nói cách thêm, bớt và kiểm nó — và vì sao chưa xây màn hình quản trị cho nó.
>
> **Không dòng nào được chèn trong đợt chuẩn bị này.** Thi hành:
> [`approval-packets/packet-d-pilot-activation.md`](./approval-packets/packet-d-pilot-activation.md).

---

## 1. Bảng, đúng như nó đang có

```sql
CREATE TABLE public.shop_pilot_members (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note     TEXT
);
```

RLS bật. Hai policy:

- `shop_pilot_members_select_self` — đọc dòng của chính mình, hoặc admin đọc tất cả.
- `shop_pilot_members_admin_write` — `FOR ALL` với `USING (is_admin())` và
  `WITH CHECK (is_admin())`.

Grant: `SELECT` + `INSERT, UPDATE, DELETE` cho `authenticated` — **nhưng** policy
`admin_write` chặn mọi thao tác ghi của người không phải admin. Grant rộng, policy
hẹp; đây là đúng thứ tự của repo (grant kiểm trước RLS, và thiếu grant là lớp lỗi
đã hai lần quét sửa).

Vì `is_admin()` đòi AAL2 từ 30/07, **mọi ghi từ một phiên người dùng đều đã bắt
buộc TOTP.** Không cần thêm cổng nào.

---

## 2. Ba khoảng trống thật, nói thẳng

| # | Khoảng trống | Hệ quả |
|---|---|---|
| 1 | **Không có `removed_by` / `removed_at`** | Gỡ một người là `DELETE` — lịch sử biến mất. Ai gỡ, khi nào, vì sao: không lưu ở đâu |
| 2 | **Không có màn hình quản trị** | Không có route `/admin/shop/pilot`. Quản lý bằng SQL |
| 3 | **Thao tác qua Management API bỏ qua AAL2** | PAT nói chuyện với Postgres ở tầng dưới `auth.uid()`; `is_admin()` không chạy. Đây **không** phải lỗ hổng — nó là quyền của người giữ PAT — nhưng nó nghĩa là "AAL2 bắt buộc" chỉ đúng cho đường đi qua UI |

Khoảng trống 1 quan trọng hơn vẻ ngoài của nó, vì **gỡ khỏi bảng này chính là
kill switch**. Nếu ai đó đóng pilot lúc 2 giờ sáng, sáng hôm sau không có gì nói
được là ai và vì sao.

---

## 3. Quyết định: SQL người vận hành, **không** xây UI

Ba lý do, theo thứ tự sức nặng:

1. **Pilot có 3–5 người bán và một admin.** Một màn hình CRUD cho năm dòng là
   công việc, bề mặt tấn công và chunk bundle mới, đổi lấy tiện lợi cho một
   người dùng.
2. **Gói này đang chờ duyệt.** Thêm migration thứ 18 vào một danh sách 17 file
   đã kiểm xong là kéo dài vòng phê duyệt để phục vụ tiện lợi.
3. **Bằng chứng kiểm toán lấy được mà không cần bảng mới.** `log_audit_event()`
   đã tồn tại trên remote với đúng một overload, và `resource_type = 'user'` đã
   nằm trong CHECK hiện hành. Một câu `PERFORM` trong chính đoạn SQL vận hành
   cho đúng thứ mà bảng lịch sử sẽ cho.

Khoảng trống 1 do đó được vá **bằng quy trình**, không bằng schema: đoạn SQL ở
§5 ghi một dòng `audit_logs` cho cả thêm lẫn bớt, và dòng đó là append-only theo
bản chất của bảng.

Thiết kế RPC + UI, cho khi nào pilot lớn hơn: §8. **Đề xuất, chưa viết migration.**

---

## 4. Không bao giờ dùng email làm khoá uỷ quyền

Khoá là `auth.users.id`. Email đổi được, gộp được, gõ sai được — `user_id` thì
không.

Quy trình cho phép admin **nhập email để tra cứu**, nhưng bước xác nhận phải hiển
thị UUID và một trường nhận dạng thứ hai, và bước ghi dùng UUID đó. Ba bước, không
được rút gọn thành một:

```
email  →  server phân giải  →  người vận hành xác nhận đúng người  →  ghi UUID
```

---

## 5. Quy trình vận hành — SQL chính xác

Mọi câu chạy qua Management API query endpoint theo `ops-runbook.md` §1, luôn
mở đầu bằng `SELECT 1;` (câu đầu tiên đôi khi bị nuốt) và luôn kiểm lại sau khi ghi.

### 5.1 Bước 1 — phân giải email, KHÔNG ghi gì

```sql
SELECT 1;
SELECT u.id,
       u.email,
       u.created_at,
       u.last_sign_in_at,
       p.full_name,
       (SELECT count(*) FROM auth.mfa_factors f
         WHERE f.user_id = u.id AND f.status = 'verified')      AS mfa_factors,
       (SELECT count(*) FROM public.shop_pilot_members m
         WHERE m.user_id = u.id)                                AS already_member
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('<EMAIL>');
```

**Dừng và đọc.** Đúng một dòng? Tên khớp người bán đã hẹn? `already_member = 0`?
Nếu bất kỳ câu nào là "không", **đừng** sang bước 2.

### 5.2 Bước 2 — thêm, idempotent, có kiểm toán

```sql
SELECT 1;
WITH ins AS (
  INSERT INTO public.shop_pilot_members (user_id, added_by, note)
  VALUES ('<UUID>'::uuid, '<ADMIN_UUID>'::uuid, '<lý do, ví dụ: pilot wave 1 — cửa hàng X, duyệt 2026-08-14>')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id
)
SELECT public.log_audit_event(
  'shop_pilot_member_added'::text,
  'admin'::text,
  'user'::text,
  '<UUID>'::text,
  'info'::text,
  jsonb_build_object('reason', '<lý do>', 'inserted', (SELECT count(*) FROM ins)),
  'user'::text
);
```

Ba điểm, không cái nào là trang trí:

- `ON CONFLICT DO NOTHING` ⇒ chạy lại là no-op, không phải lỗi.
- Ép kiểu tường minh trên **mọi** tham số `log_audit_event`. Local có hai
  overload; truyền literal không kiểu là `42725 function is not unique`, và đó
  là lỗi đã từng phá **mọi** quyết định duyệt cho tới khi pgTAP bắt được.
- `inserted` ghi lại việc dòng đã có sẵn hay chưa — phân biệt "thêm mới" với
  "chạy lại", điều mà chỉ nhìn bảng không nói được.

**Kiểm ngay:**

```sql
SELECT 1;
SELECT m.user_id, u.email, m.added_at, m.added_by, m.note
FROM public.shop_pilot_members m JOIN auth.users u ON u.id = m.user_id
ORDER BY m.added_at;
```

### 5.3 Bước 3 — gỡ một người (và ghi lại là ai gỡ)

```sql
SELECT 1;
SELECT public.log_audit_event(
  'shop_pilot_member_removed'::text, 'admin'::text, 'user'::text,
  '<UUID>'::text, 'warning'::text,
  jsonb_build_object('reason', '<lý do>', 'operator', '<tên người vận hành>'),
  'user'::text
);
DELETE FROM public.shop_pilot_members WHERE user_id = '<UUID>'::uuid;
```

**Ghi kiểm toán TRƯỚC khi xoá.** Nếu `DELETE` lỗi, ta có một dòng kiểm toán thừa
— khó chịu nhưng vô hại. Nếu xoá trước rồi ghi lỗi, ta mất bằng chứng duy nhất
về việc ai đã gỡ ai.

### 5.4 Kill switch — đóng toàn bộ pilot

```sql
SELECT 1;
SELECT public.log_audit_event(
  'shop_pilot_closed'::text, 'admin'::text, 'user'::text, NULL::text,
  'critical'::text,
  jsonb_build_object(
    'reason', '<vì sao>',
    'members', (SELECT jsonb_agg(user_id) FROM public.shop_pilot_members)),
  'user'::text
);
DELETE FROM public.shop_pilot_members;
```

Danh sách UUID được chụp **vào dòng kiểm toán trước khi xoá**, nên mở lại pilot
là đọc dòng đó chứ không phải nhớ lại.

Giới hạn của kill switch — bắt buộc phải biết trước khi bấm:
[`operations.md` §5](./operations.md).

---

## 6. Kiểm khô (dry run) — chạy được ngay hôm nay, cục bộ

Toàn bộ đoạn §5 chạy được trên stack cục bộ mà không chạm remote:

```sh
# 1. Đảm bảo cơ sở dữ liệu cục bộ có schema Shop
npx supabase db reset --local

# 2. Bảng phải rỗng và cổng phải đóng
docker exec supabase_db_ajvlcamxemgbxduhiqrl psql -U postgres -d postgres -At \
  -c "SELECT count(*) FROM public.shop_pilot_members;"
# kỳ vọng: 0

# 3. Thử §5.2 với một user thật trong auth.users cục bộ, rồi §5.3 để hoàn tác
# 4. Xác nhận hai dòng kiểm toán tồn tại
docker exec supabase_db_ajvlcamxemgbxduhiqrl psql -U postgres -d postgres \
  -c "SELECT event_type, resource_id, severity, metadata FROM public.audit_logs
      WHERE event_type LIKE 'shop_pilot%' ORDER BY created_at;"
```

Bốn bước đó là toàn bộ nội dung §5 được chứng minh trên một cơ sở dữ liệu thật,
không phải trên niềm tin rằng SQL đúng cú pháp.

`scripts/shop-closed-pilot-smoke.mjs` cũng khẳng định trạng thái allowlist ở
kiểm 3 và 4 (`ngoài danh sách bị chặn` / `trong danh sách vào được`) —
[`acceptance.md`](./acceptance.md).

---

## 7. Điều KHÔNG được làm

- ❌ Không chèn UUID nào trong đợt chuẩn bị. Bảng phải rỗng cho tới Packet D.
- ❌ Không cho phép tự đăng ký vào pilot. Không có policy INSERT cho người nộp,
  và đừng thêm.
- ❌ Không dùng email làm khoá ghi.
- ❌ Không `DELETE` mà không ghi kiểm toán trước.
- ❌ Không thêm ai vào allowlist trước khi có "Quy chế người bán v1", trừ tài
  khoản test dùng cho smoke — và tài khoản test phải nằm trong danh sách dọn.

---

## 8. Nếu pilot lớn hơn — thiết kế RPC và UI

**Đề xuất. Không có migration nào được viết hay áp.**

Ngưỡng kích hoạt: quá ~10 người bán, hoặc có người thứ hai trực kiểm duyệt.

```sql
-- ĐỀ XUẤT, chưa tồn tại.

CREATE OR REPLACE FUNCTION public.shop_pilot_lookup(_email TEXT)
RETURNS TABLE (user_id UUID, email TEXT, full_name TEXT, already_member BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN            -- ⇒ đòi AAL2
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name,
         EXISTS (SELECT 1 FROM public.shop_pilot_members m WHERE m.user_id = u.id)
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(_email);
END $$;

CREATE OR REPLACE FUNCTION public.shop_pilot_add(_user_id UUID, _reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inserted BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.shop_pilot_members (user_id, added_by, note)
  VALUES (_user_id, auth.uid(), _reason)
  ON CONFLICT (user_id) DO NOTHING;
  _inserted := FOUND;

  PERFORM public.log_audit_event(
    'shop_pilot_member_added'::text, 'admin'::text, 'user'::text,
    _user_id::text, 'info'::text,
    jsonb_build_object('reason', _reason, 'inserted', _inserted), 'user'::text);

  RETURN _inserted;
END $$;

-- shop_pilot_remove(_user_id, _reason): ghi kiểm toán TRƯỚC, rồi DELETE.
```

Quyết định đi kèm, nếu bao giờ xây:

- **Vẫn không thêm `removed_by`/`removed_at` vào bảng.** Bảng là danh sách quyền
  hiện tại; lịch sử thuộc về `audit_logs`. Trộn hai thứ vào một bảng là cách
  người ta bắt đầu `SELECT * WHERE removed_at IS NULL` rồi quên mất một chỗ.
- `_reason` **bắt buộc**, không mặc định. Một quyết định quyền không có lý do là
  một quyết định không ai kiểm được.
- pgTAP tối thiểu: người không phải admin bị `42501` · phiên aal1 bị chặn · thêm
  hai lần chỉ một dòng · gỡ ghi kiểm toán trước · lý do rỗng bị từ chối.
- UI, nếu có: `/admin/shop/pilot`, lazy chunk riêng, sau `AdminMFAGate`, và
  **bắt buộc bước xác nhận hiển thị UUID** — không phải một ô email với nút Lưu.
