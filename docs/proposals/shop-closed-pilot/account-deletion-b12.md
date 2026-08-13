# B12 — xoá tài khoản khi người đó đang sở hữu một shop

> **Trạng thái: PHÂN TÍCH + ĐỀ XUẤT. Chưa implement gì.**
>
> Chỉ có hai file được thêm, cả hai đều là **chẩn đoán** và không đổi hành vi
> production:
> `scripts/shop-account-deletion-b12.test.mjs` ·
> `supabase/tests/shop_media_reconcile_profile_gap.test.sql`.
>
> Không migration, không đổi RLS/RPC, không sửa `delete-account`, không sửa UI.

---

## 0. Ba phát hiện, xếp theo mức độ

| # | Phát hiện | Đo bằng | Ảnh hưởng |
|---|---|---|---|
| **1** | 🔴 `delete-account` **báo thành công trong khi toàn bộ 13 bước dọn dữ liệu của nó thất bại**. Tài khoản vẫn bị xoá — nhưng chỉ nhờ CASCADE của `auth.users`. Phần dọn tường minh đã là **trang trí** | gọi thật hàm edge, đọc `warnings` trong body 200 | Không mất dữ liệu, nhưng mọi suy luận dựa trên "hàm này dọn bảng X" đều sai |
| **2** | 🔴 Hộp thoại xoá tài khoản **nói sai**: nó hứa xoá "các giải đấu bạn đã tạo", nhưng `quick_tables` và `team_match_tournaments` là `SET NULL` — chúng **sống sót**, chỉ mất tên người tạo | catalog FK | Một lời hứa không đúng với người dùng, có sẵn từ trước Shop |
| **3** | 🔴 **B13 (mới)**: `shop_media_reconcile()` xếp **logo/ảnh bìa đang sống** vào hàng đợi xoá, vì nó chỉ biết `product_media`. Chưa bao giờ xảy ra **chỉ vì cron chưa từng được deploy** | pgTAP chạy thật hàm đó: `orphans_queued = 1`, đúng đường dẫn logo | **Chặn Packet C.** Môi trường đầu tiên bật cron sẽ mất mọi logo sau 1 giờ |

B12 như đề bài — "chủ shop không xoá được tài khoản" — là **đúng**, và là cái ít
nguy hiểm nhất trong ba cái.

---

## 1. Truy dấu call site production

```
src/pages/Account.tsx
  └── src/components/account/DeleteAccountDialog.tsx      gõ "DELETE" để xác nhận
        └── src/hooks/useDeleteAccount.ts                 useMutation
              └── supabase.functions.invoke("delete-account", { Authorization: Bearer <user JWT> })
                    └── supabase/functions/delete-account/index.ts   (verify_jwt = false, tự xác thực)
                          ├── supabaseUser.auth.getUser()            ES256 workaround
                          ├── 13 × supabaseAdmin.from(<table>).delete()   ← THẤT BẠI TOÀN BỘ (§2)
                          ├── storage.from("avatars").remove(...)
                          └── supabaseAdmin.auth.admin.deleteUser(userId)   ← chỗ RESTRICT chặn
```

**Không có RPC nào tham gia.** Không có edge function nào khác. Không có
`ON DELETE` trigger nào chạy trước. Đây là toàn bộ đường đi.

Điều hộp thoại làm và không làm:

- Có: bắt gõ đúng chữ `DELETE`, nói "không thể hoàn tác".
- Không: **không hỏi cơ sở dữ liệu xem người này có shop hay không**. Nút bật
  cho tất cả mọi người, kể cả người chắc chắn sẽ thất bại.

Khi thất bại, `useDeleteAccount.onError` hiện toast `Error` với thông điệp của
máy chủ. **Người dùng KHÔNG bị báo thành công giả** — nhưng thông điệp họ nhận là
`Failed to delete account`, và không có câu nào nói vì sao.

---

## 2. 🔴 Phát hiện 1 — hàm dọn dữ liệu không dọn được gì

Gọi thật, tài khoản bình thường, phản hồi **HTTP 200**:

