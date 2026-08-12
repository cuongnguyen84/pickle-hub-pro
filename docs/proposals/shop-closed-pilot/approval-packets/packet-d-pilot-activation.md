# Packet D — Kích hoạt pilot

> **TRẠNG THÁI: CHƯA DUYỆT. Không lệnh nào đã chạy.**
> Tier: 🔴 **RED** — người thật, dữ liệu thật, không có nút hoàn tác cho niềm tin.
> Nền: [`../pilot-contract.md`](../pilot-contract.md) · [`../pilot-allowlist.md`](../pilot-allowlist.md)

---

## 1. Packet này làm gì

Chèn UUID người bán đã duyệt vào `shop_pilot_members` trên
`ajvlcamxemgbxduhiqrl`. Trước đó, bảng rỗng và mọi hành động người bán bị từ
chối — **kể cả của Cuong, nếu Cuong không có vai admin.**

Đây là **một câu lệnh**, và nó là thứ biến hạ tầng thành một sản phẩm có người
dùng thật. Ba packet kia có thể sai và sửa được. Packet này sai nghĩa là một
người thật gặp một sản phẩm chưa sẵn sàng.

---

## 2. Chín đầu vào — Product Owner điền, agent không đoán

| # | Thứ | Giá trị |
|---|---|---|
| 1 | **UUID người bán pilot** (3–5) | ⬜ ⬜ ⬜ ⬜ ⬜ |
| 2 | **UUID admin trực kiểm duyệt** (đã có TOTP) | ⬜ |
| 3 | **Phiên bản quy chế** người bán chấp thuận | ⬜ (§4) |
| 4 | **Quyết định thông báo** — chấp nhận không có tự động? | ⬜ ([`../notification-decision.md`](../notification-decision.md)) |
| 5 | **Thời gian pilot** — bắt đầu → kết thúc | ⬜ → ⬜ |
| 6 | **Người trực kiểm duyệt** + SLA | ⬜ |
| 7 | **Người trực sự cố** ngoài giờ | ⬜ |
| 8 | **Giới hạn** số shop / số sản phẩm | ⬜ |
| 9 | **Ngưỡng số** cho tiêu chí dừng | ⬜ (§7) |

Remote hiện có **đúng 1** vai admin và **đúng 1** TOTP factor đã verify. Nếu #6
và #7 là cùng một người, và người đó là #2, thì pilot có **một điểm hỏng duy
nhất** — điều đó chấp nhận được với 3–5 người bán, nhưng phải là một lựa chọn
được nói ra, không phải một mặc định không ai để ý.

---

## 3. Cờ — trạng thái bắt buộc, kiểm lại trước khi chèn

| Cờ | Phải là | Kiểm bằng |
|---|---|---|
| `SHOP_PUBLIC_INDEXING` | **không tồn tại** ở cả Production lẫn Preview | mắt, dashboard |
| `sitemap-shop.xml` | **không tồn tại** | `curl /sitemap.xml \| grep -c shop` → 0 |
| IndexNow cho URL Shop | **chưa gửi lần nào** | — |
| `shop_pilot_members` | **rỗng** trước packet này | SQL |

---

## 4. 🔴 Điều kiện chặn — quy chế người bán

**"Quy chế người bán v1" chưa tồn tại**, và — quan trọng hơn — **việc gửi hồ sơ
không cưỡng chế chấp thuận nó**:

- `shop_applications` không có cột nào cho `rules_version`/`accepted_at`;
- `shop_application_submit()` xác thực 5 trường và **không** kiểm chấp thuận;
- ô đồng ý trong UI bị `disabled`, kèm dòng giải thích trung thực.

⇒ **Ô đồng ý bị khoá, nhưng việc gửi hồ sơ thì không.** Một người bán được duyệt
hôm nay sẽ không để lại bằng chứng chấp thuận điều khoản nào.

**Ba đường đi, Product Owner chọn một:**

