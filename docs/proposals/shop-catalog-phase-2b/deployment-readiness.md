# Shop Phase 2b — deployment readiness

> **Trạng thái:** `P2b Product Owner acceptance PASS locally.`
> **Chưa** deploy, **chưa** merge, **chưa** push, **chưa** áp migration lên
> remote, **chưa** bật lập chỉ mục.
>
> Tài liệu này là danh sách những gì còn thiếu, không phải lệnh thi hành. Không
> mục nào ở đây được thực hiện nếu không có chỉ thị riêng.

Ba mốc, ba danh sách. Một mục ở mốc sau **không** chặn mốc trước.

| Mốc | Nghĩa là gì | Ai quyết |
|---|---|---|
| **A. Remote preview** | Nhánh chạy được trên `<branch>.pickle-hub-pro.pages.dev` với Supabase thật | Cuong |
| **B. Production pilot** | 3–5 người bán thật dùng thật, chưa ai tìm thấy qua Google | Cuong |
| **C. Mở công khai** | Google được phép lập chỉ mục | Cuong, riêng biệt |

Ô "Bằng chứng" chỉ được đánh dấu bằng thứ chạy được và in ra số — không phải
bằng "đã đọc code".

---

## Ký hiệu

- `[ ]` chưa làm
- `[~]` làm được một nửa, ghi rõ nửa nào
- `[x]` xong, kèm bằng chứng
- 🔒 **agent không được tự làm** — cần quyền remote hoặc quyết định của Cuong

---

# A. Trước remote preview

## A1. Migration 🔒

17 file, phải áp **đúng thứ tự tên file**. Không file nào destructive với P2a.

```
20260811090000_shop_phase1_seller_onboarding.sql
20260811120000_shop_phase2a_catalog.sql
20260811140000_shop_phase2a_media_lifecycle.sql
20260811150000_shop_media_cleanup_cron.sql
20260811160000_shop_service_role_grants.sql
20260811170000_shop_draft_media_least_privilege.sql
20260811180000_shop_profile.sql
20260811190000_shop_contact_business_phone.sql
20260811200000_shop_product_editor.sql
20260811210000_shop_variants_inventory.sql
20260811220000_shop_media_ordering_profile.sql
20260811230000_shop_preview_submit.sql
20260812090000_shop_p2b_status_suspended.sql
20260812091000_shop_p2b_moderation_backend.sql
20260812120000_shop_p2b_q5_q6_closure.sql
20260813090000_shop_p2b_public_read.sql
20260813120000_shop_p2b_shop_slug_history.sql
```

- [ ] 🔒 **Đọc lại drift trước khi áp.** Nhánh `main` đang có drift migration
      kinh niên từ 04/08 (migration áp qua Management API nên không ghi vào
      `schema_migrations`). **Cấm chèn ledger mù** — có file thật sự chưa áp.
      Đối chiếu từng file trước khi áp bất cứ thứ gì.
- [ ] 🔒 Áp 17 file theo thứ tự, kiểm sau mỗi file.
- [ ] 🔒 `20260811150000_shop_media_cleanup_cron.sql` **cần `pg_cron` và một
      secret trong vault tên `cron_secret`**. Trên local nó tự bỏ qua với
      `RAISE NOTICE`; trên remote nó **RAISE EXCEPTION** nếu vault trống. Nạp
      secret **trước** khi áp file này.
- [ ] 🔒 Sau khi áp xong:
      ```sh
      npx supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl --schema public > src/integrations/supabase/types.ts
      ```
      rồi xoá `src/integrations/supabase/shop-schema.ts` và `shop-client.ts`
      (hai file đó tồn tại **chỉ** vì migration chưa áp — đầu file nói đúng
      điều kiện xoá).

**Bằng chứng cần có:** `select count(*) from supabase_migrations.schema_migrations`
tăng đúng số file thật sự áp, và một `\d public.shop_slug_history` trả về bảng.