```json
{"success":true,"message":"Account deleted successfully","warnings":[
 "notifications: permission denied for table notifications",
 "comments: permission denied for table comments",
 "likes: permission denied for table likes",
 "follows: column follows.follower_user_id does not exist",
 "quick_tables: permission denied for table quick_tables",
 "team_match_roster: permission denied for table team_match_roster",
 "team_match_tournaments: permission denied for table team_match_tournaments",
 "doubles_elimination_tournaments: permission denied for table doubles_elimination_tournaments",
 "partner_invitations: Could not find the table 'public.partner_invitations' in the schema cache",
 "partner_invitations: Could not find the table 'public.partner_invitations' in the schema cache",
 "user_roles: permission denied for table user_roles",
 "organization_members: Could not find the table 'public.organization_members' in the schema cache",
 "profiles: permission denied for table profiles"]}
```

Ba loại lỗi, cả ba đều im lặng:

- **10 × permission denied** — `service_role` **không có** quyền `DELETE` trên
  bất kỳ bảng nào trong danh sách. `service_role` đi vòng RLS nhưng **không đi
  vòng GRANT**; đây đúng là lớp lỗi mà repo này đã quét hai lần
  (`missing-grants-sweep-2`). Đáng chú ý: **toàn bộ bảng Shop thì có quyền**
  (`20260811160000` cấp đủ) — mười bảng thiếu quyền đều là bảng **có trước
  Shop**, tức là danh sách trong `delete-account` chưa từng nằm trong đợt quét
  nào.
- **2 bảng không tồn tại** — `partner_invitations`, `organization_members`.
- **1 cột đã đổi tên** — `follows.follower_user_id`.

`errors` được trả về dưới tên `warnings`, và **không có nơi nào trong client đọc
`warnings`**. `useDeleteAccount` chỉ nhìn `response.error`.

**Hệ quả quan trọng nhất:** việc xoá tài khoản hôm nay hoạt động **hoàn toàn nhờ
`ON DELETE CASCADE` từ `auth.users`**. Vòng lặp kia không đóng góp gì. Bất kỳ
phương án nào ở §5 mà giả định "hàm này đã dọn X rồi" đều xuất phát từ tiền đề sai.

> ⚠️ Đo trên cơ sở dữ liệu cục bộ dựng từ migration. **Chưa đo trên production**
> — chưa được phép đọc remote. Grant trên production có thể khác vì lịch sử
> drift; đây là một mục cần kiểm khi có quyền, không phải một kết luận về prod.

---

## 3. Bảng object — FK, hành vi, và cái gì phải giữ

Đọc từ `pg_constraint` trên cơ sở dữ liệu dựng từ migration, không phải từ trí nhớ.

### 3.1 Trực tiếp trỏ vào `auth.users`

| Object | FK | Khi xoá user | Phải xoá | Phải giữ (audit/pháp lý) | Cần ẩn danh |
|---|---|---|---|---|---|
| `shops.owner_user_id` | **RESTRICT** | 🔴 **chặn toàn bộ** | — | shop là thực thể công khai, không xoá theo người | — |
| `shop_members.user_id` | CASCADE | mất tư cách thành viên | ✅ | — | — |
| `shop_applications.applicant_user_id` | CASCADE | hồ sơ biến mất | ✅ hồ sơ chứa họ tên/SĐT/địa chỉ | ⚠️ **quyết định duyệt** biến mất cùng | — |
| `shop_applications.decided_by` | SET NULL | ai duyệt → NULL | — | ✅ | ✅ tự động |
| `shop_application_events.actor_user_id` | SET NULL | nhật ký còn, tác giả → NULL | — | ✅ | ✅ tự động |
| `legal_acceptances.user_id` | CASCADE | **bằng chứng chấp thuận biến mất** | ✅ theo thiết kế CP12 | ⚠️ xem §3.4 | — |
| `shop_pilot_members.user_id` | CASCADE | rời allowlist | ✅ | — | — |
| `shop_pilot_members.added_by` | SET NULL | ai thêm → NULL | — | ✅ | ✅ tự động |
| `shop_contact_channels.approved_by` | SET NULL | ai duyệt kênh → NULL | — | ✅ | ✅ tự động |
| `shop_contact_moderation_events.actor_user_id` | SET NULL | nhật ký còn | — | ✅ | ✅ tự động |
| `product_moderation_events.actor_user_id` | SET NULL | nhật ký còn | — | ✅ | ✅ tự động |
| `product_submission_events.actor_user_id` | SET NULL | nhật ký còn | — | ✅ | ✅ tự động |
| `products.decided_by` | SET NULL | ai duyệt sản phẩm → NULL | — | ✅ | ✅ tự động |
| `inventory_movements.actor_user_id` | SET NULL | lịch sử kho còn | — | ✅ | ✅ tự động |
| `audit_logs.actor_id` → `profiles` | SET NULL | nhật ký còn, tác giả → NULL | — | ✅ | ✅ tự động |