| Đường | Điều kiện | Hệ quả |
|---|---|---|
| **D-a** | Chưa có quy chế | Chỉ chèn UUID **tài khoản test**, chạy smoke, **không mời người bán thật** |
| **D-b** | Có văn bản, chưa có cột bằng chứng | Mời người bán thật, chấp thuận lưu **ngoài hệ thống** (Zalo/email, lưu tay). Product Owner phải nói rõ chấp nhận điều này |
| **D-c** | Có văn bản + migration bằng chứng | Đường đi đầy đủ. Thiết kế ở [`../seller-rules-v1-outline.md` §4](../seller-rules-v1-outline.md) — **chỉ đề xuất, chưa viết migration** |

Đường đã chọn: ⬜ D-a  ⬜ D-b  ⬜ D-c

---

## 5. Lệnh chính xác

Đầy đủ, kèm bước phân giải email: [`../pilot-allowlist.md` §5](../pilot-allowlist.md).

### Bước 1 — phân giải, KHÔNG ghi gì

```sql
SELECT 1;
SELECT u.id, u.email, u.created_at, p.full_name,
       (SELECT count(*) FROM public.shop_pilot_members m WHERE m.user_id = u.id) AS already_member
FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('<EMAIL>');
```

**Dừng và đọc.** Đúng một dòng? Tên khớp người bán đã hẹn? `already_member = 0`?
Bất kỳ câu nào là "không" ⇒ **đừng sang bước 2**.

### Bước 2 — chèn, idempotent, có kiểm toán

```sql
SELECT 1;
WITH ins AS (
  INSERT INTO public.shop_pilot_members (user_id, added_by, note)
  VALUES ('<UUID>'::uuid, '<ADMIN_UUID>'::uuid, 'pilot wave <N> — <tên shop>, duyệt <ngày>')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id
)
SELECT public.log_audit_event(
  'shop_pilot_member_added'::text, 'admin'::text, 'user'::text,
  '<UUID>'::text, 'info'::text,
  jsonb_build_object('reason', 'pilot wave <N>', 'inserted', (SELECT count(*) FROM ins)),
  'user'::text);
```

⚠️ **Ép kiểu tường minh trên mọi tham số `log_audit_event` là bắt buộc.** Local
có hai overload; truyền literal không kiểu là `42725 function is not unique` —
lỗi đã từng phá **mọi** quyết định duyệt cho tới khi pgTAP bắt được.

### Bước 3 — kiểm lại

```sql
SELECT 1;
SELECT m.user_id, u.email, m.added_at, m.note
FROM public.shop_pilot_members m JOIN auth.users u ON u.id = m.user_id
ORDER BY m.added_at;
```

---

## 6. Wave — không mở cả năm người cùng lúc

| Wave | Ai | Cửa sổ quan sát | Điều kiện mở wave sau |
|---|---|---|---|
| **0** | Chỉ tài khoản test | tới khi smoke xanh | 24/24 kiểm, dữ liệu test đã dọn **và đã đếm lại** |
| **1** | **1** người bán thật | ≥ 48 giờ | Người đó đăng được ≥1 sản phẩm, duyệt được, hàng đợi ảnh sạch, 0 lỗi P1 |
| **2** | thêm 2–4 người | ≥ 72 giờ | Như trên, cộng: chưa lần nào quên nhắn tay |
| **3** | mở rộng | — | Nghiệm thu riêng của Product Owner |

Mỗi wave cần **chấp thuận riêng**. Chữ ký ở §9 chỉ mở Wave 0 và Wave 1.

---

## 7. Tiêu chí dừng — sự kiện đã có, ngưỡng cần điền

Dừng **ngay** khi bất kỳ điều nào xảy ra ([`../pilot-contract.md` §7](../pilot-contract.md)):

