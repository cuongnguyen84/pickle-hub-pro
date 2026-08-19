# CP0 — Canonical release inventory (Shop closed pilot)

> **Trạng thái:** `Closed-pilot deployment package prepared and verified
> locally, pending Product Owner approval for remote actions.`
>
> Tài liệu này là bản kiểm kê. Nó **không** là lệnh thi hành. Không mục nào ở
> đây được thực hiện trên remote nếu chưa có approval packet tương ứng
> (`approval-packets/`).

Viết 2026-08-12 sau khi xác minh Git graph, đọc 17 migration Shop, edge
function `shop-media-lifecycle`, `functions/_middleware.ts`, `functions/robots.txt.ts`,
và sau một vòng probe **chỉ đọc** vào project `ajvlcamxemgbxduhiqrl`.

---

## 1. Commit gốc và nhánh

| Việc | Giá trị | Cách xác minh |
|---|---|---|
| Canonical P2b acceptance HEAD | **`f172a441fb182dc562af4c0d20d13a73fa0b0326`** | `git rev-parse feat/shop-production-phase-2b` |
| Nhánh nguồn | `feat/shop-production-phase-2b` (tip = canonical, không có commit nào sau) | `git log -1` |
| Nhánh closed pilot | **`feat/shop-closed-pilot`**, tạo từ `f172a441` | `git worktree add … -b feat/shop-closed-pilot f172a441` |
| Worktree | `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-closed-pilot` | sạch khi tạo (`git status --porcelain` = 0 dòng) |
| Base P2a | `afdb9a0a` — `docs(shop): P2a Product Owner acceptance PASS locally` | commit #57 trong dãy |
| Merge-base với `main` | `8dd30e51` | `git merge-base HEAD main` |
| Số commit trước `main` | **82** | `git rev-list --count main..HEAD` |
| Số commit `main` chưa có ở nhánh này | **12** | `git rev-list --count HEAD..main` |
| Remote | **Nhánh CHƯA được push.** `origin/feat/shop-production-phase-2b` không tồn tại. | `git rev-parse origin/…` → `unknown revision` |

**Xác nhận ba supplemental commit P2b.7b nằm TRONG nền tảng canonical** — chúng
không bị bỏ sót:

```
2681b1b2  test(shop): supplemental A — the photo follows the variant, on the real PDP
e96db70e  test(shop): supplemental B — EXIF on real bytes, and the full robots matrix
f172a441  docs(shop): P2b.7b supplemental results, locale-redirect decision, status
```

`f172a441` là commit cuối, không phải `7b52cc37`. Bất kỳ tài liệu nào nói
"acceptance @ 7b52cc37" đều nói về thời điểm nghiệm thu có điều kiện, không phải
nền tảng triển khai.

### 12 commit trên `main` chưa có trong nhánh Shop

Không commit nào chạm vào Shop; đều là SEO/homepage/livestream. Chúng **không**
chặn preview, nhưng nhánh closed-pilot sẽ mang một `main` cũ hơn 12 commit khi
deploy — quyết định rebase/merge nằm trong Packet A.

```
31efb6a4 Invalidate cached OAuth homepage title (#563)
899a21a7 Match homepage name to OAuth branding (#562)
1fdb1be9 Remove duplicate homepage identity strip (#561)
615ff8ee Match homepage brand to OAuth app name (#560)
452f5931 Add Google sign-in data disclosures (#559)
35622c7c Invalidate cached homepage prerender (#558)
ced39fe3 Clarify ThePickleHub purpose in homepage manifesto (#557)
5c68ab74 show thumbnail for scheduled livestreams
b578d4c1 fix livestream thumbnail cropping
1b0b011c feat(seo): extend DUPR->/tools internal links (algorithm + user-guide, EN)
ff6f986f feat(seo): link DUPR cluster to /tools money page (EN+VI internal links)
0b27a4d3 Retire the blob-loss auto-heal layer now that Supabase confirmed the fix (#556)
```

### Kiểm tra vệ sinh Git