**Mọi cột "ai đã làm việc này" đều đã là `SET NULL`.** Ẩn danh không cần viết
thêm dòng nào — nó đã là hành vi mặc định của schema.

### 3.2 Treo dưới `shops` (chỉ chạm tới khi shop bị xoá)

Tất cả đều `CASCADE` từ `shops`, nên xoá một shop là xoá cả cây:

`products` → `product_variants`, `product_media`, `product_slug_history`,
`product_moderation_events`, `product_submission_events`, `inventory_movements`
· `shop_members` · `shop_contact_channels` → `shop_contact_moderation_events`
· `shop_profile_media` · `shop_slug_history` · và `shop_applications.shop_id`
→ **SET NULL** (hồ sơ sống sót, mất con trỏ tới shop).

### 3.3 Media và hàng đợi dọn ảnh

`shop_media_cleanup_jobs` **không có FK nào** và **không có trigger nào chạy khi
xoá**. Nghĩa là: xoá một shop **không** xếp hàng dọn ảnh. Object trong Storage
trở thành mồ côi.

Cái vớt lại là `shop_media_reconcile()`: nó quét bucket và xếp hàng những object
không còn dòng nào trỏ tới — **1 giờ** với bucket công khai, **24 giờ** với
bucket nháp. Nên ảnh sản phẩm **cuối cùng vẫn được dọn**, miễn là cron chạy.

🔴 **Và ở đây có B13** — xem §6. Cùng cơ chế đó hiện xoá cả ảnh **đang sống**.

### 3.4 Câu hỏi khó: bằng chứng chấp thuận biến mất cùng tài khoản

