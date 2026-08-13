# B12 — xoá tài khoản khi người đó đang sở hữu một shop

> **Trạng thái: PHƯƠNG ÁN C ĐÃ DUYỆT (13/08) VÀ ĐÃ IMPLEMENT — chỉ cục bộ.**
>
> | | |
> |---|---|
> | **B12** | ✅ đóng cục bộ bằng phương án C — §7, §8 |
> | **B13** | ✅ đã vá — migration `20260814110000`, §6 |
> | **B14** | ⏸ **cố ý không sửa** — hồ sơ riêng: [`docs/defects/b14-delete-account-cleanup-noop.md`](../../defects/b14-delete-account-cleanup-noop.md) |
>
> 🔴 **Chưa deploy gì.** Nhánh chưa push; migration chưa áp ở đâu; hàm edge
> chưa deploy. Trên production hôm nay, chủ shop vẫn gặp lỗi
> `Database error deleting user` như mô tả ở §1.
>
> Phần phân tích bên dưới **giữ nguyên** làm hồ sơ vì sao chọn C — nó là bằng
> chứng, không phải bản nháp.

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

## 6. ✅ B13 — đã vá bằng migration `20260814110000` (Packet B **#20**)

`shop_media_reconcile()` quét bucket tìm object "không dòng nào trỏ tới", và
**chỉ hỏi `product_media`**. `shop_profile_media` ra đời hai migration sau đó
(`20260811220000`), dùng **cùng hai bucket**, và không ai quay lại dạy cho hàm
quét biết.

**Hai đường, và đường nguy hiểm hơn không phải đường đã báo cáo lần trước:**

| Bucket | Ân hạn | Trạng thái thật |
|---|---|---|
| **draft** | 24 giờ | 🔴 **có thể xảy ra ngay hôm nay** — màn cài đặt shop upload logo/ảnh bìa vào đúng bucket này. Bản gốc và rendition source của mọi logo là "mồ côi" sau 24h |
| **public** | 1 giờ | tiềm ẩn — `shop_profile_media_publish_commit()` **chưa có caller production nào**, nên chưa có object logo nào nằm trong bucket công khai |

> Đính chính so với báo cáo CP16: câu "mất logo sau 1 giờ" đúng về cơ chế nhưng
> nhầm về đường. Đường **có thật hôm nay** là draft/24h; đường public/1h chỉ nổ
> khi có thứ gì đó gọi publish cho profile media.

Cả hai chưa từng nổ **vì cron chưa từng được deploy ở đâu**.

### Bản vá không phải một điều kiện loại trừ

Thêm "…và nó không phải logo" sẽ vá triệu chứng và giữ nguyên hình dạng của
lỗi: hai miền media, một vòng quét biết một miền, và một miền thứ ba sau này
không ai nhớ. Thứ thiếu là một **định nghĩa**, nên migration viết ra nó:

`shop_media_referenced_objects()` — mọi cặp `(bucket, path)` mà hệ thống mong
đợi tồn tại, từ **cả hai** miền, qua **mọi cột có thể chứa key**:
`draft_path`, `rendition_source_path`, `public_path` của `product_media` và
`shop_profile_media`. Vòng quét trở thành **phần bù** của tập đó.

### Và nó đóng luôn một race mà ân hạn chỉ che *gần như*

Rendition sản phẩm được worker copy tới key công khai **rồi mới** commit. Giữa
hai việc đó, object tồn tại và không dòng nào trỏ tới nó. Bản cũ đặt cược vào
"một giờ là đủ lâu". Key công khai là **tất định** (`shop/product/media-v<n>.webp`,
do `product_publish_prepare` sinh), nên tập tham chiếu chứa luôn key mà một ảnh
đã verified **sắp** được publish tới — cửa sổ đóng hẳn thay vì đóng *chắc là*.

Profile media không có key tất định (commit nhận path từ worker), nên ở đó vẫn
là ân hạn làm việc. Nói ra, không che.

### Kiểm chứng

`supabase/tests/shop_media_reconcile.test.sql` — **17 assertion**, một thế giới
chứa đủ 10 trường hợp phải phân biệt: logo sống · cover sống · ảnh gốc sản phẩm
· rendition đang phục vụ · original+rendition profile · mồ côi ở draft · mồ côi
ở public · object đã có job · object đang giữa chừng publish + object trong ân
hạn · shop active và shop suspended.

Byte thật, qua worker thật: `scripts/shop-p2b-media-lifecycle.test.mjs` publish
một logo, chạy reconcile thật, drain bằng vòng lặp worker thật, rồi khẳng định
**ảnh vẫn tải được** — vì "không có job nào được xếp hàng" là lời khẳng định yếu
hơn thứ người bán thật sự nhìn thấy.

Đỏ trước, xanh sau — phá **định nghĩa ở call site production**: bỏ nửa profile
media → **5 đỏ**; bỏ key publish tất định → **4 đỏ**.