**Rollback:** SQL nghịch đảo theo thứ tự phụ thuộc ngược, viết trong thân PR.
Mọi object đều additive nên `DROP` là đủ; không có cột nào của P2a bị đổi kiểu.

## A2. Worker dọn ảnh 🔒

Đây là blocker **nặng nhất** và nó có từ P2a.

- [ ] 🔒 Deploy `supabase/functions/shop-media-lifecycle`:
      ```sh
      npx supabase functions deploy shop-media-lifecycle --project-ref ajvlcamxemgbxduhiqrl
      ```
- [ ] 🔒 `supabase functions list --project-ref ajvlcamxemgbxduhiqrl` phải thấy nó.
      **Code trong repo ≠ đã deploy.**
- [ ] 🔒 Đặt secret `CRON_SECRET` cho function (giá trị **giống** `cron_secret`
      trong vault, nếu không cron gọi sẽ 401).
- [ ] 🔒 Kiểm tay một lần: gọi `?action=cleanup` với header `x-cron-secret` đúng
      → 200; với header sai → 401.

**Vì sao chặn:** đến khi worker chạy, `unpublish` và `suspend` chỉ ngắt con trỏ
trong cơ sở dữ liệu — **tệp ảnh vẫn tải được** với ai đang giữ URL. P2b làm điều
này tệ hơn **về bản chất**, không phải về code: gỡ hàng giờ là một lời hứa hiển
thị cho người mua.

**Rollback:** `supabase functions delete shop-media-lifecycle`. Hàng đợi
`shop_media_cleanup_jobs` chỉ nằm im, không mất dữ liệu.

## A3. Cron

- [ ] 🔒 `cron_secret` có trong `vault.decrypted_secrets`.
- [ ] 🔒 Hai job tồn tại sau khi áp migration:
      `shop-media-cleanup-every-5m` (*/5 * * * *) và
      `shop-media-reconcile-hourly` (17 * * * *).
      ```sql
      SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'shop-media-%';
      ```
- [ ] 🔒 Sau 15 phút, `select count(*) from shop_media_cleanup_jobs where state='pending'`
      không tăng đơn điệu.

## A4. Sức khoẻ hàng đợi

- [ ] 🔒 Cảnh báo khi `shop_media_cleanup_jobs` có job `pending` quá 30 phút.
      Hạ tầng ops đã có (`docs/ops-runbook.md`, bot Telegram); đây là **thêm một
      truy vấn**, không phải dựng hệ thống mới.
- [ ] 🔒 Cảnh báo khi hồ sơ / sản phẩm chờ duyệt lâu nhất quá 48 giờ. Con số đó
      là con số nói rằng người kiểm duyệt đã ngừng nhìn.

## A5. Danh sách người bán thí điểm 🔒

- [ ] 🔒 `shop_pilot_members` **đang rỗng trên remote**. Không có ai trong bảng
      này thì `/seller/application` từ chối **tất cả mọi người**, kể cả Cuong.
- [ ] 🔒 Chèn UUID của từng người bán thí điểm (3–5 người).
      ```sql
      INSERT INTO public.shop_pilot_members (user_id) VALUES ('<uuid>');
      ```
- [ ] 🔒 Danh sách UUID phải do Cuong chọn — agent không có căn cứ chọn hộ.

## A6. Tài khoản admin AAL2

- [ ] 🔒 `thecuong@gmail.com` đã enrol TOTP (đã làm từ 30/07 — xác nhận lại).
- [ ] 🔒 Thử một quyết định thật trên remote: `product_decide` với session aal1
      phải bị từ chối, aal2 phải qua.
- [ ] 🔒 **Chỉ có một** tài khoản admin. Mất authenticator = xoá dòng trong
      `auth.mfa_factors` (cần quyền SQL). Ghi lại đường thoát này ở nơi Cuong
      đọc được khi đang bị khoá ngoài.

