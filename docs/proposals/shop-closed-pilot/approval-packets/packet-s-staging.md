# Packet S — Dự án Supabase staging

> **TRẠNG THÁI: CHƯA DUYỆT. Không có project nào được tạo trong task này.**
> Tier: 🟡 AMBER — thêm mới, không đụng gì đang chạy.
>
> Quyết định Product Owner 2026-08-12 #1: **preview phải dùng Supabase staging
> riêng, không trỏ vào Supabase production.**

---

## 1. Vì sao packet này tồn tại

Gói chuẩn bị ban đầu khuyến nghị preview web + Supabase production, vì đó là
cách rẻ nhất và ba lớp bảo vệ đã có sẵn. Product Owner **từ chối**, và lý do
đưa ra đứng vững hơn khuyến nghị:

| Lý do | Điều nó tránh được |
|---|---|
| 17 migration Shop chưa cần sống trên production trước khi pilot được duyệt | Một schema không ai duyệt, trên cơ sở dữ liệu thật, chờ một quyết định có thể là "không" |
| Test tạo/xoá được người bán, ảnh, cron, allowlist mà không chạm dữ liệu thật | [`preview-deployment.md` §7](../preview-deployment.md) phải viết cả một mục về dọn dẹp vì mọi thứ smoke tạo ra là dữ liệu thật |
| Chạy được migration, worker và cron **đầy đủ** | Không phải drain tay để giả lập cron |
| Rollback đơn giản hơn | Xoá một project staging là một thao tác; forward-fix trên production thì không |
| Giảm rủi ro từ drift migration có sẵn | Remote hiện có 29 file lệch ledger và **một file thật sự chưa áp** |

Điểm cuối là điểm agent đánh giá thấp nhất. Áp 17 migration vào một cơ sở dữ
liệu đã có drift kinh niên nghĩa là thêm biến vào một hệ đã có ẩn số.

---

## 2. Project — đã tạo, còn thiếu đúng một thứ

Product Owner đã tạo project. Thông tin đã biết:

| # | Thứ | Giá trị |
|---|---|---|
| 1 | Organization | **ThePickleHub** |
| 2 | Project name | **ThePickleHub Staging** |
| 3 | Region | **AWS ap-northeast-1** — **giống production**, nên độ trễ và hành vi Storage không phải biến số thứ hai |
| 4 | Plan | **Pro** |
| 5 | Trạng thái dữ liệu | **sạch** — không clone production, không copy người dùng production |
| 6 | **Project ref** | 🔴 **`<STAGING_PROJECT_REF>` — CHƯA CÓ GIÁ TRỊ THẬT** |

🔴 **Giá trị `project ref` chưa được cung cấp.** Chuỗi được đưa trong yêu cầu là
`<STAGING_PROJECT_REF>` — một placeholder, không phải một ref. Agent **không đoán
và không suy ra** một project ref: gõ nhầm 20 ký tự chữ-số là gõ vào một project
của người khác.

Nó là **một dòng** cần điền, ở Supabase Dashboard → Project Settings → General →
Reference ID (hoặc trong URL: `https://supabase.com/dashboard/project/<ref>`).

```
Project ref staging: ______________________________
```

Cho tới khi ô đó có giá trị, **không lệnh nào trong Packet B/C chạy được** — mọi
lệnh đều dùng `$REF` và một `$REF` chưa giải là một lệnh không có mục tiêu.

### Gói Pro gỡ được hai lo ngại

Bản trước của packet này cảnh báo hai điều về Free tier. Gói **Pro** giải quyết
cả hai:

| Lo ngại | Trên Pro |
|---|---|
| Project tự tạm dừng sau ~7 ngày không hoạt động | **Không tạm dừng.** Cron chạy liên tục suốt pilot |
| `pg_cron` / `pg_net` có bật được không | Có. Vẫn phải **xác nhận bằng mắt** ở checklist mục 7 trước khi Packet C có ý nghĩa |

Đổi lại, Pro **có chi phí theo tháng**. Nếu pilot kéo dài, đó là một khoản thật
— và xoá project khi pilot xong là cách dừng chi phí đó.

---

## 3. Hạn mức và năng lực — trên gói Pro