### Một finding giữ lại, không mở rộng

Vòng quét vẫn đi qua **toàn bộ** hai bucket mỗi lần chạy. `EXPLAIN` cho thấy nó
dùng bitmap index scan giới hạn theo bucket, tập tham chiếu được materialise
một lần, và anti-join với hàng đợi là index-only — đúng ở quy mô pilot (vài
trăm tới vài nghìn object). **Không phân trang**, có chủ ý: khi số object lên
tới hàng chục nghìn, đây là chỗ phải xem lại, và đó là một quyết định riêng
chứ không phải một bản redesign nhét vào bản vá.

---

## 7. Quyết định: **C** — đã duyệt và đã implement

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

### Runbook offboarding chủ shop — 7 bước, thứ tự bắt buộc

> Đây là **quy trình thủ công cho closed pilot**, không phải luồng tự phục vụ.
> Không bước nào chạy tự động, và không bước nào được gộp.
>
> 🔴 **Không có bước nào tự xoá shop, catalog hay tài khoản.** Bước 7 chỉ được
> thực hiện khi có một quyết định riêng cho **chính yêu cầu đó**.

**1. Xác minh người yêu cầu.**
Yêu cầu phải đến từ **chính địa chỉ email đã đăng ký** của chủ shop. Trả lời
vào địa chỉ đó và chờ xác nhận. Không xử lý yêu cầu đến từ Zalo/Messenger hay
từ một email khác — mục 19 của Quy chế nói email là kênh chính thức, và đây
đúng là loại việc cần một hồ sơ.

**2. Ghi nhận shop và phạm vi dữ liệu.**
Ghi lại `shop_id`, slug, số sản phẩm đã đăng, số ảnh, có tranh chấp/khiếu nại
đang mở hay không. Đây là thứ quyết định bước 6 và bước 7 được phép làm gì.

**3. Đình chỉ shop bằng đúng RPC/màn hình admin, phiên AAL2.**
```
/admin/shop/... → Đình chỉ shop     (KHÔNG psql, KHÔNG UPDATE tay)
```
🔴 `shops_guard_privileged_columns` im lặng ghi đè `NEW.state := OLD.state`
khi `is_admin()` sai. Một lệnh `UPDATE public.shops SET state='suspended'`
chạy bằng psql là **NO-OP CÂM**: không lỗi, không đổi gì, và
`shops_revoke_media_on_state_change` **không chạy** — nên ảnh vẫn công khai
trong khi bảng điều khiển trông như đã đình chỉ. Bẫy này đã bắt được một lần
ở P2b.

**4. Xác minh phần công khai đã biến mất.**
Trang shop và trang sản phẩm trả về "không tồn tại"; `shop_public_shop` /
`public_products` không còn dòng nào của shop này. Kiểm bằng một phiên **ẩn
danh**, không phải phiên admin.

**5. Xác minh job thu hồi ảnh đã được xếp hàng.**
`shop_media_cleanup_jobs` có job `reason='suspend'` cho từng rendition công
khai của shop (sản phẩm **và** logo/ảnh bìa — sau bản vá B13 thì cả hai đều
được vòng quét hiểu đúng). Nếu **không có job nào**, bước 3 đã không thực sự
chạy: quay lại bước 3.

**6. Đợi worker drain và kiểm tra sức khoẻ.**
`shop_media_cleanup_health` → `pending` về 0, `failed` = 0, `stuck` = 0. Xác
nhận URL công khai của ảnh trả 404.
⚠️ Khi cron chưa deploy (trước Packet C), **không có worker nào chạy**: phải
drain tay và ghi rõ đã làm bằng tay.

**7. Chỉ sau khi xử lý dữ liệu/audit theo policy — mới đóng tài khoản.**
Trước khi xoá bất cứ thứ gì:
- xuất bản ghi cần giữ nếu đang có tranh chấp (quyết định kiểm duyệt, bằng
  chứng chấp thuận quy chế) — `legal_acceptances` **CASCADE mất** cùng tài
  khoản, và đó là thiết kế của CP12, không phải lỗi;
- có quyết định riêng cho yêu cầu này: xoá shop hay giữ shop ở trạng thái đình
  chỉ, xoá tài khoản hay chỉ đóng shop.

Chỉ khi đã có quyết định đó mới thực hiện thao tác tương ứng, và ghi lại: ai
yêu cầu, ai duyệt, ai thực hiện, lúc nào. Sau khi shop không còn, chủ shop
dùng lại được nút xoá tài khoản bình thường — không có đường riêng nào cả.

### Việc C KHÔNG giải quyết, và không giả vờ giải quyết