rò rỉ dữ liệu/ảnh riêng tư · người bán đọc/ghi được shop khác · thao tác admin
qua được không cần AAL2 · worker dọn ảnh không xoá được byte · sản phẩm công
khai trước khi duyệt · sản phẩm bị đình chỉ vẫn công khai · route Shop mất
noindex hoặc vào sitemap · Google lập chỉ mục một URL Shop · hỏng dữ liệu ·
lỗi tăng vọt không kiểm soát.

Ngưỡng số cần Product Owner điền:

| Chỉ số | Ngưỡng |
|---|---|
| Tỉ lệ 5xx trên route Shop trong 15 phút | ⬜ % |
| Số chữ ký lỗi mới trong 24 giờ | ⬜ |
| Job dọn ảnh `pending` lâu nhất | ⬜ phút *(đề xuất: 30)* |
| Hồ sơ/sản phẩm chờ duyệt lâu nhất | ⬜ giờ *(đề xuất: 48)* |
| Số lần quên nhắn tay mỗi tuần | ⬜ |

---

## 8. Kill switch — và giới hạn của nó

```sql
SELECT 1;
SELECT public.log_audit_event(
  'shop_pilot_closed'::text, 'admin'::text, 'user'::text, NULL::text, 'critical'::text,
  jsonb_build_object('reason', '<vì sao>',
                     'members', (SELECT jsonb_agg(user_id) FROM public.shop_pilot_members)),
  'user'::text);
DELETE FROM public.shop_pilot_members;
```

Danh sách UUID được chụp **vào dòng kiểm toán trước khi xoá**, nên mở lại pilot
là đọc dòng đó chứ không phải nhớ lại.

🔴 **Nó KHÔNG dừng cái gì** — phải biết trước khi bấm, không phải sau:

| Vẫn hoạt động | Vì sao |
|---|---|
| Người bán **đọc** dữ liệu shop của họ | Q1 — `shop_members` cho quyền đọc |
| Sản phẩm **đã publish vẫn công khai** | Publish là trạng thái trên `products` |
| Ảnh công khai vẫn tải được | Byte đã ở bucket public |

⇒ **Đóng cổng là đóng băng, không phải gỡ xuống.** Gỡ nội dung xuống là
`product_decide('suspend')` hoặc `shops.state = 'suspended'` —
[`../operations.md` §5.2](../operations.md), kèm bẫy `is_admin()` khiến một
`UPDATE` qua psql thành **no-op câm**.

---

## 9. Ô ký

```
Packet D — kích hoạt closed pilot trên ajvlcamxemgbxduhiqrl.

Điều kiện tiên quyết:
  [ ] Packet A, B, C đã duyệt và đã thi hành
  [ ] Nghiệm thu preview PASS — 24/24, dữ liệu test đã dọn VÀ ĐÃ ĐẾM LẠI
  [ ] SHOP_PUBLIC_INDEXING không tồn tại ở cả hai môi trường (xác nhận bằng mắt)
  [ ] Sitemap không nhắc tới Shop
  [ ] Đã chọn đường quy chế: __ D-a  __ D-b  __ D-c

Chín đầu vào ở §2 đã điền:            [ ] có
Ngưỡng tiêu chí dừng ở §7 đã điền:    [ ] có
Quyết định thông báo đã ký:           [ ] có   ([ ] chấp nhận  [ ] không chấp nhận)

Tôi hiểu rằng:
  - việc gửi hồ sơ KHÔNG cưỡng chế chấp thuận quy chế (§4);
  - pilot không có thông báo tự động; liên lạc là thủ công theo runbook;
  - đóng cổng pilot đóng băng người bán, KHÔNG gỡ nội dung công khai xuống;
  - chỉ có một admin, và mất authenticator là mất quyền kiểm duyệt.

[ ] DUYỆT WAVE 0 (chỉ tài khoản test) — ký: __________  ngày: ________
[ ] DUYỆT WAVE 1 (1 người bán thật)   — ký: __________  ngày: ________
[ ] TỪ CHỐI — lý do: ____________________________________________

UUID đã chèn: ______________________________________________
Người thi hành: _____________  (KHÔNG phải subagent — RED tier)
```
