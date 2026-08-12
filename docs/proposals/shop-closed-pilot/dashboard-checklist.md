# Checklist dashboard — bảy mục cho Product Owner

> Bảy thứ **không lệnh CLI chỉ-đọc nào đọc được**, hoặc đọc được nhưng chỉ cùng
> lúc với các giá trị bí mật trong cùng payload. Chúng phải được nhìn bằng mắt.
>
> Mất khoảng **5 phút**. Mục 4 và 5 là hai mục đứng giữa "pilot kín" và "Google
> thấy sáu sản phẩm".

**Không chụp màn hình có chứa secret.** Nếu cần ghi lại, chép **tên** biến và
kết quả có/không — không chép giá trị. Một khoá dán vào chat là một khoá đã lộ,
kể cả trong chat riêng.

---

## 1. Cloudflare — nhánh production

**Pages → `pickle-hub-pro` → Settings → Builds & deployments**

- [ ] Production branch là **`main`**, không phải gì khác.

Vì sao: nếu nhánh production bị đổi, `git push` một nhánh tính năng sẽ deploy
thẳng lên `thepicklehub.net` thay vì dựng preview.

## 2. Cloudflare — hành vi preview

**Cùng trang**

- [ ] Preview deployments: **All branches** (hoặc ít nhất có `feat/shop-closed-pilot`).

Vì sao: Packet A xin phép đúng một thao tác — đẩy nhánh. Nếu preview bị tắt,
không có gì được dựng và packet không làm gì cả.

## 3. Cloudflare — biến môi trường web trỏ vào đâu

**Pages → `pickle-hub-pro` → Settings → Environment variables → Preview**

Ghi lại (chỉ **tên** và trỏ tới đâu, không chép giá trị):

- [ ] `VITE_SUPABASE_URL` (Preview) = `https://<STAGING_REF>.supabase.co`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` (Preview) = anon key **của staging**
- [ ] `VITE_SUPABASE_PROJECT_ID` (Preview) = `<STAGING_REF>`
- [ ] Production giữ nguyên trỏ `ajvlcamxemgbxduhiqrl`

⚠️ Đây là thay đổi có sức công phá nhất trong gói: biến Preview áp cho **mọi
nhánh**, nên preview của các nhánh SEO/homepage đang chạy song song cũng sẽ trỏ
staging. Xem [`approval-packets/packet-s-staging.md` §6](./approval-packets/packet-s-staging.md)
— có hai lựa chọn và một khuyến nghị.

## 4. 🔴 Cloudflare — cờ lập chỉ mục, **cả hai môi trường**

**Cùng trang, xem cả tab Production lẫn tab Preview**

- [ ] `SHOP_PUBLIC_INDEXING` **KHÔNG tồn tại** ở **Production**
- [ ] `SHOP_PUBLIC_INDEXING` **KHÔNG tồn tại** ở **Preview**

Sự vắng mặt là mặc định an toàn. Chỉ chuỗi **chính xác** `"1"` mới mở lập chỉ
mục; `"true"`, `"yes"`, `"0"`, `""` đều đóng — nhưng cách chắc chắn nhất là
không có biến nào cả.

Vì sao mục này quan trọng hơn vẻ ngoài: một sản phẩm đã bị Google lập chỉ mục là
**cửa một chiều**. Revert gỡ route, không gỡ URL khỏi chỉ mục.

## 5. 🔴 Supabase STAGING — Redirect URLs

**Dashboard staging → Authentication → URL Configuration**

- [ ] **Site URL** = URL preview
- [ ] **Redirect URLs** có `https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev/**`

Vì sao: không có nó, đăng nhập trên preview bật ngược đi nơi khác và **toàn bộ
smoke seller/admin trở nên vô nghĩa** — người kiểm thử đăng nhập thành công vào
một site không có Shop rồi kết luận là hỏng.

Agent **không đọc được** mục này: endpoint cấu hình auth trả `smtp_pass` và các
`external_*_secret` trong cùng payload, nên đọc nó là đọc secret.

## 6. Supabase STAGING — TOTP và tài khoản admin

**Dashboard staging → Authentication → Providers / Multi-Factor**

- [ ] MFA (TOTP) **đã bật**
- [ ] Có **một** tài khoản admin staging, đã enrol TOTP
- [ ] UUID của nó **khác** admin production

Vì sao: `is_admin()` chỉ đòi aal2 khi người dùng **có** factor đã verify. Một
staging không có TOTP sẽ cho mọi phiên đi qua, và smoke sẽ báo "cổng AAL2 hoạt
động" trên một cổng đang mở.

## 7. Supabase STAGING — extension lên lịch

**Dashboard staging → Database → Extensions**

- [ ] `pg_cron` bật được
- [ ] `pg_net` bật được
- [ ] `supabase_vault` khả dụng

Vì sao: nếu không, Packet C mất phần quan trọng nhất — chứng minh worker chạy
theo **lịch thật** — và preview chỉ còn drain tay, tức là đúng thứ môi trường
cục bộ đã làm được. Biết điều này **trước** khi chọn gói thì rẻ hơn nhiều so
với sau.

---

## Ghi kết quả

```
Ngày kiểm: __________   Người kiểm: __________

1. Production branch = main                      [ ] ok  [ ] KHÔNG
2. Preview build cho mọi nhánh                   [ ] ok  [ ] KHÔNG
3. VITE_SUPABASE_* (Preview) trỏ staging         [ ] ok  [ ] KHÔNG
4. SHOP_PUBLIC_INDEXING vắng ở Production        [ ] ok  [ ] KHÔNG
   SHOP_PUBLIC_INDEXING vắng ở Preview           [ ] ok  [ ] KHÔNG
5. Redirect URL preview có ở STAGING             [ ] ok  [ ] KHÔNG
6. TOTP bật + 1 admin staging đã enrol           [ ] ok  [ ] KHÔNG
7. pg_cron / pg_net / vault khả dụng             [ ] ok  [ ] KHÔNG

Ghi chú: ______________________________________________________________
```

Bất kỳ ô **KHÔNG** nào ở mục 4, 5 hoặc 7 đều **chặn Packet A**. Mục 1-3 và 6
chặn việc smoke có ý nghĩa gì hay không.