| Thứ | Cần cho pilot | Trên Pro |
|---|---|---|
| Postgres + RLS | ✅ | có |
| Storage (2 bucket, vài chục ảnh nhỏ) | ✅ | thừa sức |
| Edge Functions | ✅ 1 function | có |
| `pg_cron` + `pg_net` | ✅ **bắt buộc** | có — **vẫn phải xác nhận bằng mắt** (checklist mục 7) |
| `supabase_vault` | ✅ cho `cron_secret` | có |
| Auth + MFA/TOTP | ✅ cho `is_admin()` | có |
| Không tự tạm dừng | ✅ **bắt buộc** cho cron | ✅ Pro không tạm dừng |
| Sao lưu / PITR | ❌ không cần — xem §9 | có, không dùng |

Quy mô pilot: 3–5 người bán, vài chục sản phẩm, vài chục ảnh. Không có ràng buộc
nào về dung lượng hay compute.

🔴 **Một điều vẫn phải kiểm trước khi Packet C có nghĩa:** `pg_cron` và `pg_net`
đã bật trên project chưa. Gói Pro cho phép, nhưng cho phép không phải là đã bật.
Nếu chưa, Packet C mất phần quan trọng nhất — chứng minh worker chạy theo **lịch
thật** — và preview chỉ còn drain tay, tức là đúng thứ máy cục bộ đã làm được.

---

## 4. Auth

| Thứ | Giá trị staging |
|---|---|
| **Site URL** | ⬜ URL preview Cloudflare |
| **Redirect URLs** | ⬜ `https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev/**` |
| Redirect URL production | **KHÔNG thêm** — staging không được nhận đăng nhập từ site thật |
| Email provider | ⬜ mặc định Supabase là đủ; **không** nối Resend |
| MFA/TOTP | ✅ **phải bật** — `is_admin()` đòi aal2, và một staging không có TOTP sẽ chứng minh nhầm rằng cổng AAL2 hoạt động |
| Tài khoản admin staging | ⬜ 1 tài khoản, enrol TOTP, **UUID khác** production |

> Đây là chỗ Blocker B1 chuyển sang: câu hỏi không còn là "URL preview có trong
> redirect list của production chưa" mà là "staging có biết URL preview không".
> Cùng một kiểm tra, an toàn hơn — sai ở staging không ảnh hưởng đăng nhập thật.

---

## 5. Secret — tên, không phải giá trị

Staging cần đúng tập secret production đang có cho Shop, **giá trị mới, không sao chép**:

| Tên | Nguồn |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase tự đặt |
| `CRON_SECRET` | **giá trị MỚI**, sinh ngẫu nhiên cho staging |
| `cron_secret` (vault) | **cùng giá trị với `CRON_SECRET` staging** |

🔴 **Không sao chép `CRON_SECRET` của production sang staging.** Một secret dùng
chung nghĩa là một máy chủ staging bị lộ có thể gọi cron của production. Đây là
secret duy nhất Shop cần, và nó phải khác.

Không secret nào khác cần thiết: Shop không gọi Mux, DUPR, Resend, FCM hay Zalo.

---

## 6. Ứng dụng web trỏ vào đâu

Cloudflare Pages đọc `VITE_SUPABASE_*` **lúc build**, và preview build dùng
biến môi trường của môi trường Preview:

| Biến | Preview (staging) | Production |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<STAGING_PROJECT_REF>.supabase.co` | production |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key staging | production |
| `VITE_SUPABASE_PROJECT_ID` | `<STAGING_PROJECT_REF>` | production |
| `SHOP_PUBLIC_INDEXING` | **không đặt** | **không đặt** |

⚠️ **Đây là thay đổi có sức công phá nhất trong toàn bộ gói.** Đặt
`VITE_SUPABASE_*` ở môi trường Preview của Cloudflare làm **mọi preview của mọi
nhánh** trỏ vào staging, không chỉ nhánh Shop. Với nhánh SEO/homepage đang chạy
song song, điều đó nghĩa là preview của chúng không còn thấy dữ liệu thật.

Hai lựa chọn, Product Owner chọn:

| | Cách | Đánh đổi |
|---|---|---|
| **S-a** | Đặt biến Preview ở cấp project | Đơn giản; **mọi** preview nhánh khác cũng trỏ staging |
| **S-b** | Chỉ nhánh này trỏ staging | Cloudflare Pages **không** hỗ trợ biến theo nhánh. Cần một project Pages thứ hai chỉ cho nhánh Shop |

Khuyến nghị: **S-a**, và nói cho những phiên đang chạy nhánh khác biết. Một
preview trỏ staging là bất tiện; một project Pages thứ hai là một hệ thống thứ
hai phải bảo trì.

Đã chọn: ⬜ S-a  ⬜ S-b

---

## 7. Chính sách dữ liệu

- **Không sao chép dữ liệu production sang staging.** Không dump, không restore,
  không "chỉ vài dòng người dùng". Staging bắt đầu rỗng và chỉ chứa dữ liệu do
  smoke tạo ra.
- **Không dữ liệu cá nhân thật.** Không tên thật, không số điện thoại thật,
  không ảnh chụp nhà ai.
- Tài khoản test dùng địa chỉ nhận diện được:
  `shop-pilot-smoke+seller@…`, `shop-pilot-smoke+buyer@…`, `shop-pilot-admin@…`.
- Staging **không** gửi email/push ra ngoài ngoài email xác thực tới địa chỉ
  mình kiểm soát.

### Dọn tài khoản test

Nhẹ hơn hẳn so với phương án production, và đó là một trong những lý do đổi:
staging **có thể xoá sạch**.

```sql
-- Trên STAGING, và chỉ staging (xem §8 trước khi chạy).
SELECT 1;
SELECT count(*) FROM auth.users;          -- kỳ vọng: chỉ tài khoản test
DELETE FROM public.shop_pilot_members;
-- Người dùng xoá qua Auth admin API; shop/product/ảnh cascade theo.
```

Cách chắc nhất vẫn là **xoá cả project** khi pilot kết thúc.

---

## 8. 🔴 Chứng minh mục tiêu là staging TRƯỚC mỗi lần ghi

Bắt buộc. Một lệnh `DELETE FROM shop_pilot_members` gõ nhầm project là toàn bộ
pilot đóng lại trong im lặng.

**Quy tắc: mọi phiên ghi bắt đầu bằng câu này, và người vận hành phải ĐỌC kết quả.**

```sql
SELECT 1;
SELECT
  current_database()                                              AS db,
  (SELECT count(*) FROM auth.users)                               AS users,
  (SELECT count(*) FROM public.profiles)                          AS profiles,
  (SELECT count(*) FROM public.social_events)                     AS events,
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public')                                 AS public_tables;
```

| Đọc được gì | Đây là |
|---|---|
| `users` ~2 219, `profiles` ~2 415, `events` 10 | 🔴 **PRODUCTION — DỪNG** |
| `users` dưới 20, `profiles` gần 0, `events` 0 | ✅ staging |

Con số production ở trên đo ngày 2026-08-12. Chúng chỉ tăng, nên bất kỳ kết quả
hàng nghìn nào đều là production.

Kiểm tra thứ hai, độc lập và không dựa vào trí nhớ:

```sh
# Project ref phải xuất hiện TRONG chính lệnh, không qua biến chưa giải.
curl -s -H "Authorization: Bearer $PAT" \
  "https://api.supabase.com/v1/projects/<STAGING_PROJECT_REF>" | jq '{name, region, created_at}'
# name KHÔNG được là "thepicklehub-prod"
```

---

## 9. Sao lưu

Staging **không cần sao lưu**. Nó không giữ gì không tạo lại được, và toàn bộ
schema nằm trong 18 file migration đã tracked.

Nếu ai đó thấy mình muốn sao lưu staging, câu hỏi thật là "vì sao có dữ liệu
không tạo lại được ở đây" — và câu trả lời đúng gần như luôn là §7.

---

## 10. Cái gì KHÔNG thuộc Packet S

- ❌ Tạo project — thao tác của Product Owner, không phải của agent.
- ❌ Áp migration — Packet B.
- ❌ Deploy function — Packet C.
- ❌ Đẩy nhánh / dựng preview — Packet A.
- ❌ Chèn UUID người bán — Packet D.

---

## 11. Ô ký

```
Packet S — tạo/xác nhận một dự án Supabase staging riêng cho closed pilot.

Đầu vào đã điền:
  [ ] project ref staging  ______________________
  [ ] region               ______________________
  [ ] gói/hạn mức          ______________________
  [ ] pg_cron + pg_net XÁC NHẬN bật được          (§3 — không có thì Packet C mất ý nghĩa)
  [ ] vault khả dụng
  [ ] MFA/TOTP bật, 1 admin staging đã enrol
  [ ] CRON_SECRET staging là GIÁ TRỊ MỚI, không sao chép từ production
  [ ] chọn cách trỏ biến web:  __ S-a (cả project)   __ S-b (Pages project thứ hai)
  [ ] không sao chép dữ liệu production

[ ] DUYỆT — ký: ____________  ngày: __________
[ ] TỪ CHỐI — lý do: _______________________________________________

Câu §8 đã chạy và ĐỌC trước lần ghi đầu tiên:  [ ] rồi
```