- **B14** (`delete-account` dọn hụt) vẫn còn, **cố ý**. Nó không gây mất dữ
  liệu hôm nay, nhưng nó là một quả mìn: cấp grant mà không sửa luồng sẽ biến
  vòng lặp đang vô hại thành xoá thật, chạy **trước** `deleteUser`, không
  transaction. Hồ sơ riêng:
  [`docs/defects/b14-delete-account-cleanup-noop.md`](../../defects/b14-delete-account-cleanup-noop.md).
- C **không phải** luồng tự phục vụ hoàn chỉnh. Nó là một quy trình thủ công
  cho 3–5 người bán, và không được mô tả khác đi ở bất cứ đâu.

---

## 8. Đã implement những gì

### Máy chủ — `supabase/functions/delete-account/index.ts`

Kiểm quyền sở hữu **trước bước dọn đầu tiên**, trả 409:

```json
{ "error": "shop_owner_offboarding_required",
  "code":  "shop_owner_offboarding_required",
  "shop_count": 1,
  "contact_email": "tapickleballvn@gmail.com",
  "message": "Tài khoản này đang sở hữu một shop. Để đóng shop và tài khoản an toàn, vui lòng gửi yêu cầu tới tapickleballvn@gmail.com." }
```

Bốn điều đáng nói:

1. **Thứ tự là toàn bộ vấn đề.** Bên dưới chỗ kiểm này là vòng lặp 13 bảng rồi
   mới tới `deleteUser`, **không transaction**. Một lời từ chối đến từ Postgres
   ở bước cuối là lời từ chối đến **sau khi** tài khoản đã bị tháo rời.
2. **Không dựa vào FK làm hợp đồng UX.** `RESTRICT` vẫn là lớp cuối, nhưng
   GoTrue nuốt nó thành `"Database error deleting user"`.
3. **Lỗi khi kiểm thì đóng cửa** (`503 ownership_check_failed`). Không biết
   tài khoản có shop hay không thì không phải lý do để bắt đầu xoá.
4. **Quyền sở hữu, không phải tư cách thành viên.** Manager/support không bị
   chặn — họ không sở hữu gì, nên không có gì mồ côi khi họ rời đi.

Replay và hai request song song trả **cùng một 409**, không side effect: chưa
có gì chạy để mà chạy dở.

### Giao diện — `DeleteAccountDialog` + `useDeleteAccount`

Chủ shop **không thấy ô gõ `DELETE`** và không có nút xác nhận. Họ thấy: điều
gì đang chặn, vì sao pilot xử lý tay, và một nút **soạn** email.

Câu giữ cho việc này trung thực: *"Nút bên dưới chỉ mở ứng dụng email của
anh/chị — nó KHÔNG tự gửi yêu cầu."* Mở mail client không phải là một yêu cầu
đã tới nơi, và người ngồi chờ hồi âm cho một email chưa từng gửi là đúng thứ
câu đó ngăn lại.

Câu hỏi "có sở hữu shop không" ở client dùng lại `useMyShop` — hook vốn đã
nghĩa là `owner_user_id = tôi` — nên hai đường không thể lệch nhau.

### Câu chữ — đã sửa

| Chỗ | Trước | Sau |
|---|---|---|
| `deleteDataTournaments` | "Các giải đấu bạn đã tạo" (**sai**: `SET NULL`) | "Liên kết giữa bạn và các giải đấu bạn đã tạo (giải đấu vẫn còn, nhưng không còn gắn tên bạn)" |
| Chính sách bảo mật | — | **không đổi**; 21 assertion xác nhận vẫn đúng |

### Kiểm chứng

| Bộ | Nội dung |
|---|---|
| `scripts/shop-account-deletion-b12.test.mjs` | 7 case qua **đúng call site production**: control · B14 · từ chối có mã ổn định · không đổi gì · replay song song · manager không bị chặn · sau offboarding thì xoá bình thường |
| `src/components/account/__tests__/delete-account-dialog.test.tsx` | 6 case: không có ô gõ · CTA mailto · không tuyên bố đã gửi · không gọi được mutate · người thường **không** hồi quy · câu chữ giải đấu |

Đỏ trước, xanh sau — phá **sản phẩm**, không phá test: gỡ khối kiểm ở máy chủ
→ 2 đỏ; ép `ownsShop = false` ở component → 4 đỏ.

---

## 9. Quyết định đã có, và cái còn lại

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Chọn A/B/C | ✅ **C**, đã implement |
| 2 | Vá B13 | ✅ migration `20260814110000` |
| 3 | B14 | ⏸ **không sửa**, có hồ sơ riêng; 🔴 cấm cấp grant lẻ |
| 4 | Câu "các giải đấu bạn đã tạo" | ✅ đã sửa cùng C |
| 5 | §3.4 — bằng chứng chấp thuận CASCADE mất theo tài khoản | ⬜ **còn mở**: giữ nguyên cho pilot, hay giữ bản ẩn danh (hash + phiên bản + thời điểm, không danh tính)? Chỉ cần trả lời trước khi có thanh toán |