## A7. Biến môi trường

| Nơi | Tên | Giá trị pilot | Ghi chú |
|---|---|---|---|
| Cloudflare Pages | `SHOP_PUBLIC_INDEXING` | **không đặt** | Chỉ chuỗi đúng `"1"` mới mở. `"true"`, `"yes"`, `""` đều đóng — đã có test. |
| Supabase functions | `CRON_SECRET` | = `cron_secret` trong vault | |
| Supabase functions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | mặc định | worker cần cả ba |

- [ ] 🔒 Xác nhận `SHOP_PUBLIC_INDEXING` **không** tồn tại trong môi trường
      Pages. Sự vắng mặt là mặc định an toàn.

## A8. Kho ảnh và chính sách

- [ ] 🔒 `shop-product-media-draft` — **private**, 8 MB, chỉ jpeg/png/webp.
- [ ] 🔒 `shop-product-media` — **public**, chỉ webp.
- [ ] 🔒 Kiểm bằng HTTP thật, không bằng đọc migration:
      - GET ẩn danh một object trong bucket draft → **không** 200
      - GET ẩn danh một rendition trong bucket public → **200**
      - upload bằng JWT người dùng vào bucket public → **lỗi**

## A9. Giới hạn đã chấp nhận — thông báo

- [x] **Không có hệ thống thông báo cho người bán.** Người bán không nhận email
      hay push khi sản phẩm bị yêu cầu sửa, bị từ chối hay bị gỡ. Họ chỉ biết
      khi tự mở `/seller/products`.
      Đây là **giới hạn đã biết và chấp nhận cho pilot** với 3–5 người bán mà
      Cuong liên lạc trực tiếp. Xem `notification-contract.md`.
      **Không dựng hạ tầng thông báo mới trong P2b.7.**
- [ ] 🔒 Quy trình thay thế cho pilot: Cuong nhắn trực tiếp cho người bán sau mỗi
      quyết định. Ghi vào runbook.

## A10. Rollback / forward-fix

- [ ] 🔒 Quyết định trước: sự cố ở Shop thì **revert nhánh** hay **tắt route**?
      Mọi route P2b đều mới nên `git revert` không làm mồ côi link nào đang có.
- [ ] 🔒 Nhớ bump `pr:v34` → `pr:v35` nếu SSR đổi, nếu không KV phục vụ HTML cũ.
- [ ] 🔒 **Cửa một chiều duy nhất:** một sản phẩm đã được Google lập chỉ mục.
      Revert gỡ route, không gỡ URL khỏi Google. Đó là lý do mốc C tách riêng.

---

# B. Trước production pilot

- [ ] 🔒 **Product Owner nghiệm thu tay P2b** — `product-owner-test-cases.md`,
      không còn ca 🔴 CHẶN nào FAIL.
- [ ] 🔒 **Chạy lại pgTAP trên remote**, không chỉ local. RLS là thứ khác nhau
      giữa hai môi trường nhiều nhất (grant, role, search_path).
- [ ] 🔒 **E2E người bán / quản trị / người mua trên preview thật**, với tài
      khoản thật và ảnh thật.
- [ ] 🔒 **Kiểm thu hồi ảnh trên remote**: gỡ một sản phẩm, đợi worker, xác nhận
      URL công khai trả về 404. Đây là thứ local không chứng minh được vì local
      không có cron.
- [ ] 🔒 Giám sát: lỗi edge function, tỉ lệ 4xx/5xx của Shop route, tuổi hàng đợi.
- [ ] 🔒 **Runbook hỗ trợ**: ai xử lý khi người bán kêu "ảnh mất", "shop biến
      mất", "không đăng nhập được"?
- [ ] 🔒 **Lưu trữ dữ liệu**: người bán rời chương trình thì shop và ảnh của họ
      xử lý thế nào, giữ bao lâu.
