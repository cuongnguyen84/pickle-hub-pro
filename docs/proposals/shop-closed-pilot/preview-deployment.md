# CP7 — Kế hoạch triển khai preview

> **Không deploy nào được thực hiện.** Thi hành:
> [`approval-packets/packet-a-preview.md`](./approval-packets/packet-a-preview.md).

---

## 1. Preview trên hạ tầng này thật ra là gì

Cloudflare Pages project `pickle-hub-pro` nối trực tiếp với GitHub. Nhánh
production là `main`; **mọi nhánh khác được build tự động thành một preview**.
Đã quan sát thấy 6 preview đang sống từ 6 nhánh khác nhau.

Nghĩa là: **không có lệnh deploy nào cả.** Packet A xin phép đúng **một** thao
tác — đẩy `feat/shop-closed-pilot` lên GitHub. Cloudflare lo phần còn lại.

URL sẽ có hai dạng:

| Dạng | Ví dụ | Tính chất |
|---|---|---|
| Theo deployment | `https://<hash>.pickle-hub-pro.pages.dev` | bất biến, dùng để rollback |
| Theo nhánh | `https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev` | luôn trỏ vào bản mới nhất của nhánh |

Dùng **URL theo nhánh** cho smoke và cho người kiểm thử; ghi lại **URL theo
deployment** như điểm rollback.

---

## 2. Preview trỏ vào Supabase nào — ✅ ĐÃ QUYẾT

> **Product Owner, 2026-08-12, quyết định #1: preview dùng Supabase staging
> riêng. KHÔNG trỏ vào Supabase production.**

Khuyến nghị trước đó của agent — preview web + Supabase production — **đã bị từ
chối**, và lý do từ chối đứng vững hơn khuyến nghị:

- 18 migration Shop chưa cần sống trên production trước khi pilot được duyệt;
- test tạo/xoá được người bán, ảnh, cron, allowlist mà không chạm dữ liệu thật;
- chạy được migration, worker và cron **đầy đủ**, không phải drain tay;
- rollback đơn giản hơn — xoá một project là một thao tác;
- **giảm rủi ro từ drift migration có sẵn** — điểm agent đánh giá thấp nhất:
  áp 18 migration vào một cơ sở dữ liệu đã có 29 file lệch ledger và **một file
  thật sự chưa áp** là thêm biến vào một hệ đã có ẩn số.

Hệ quả cho tài liệu này: mọi chỗ dưới đây nói "dùng chung cơ sở dữ liệu với
production" **không còn đúng cho preview**. Phần §7 (dọn dẹp) nhẹ đi hẳn —
staging xoá sạch được — nhưng vẫn giữ nguyên vì nó đúng nguyên vẹn cho
**production pilot** ở bước 9-12 của thứ tự mới.

Yêu cầu về project staging, kể cả hai thứ phải kiểm **trước khi chọn gói**
(`pg_cron`/`pg_net` có bật được không, và việc Free tier tự tạm dừng sau ~7 ngày
không hoạt động — một project ngủ giữa pilot làm cron ngừng chạy và ảnh đã gỡ ở
lại):
[`approval-packets/packet-s-staging.md`](./approval-packets/packet-s-staging.md).

⇒ Thứ tự mới: **S → B(staging) → C(staging) → A → smoke → nghiệm thu →
B/C(production) → D**. Đầy đủ ở
[`approval-packets/README.md`](./approval-packets/README.md).

---

## 3. Ma trận môi trường

| Chiều | Preview | Production hôm nay | Production pilot (sau) |
|---|---|---|---|
| Nhánh Git | `feat/shop-closed-pilot` | `main` | `main` (sau khi merge) |
| Cloudflare | preview tự động | `pickle-hub-pro` | `pickle-hub-pro` |
| Supabase | `ajvlcamxemgbxduhiqrl` | cùng | cùng |
| Route Shop | **có** | **không có** | có |
| `SHOP_PUBLIC_INDEXING` | **không đặt** | không đặt | **không đặt** |
| `shop_pilot_members` | rỗng → tài khoản test | rỗng | UUID đã duyệt |
| `shop-media-lifecycle` | phải deploy trước | chưa deploy | deployed |
| Cron Shop | phải tồn tại trước | không có | 2 job |
| Prototype `/proto/shop` | **không có trong artifact** (D4) | không có | không có |

Preview và production **dùng chung** cơ sở dữ liệu, Edge Functions, Storage và
cron. Đây là hệ quả của việc chỉ có một project, và nó là lý do §7 (dọn dẹp)
không phải tuỳ chọn.

---

## 4. Tên biến môi trường và secret

**Không biến mới nào được tạo cho preview.**