| Kiểm tra | Kết quả |
|---|---|
| Duplicate / cherry-pick trùng patch với `main` | **0** — `git log --cherry-mark main...HEAD` không có dòng `=` nào |
| File untracked / bẩn từ phiên khác | **0** — `git status --porcelain -uall` rỗng |
| `shop-marketplace-plan.md` tracked | ✅ `git ls-files` trả về |
| `shop-marketplace-screen-tasks.md` tracked | ✅ |
| `shop-marketplace-product-owner-test-cases.md` tracked | ✅ |
| Migration local đều tracked | ✅ 350 file trên đĩa = 350 file trong `git ls-files supabase/migrations` |
| `.env` / token / TOTP secret / service key trong diff `main..HEAD` | **0 hit** trên 3,05 MB diff (mẫu `sbp_`, `ghp_`, `SUPABASE_SERVICE_ROLE_KEY=`, `CLOUDFLARE_API_TOKEN=`) |
| Đường dẫn hình dạng secret trong 264 file thay đổi | **0** — không có `.env`, `ios/`, `secrets`, `.pem` |

Hai kết quả dương tính giả đã loại, cả hai **không** do Shop tạo ra:

1. `docs/proposals/shop-catalog-phase-2b/product-owner-test-cases.md:67` chứa
   `VITE_SUPABASE_PUBLISHABLE_KEY=eyJ…` — đây là **anon key demo của Supabase
   local** (issuer `supabase-demo`), giá trị công khai giống hệt trên mọi máy
   chạy `supabase start`. Không phải bí mật.
2. `ios/App/App/public/assets/*.js` chứa publishable key production — file build
   sẵn có trong repo từ trước, **không** nằm trong diff `main..HEAD`.

---

## 2. Generated types và hai file tạm

| File | Trạng thái | Điều kiện xoá |
|---|---|---|
| `src/integrations/supabase/types.ts` | tracked, **chưa** chứa bảng Shop (remote chưa có schema) | regenerate sau khi áp migration |
| `src/integrations/supabase/shop-schema.ts` | tracked — bảng/RPC viết tay cho Shop | xoá **sau khi** `gen types` trả về bảng Shop |
| `src/integrations/supabase/shop-client.ts` | tracked — client typed theo `shop-schema.ts` | xoá cùng lúc |

Đây là hệ quả tất yếu của "migration chưa áp", không phải nợ kỹ thuật. Chuỗi
đúng nằm trong `migration-deployment.md` §5.

---

## 3. Migration Shop — 17 file, đúng thứ tự

Thứ tự áp = thứ tự tên file. Không file nào destructive.

| # | File | Nội dung chính |
|---|---|---|
| 1 | `20260811090000_shop_phase1_seller_onboarding.sql` | `shop_pilot_members`, `shop_applications`, `shop_application_events`, `shops`, `shop_members`; `shop_pilot_has_access()`; `unaccent_immutable()`; **widen `audit_logs_resource_type_check`** |
| 2 | `20260811120000_shop_phase2a_catalog.sql` | `product_categories`, `products`, `product_variants`, `product_media`, `product_submission_events`; **2 storage bucket**; state machine + RLS |
| 3 | `20260811140000_shop_phase2a_media_lifecycle.sql` | `shop_media_cleanup_jobs`, `shop_media_cleanup_health` view, claim/complete/reconcile, `product_publish_prepare/commit` |
| 4 | `20260811150000_shop_media_cleanup_cron.sql` | **2 pg_cron job** gọi `shop-media-lifecycle` |
| 5 | `20260811160000_shop_service_role_grants.sql` | grant cho `service_role` |
| 6 | `20260811170000_shop_draft_media_least_privilege.sql` | thu hẹp quyền đọc draft (support member mất quyền) |
| 7 | `20260811180000_shop_profile.sql` | hồ sơ shop, `shop_slug_update`, `shop_contact_channels` |
| 8 | `20260811190000_shop_contact_business_phone.sql` | `vn_phone_e164`, tách số điện thoại doanh nghiệp khỏi Zalo |
| 9 | `20260811200000_shop_product_editor.sql` | `product_create/update/edit_sections`, version guard |
| 10 | `20260811210000_shop_variants_inventory.sql` | ma trận biến thể, SKU, `inventory_movements` |
| 11 | `20260811220000_shop_media_ordering_profile.sql` | `shop_profile_media`, thứ tự ảnh, ảnh theo biến thể |
| 12 | `20260811230000_shop_preview_submit.sql` | `product_public_projection`, preflight, submit |
| 13 | `20260812090000_shop_p2b_status_suspended.sql` | trạng thái `suspended` |
| 14 | `20260812091000_shop_p2b_moderation_backend.sql` | `product_moderation_queue/detail/history`, `product_decide`, `shop_contact_decide` |
| 15 | `20260812120000_shop_p2b_q5_q6_closure.sql` | Q5 khôi phục sau suspend, Q6 `shop_contact_moderation_events` |
| 16 | `20260813090000_shop_p2b_public_read.sql` | `public_products` view, `search_doc` generated column, `shop_public_*` |
| 17 | `20260813120000_shop_p2b_shop_slug_history.sql` | `shop_slug_history` (Q2 — 301) |