- [ ] 🔒 **Nhân lực kiểm duyệt**: hiện chỉ có một admin. SLA duyệt là bao lâu?
      48 giờ? Nếu Cuong đi vắng một tuần thì sao?
- [ ] 🔒 **Quy chế người bán v1** — văn bản này **chưa tồn tại**. Không thể mời
      người bán thật vào mà không có điều khoản họ đồng ý.
- [ ] 🔒 **Chính sách kênh liên hệ**: điều gì được duyệt, điều gì không. Hiện
      quy tắc nằm trong code (`shop_contact_value_is_safe`) chứ không nằm trong
      một văn bản người kiểm duyệt đọc được.
- [ ] 🔒 **Quy trình sự cố**: người bán đăng hàng giả / hàng cấm. Ai gỡ, trong
      bao lâu, bằng nút nào. `product_decide('suspend')` là nút — quy trình thì
      chưa có.

---

# C. Trước khi bật lập chỉ mục / mở công khai

- [ ] 🔒 **Cuong đồng ý bằng lời, riêng biệt.** Không suy ra từ việc pilot chạy tốt.
- [ ] 🔒 **Ngưỡng chất lượng danh mục.** Một sàn 6 sản phẩm bị Google đánh giá
      thin content, và điểm đó dính vào cả tên miền. Con số tối thiểu là quyết
      định của Cuong; đề xuất tham khảo: ≥3 shop hoạt động, ≥40 sản phẩm đang
      bán, ≥3 ngành hàng có hàng.
- [ ] 🔒 **CHƯA XÂY — SSR cho Shop.** `renderShopProduct` / `renderShopStore`,
      JSON-LD `Product`/`Offer`, và `sitemap-shop.xml` **cố ý chưa làm** (P2b.6).
      Chúng tồn tại để được crawl, và chưa có gì được crawl. Đây là công việc
      của mốc C, không phải nợ kỹ thuật của P2b.
- [ ] 🔒 Thêm `sitemap-shop.xml` vào sitemap index, kèm hreflang en/vi/x-default.
- [ ] 🔒 IndexNow cho URL Shop.
- [ ] 🔒 Canonical và redirect: đường dẫn cũ phải trả **301 thật ở edge**, không
      chỉ `<Navigate>` phía client như hiện nay.
- [ ] 🔒 **LOCALE REDIRECT — quyết định đang chờ Product Owner.** Xem mục riêng
      bên dưới. **Không chặn pilot**, nhưng **phải chốt trước khi bật index**.
- [ ] 🔒 Xoá cache: bump `pr:v`, và `?nocache=1` cho từng path sau khi deploy.
- [ ] 🔒 Chất lượng tìm kiếm: `shop_public_search` hiện dùng `search_doc`
      tsvector + unaccent. Đủ cho 40 sản phẩm; đo lại trước khi mở.
- [ ] 🔒 Hiệu năng / RUM: Shop route vào ngân sách bundle (INITIAL ≤280 KB) và
      không làm xấu CLS — mốc `CLS-ATTR-READ` 17/08 đọc số thật.
- [ ] 🔒 SLA hỗ trợ người mua. Hiện **không có** kênh nào cho người mua ngoài
      việc liên hệ thẳng shop.
- [ ] 🔒 Xác minh sau deploy, đúng cách:
      ```sh
      curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
        "https://www.thepicklehub.net/shop/product/<slug>?nocache=1"
      ```
      Đếm **số từ trong thân bài**, không chỉ nhìn thẻ meta — lần hụt 05/08 có
      thẻ hoàn hảo và bài rỗng.

---

---

# Quyết định đang chờ — chuyển hướng có giữ ngôn ngữ không?

**Trạng thái: CHƯA SỬA, cố ý.** Không sửa trong đợt supplemental này.

## Hiện trạng

`/vi/shop/store/<slug-cũ>` chuyển hướng sang **`/shop/store/<slug-mới>`** —
mất tiền tố `/vi`. Sản phẩm cũng vậy. Nguồn: `ProductDetail.tsx` và
`ShopStore.tsx` dựng đích bằng chuỗi EN cứng.

