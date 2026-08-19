# Risk auditor — shop-catalog-phase-2a

> Nguyên văn output agent `risk-auditor` (có phản biện GPT-5.6), 2026-08-11.
> Artifact model ngoài: `external/risk-brief.md`, `external/risk-openai.md`.

## Verdict: 🔴 RED

Người bán đăng ảnh vi phạm, Cuong bấm "gỡ" trong admin — nhưng ảnh vẫn sống trên URL public của Supabase Storage vì **admin không có policy xoá object của người khác**, Googlebot vẫn nhận trang sản phẩm 200 từ KV thêm 6 tiếng, và người dùng PWA đã xem qua vẫn thấy ảnh đó **tới 30 ngày**.

Classifier: RED (migration) · AMBER (`_middleware.ts`, sitemap) · GREEN (app code).
**Nâng `_middleware.ts` + render layer AMBER → RED** vì tier theo blast-radius, không theo reversibility; cộng lỗ takedown ở #2.

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|---|---|---|---|
| 1 | **Cao** | **CI đã đỏ trước khi 2a viết một dòng.** Build `1fac6b4f`: Total **2054.0 KB gz / backstop 1970** (INITIAL 225.9/280 OK, CODE 1670.0/1800 OK). `.github/workflows/quality.yml:96-98` chạy `BUNDLE_STRICT=1` → `exit(1)`. Nguồn: 32 chunk `src/proto/shop/**` = **86.8 KB gz**, chỉ có trên nhánh này | PR không merge được; gate `quality` đỏ | Xoá/route-gate prototype **trước** 2a. Nhưng 2054 − 86.8 = **1967.2 → còn 2.8 KB** cho toàn bộ 2a. Phải claw back thật (TeamMatchView 29.9, QuickTableView 38.4) hoặc xin bump budget kèm lý do trong `docs/perf-budgets.md` |
| 2 | **Cao** | **Takedown bất khả thi 4 tầng.** (a) `20260512160000_clubs_self_service.sql:137-145` — policy DELETE chỉ `(storage.foldername(name))[1] = auth.uid()::text`, **không nhánh `is_admin()`** → copy khuôn = admin 403 khi xoá ảnh người bán. (b) `_middleware.ts:622` chỉ ghi KV khi `status === 200` → sản phẩm bị gỡ, renderer trả 404 **không đè** bản 200 cũ; TTL 6h; repo không có `PRERENDER_CACHE.delete` nào. (c) `vite.config.ts:218-223` cache `supabase.co/storage/` **CacheFirst 30 ngày**. (d) `useClubLogoUpload.ts:64` `cacheControl: "31536000"` → native WKWebView giữ 1 năm | Admin báo "đã gỡ" nhưng ảnh/trang vẫn hiện với bot, với người đã xem, và với app native | Bucket riêng với policy admin là **OUTER OR**; RPC takedown xoá object + `cacheControl` ngắn cho ảnh moderated; media key bất biến có version; runbook ghi bump `pr:v34→v35` là đường cắt KV duy nhất |
| 3 | **Cao** | **Bucket public = không có ranh giới draft.** Repo có **0 lời gọi `createSignedUrl`**, mọi bucket `public: true`. URL `/storage/v1/object/public/...` phục vụ **không qua RLS**. Ảnh sản phẩm `draft`/`rejected`/`suspended` public ngay từ lúc upload | Ảnh chưa duyệt truy cập được bởi bất kỳ ai có URL | Bucket staging **private** + `createSignedUrl`; promote sang key public khi approve. **Net-new, không có tiền lệ — tính đúng chi phí, đừng gọi là "copy khuôn og-images"** |
| 4 | **Cao** | **`is_shop_member()` mù vai trò.** `20260811090000...sql:191-195`: `shops_update_owner USING (is_shop_member(id))` — `support`/`fulfillment` thoả. Tái dùng cho `products` → một `support` gọi thẳng PostgREST là sửa/xoá được sản phẩm. Trái `shop-marketplace-plan.md:681` | Nhân viên hỗ trợ đổi giá/mô tả/gỡ ảnh; chủ shop không hiểu vì sao | `is_shop_member(_shop_id, _roles shop_member_role[])`; pgTAP negative case cho `support` |
| 5 | TB | **Race seller-vs-moderator** (không phải 2 admin — chỉ có 1 admin). Cuong mở màn duyệt → seller sửa mô tả/ảnh → Cuong bấm Duyệt → row `approved` mang nội dung Cuong **chưa từng xem**, audit log ghi "đã duyệt" | Nội dung không qua kiểm duyệt lên public; audit log nói dối | `UPDATE ... WHERE id=? AND state='pending' AND updated_at=?`, 0 row → "Sản phẩm đã thay đổi, xem lại". Ghi `approved_revision` vào audit |
| 6 | TB | **Slug sản phẩm phải unique TOÀN CỤC**: route là `/shop/product/:slug` (`plan:507`), không có shop segment. Unique `(shop_id, slug)` → 2 shop cùng slug → `.single()` trả 406 `PGRST116` | "Lỗi kết nối — Thử lại" trên URL không bao giờ chạy | Unique global trên slug đã normalize + suffix collision. **SKU thì ngược lại**: unique `(shop_id, upper(trim(sku)))` |
| 7 | TB | **RLS public phải đi hết chuỗi**: product approved **AND** shop active **AND** media/variant thuộc product public. Nếu `product_media`/`product_variants` có policy anon rộng, anon query REST là liệt kê được title/SKU/path của draft | Đối thủ đọc catalog chưa công bố qua REST | pgTAP: mọi bảng mới × anon = 0 row cho state không public. Nhớ GRANT block |
| 8 | Thấp-TB | `shops_select_public_active` (`:172-175`) không có `TO`, cộng `GRANT SELECT TO anon` (`:241`) → anon đọc **mọi cột** shop active, kể cả `owner_user_id` (UUID `auth.users`) | UUID user người bán lộ trong response REST | View public chọn cột, hoặc chấp nhận có chủ đích và ghi vào proposal |
| 9 | Thấp | `shops.intro` không có CHECK độ dài (`:116`, chỉ `name` 3-120) | Mô tả 2 MB phình SSR HTML → chạm `RENDER_BUDGET_MS = 8000` → bot rơi về SPA shell rỗng | CHECK độ dài trên mọi cột free-text public |

