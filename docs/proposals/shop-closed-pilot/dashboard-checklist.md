# Checklist dashboard — Product Owner tự kiểm

> Những thứ **không lệnh CLI chỉ-đọc nào đọc được**, hoặc đọc được nhưng chỉ
> cùng lúc với giá trị bí mật trong cùng payload. Chúng phải được nhìn bằng mắt.
>
> **~10 phút.** Hai mục 🔴 quan trọng nhất là **S-2** (redirect URL) và **C-4**
> (cờ lập chỉ mục) — mục thứ hai đứng giữa "pilot kín" và "Google thấy sáu sản
> phẩm".

## Quy tắc chụp màn hình

**Không chụp bất kỳ màn hình nào có giá trị secret.** Ở các mục yêu cầu ảnh, chụp
phần **tên** và **trạng thái**, che hoặc cắt bỏ cột giá trị. Một khoá dán vào chat
là một khoá đã lộ, kể cả trong chat riêng.

Ở mục ghi "chỉ tên", chỉ cần ghi **có / không có** — không chép giá trị vào bất
cứ đâu.

---

# Phần S — Supabase STAGING

Project: **`utokwfcljxjkpkaqgheo`** · `https://utokwfcljxjkpkaqgheo.supabase.co`
Dashboard: `https://supabase.com/dashboard/project/utokwfcljxjkpkaqgheo`

> **Bảy mục dưới đây đã được xác minh bằng probe chỉ đọc (13/08)** và không cần
> anh kiểm lại: tên project, org, region, `auth.users` = **0**, bảng `public` =
> **0**, bucket = 0, Edge Function = không có, secret = không có, va chạm tên
> object Shop = **0**. Chúng được đánh dấu ✅ sẵn.
>
> Những mục còn `☐` là **những mục agent không đọc được** — hoặc vì endpoint trả
> secret trong cùng payload, hoặc vì chúng nằm ở Cloudflare.

| # | Mục | Tìm ở đâu | Kỳ vọng | PASS/FAIL | Ảnh |
|---|---|---|---|---|---|
| **S-1** | Tên, tổ chức, region | Project Settings → General | `ThePickleHub Staging` · org `ThePickleHub` · `ap-northeast-1` | ✅ **đã xác minh** | — |
| **S-1b** | **Gói** | Project Settings → General / Billing | **Pro** — API trả `plan: null` nên **chỉ dashboard xác nhận được** | ☐ | ☐ |
| **S-2** | 🔴 **Auth Site URL + Redirect URLs** | Authentication → URL Configuration | Site URL = URL preview. Redirect URLs **có** `https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev/**`. **Không** có URL production | ☐ | ☐ |
| **S-3** | MFA / TOTP | Authentication → Providers (Multi-Factor) | TOTP **đã bật** | ☐ | ☐ |
| **S-4** | Tài khoản admin staging | Authentication → Users | Đúng **1** tài khoản admin, đã enrol TOTP, email khác production | ☐ | ☐ (che email nếu là email thật) |
| **S-5** | 🔴 **Không có người dùng production** | Authentication → Users | **`auth.users` = 0** khi probe. Nếu về sau thấy hàng nghìn → **DỪNG**, đó không phải staging | ✅ **đã xác minh (0)** | — |
| **S-6** | Allowed origins / CORS | Project Settings → API | Chỉ URL preview (và `localhost` khi cần). **Không** có `www.thepicklehub.net` | ☐ | ☐ |
| **S-7** | Secret — **chỉ tên** | Edge Functions → Secrets | Có `CRON_SECRET`. `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` do Supabase tự đặt. **Giá trị `CRON_SECRET` phải KHÁC production** | ☐ | ☐ (che cột giá trị) |
| **S-8** | Edge Function | Edge Functions | **Trước Packet C:** trống ✅ (probe: không có). **Sau Packet C:** đúng `shop-media-lifecycle` ACTIVE | ☐ sau Packet C | ☐ |
| **S-9** | 🔴 **Extension lên lịch** | Database → Extensions | `pg_cron` và `pg_net` **khả dụng nhưng CHƯA CÀI** (probe 13/08). Cần **bật cả hai** trước Packet C — bật là một thao tác **ghi**, ngoài phạm vi kiểm chỉ đọc | ☐ **cần bật** | ☐ |
| **S-10** | Cron job | Database → Cron (hoặc `cron.job`) | **Trước Packet B#4:** không có job Shop. **Sau:** đúng 2 job `shop-media-cleanup-every-5m` và `shop-media-reconcile-hourly`, `active = true` | ☐ | ☐ |
| **S-11** | Storage bucket | Storage | Hiện **0 bucket** ✅. **Sau Packet B:** `shop-product-media-draft` (**Private**) và `shop-product-media` (**Public**) | ☐ sau Packet B | ☐ |
| **S-12** | Migration ledger | Database → Migrations | Hiện **chưa có bảng ledger**, 0 bảng trong `public` ✅. **Sau Packet B:** 351 dòng, dòng cuối `20260814090000` | ☐ sau Packet B | ☐ |
| **S-13** | Quy chế người bán | Table Editor → `legal_documents` | **Trước khi Product Owner duyệt v1:** bảng **rỗng**, không dòng nào có `approved_at` | ☐ sau Packet B | ☐ |
| **S-14** | Va chạm tên object Shop | — | **0** bảng và **0** function tên `shop*`/`product*`/`legal*` | ✅ **đã xác minh (0)** | — |