Đây **không phải lỗi riêng của Shop**: mọi link nội bộ trong sản phẩm đều viết
cứng đường dẫn EN (`VenuesList.tsx`, `ClubsList.tsx`, …). Shop đang theo đúng
quy ước sẵn có. Đổi nó là một quyết định điều hướng/SEO toàn site.

## Vì sao không chặn pilot

Trong pilot mọi route Shop đều `noindex, nofollow, noarchive` ở edge — đã kiểm
bằng 96 assertion gọi thẳng `onRequest`. Không có bản EN hay VI nào được lập
chỉ mục, nên **không có canonical/hreflang nào lệch được**. Ảnh hưởng hiện tại
chỉ là: người dùng VI theo một link cũ sẽ rơi vào route EN.

## Vì sao phải chốt trước khi bật index

Khi Shop mở cho crawler, một chuyển hướng đổi ngôn ngữ sẽ:

- gộp tín hiệu VI vào URL EN;
- làm hreflang tự mâu thuẫn (VI trỏ sang trang mà chính nó redirect đi);
- đẩy người đọc Việt sang trang tiếng Anh — với ~95% người dùng là người Việt,
  đây là thiệt hại thật chứ không phải chi tiết kỹ thuật.

## Khuyến nghị (chờ Cuong duyệt)

Giữ nguyên ngôn ngữ khi chuyển hướng:

| Vào | Ra |
|---|---|
| `/vi/shop/product/<cũ>` | `/vi/shop/product/<mới>` |
| `/shop/product/<cũ>` | `/shop/product/<mới>` |
| `/vi/shop/store/<cũ>` | `/vi/shop/store/<mới>` |
| `/shop/store/<cũ>` | `/shop/store/<mới>` |

- canonical theo đúng chính sách locale đang dùng cho phần còn lại của site;
- **không** ép người dùng VI sang EN;
- làm ở **giai đoạn triển khai sau**, trong task deployment-readiness — không
  cần mở lại toàn bộ nghiệm thu P2b.

Kèm theo, khi làm: chuyển hướng ở edge phải là **301 thật**, không chỉ
`<Navigate>` phía client như hiện nay (mục ở mốc C bên trên).

---

## Những gì P2b.7 **đã** chứng minh (local)

Để danh sách trên không bị đọc nhầm thành "chưa có gì hoạt động":

| Việc | Bằng chứng |
|---|---|
| Ledger migration | 350/350 sau `db reset` sạch |
| Quy tắc trong Postgres | 1.241 pgTAP PASS (chạy lại sau khi QA chạy xong) |
| Logic ứng dụng | 2.014 unit test PASS (10 skipped) |
| Ảnh đổi theo phiên bản | `shop-p2b-variant-media-qa.mjs` — so trên khoá object công khai, đỏ khi phá PDP |
| Xoá EXIF/GPS/XMP | `shop-p2b-exif-pipeline-qa.mjs` — byte thật, qua worker thật, đỏ khi bỏ inspector |
| noindex ở edge | 96 assertion, 9 loại route × 6 giá trị cờ, đọc từ Response thật |
| Toàn bộ 20 route × 6 chiều rộng | `node scripts/shop-p2b-acceptance-qa.mjs` PASS |
| 6 hành trình đầu-cuối | cùng lệnh trên |
| noindex ở edge | 41 test gọi thẳng `onRequest`, đỏ khi phá call site |
| Vòng đời ảnh | 7 test trên byte thật, gồm ca republish |
| Dọn dữ liệu | đếm lại bằng DB + Storage, 0 ở 17 loại |

**Câu trạng thái được phép dùng hôm nay:**

> `P2b Product Owner acceptance PASS locally.`

**Cấm dùng:** *production ready*, *deployed*, *remote verified*,
*public launch approved*.