### Đối tượng schema

**18 bảng:** `shops`, `shop_members`, `shop_pilot_members`, `shop_applications`,
`shop_application_events`, `shop_contact_channels`, `shop_contact_moderation_events`,
`shop_media_cleanup_jobs`, `shop_profile_media`, `shop_slug_history`,
`product_categories`, `products`, `product_variants`, `product_media`,
`product_moderation_events`, `product_submission_events`, `product_slug_history`,
`inventory_movements`.

**10 enum:** `shop_application_status`, `shop_state`, `shop_member_role`,
`shop_contact_state`, `shop_contact_type`, `shop_media_cleanup_state`,
`shop_media_purpose`, `product_status`, `product_condition`, `product_media_state`.

**3 view:** `public_products`, `my_shop_application`, `shop_media_cleanup_health`.

**95 hàm/RPC `public.*`** — danh sách đầy đủ trong `migration-deployment.md` §3.
Bề mặt gọi từ client là các RPC `SECURITY DEFINER`; không client nào ghi trực
tiếp `products.status`, `shops.state`, `shop_applications.status`.

---

## 4. Edge function

| Tên | Đường dẫn | verify_jwt | Deploy? |
|---|---|---|---|
| `shop-media-lifecycle` | `supabase/functions/shop-media-lifecycle/index.ts` (+ `webp.ts`) | `false` (`supabase/config.toml:425`) | ❌ **CHƯA** — xác nhận bằng `GET /v1/projects/…/functions`: 80 function ACTIVE, không có nó |

Ba hành động: `publish` (uỷ quyền qua JWT người gọi → `product_publish_prepare`),
`cleanup` và `reconcile` (chỉ cron, qua `x-cron-secret`).

Không có Cloudflare Worker mới. `workers/` giữ nguyên 4 worker cũ
(`edge-blob-watchdog`, `news-fetcher`, `pro-tour-scraper`, `social-poster`).

---

## 5. Cron

Hai job do migration #4 tạo, **chưa tồn tại trên remote**:

| jobname | schedule | body |
|---|---|---|
| `shop-media-cleanup-every-5m` | `*/5 * * * *` | `net.http_post` → `shop-media-lifecycle` `{"action":"cleanup"}` |
| `shop-media-reconcile-hourly` | `17 * * * *` | `{"action":"reconcile"}` |

Cả hai đọc `vault.decrypted_secrets` tên `cron_secret` **tại thời điểm chạy** và
`RAISE EXCEPTION 'cron_secret is not configured'` nếu rỗng.

> ⚠️ **Đính chính `deployment-readiness.md` A1:** exception nằm **trong thân job**,
> không phải trong migration. Áp migration khi vault rỗng vẫn thành công; job sẽ
> đỏ ở lần chạy đầu. Vault đã có `cron_secret` trên remote (đếm = 1), nên điểm
> này không còn là rủi ro — nhưng câu chữ cũ sai và đã dẫn tới một thứ tự triển
> khai chặt hơn mức cần thiết.

---

## 6. Storage