## SLO
- **SLO 1** gián tiếp: `/shop/*` không nằm trong smoke. Không gate nào biết nó chết.
- **SLO 6 (Latency VN p75)** trực tiếp: CLS p75 ~0.64 vs mục tiêu ≤0.1. Trang chi tiết = gallery + variant selector, đúng lớp gây CLS đã biết.
- **Không đe doạ** SLO 2/3/4/5/7.

## Ngân sách hiệu năng — đã VƯỢT trước khi bắt đầu
- INITIAL 225.9/280 ✅ · CODE 1670.0/1800 ✅ · **Total 2054.0/1970 ❌ (+84.0)**
- `src/proto/shop/**` = 86.8 KB gz / 32 chunk, **không có trên `main`**
- Xoá prototype → ~1967 → **còn ~3 KB headroom**. Con số "~66 KB headroom" trong proposal cũ **sai dấu, đã lỗi thời**.
- Trang `/shop/product/:slug` là màn ảnh-nặng đầu tiên kể từ khi CLS được sửa 07/2026. Bắt buộc `aspect-ratio` khoá sẵn + `srcset`.

## SEO
- **Chưa có renderer nào** cho `/shop*` — `functions/_lib/render/` không có `product.ts`/`shop.ts`. Fallthrough `_middleware.ts:917` → `render404`. **Ship route public mà quên renderer = Googlebot nhận 404 trong khi SPA hiện hoàn hảo.**
- **Bump `pr:v34`?** KHÔNG cần nếu chỉ *thêm* route mới. CÓ cần nếu sửa output renderer đã có. Và bump là **cơ chế gỡ khẩn duy nhất** khi một trang bị poison — đổi lại cold cache toàn site.
- **Sitemap:** đừng thêm `sitemap-products.xml` ở 2a. Vài chục SKU = thin content; nộp sớm là chuốc "Crawled – currently not indexed" trên cả domain.
- **Song ngữ:** người bán viết **một** bản VI. Mirror `/vi/...` với hreflang trỏ nội dung y hệt = duplicate khai báo sai. Hoặc chỉ VI + `x-default`, hoặc đừng mirror ở 2a.
- Verify: `curl -A Googlebot ".../shop/product/<slug>?nocache=1"` → 200 + title + og:image + hreflang; và với slug đã gỡ → **404/410, kiểm lại lần 2 KHÔNG có `?nocache=1`**.

## Rollback
- `git revert` phục hồi **app code** (~5-10 phút). Không phục hồi: KV bot HTML tới **6h** (hoặc bump `pr:v34` = cold toàn site); ảnh PWA cache **30 ngày**; object Storage **vĩnh viễn** tới khi xoá tay bằng service-role.
- **Không revert được — chính là cái làm nó RED:** (1) migration — `git revert` không un-run SQL, phải có forward-disable viết sẵn trong PR body; (2) seed 6 category — slug đi vào URL public, đổi sau khi index = 404 hàng loạt; (3) ảnh đã upload ở lại bucket; (4) KV + PWA cache.

## Phải verify trước khi merge
- [ ] `BUNDLE_STRICT=1 node scripts/check-bundle-size.mjs` → exit 0. **Hiện exit 1 với 2054.0 KB.** Điều kiện cứng số 1.
- [ ] `supabase db start && supabase test db --local supabase/tests` → 24 assertion Phase 1 **xanh lần đầu tiên**, rồi mới đọc 2a.
- [ ] pgTAP 2a: 7 actor × 4 bảng, **negative-first**. Bắt buộc: anon đọc draft = 0 row; `support` UPDATE product = 42501; seller shop B đọc/sửa shop A = 0 row/42501; client tự set `shop_id`/`moderation_state` bị trigger ghim.
- [ ] `curl` thật với anon key `/rest/v1/product_media?select=*` → `[]`.
- [ ] Admin (AAL2) xoá được object media của seller khác trên local Storage → khuôn `clubs-logos` sẽ **fail** test này. **Test phải đỏ trước khi có fix.**
- [ ] `npm run test -- route-snapshot` sau khi thêm route.
- [ ] Nếu có `renderProduct`: grep `escapeHtml`/`escapeJsonLd` trên **mọi** field người bán nhập. Tiền lệ: `functions/_lib/render/forum.ts:86,123`.
- [ ] `npm run auth:registry -- --strict` (2a không thêm edge function; nếu có là scope creep).