**Vì sao S-5 quan trọng hơn vẻ ngoài:** nếu ai đó vô tình mở nhầm tab production,
mọi mục còn lại vẫn "PASS" trong khi đang nhìn cơ sở dữ liệu thật. Số người dùng
là dấu hiệu rẻ nhất và rõ nhất để phân biệt hai project.

**Vì sao S-2 quan trọng:** không có redirect URL, đăng nhập trên preview bật đi
nơi khác và **toàn bộ smoke seller/admin trở nên vô nghĩa** — người kiểm thử
đăng nhập thành công vào một site không có Shop rồi kết luận là hỏng. Agent
không đọc được mục này: endpoint cấu hình auth trả `smtp_pass` và các
`external_*_secret` trong cùng payload.

**Vì sao S-3 quan trọng:** `is_admin()` chỉ đòi aal2 khi người dùng **có** một
factor đã verify. Một staging không có TOTP cho mọi phiên đi qua, và smoke sẽ
báo "cổng AAL2 hoạt động" trên một cổng đang mở.

---

# Phần C — Cloudflare Pages

Dashboard: Pages → `pickle-hub-pro`

| # | Mục | Tìm ở đâu | Kỳ vọng | PASS/FAIL | Ảnh |
|---|---|---|---|---|---|
| **C-1** | Project và nhánh production | Settings → Builds & deployments | Project `pickle-hub-pro` · production branch **`main`** | ☐ | ☐ |
| **C-2** | Hành vi preview | Cùng trang | Preview deployments bật cho **All branches** (hoặc ít nhất `feat/shop-closed-pilot`) | ☐ | ☐ |
| **C-3** | Biến môi trường **Preview** | Settings → Environment variables → **Preview** | `VITE_SUPABASE_URL` = `https://utokwfcljxjkpkaqgheo.supabase.co` · `VITE_SUPABASE_PROJECT_ID` = ref staging · `VITE_SUPABASE_PUBLISHABLE_KEY` = anon key **staging** | ☐ | ☐ (che giá trị key) |
| **C-4** | 🔴 **Cờ lập chỉ mục — CẢ HAI tab** | Cùng trang, xem **Production** và **Preview** | `SHOP_PUBLIC_INDEXING` **KHÔNG tồn tại** ở cả hai | ☐ | ☐ |
| **C-5** | Biến **Production** không đổi | Settings → Environment variables → **Production** | `VITE_SUPABASE_*` vẫn trỏ `ajvlcamxemgbxduhiqrl` | ☐ | ☐ (che giá trị key) |
| **C-6** | URL preview | Deployments (sau Packet A) | `https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev` trả 200 | ☐ | ☐ |
| **C-7** | Điểm rollback | Deployments → bản production mới nhất | Ghi lại **deployment ID** production hiện tại **trước** khi đẩy nhánh | ☐ | ☐ |
| **C-8** | Legacy `prerender-worker` | Workers & Pages → Workers | **Không đụng vào.** Vẫn ACTIVE, không đổi route, không đổi phiên bản | ☐ | ☐ |