`legal_acceptances.user_id` là CASCADE, có chủ ý (CP12: *"một chữ ký sống lâu hơn
con người không phải bằng chứng, đó là lỗi lưu trữ"*).

Nhưng nó tạo ra một tình huống có thật: người bán chấp thuận quy chế, bán hàng,
có tranh chấp, **rồi xoá tài khoản** — và bằng chứng họ từng đồng ý biến mất.

Trong pilot kín 3–5 người bán, không có đơn hàng và không có tiền, rủi ro này
**chấp nhận được**. Trước khi có thanh toán thì không, và lúc đó cần một quyết
định riêng (giữ bản ghi ẩn danh: hash + phiên bản + thời điểm, không kèm danh
tính). **Không thuộc phạm vi B12.**

---

## 4. Privacy vừa duyệt có hứa quá không?

**Chính sách bảo mật: KHÔNG.** Ba câu liên quan đều đúng với đo đạc:

| Câu trong Privacy | Sự thật |
|---|---|
| "Hồ sơ đăng ký và bằng chứng chấp thuận bị xoá cùng tài khoản" | ✅ cả hai đều CASCADE |
| "Nhật ký kiểm duyệt được giữ lại… nhưng không còn gắn với tài khoản đã xoá" | ✅ mọi `actor_*` đều SET NULL |
| "Nếu bạn đang sở hữu một shop, shop phải được xử lý trước thì tài khoản mới xoá được" | ✅ đúng nguyên văn hành vi RESTRICT |
| `rights.items.edit`: "Yêu cầu chỉnh sửa hoặc xóa tài khoản" | ✅ "yêu cầu", không phải "được xoá ngay" |

**Hộp thoại xoá tài khoản: CÓ, và nó sai từ trước khi có Shop.**

```
"Hành động này sẽ xóa vĩnh viễn tài khoản và tất cả dữ liệu của bạn, bao gồm:
   • Thông tin hồ sơ và ảnh đại diện        ✅ đúng (profiles CASCADE)
   • Các giải đấu bạn đã tạo                🔴 SAI
   • Bình luận, lượt thích và dữ liệu tương tác   ✅ đúng (CASCADE)
 Hành động này không thể hoàn tác."
```

`quick_tables.creator_user_id`, `team_match_tournaments.created_by` và
`team_match_roster.user_id` đều là **SET NULL**. Giải đấu **không bị xoá** — nó
ở lại, không còn người tạo. Câu thứ hai là một lời hứa không được giữ, và nó
không liên quan gì tới Shop; Shop chỉ làm nó lộ ra.

---

## 5. Ba phương án

### A — Xoá shop/catalog trước, rồi xoá auth user

| | |
|---|---|
| **Tính đúng dữ liệu** | Hoàn chỉnh: cây CASCADE dưới `shops` dọn sạch mọi thứ |
| **Audit/pháp lý** | 🔴 **Mất nhiều nhất.** Nhật ký kiểm duyệt sản phẩm, lịch sử kênh liên hệ, lịch sử slug, lịch sử kho — tất cả CASCADE theo shop. Một shop bị gỡ vì bán hàng giả sẽ **không để lại dấu vết nào** sau khi chủ nó bấm nút |
| **Media cleanup** | Dựa vào `shop_media_reconcile` (1 giờ / 24 giờ), **và cron chưa deploy ở đâu**. Trước Packet C, ảnh ở lại vĩnh viễn — kể cả trong bucket công khai |
| **Khôi phục** | Không. Không có bản sao, không có soft delete |
| **UX** | Một nút, xong ngay — tốt nhất trong ba phương án |
| **Cần đổi** | `delete-account` phải xoá shop trước. Quyền thì **đã sẵn**: `service_role` có `DELETE` trên toàn bộ bảng Shop từ `20260811160000` — chính vì thế A là phương án **chạy được ngay hôm nay**, và cũng vì thế nó nguy hiểm: không có gì chặn một bản vá vội |
| **Race / partial failure** | 🔴 **Nặng nhất.** Không có transaction bao quanh: Edge Function gọi PostgREST rồi gọi GoTrue, hai request riêng. Xoá shop xong mà `deleteUser` lỗi ⇒ **shop biến mất, tài khoản còn** — đúng trạng thái nửa vời mà RESTRICT hiện đang ngăn |

### B — Giữ hồ sơ audit, ẩn danh chủ sở hữu, rồi xoá auth user

| | |
|---|---|
| **Tính đúng dữ liệu** | Tuỳ định nghĩa. Shop **ở lại** với một chủ ẩn danh |
| **Audit/pháp lý** | ✅ Giữ được nhiều nhất |
| **Media cleanup** | Không có gì để dọn — ảnh vẫn thuộc một shop đang sống |
| **Khôi phục** | Không cần |
| **UX** | 🔴 Khó nói cho ra: "tài khoản của anh/chị đã xoá, nhưng shop vẫn đứng đó và vẫn bán hàng" |
| **Cần đổi** | `shops.owner_user_id` phải cho phép NULL (**migration đổi NOT NULL**) → và mọi RLS/RPC dùng `owner_user_id = auth.uid()` phải xử lý NULL. Đây là **thay đổi rộng nhất** trong ba phương án, chạm vào lõi quyền của toàn bộ Shop |
| **Race / partial failure** | Ẩn danh xong mà `deleteUser` lỗi ⇒ shop **mất chủ nhưng chủ vẫn còn tài khoản**, và không ai còn quyền sửa nó |
| **🔴 Rủi ro thật** | Một shop không chủ vẫn **công khai**, vẫn hiện số điện thoại đã duyệt, và **không ai có quyền gỡ nó xuống** ngoài admin. Trong pilot kín, đó là kịch bản tệ nhất |

### C — Chặn tự xoá với chủ shop, chuyển thành offboarding do admin xử lý

| | |
|---|---|
| **Tính đúng dữ liệu** | ✅ Không có gì bị xoá sai, vì không có gì bị xoá tự động |
| **Audit/pháp lý** | ✅ Admin quyết định giữ gì trước khi xoá, theo runbook |
| **Media cleanup** | ✅ **Tốt nhất, và đã có sẵn**: `shops_revoke_media_on_state_change_trg` — chuyển `state` khỏi `active` là **tự động thu hồi** mọi rendition công khai và ảnh hồ sơ, có xếp hàng dọn đàng hoàng. Đây là đường dọn ảnh **duy nhất** hôm nay thật sự chạy |
| **Khôi phục** | ✅ Suspend đảo ngược được; xoá thì không |
| **UX** | ⚠️ Kém hơn A: người dùng phải gửi email và chờ. Nhưng **trung thực**, và pilot chỉ có 3–5 người bán |
| **Cần đổi** | **Không migration. Không RLS. Không RPC.** Chỉ: hộp thoại hỏi trước "người này có shop không", và một mục runbook |
| **Race / partial failure** | ✅ Không có. Không thao tác nhiều bước nào chạy tự động |

---

## 6. 🔴 B13 — chặn Packet C, phát hiện trong lúc phân tích nhánh media

`shop_media_reconcile()` quét bucket công khai tìm object "không dòng nào trỏ
tới", và **chỉ hỏi `product_media`**. `shop_profile_media` ra đời hai migration
sau đó (`20260811220000`), dùng **cùng bucket**, và không ai quay lại dạy cho
hàm quét biết.

Đo bằng pgTAP chạy chính hàm đó
(`supabase/tests/shop_media_reconcile_profile_gap.test.sql`):

```
logo đã publish + verified, object upload 2 giờ trước
→ shop_media_reconcile() = {"unstuck": 0, "orphans_queued": 1}
→ hàng đợi dọn chứa ĐÚNG đường dẫn logo đang sống
```

**Chưa từng xảy ra vì cron chưa từng được deploy ở đâu.** Môi trường đầu tiên
bật nó — staging ở Packet C — sẽ xoá mọi logo và ảnh bìa **1 giờ sau khi upload**.

Vá là một điều kiện `NOT EXISTS` thứ hai trong vòng quét, tức một migration mới.
**Chưa viết**, vì migration cần được duyệt và Packet B đang đóng băng ở 19 file.

---

## 7. Khuyến nghị: **C**, đúng như Product Owner phác

Lý do C thắng ở pilot này không phải vì nó dễ nhất, mà vì:

1. **Nó là phương án duy nhất không cần cấp thêm quyền ghi.** A cần
   `DELETE` trên `shops` cho `service_role`; B cần đổi `NOT NULL` trên cột khoá
   quyền của toàn bộ Shop. C không cần gì.
2. **Nó dùng đường dọn ảnh duy nhất đang thật sự chạy** — suspend thu hồi
   rendition qua trigger. A và B đều dựa vào cron chưa deploy, và cron đó đang
   mang B13.
3. **Nó không tạo được trạng thái nửa vời.** A và B đều có một khoảng giữa hai
   request mà một lỗi mạng biến thành dữ liệu hỏng vĩnh viễn.
4. **Quy mô đúng với rủi ro**: 3–5 người bán. Việc "một người bán rời chương
   trình" sẽ xảy ra vài lần, không phải vài nghìn lần.

Và điều C **không** được phép là: nói dối. Cụ thể:

- Người **không sở hữu shop** dùng đúng luồng hiện tại, không đổi gì.
- Chủ shop **không bao giờ** nhận thông báo "đã xoá thành công".
- Hộp thoại phải **hỏi trước khi bấm**, không phải để họ gõ `DELETE` rồi mới
  nhận một lỗi máy chủ chung chung.
- Phải nói thẳng: tài khoản đang sở hữu shop, cần gửi yêu cầu tới
  `tapickleballvn@gmail.com`.
- Đây là **giải pháp tạm cho closed pilot**, không phải luồng tự phục vụ hoàn
  chỉnh. Nói vậy trong runbook, và không mô tả khác đi ở bất cứ đâu.

### Runbook offboarding (admin) — thứ tự bắt buộc

```
1. Xác minh danh tính người yêu cầu qua email đã đăng ký.
2. shop.state → 'suspended'   ← trigger thu hồi rendition công khai + ảnh hồ sơ
   🔴 PHẢI làm qua màn admin (phiên aal2). shops_guard_privileged_columns
      im lặng ghi đè NEW.state := OLD.state khi is_admin() sai — một lệnh
      UPDATE chạy bằng psql là NO-OP CÂM, không báo lỗi, và trigger thu hồi
      ảnh cũng không chạy. Bẫy này đã bắt được một lần ở P2b.
3. Đợi hàng đợi dọn ảnh chạy hết; xác nhận URL công khai trả 404.
4. Xuất bản ghi cần giữ (quyết định kiểm duyệt, bằng chứng chấp thuận) nếu
   đang có tranh chấp — legal_acceptances sẽ CASCADE mất ở bước 6.
5. Xoá shop  → cây CASCADE dọn products/media/contacts/lịch sử.
6. Xoá auth user → lúc này RESTRICT không còn chặn.
7. Ghi lại: ai yêu cầu, ai thực hiện, lúc nào.
```

Bước 3 **không tự động** khi cron chưa deploy — trước Packet C phải xoá tay.
Bước 4 tồn tại vì bước 6 huỷ bằng chứng, và đó là thiết kế chứ không phải lỗi.

### Việc C KHÔNG giải quyết, và không giả vờ giải quyết

- Phát hiện 1 (`delete-account` dọn hụt) vẫn còn. Nó **không** gây mất dữ liệu
  hôm nay, nhưng nó là một quả mìn: cấp grant mà không sửa luồng sẽ biến vòng
  lặp đang vô hại thành xoá thật, chạy **trước** `deleteUser`, không transaction.
- Phát hiện 2 (hộp thoại hứa xoá giải đấu) vẫn còn. Sửa câu chữ là việc nhỏ và
  nằm ngoài Shop; đề nghị làm cùng lúc vì cùng một hộp thoại.
- B13 vẫn còn và **chặn Packet C**.

---

## 8. Câu chữ cần đổi nếu chọn C

Không câu nào trong **Chính sách bảo mật** cần đổi — bản vừa duyệt đã nói đúng.

Cần thêm/sửa trong `DeleteAccountDialog` + `useDeleteAccount` (i18n VI/EN):

| Chỗ | Hiện tại | Đề xuất |
|---|---|---|
| Danh sách "sẽ xoá" | "Các giải đấu bạn đã tạo" | 🔴 **Bỏ hoặc sửa** — không đúng (`SET NULL`) |
| Trước khi mở hộp thoại | không kiểm tra gì | Nếu người này sở hữu shop: **không hiện ô gõ `DELETE`**; hiện lời giải thích + nút mở email |
| Nội dung cho chủ shop | — | "Tài khoản này đang sở hữu shop **{tên}**. Vì shop còn sản phẩm và lịch sử kiểm duyệt, việc đóng tài khoản do ThePickleHub xử lý thủ công trong giai đoạn thử nghiệm. Gửi yêu cầu tới `tapickleballvn@gmail.com` từ chính email đã đăng ký; chúng tôi sẽ xác nhận trước khi làm bất cứ điều gì." |
| Toast lỗi | "Failed to delete account" | Với chủ shop, luồng này không được chạm tới nữa. Giữ nguyên cho mọi trường hợp khác |

Một câu **không** được viết: bất cứ điều gì hàm ý tài khoản đã đóng, đang chờ
đóng tự động, hay sẽ tự đóng sau N ngày.

---

## 9. Quyết định cần từ Product Owner

1. **Chọn A / B / C** cho closed pilot. Khuyến nghị: **C**.
2. **B13** — cho viết migration vá vòng quét orphan? Nó **chặn Packet C**.
3. **Phát hiện 1** — quét grant cho `delete-account` là việc riêng, ngoài Shop.
   Làm bây giờ hay sau pilot?
4. **Phát hiện 2** — sửa câu "các giải đấu bạn đã tạo" cùng lúc với C?
5. **§3.4** — bằng chứng chấp thuận CASCADE mất theo tài khoản: giữ nguyên cho
   pilot, hay giữ bản ẩn danh?

Chưa implement gì cho tới khi có quyết định.