| Nơi | Tên | Preview |
|---|---|---|
| Cloudflare Pages | `SHOP_PUBLIC_INDEXING` | **không đặt** — kiểm bằng mắt (BLOCKER B2) |
| Cloudflare Pages | `CANONICAL_HOST` | giữ nguyên |
| Build (`VITE_*`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | như production |
| Build | `VITE_PROTO_SHOP` | **không đặt** — prototype bị loại ở compile time (D4) |
| Supabase Edge | `CRON_SECRET`, `SUPABASE_*` | đã có, không đụng |

🔴 **BLOCKER B2** — không có lệnh CLI chỉ đọc nào liệt kê biến môi trường của
Pages. Cuong phải xác nhận bằng mắt, cho **cả** Production và Preview, rằng
`SHOP_PUBLIC_INDEXING` không tồn tại. Kiểm tra 30 giây, và nó là thứ đứng giữa
"pilot kín" và "Google thấy sáu sản phẩm".

---

## 5. Origin, redirect và CORS

### 5.1 Auth redirect URL

🔴 **BLOCKER B1** — URL preview phải có trong Supabase → Authentication → URL
Configuration → **Redirect URLs**:

```
https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev/**
```

Không có nó, đăng nhập trên preview bật ngược về production và **toàn bộ smoke
seller/admin trở nên vô nghĩa** — người kiểm thử sẽ đăng nhập thành công vào một
site không có Shop và tưởng là hỏng.

Không kiểm được ở chế độ chỉ đọc: endpoint `config/auth` trả về `smtp_pass` và
các `external_*_secret` trong cùng payload; đọc nó là đọc secret.

### 5.2 CORS của edge function

`shop-media-lifecycle` dùng `corsHeaders` từ `_shared/cors.ts`. **Không nới, không
inline header** (`architecture-boundaries.md` §edge rule 2). Nếu preview origin
không nằm trong preset hiện hành, `publish` sẽ hỏng trên preview — kiểm ở smoke
bước 12, không suy đoán.

### 5.3 URL Storage

Rendition công khai phục vụ từ
`https://ajvlcamxemgbxduhiqrl.supabase.co/storage/v1/object/public/shop-product-media/…`
— **cùng một URL** trên preview và production, vì cùng một project. Ảnh tạo ra
trong smoke preview sẽ tồn tại thật; xem §7.

---

## 6. Kiểm noindex — thứ phải xanh trước khi bất kỳ ai khác nhận URL

```sh
BASE=https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev

# Mọi route người mua phải mang header, cả EN lẫn /vi
for p in /shop /shop/search /shop/category/vot /shop/product/x /shop/store/y \
         /vi/shop /vi/shop/search /vi/shop/category/vot /vi/shop/product/x /vi/shop/store/y; do
  printf '%-32s %s\n' "$p" \
    "$(curl -sI "$BASE$p" | grep -i '^x-robots-tag' || echo 'MISSING ← ĐỎ')"
done
# kỳ vọng mọi dòng: noindex, nofollow, noarchive

# Bề mặt người bán và quản trị noindex VÔ ĐIỀU KIỆN
for p in /shop/sell /seller /seller/products /admin/shop/products; do
  printf '%-32s %s\n' "$p" "$(curl -sI "$BASE$p" | grep -i '^x-robots-tag')"
done

# robots.txt phải Disallow catalogue người mua
curl -s "$BASE/robots.txt" | grep -E '^Disallow: /(vi/)?shop'
# kỳ vọng 10 dòng

# Sitemap KHÔNG được nhắc tới Shop
curl -s "$BASE/sitemap.xml" | grep -ci shop
# kỳ vọng: 0

# Một route không phải Shop KHÔNG được nhiễm noindex (chứng minh mẫu không quá rộng)
curl -sI "$BASE/tournaments" | grep -i '^x-robots-tag' && echo "ĐỎ — quá rộng" || echo "ok"
```

Cùng ma trận này đã được chứng minh cục bộ bằng 96 assertion đọc từ Response
thật do `onRequest` trả về, chín lớp route × sáu giá trị cờ, cộng một control
không thuộc Shop. Ở preview nó được chạy lại **trên HTTP thật**, vì đó là thứ
duy nhất chứng minh cấu hình Cloudflare khớp mã nguồn.

---

## 7. Tài khoản test và dọn dẹp — không tuỳ chọn

Vì preview dùng **chung** cơ sở dữ liệu với production, mọi thứ smoke tạo ra là
**dữ liệu thật**.

### Trước smoke

1. Tạo 2 tài khoản test (1 seller, 1 buyer) bằng email nhận diện được:
   `shop-pilot-smoke+seller@…`, `shop-pilot-smoke+buyer@…`.
2. Thêm UUID seller test vào `shop_pilot_members` theo
   [`pilot-allowlist.md` §5.2](./pilot-allowlist.md), lý do ghi rõ `smoke test`.
3. Ghi lại **cả hai UUID** — chúng là danh sách dọn.

### Sau smoke

Chạy teardown, rồi **đếm lại** — không tin vào việc đã ra lệnh xoá:

```sql
SELECT 1;
SELECT
  (SELECT count(*) FROM public.shops             WHERE owner_user_id = ANY($ids)) AS shops,
  (SELECT count(*) FROM public.products p JOIN public.shops s ON s.id = p.shop_id
     WHERE s.owner_user_id = ANY($ids))                                            AS products,
  (SELECT count(*) FROM public.shop_applications WHERE applicant_user_id = ANY($ids)) AS applications,
  (SELECT count(*) FROM public.shop_pilot_members WHERE user_id = ANY($ids))       AS pilot_rows,
  (SELECT count(*) FROM storage.objects WHERE bucket_id LIKE 'shop%')              AS shop_objects;
```

> ⚠️ Bài học P2b.7: một teardown từng in **toàn số 0** cho ba shop nó chưa xoá,
> vì báo cáo dùng `?? 0` biến lỗi đếm thành "sạch" và xoá theo sai cột. **Chỉ một
> truy vấn chạy trên CHÍNH cơ sở dữ liệu vừa QA mới bắt được điều đó.** Đếm bằng
> câu trên, không bằng output của script teardown.

`shop_objects` là con số nguy hiểm nhất: nó đếm object thật trong Storage, và
Storage **không** nằm trong sao lưu cơ sở dữ liệu.

### Cấm

- ❌ Không dùng tài khoản người bán thật trước khi smoke xanh.
- ❌ Không để lại dữ liệu test nào — kể cả một dòng `shop_pilot_members`.
- ❌ Không gửi email/push thật. Không có dispatcher nào chạy
  ([`notification-decision.md`](./notification-decision.md)), nên rủi ro duy nhất
  là email xác thực khi tạo tài khoản test — dùng địa chỉ mình kiểm soát.

---

## 8. Rollback

| Thứ | Cách | Thời gian |
|---|---|---|
| Web preview | Không cần rollback — xoá nhánh trên GitHub, preview biến mất. Web production không bao giờ bị chạm | phút |
| Nếu đã merge vào `main` | Dashboard → Pages → Deployments → deployment id đã ghi → Rollback | phút |
| Cổng pilot | `DELETE FROM shop_pilot_members` | giây |
| Schema, cron, function | [`migration-deployment.md` §10](./migration-deployment.md) | |

**Ghi lại deployment id cuối cùng đã biết tốt của production TRƯỚC khi đẩy nhánh.**
Nó không dùng đến trong luồng preview, nhưng nó là thứ ta sẽ muốn có nếu ai đó
nhầm nhánh.

Cache prerender: bump `pr:v34` → `pr:v35` **chỉ khi** đầu ra SSR thay đổi. Pilot
này **không** thêm SSR handler cho Shop (cố ý — P2b.6), nên **không cần bump**.
Nếu ai đó thấy mình định bump, hãy dừng lại và hỏi vì sao đầu ra SSR đổi.

---

## 9. Bộ smoke

24 kiểm, kèm script: [`acceptance.md`](./acceptance.md) và
`scripts/shop-closed-pilot-smoke.mjs`.

Thứ tự chạy trên preview:

1. **Ẩn danh trước** — bước 1, 2, 21, 22 của bộ smoke. Nếu noindex hoặc rò rỉ
   sai, dừng ngay và không ai khác nhận URL.
2. **Người bán ngoài danh sách** — bước 3. Phải bị chặn.
3. **Người bán trong danh sách** — bước 4-15.
4. **Người mua** — bước 16-17.
5. **Vòng đời ảnh** — bước 19. Đây là thứ cục bộ **không** chứng minh được, vì
   cục bộ không có cron.
6. **Kill switch, chạy khô** — bước 23.
7. **Dọn dẹp** — bước 24, rồi đếm lại theo §7.

---

## 10. Ngưỡng nghiệm thu preview

Product Owner ký "preview acceptance" khi và chỉ khi:

- [ ] 24/24 kiểm smoke xanh trên preview
- [ ] Ma trận noindex §6 xanh trên HTTP thật
- [ ] Sitemap không nhắc tới Shop
- [ ] Ảnh bị thu hồi thật sự 404 sau khi worker chạy (kiểm bằng cron thật, không
      phải drain tay)
- [ ] Hàng đợi dọn ảnh sạch: `pending`/`due_now`/`stuck`/`failed` = 0
- [ ] Dữ liệu test đã dọn, **đã đếm lại**, `shop_objects` = 0
- [ ] Không có chữ ký lỗi mới trong `client_errors` (dùng `soak-watch.mjs` với
      baseline lấy **trước** khi đẩy nhánh — không có baseline thì không phát
      hiện được cái gì là mới)

Chỉ khi đó mới đề nghị packet production-pilot.