| Bucket | public | limit | MIME cho phép | Ghi |
|---|---|---|---|---|
| `shop-product-media-draft` | **false** | 8 MB | jpeg, png, webp | manager của shop, phạm vi thư mục `<shop_id>/<product_id>/…` |
| `shop-product-media` | **true** | 8 MB | jpeg, png, webp | **không có policy INSERT/UPDATE/DELETE** — chỉ `service_role` ghi được |

> ⚠️ **Đính chính `deployment-readiness.md` A8:** bucket public **không** giới hạn
> ở webp và **không** giới hạn 1 MB ở tầng bucket. Ràng buộc đó do worker áp
> (`MAX_RENDITION_BYTES = 1 048 576`, `inspectWebp()` từ chối mọi thứ không phải
> WebP, `MAX_DIMENSION = 2048`). Vì không ai ngoài `service_role` ghi được vào
> bucket public, hai tầng cho cùng một kết quả — nhưng tiêu chí nghiệm thu phải
> đo ở worker, không đo ở `storage.buckets`.

**Policy Shop trên `storage.objects`:** `shop_product_media_draft_select`
(bị migration #6 thu hẹp), `…_insert`, `…_update`, `…_delete`,
`shop_product_media_public_select`, `shop_profile_media_select_public`,
`shop_profile_media_select_member`.

Remote hiện có 5 bucket (`avatars`, `clubs-logos`, `og-images`, `thumbnails`,
`videos`) và 17 storage policy — **không** cái nào tên `shop*`.

---

## 7. Route

**Buyer (5, mirrored EN + `/vi`)** — khai báo trong `MIRRORED` của `src/App.tsx`:
`/shop`, `/shop/search`, `/shop/category/:slug`, `/shop/product/:slug`,
`/shop/store/:slug`.

**Seller (7, EN-only, sau `RequireAuth`):** `/shop/sell`, `/seller`,
`/seller/application`, `/seller/application/status`, `/seller/settings`,
`/seller/products`, `/seller/products/new`, `/seller/products/:id/edit`.

**Admin (5, sau `RequireAuth requiredRole="admin"` + `AdminMFAGate`):**
`/admin/shop/applications`, `/admin/shop/applications/:id`,
`/admin/shop/products`, `/admin/shop/products/:id`, `/admin/shop/contacts`.

**Prototype:** `/proto/shop/*` — chỉ tồn tại khi `VITE_PROTO_SHOP=1`, bị loại ở
compile time trong build production (D4).

---

## 8. Biến môi trường, secret và cờ

| Nơi | Tên | Trạng thái remote hôm nay | Giá trị pilot |
|---|---|---|---|
| Cloudflare Pages | `SHOP_PUBLIC_INDEXING` | không đọc được qua CLI — xem `environment-audit.md` §blocker | **KHÔNG ĐẶT** (vắng mặt = an toàn) |
| Cloudflare Pages | `CANONICAL_HOST` | đang dùng bởi `robots.txt.ts` | giữ nguyên |
| Supabase Edge | `CRON_SECRET` | ✅ **đã tồn tại** ở cấp project | dùng lại, không tạo mới |
| Supabase Edge | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | ✅ đã tồn tại | mặc định |
| Supabase Vault | `cron_secret` | ✅ đã tồn tại (đếm = 1) | dùng lại |

> ⚠️ **Đính chính `deployment-readiness.md` A2:** "Đặt secret `CRON_SECRET` cho
> function" là thừa. Secret của Supabase Edge Functions là **cấp project**, không
> phải cấp function; `CRON_SECRET` đã có sẵn và `shop-media-lifecycle` sẽ đọc
> được ngay khi deploy. Packet C do đó **không** chứa bước `secrets set` — thêm
> nó vào là rủi ro rotate nhầm một secret 5 caller đang dùng.

**Cờ chỉ mục:** `SHOP_PUBLIC_INDEXING` mở **chỉ** với chuỗi chính xác `"1"`
(`functions/_middleware.ts:141`). `"true"`, `"yes"`, `"0"`, `""` đều đóng — có
test. Cờ điều khiển đồng thời `X-Robots-Tag` ở middleware và khối `Disallow`
trong `robots.txt.ts`.

**Sitemap:** index hiện tham chiếu 11 segment; **không** có `sitemap-shop.xml`,
và không file sitemap nào chứa chuỗi `shop`. Đúng theo Q4.

---

## 9. Giám sát

Hạ tầng sẵn có mà pilot dùng lại (không dựng mới):

- `audit_logs` — Shop ghi qua `log_audit_event(...)` với 7 tham số ép kiểu tường
  minh; `resource_type` được widen thêm `shop_application`, `shop`, `shop_product`.
- `client_errors` + `errors-telegram-alert` (cron 10 phút).
- `ops_cron_monitors` / `ops_cron_alert_state` / `ops_job_registry` — **chưa có
  dòng nào cho hai job Shop**; đó là việc của `operations.md`.
- `shop_media_cleanup_health` view — do migration #3 tạo, chưa tồn tại remote.

---

## 10. Phụ thuộc rollback

Thứ tự tháo ngược thứ tự dựng:

```
1. Đóng cổng pilot   DELETE FROM shop_pilot_members       (kill switch, tức thì)
2. Web               Cloudflare Pages → rollback deployment
3. Cron              SELECT cron.unschedule('shop-media-cleanup-every-5m'), …
4. Edge function     supabase functions delete shop-media-lifecycle
5. Schema            forward-fix DROP theo thứ tự phụ thuộc ngược (xem §Rollback
                     trong migration-deployment.md) — repo forward-only
```

Phụ thuộc cứng cần tôn trọng:

- Web **sau** schema: route Shop gọi RPC; deploy web trước migration = 404 RPC
  cho mọi người vào `/shop`.
- Cron **sau** function: job gọi một URL chưa tồn tại sẽ ghi 404 vào `net._http_response`.
- Xoá function **trước** unschedule = cron đỏ mỗi 5 phút cho tới khi ai đó nhìn.
- `shop_media_cleanup_jobs` **không mất dữ liệu** khi function bị xoá — hàng đợi
  chỉ nằm im.

---

## 11. Đối chiếu remote — trích ngang, chỉ đọc

Đo 2026-08-12 trên `ajvlcamxemgbxduhiqrl` (`thepicklehub-prod`, ap-northeast-1,
`ACTIVE_HEALTHY`, PG 17.6.1.104). Chi tiết trong `environment-audit.md`.

| Thứ | Local | Remote |
|---|---|---|
| File migration | 350 | ledger 325 dòng, version cao nhất `20260804090000` |
| Bảng Shop | 18 | **0** |
| Bảng product\* | 4 | **0** |
| Bucket Shop | 2 | **0** |
| Cron job Shop | 2 | **0** (tổng 17 job khác) |
| `shop-media-lifecycle` | có source | **chưa deploy** |
| `shop_pilot_members` | có bảng | **bảng chưa tồn tại** |
| Va chạm tên (type/function/table `shop*`, `product*`) | — | **0** |

Kết luận: remote là **tờ giấy trắng** với Shop. Không có object drift nào thuộc
Shop, không có gì phải hoà giải trước khi áp.

### Drift ledger (KHÔNG thuộc Shop — có trước Shop)

29 file local vắng mặt trong ledger remote: 17 của Shop (đúng như mong đợi) và
**12 không thuộc Shop**. Với 12 file đó đã probe object thật:

| File | Object probe | Thực tế trên remote |
|---|---|---|
| `20260727120000_quick_table_champion` | `quick_tables.champion_player_id` | ✅ **đã áp**, chỉ thiếu dòng ledger |
| `20260727130000_quick_table_champion_guard` | `protect_quick_table_champion()` | ✅ đã áp |
| `20260728060000_create_event_free_perks_ball_type` | `create_social_event_with_payment` chứa `ball_type` | ✅ đã áp |
| `20260728120000_parent_delete_detaches_events` | FK `quick_tables_parent_tournament_id_fkey` là `ON DELETE SET NULL` | ✅ đã áp |
| `20260730090000_admin_requires_aal2` | `admin_session_aal_ok()` | ✅ đã áp |
| `20260730100000_admin_aal2_sweep` | `user_can_admin_organization`, `mark_match_submitted_to_dupr` | ✅ cả hai tồn tại |
| `20260802090000_fix_missing_table_grants_sweep_2` | `has_table_privilege('authenticated', 'push_tokens'\|'chat_highlighted_users'\|'user_roles', …)` | ✅ cả ba `true` |
| `20260803160000_ops_slo_burn_state` | bảng `ops_slo_burn_state` | ✅ đã áp |
| `20260804120000_ops_monitoring_coverage_expansion` | `ops_edge_function_registry.probe_url` | ✅ đã áp |
| `20260804134500_ops_remove_news_translate_monitor` | `ops_cron_monitors` có dòng `news-translate` | ✅ đã áp (0 dòng còn lại) |
| `20260805150000_news_source_ppa_tour_pause` | `news_sources` id `ppa-tour` phải `active=false` + `last_error` | 🔴 **CHƯA ÁP** — remote đang `active=true`, `last_error` rỗng |
| `20260805170000_news_source_pickleball_com` | `news_sources` id `pickleball-com` | ✅ đã áp (1 dòng, active) |

🔴 **Phát hiện ngoài phạm vi Shop:** đúng một migration trong 12 file là **thật
sự chưa áp** — `20260805150000_news_source_ppa_tour_pause`. Nguồn tin PPA Tour
vẫn `active=true` trên production dù RSS feed đã 404 từ 05/08. 11 file còn lại
đã áp và chỉ thiếu dòng ledger.

Đây chính là lý do lệnh **"cấm chèn ledger mù"** tồn tại: chèn 12 dòng ledger sẽ
đánh dấu file này là "đã áp" trong khi nó chưa chạy, và nguồn tin hỏng sẽ ở lại
vĩnh viễn. Không sửa trong đợt này — ghi lại để xử lý riêng, và nó **không** chặn
Shop.

**4 version trong ledger remote không có file local:** `20260801070000`,
`20260801111500`, `20260802190000`, `20260802190100`. Khớp với ghi chú
"3 migration đã áp prod nhưng chưa vào git" trong sổ tay dọn repo 06/08 (nay là 4).

**Lệnh cấm giữ nguyên:** không chèn ledger mù, không `db push --include-all`.
Drift này **có trước** và **không chặn** Shop — 17 migration Shop chỉ phụ thuộc
vào `is_admin()`, `has_role()`, `log_audit_event()` và `audit_logs`, cả bốn đều
đã có trên remote (§12). Hoà giải drift là việc riêng, ghi ở
`migration-deployment.md` §7.

---

## 12. Phụ thuộc của Shop vào schema có sẵn — đã kiểm trên remote

| Phụ thuộc | Remote | Ghi chú |
|---|---|---|
| `public.is_admin()` | ✅ tồn tại | đã bao gồm cưỡng chế AAL2 (migration 20260730090000 đã áp) |
| `public.has_role()` | ✅ | |
| `public.log_audit_event()` | ✅ **đúng 1 overload**: `(_event_type text, _event_category text, _resource_type text, _resource_id text, _severity text, _metadata jsonb, _actor_type text)` | Shop gọi với ép kiểu tường minh khớp chữ ký này. Local có 2 overload → 42725; remote chỉ 1 nên an toàn cả hai đường |
| `public.audit_logs` | ✅ 2 851 dòng / 2 328 kB | `event_category='admin'` và `severity` `info`/`warning` đều đã hợp lệ; migration #1 chỉ cần widen `resource_type` |
| `pg_cron` | ✅ | |
| `pg_net` | ✅ | |
| `supabase_vault` | ✅ + có `cron_secret` | |
| `pgcrypto` (`gen_random_uuid`) | ✅ | |
| `unaccent` / `pg_trgm` | ❌ **KHÔNG cài** | **không cần** — `unaccent_immutable()` là 7 `regexp_replace` thuần, không gọi extension. Đã đọc định nghĩa ở migration #1 dòng 536-555 |
| `auth.users` | ✅ 2 219 dòng | |
| admin AAL2 | ✅ 1 role admin, 1 MFA factor `verified` | |

Không phụ thuộc nào thiếu. Không có xung đột enum, không có xung đột overload
hàm, không có extension nào phải cài thêm.