## Phản biện độc lập (GPT-5.6)

**Xác minh trong repo — giữ:**
- "Xoá prototype chỉ còn ~3 KB headroom" — đúng, GPT làm sắc thêm; auditor định dừng ở "xoá proto là xong".
- "MIME/size limit đặt ở bucket thì Storage REST KHÔNG bypass được" — **đúng, sửa một over-claim của auditor**. `20260512160200_clubs_logos_bucket_limits.sql` tồn tại chính vì lý do đó. Chỉ giới hạn ở hook client mới bypass được.
- "Race thật là seller-vs-moderator, không phải 2 admin" — đúng, chỉ có 1 admin. Auditor hạ mục "2 admin" xuống lo xa, thay bằng #5.
- "Slug phải global vì route không có shop segment" — đúng theo `plan:507`.
- "React tự escape → mô tả không sanitise KHÔNG tự động là XSS" — đúng, GPT **gỡ** một rủi ro thay vì thêm. Cơ chế thật chỉ còn SSR string-building và JSON-LD.

**Bác bỏ / sửa lại:**
- "Native Capacitor tránh được cache 30 ngày vì không dùng SW" — **nửa đúng, kết luận sai**. `cacheControl: "31536000"` → WKWebView có HTTP cache riêng tôn trọng header. Native **không** miễn nhiễm — tệ hơn (1 năm, không có đường xoá qua app-store review).
- "CDN staleness sau khi xoá không xác định được" — hedge, bỏ.
- "Dùng private staging bucket + promote là đơn giản hơn" — không "đơn giản hơn" trong repo này. **0 `createSignedUrl` tồn tại**. Giữ khuyến nghị, bỏ chữ "simpler".
- "Boolean inventory là Phase 3 blocker" — đúng nhưng **ngoài phạm vi**, Cuong đã chốt. Không mở lại.

Panel chạy **đủ 2 model** (GPT-5.6 trả lời 14.101 ký tự). **Lỗ hổng tooling:** `scripts/agents/ask-model.mjs` **không tồn tại** trong repo — agent gọi API trực tiếp. Cần vá `/idea`.

## Verdict theo checkpoint

| CP | Nội dung | Tier | Điều kiện hạ |
|---|---|---|---|
| **2a.1** | Migration schema | 🔴 **RED** | **Không hạ được.** Điều kiện *duy nhất* để merge: pgTAP Phase 1 + 2a xanh trên DB thật, forward-disable migration trong PR body, Cuong duyệt tường minh việc áp prod. |
| **2a.2** | Media storage boundary | 🔴 **RED** | → 🟡 AMBER khi đủ **cả ba**: (a) bucket draft `public: false` + `createSignedUrl`; (b) policy `storage.objects` có `is_admin()` là **OUTER OR**, test đỏ-trước-xanh; (c) `file_size_limit` + `allowed_mime_types` đặt ở **bucket**. Không xuống GREEN — object đã upload không revert được. |
| **2a.3** | Moderation state machine + admin UI | 🟡 **AMBER** | → 🟢 GREEN khi approve dùng conditional UPDATE + audit ghi revision đã duyệt; gate overflow `.tl-admin-frame` (bẫy P12) chạy ở 375/768px. |
| **2a.4** | Seller catalog UI | 🟢 **GREEN** | Đã GREEN. Điều kiện: không import `src/proto/shop`. Nâng AMBER nếu làm bundle vượt backstop lần nữa. |
| **2a.5** | Public catalog + SSR/SEO | 🔴 **RED** | Classifier nói AMBER; **nâng RED** vì blast-radius + không có đường purge KV từng key. → 🟡 AMBER khi: có `renderProduct` với `escapeHtml` trên mọi UGC; `curl -A Googlebot` chứng minh 200-có-body cho live **và** 404 cho đã gỡ (verify 2 lần); runbook takedown có bump `pr:vNN`; **không** thêm sitemap ở 2a. |

**Rủi ro thật có bằng chứng:** #1, #2, #3, #4, #6.
**Chỉ lo xa:** 2 admin cùng duyệt (chỉ 1 admin); brute-force đường dẫn object; XSS từ mô tả trong SPA (React escape); xoá category đang có sản phẩm (seed cố định).

**Đóng cửa cho Phase 3:** tồn kho boolean không biểu diễn được số lượng/giữ chỗ/trừ kho đồng thời — Phase 3 phải **thêm mới** model chứ không mở rộng được (Cuong đã chốt). Và: đảm bảo `product_variants.id` là UUID ổn định ngay từ 2a, để `orders` tham chiếu `variant_id` chứ không phải SKU text — nếu không Phase 3 mất snapshot giá/tên tại thời điểm mua.