**Vì sao C-4 quan trọng hơn vẻ ngoài:** một sản phẩm đã bị Google lập chỉ mục là
**cửa một chiều**. Revert gỡ route, **không** gỡ URL khỏi chỉ mục. Sự vắng mặt
của biến là mặc định an toàn — chỉ chuỗi **chính xác** `"1"` mới mở, nhưng cách
chắc chắn nhất là không có biến nào cả.

**Vì sao C-3 đáng cân nhắc trước khi làm:** biến môi trường Preview áp cho **mọi
nhánh**, nên preview của các nhánh SEO/homepage đang chạy song song cũng sẽ trỏ
staging và không còn thấy dữ liệu thật. Hai lựa chọn và một khuyến nghị:
[`approval-packets/packet-s-staging.md` §6](./approval-packets/packet-s-staging.md).
Ai đang chạy nhánh khác cần được báo.

---

## Ghi kết quả

```
Ngày kiểm: __________        Người kiểm: __________________

Project ref staging: utokwfcljxjkpkaqgheo   ✅ đã điền vào toàn bộ tài liệu

Supabase staging
  S-1  tên/org/region             ✅ đã xác minh bằng probe
  S-1b gói = Pro                   [ ] PASS  [ ] FAIL   (chỉ dashboard đọc được)
  S-2  Site URL + Redirect URLs    [ ] PASS  [ ] FAIL   🔴
  S-3  TOTP đã bật                 [ ] PASS  [ ] FAIL
  S-4  1 admin staging có TOTP     [ ] PASS  [ ] FAIL
  S-5  KHÔNG có user production   ✅ đã xác minh (auth.users = 0)
  S-6  allowed origins             [ ] PASS  [ ] FAIL
  S-7  secret (chỉ tên)            [ ] PASS  [ ] FAIL
  S-8  edge function               [ ] PASS  [ ] FAIL  [ ] chưa tới bước
  S-9  pg_cron + pg_net ĐÃ BẬT     [ ] PASS  [ ] FAIL   🔴 (probe: khả dụng, CHƯA cài)
  S-10 cron job                    [ ] PASS  [ ] FAIL  [ ] chưa tới bước
  S-11 bucket (draft = Private)    [ ] PASS  [ ] FAIL  [ ] chưa tới bước
  S-12 migration ledger            [ ] PASS  [ ] FAIL  [ ] chưa tới bước
  S-13 legal_documents rỗng        [ ] PASS  [ ] FAIL

Cloudflare
  C-1  project + nhánh production  [ ] PASS  [ ] FAIL
  C-2  preview cho mọi nhánh       [ ] PASS  [ ] FAIL
  C-3  biến Preview trỏ staging    [ ] PASS  [ ] FAIL   (đã báo phiên khác? [ ])
  C-4  SHOP_PUBLIC_INDEXING vắng   [ ] PASS  [ ] FAIL   🔴  (Production ☐ / Preview ☐)
  C-5  biến Production không đổi   [ ] PASS  [ ] FAIL
  C-6  URL preview 200             [ ] PASS  [ ] FAIL  [ ] chưa tới bước
  C-7  deployment ID rollback      ______________________________
  C-8  prerender-worker không đổi  [ ] PASS  [ ] FAIL

Ghi chú: ______________________________________________________________
```

## Ô nào FAIL thì chặn gì

| FAIL ở | Chặn |
|---|---|
| **S-2** | **Packet A** |
| **S-9** | **Packet C** — cron không lên lịch được |
| **S-5** | **Mọi thứ.** Đó không phải staging — dừng và xác minh lại |
| **C-4** | **Packet A và D** |
| S-3, S-4 | Smoke chạy được nhưng **không chứng minh** được cổng AAL2 |
| C-3 | Preview sẽ trỏ nhầm cơ sở dữ liệu |
| C-1, C-2 | Packet A không dựng được preview |
| C-8 | Dừng — traffic production đang đi qua worker đó |
