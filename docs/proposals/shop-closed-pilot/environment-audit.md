# CP1 — Read-only environment audit

> Đo 2026-08-12. **Không một lệnh ghi nào được chạy.** Mọi truy vấn Postgres đi
> qua một script từ chối bất cứ câu lệnh nào không bắt đầu bằng `SELECT`/`WITH`
> (`supabase-readonly-select.mjs`, sống ngoài repo trong thư mục tạm của phiên).
> Không giá trị secret nào được đọc hay in ra — chỉ **tên**.

## 0. Trước mỗi lệnh: mục tiêu là gì

| Thứ | Giá trị | Đã xác nhận |
|---|---|---|
| Supabase project ref | `ajvlcamxemgbxduhiqrl` | tên trả về `thepicklehub-prod` — khớp CLAUDE.md |
| Cloudflare Pages project | `pickle-hub-pro` | domain `thepicklehub.net`, `www.thepicklehub.net` |
| Cloudflare account id | `7888e97076d4eadd9a8fa409d11dc281` | từ URL dashboard trong output `wrangler` |

Không có biến môi trường chưa giải nào trong bất kỳ lệnh nào; project ref viết
tường minh, không placeholder.

---

## 1. Ma trận môi trường thực tế

| Môi trường | Tồn tại? | Ghi chú |
|---|---|---|
| Supabase local | ✅ | Docker stack, dùng cho toàn bộ nghiệm thu P2a/P2b |
| Supabase **preview/staging** | ❌ **KHÔNG CÓ** | Chỉ một project Supabase. Xem §5 — đây là quyết định phải chốt |
| Supabase production | ✅ `ajvlcamxemgbxduhiqrl` | |
| Cloudflare Pages preview | ✅ | Tự động, từ **mọi nhánh Git** đẩy lên GitHub |
| Cloudflare Pages production | ✅ | Nhánh `main` |
| Edge Functions | ✅ 80 ACTIVE | trên cùng project production |
| Cron / scheduled jobs | ✅ 17 job `pg_cron` | trên cùng project production |

**Hệ quả quan trọng:** không có "preview Supabase". Một preview web trỏ vào
Supabase production hoặc vào không gì cả. Đây là đầu vào bắt buộc cho Packet A.

---

## 2. Supabase — kết quả kiểm

### 2.1 CLI và trạng thái link

| Thứ | Kết quả |
|---|---|
| `npx supabase --version` | **2.111.0** |
| Worktree đã `link` chưa | **CHƯA** — `supabase/.temp` không tồn tại |
| `supabase/.temp/` có trong `.gitignore`? | ✅ dòng 46 — link là trạng thái cục bộ, không tracked |

`supabase link` **không được chạy** (nằm trong danh sách cấm). Mọi truy vấn dùng
Management API với PAT đọc từ `~/Downloads/secrets.local.md` theo đúng
`ops-runbook.md` §1. Điều này **không** chặn phần audit nào — nhưng nó chặn
`supabase db diff` và `supabase migration list`, nên §2.3 dùng probe object thay
vì hai lệnh đó.

### 2.2 Project

```
id        ajvlcamxemgbxduhiqrl
name      thepicklehub-prod
region    ap-northeast-1
status    ACTIVE_HEALTHY
pg        17.6.1.104
created   2026-04-11
```

### 2.3 Ledger migration và drift

| Thứ | Số |
|---|---|
| File migration local | **350** |
| Dòng trong `supabase_migrations.schema_migrations` | **325** |
| Version cao nhất trên remote | `20260804090000` |
| File local vắng mặt trong ledger | **29** (17 Shop + 12 không thuộc Shop) |
| Version remote không có file local | **4** (`20260801070000`, `20260801111500`, `20260802190000`, `20260802190100`) |

Phân loại đầy đủ, kèm probe object cho từng file, nằm ở
[`release-inventory.md` §11](./release-inventory.md#drift-ledger-không-thuộc-shop--có-trước-shop).

Tóm tắt:

- **17 migration Shop:** chưa áp, và **object cũng chưa tồn tại** — không có
  drift một nửa nào phải hoà giải.
- **11/12 migration không thuộc Shop:** đã áp, chỉ thiếu dòng ledger (drift kinh
  niên từ 04/08 — áp qua Management API nên không ghi ledger).
- **1/12: `20260805150000_news_source_ppa_tour_pause` THẬT SỰ CHƯA ÁP.** Nguồn
  tin `ppa-tour` vẫn `active=true` trên production dù feed đã 404 từ 05/08.
  Ngoài phạm vi Shop; ghi lại, không sửa.

### 2.4 Schema drift trong phạm vi Shop

| Kiểm | Kết quả |
|---|---|
| Bảng tên `shop*` trên remote | **0** |
| Bảng `products` / `product_variants` / `product_media` / `product_categories` | **0** |
| Type/enum tên `shop*` hoặc `product*` | **0** |
| Function tên `shop*` / `product*` / `unaccent_immutable` | **0** |
| Bucket tên `shop*` | **0** |
| Cron job tên `shop-media-*` | **0** |

**Không có va chạm tên.** Áp 17 migration vào remote hôm nay là một thao tác
thuần thêm mới.

### 2.5 RLS và grant — phụ thuộc có sẵn

| Object Shop cần | Có trên remote? |
|---|---|
| `public.is_admin()` | ✅ (đã bao gồm cưỡng chế AAL2) |
| `public.has_role()` | ✅ |
| `public.log_audit_event()` | ✅ — **đúng 1 overload** `(text, text, text, text, text, jsonb, text)` |
| `public.audit_logs` | ✅ 2 851 dòng / 2 328 kB |
| `audit_logs_event_category_check` | ✅ đã cho phép `admin` |
| `audit_logs_severity_check` | ✅ đã cho phép `info`, `warning` |
| `audit_logs_actor_type_check` | ✅ đã cho phép `user` |
| `audit_logs_resource_type_check` | ✅ đúng 14 giá trị nền — migration Shop #1 widen thêm 3 |

> Ghi chú kỹ thuật: local có **2** overload `log_audit_event` (từ `20260301120755`
> và `20260302020338`) và đã từng gây `42725 function is not unique`. Remote chỉ
> có **1**. Shop gọi với ép kiểu tường minh nên đúng ở cả hai môi trường — nhưng
> đừng "đơn giản hoá" bỏ ép kiểu vì thấy remote sạch.

### 2.6 Edge functions

| Thứ | Kết quả |
|---|---|
| Tổng function ACTIVE | **80** — khớp con số CLAUDE.md cưỡng chế bởi `npm run auth:registry` |
| `shop-media-lifecycle` | ❌ **KHÔNG CÓ** |
| Tất cả 80 function | `verify_jwt = false` (đúng cách giải ES256/HS256) |

### 2.7 Secret của Edge Functions — **chỉ tên**

41 secret tồn tại. Những cái Shop cần, tất cả **đã có sẵn**:

```
CRON_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
```

**Không secret mới nào cần tạo cho Shop.** Secret của Supabase Edge Functions là
cấp project, không phải cấp function — `shop-media-lifecycle` sẽ đọc được
`CRON_SECRET` ngay khi deploy. (Đính chính `deployment-readiness.md` A2.)

Không giá trị nào được đọc.

### 2.8 Cron / pg_cron / pg_net / vault

| Thứ | Kết quả |
|---|---|
| `pg_cron` | ✅ cài |
| `pg_net` | ✅ cài |
| `supabase_vault` | ✅ cài |
| `vault.secrets` tên `cron_secret` | ✅ tồn tại (đếm = 1, giá trị **không đọc**) |
| Số cron job | **17**, tất cả `active=true` |
| Job Shop | **0** |

17 job hiện có: `match-expire-daily`, `dupr-sync-daily`,
`auto-cancel-unpaid-registrations`, `surface-quick-table-results-daily`,
`social-poster-catchup-15min`, `zalo-token-refresh`, `mux-sync-assets-every-4-hours`,
`error-alert-dedup-gc`, `feed-embeds-sync-hourly`, `feed-generate-hourly`,
`client-errors-retention-daily`, `dupr-webhook-events-retention-daily`,
`news-rewrite-every-30m`, `errors-telegram-alert-10min`, `ops-job-digest-morning`,
`ops-job-telegram-commands`, `ops-edge-health-every-5m`.

Hai job Shop sẽ nâng lên 19. Khe `*/5` đã có `ops-edge-health-every-5m` — hai job
5 phút chạy cùng lúc là bình thường với pg_cron, nhưng ghi lại ở
`operations.md` để không ai ngạc nhiên khi đọc log.

### 2.9 Extension

Cài: `hypopg`, `index_advisor`, `pg_cron`, `pg_net`, `pg_stat_statements`,
`pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`.

**Không cài:** `unaccent`, `pg_trgm`.

Shop **không cần** cả hai. `public.unaccent_immutable()` là bảy `regexp_replace`
thuần ASCII (định nghĩa ở migration #1 dòng 536-555), và `search_doc` dùng
`to_tsvector('simple', …)` — cấu hình `simple` là built-in. Không có
`CREATE EXTENSION` nào trong 17 file.

### 2.10 Storage

| Thứ | Kết quả |
|---|---|
| Bucket hiện có | 5: `avatars`, `clubs-logos` (2 MB), `og-images` (2 MB), `thumbnails`, `videos` (500 MB) — tất cả **public** |
| Bucket Shop | **0** |
| Policy trên `storage.objects` | **17**, không cái nào tên `shop*` |
| Tổng `storage.objects` | **27** dòng |

Migration Shop sẽ thêm bucket đầu tiên có `public = false` của toàn dự án
(`shop-product-media-draft`).

### 2.11 Người dùng, vai trò, AAL2

| Thứ | Số |
|---|---|
| `auth.users` | **2 219** |
| `user_roles` với `role='admin'` | **1** |
| `auth.mfa_factors` trạng thái `verified` | **1** |
| `shop_pilot_members` | bảng **chưa tồn tại** |

Một admin, một TOTP factor đã enrol → cổng AAL2 của `/admin/shop/*` sẽ hoạt động
ngay sau khi migration áp. Đường thoát khi mất authenticator (xoá dòng trong
`auth.mfa_factors`) ghi ở `operations.md`.

### 2.12 Sao lưu / PITR

**Không kiểm.** Endpoint backup của Management API trả dữ liệu cấu hình chi tiết
và không cần thiết cho quyết định pilot. Điều đã biết, từ `ops-runbook.md` §6:
sao lưu theo lịch chạy ~15:45 UTC, restore-to-new-project mất ~4 phút, và
**Storage object KHÔNG nằm trong bản sao lưu DB**. Điểm cuối là ràng buộc thật
cho Shop — ảnh sản phẩm không được sao lưu cùng cơ sở dữ liệu.

### 2.13 Auth redirect URL / cấu hình MFA

**KHÔNG KIỂM ĐƯỢC ở chế độ chỉ đọc an toàn.** `GET /v1/projects/{ref}/config/auth`
trả về cả `smtp_pass`, `external_*_secret` và hàng loạt giá trị bí mật trong cùng
một payload; đọc nó là đọc secret, nên đã bỏ qua có chủ ý.

🔴 **BLOCKER B1** — trước khi có bất kỳ preview nào, Cuong phải xác nhận trong
dashboard (Authentication → URL Configuration) rằng URL preview
`https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev` nằm trong
**Redirect URLs**. Không có nó, đăng nhập trên preview sẽ bật ngược về
production và toàn bộ smoke seller/admin sẽ vô nghĩa.

---

## 3. Cloudflare — kết quả kiểm

| Thứ | Kết quả |
|---|---|
| `npx wrangler --version` | **4.79.0** (có bản mới 4.121.0 — không nâng trong đợt này) |
| Project | **`pickle-hub-pro`** — project duy nhất |
| Domain | `pickle-hub-pro.pages.dev`, `thepicklehub.net`, `www.thepicklehub.net` |
| Git provider | **Yes** — deploy tự động từ GitHub |
| Nhánh production | `main` |
| Preview | tự động cho **mọi nhánh khác** — quan sát thấy 6 preview đang sống từ 6 nhánh |
| Lịch sử deployment | đọc được qua `wrangler pages deployment list`; mỗi bản có id + URL riêng |
| Cơ chế rollback | Dashboard → Deployments → Rollback; hoặc re-promote một deployment id đã biết tốt (`ops-runbook.md` §4.2) |
| `_routes.json` | `include: ["/*"]`, exclude 7 đường tĩnh — mọi route Shop đi qua Pages Functions |
| Pages Functions | `functions/_middleware.ts`, `functions/robots.txt.ts`, `functions/sitemap*.ts`, `functions/api/*` |
| Legacy `prerender-worker` | vẫn phục vụ traffic production (CLAUDE.md) — **không đụng**; không có route Shop nào đi qua nó vì Shop chưa có SSR handler |

**Hệ quả then chốt cho Packet A:** preview là **hệ quả của một `git push`**. Không
có `wrangler pages deploy` thủ công nào cần thiết — và push nằm trong danh sách
cấm. Nói cách khác, Packet A thực chất chỉ xin phép **một** thao tác: đẩy nhánh
`feat/shop-closed-pilot` lên GitHub.

### 3.1 Biến môi trường Pages

🔴 **BLOCKER B2** — `wrangler` không có lệnh liệt kê biến môi trường của một
Pages project, và API tương ứng trả về giá trị đã mã hoá lẫn giá trị thường
trong cùng payload. **Không kiểm được ở chế độ chỉ đọc an toàn.**

Cần Cuong xác nhận bằng mắt trong dashboard (Pages → pickle-hub-pro → Settings →
Environment variables), cho **cả** Production và Preview:

- `SHOP_PUBLIC_INDEXING` **không tồn tại** ở cả hai môi trường. Sự vắng mặt là
  mặc định an toàn; chỉ chuỗi chính xác `"1"` mới mở lập chỉ mục.
- `CANONICAL_HOST` giữ nguyên giá trị hiện tại.

Đây là kiểm tra 30 giây và nó là thứ đứng giữa "pilot kín" và "Google thấy sáu
sản phẩm".

### 3.2 Không dùng Google Cloud

Repo không chứa tài nguyên Google Cloud nào ngoài các API key client-side
(Gemini cho dịch tin, FCM cho push) — không có project GCP, không có `gcloud`
config, không có Cloud Run/Functions. **Không chạy `gcloud`, không cài CLI cloud
nào ngoài phạm vi.**

---

## 4. Những gì KHÔNG kiểm được, và vì sao

| # | Thứ | Lý do | Ai gỡ |
|---|---|---|---|
| B1 | Auth redirect URLs, cấu hình MFA production | endpoint trả secret trong cùng payload | Cuong, dashboard |
| B2 | Biến môi trường Cloudflare Pages (prod + preview) | không có lệnh CLI chỉ đọc | Cuong, dashboard |
| B3 | Giá trị `cron_secret` khớp giữa vault và edge secret | đọc giá trị = đọc secret | Cuong, hoặc chứng minh gián tiếp bằng một cron job hiện có đang trả 200 |
| B4 | Cấu hình sao lưu / PITR | không cần cho quyết định pilot; đã có bằng chứng diễn tập 22/07 | — |

B3 có đường vòng không cần đọc secret: 17 cron job hiện tại đều dùng cùng
`cron_secret`, và `ops_cron_alert_state` không báo `caller_auth_failed` — nghĩa
là vault và edge secret đang khớp. Job Shop dùng đúng cặp đó.

---

## 5. Quyết định phải chốt: preview trỏ vào đâu

Vì **không có Supabase preview**, chỉ có ba lựa chọn thật:

| Lựa chọn | Nghĩa là gì | Đánh giá |
|---|---|---|
| **A. Preview web + Supabase production** | Áp 17 migration lên production trước, rồi preview web trỏ vào đó | Rẻ nhất, và là cách duy nhất kiểm được cron + worker thật. Rủi ro: schema Shop sống trên production trước khi có ai duyệt — nhưng **`shop_pilot_members` rỗng khiến mọi hành động seller bị từ chối**, và route Shop chưa tồn tại trên `main`, nên không người dùng production nào chạm được vào chúng |
| **B. Tạo project Supabase thứ hai làm staging** | Đúng sách vở | Tốn một project, phải đồng bộ 350 migration + 41 secret + storage; và cron/pg_net/vault phải dựng lại. Chi phí thật, giá trị thấp cho pilot 3–5 người |
| **C. Không preview, đi thẳng production pilot** | Bỏ mốc A | Mất tầng an toàn duy nhất. Không khuyến nghị |

**Khuyến nghị: A**, với ba điều kiện cứng, cả ba đã có sẵn trong thiết kế:

1. `shop_pilot_members` rỗng → không ai tạo được shop, kể cả khi đoán đúng URL.
2. `SHOP_PUBLIC_INDEXING` không đặt → mọi route Shop `noindex, nofollow, noarchive`.
3. `main` không có route Shop → production web hiện tại không đổi một pixel.

Đây là quyết định của Product Owner, không phải của agent. Nó là câu hỏi #3
trong `pilot-contract.md`.

---

## 6. Tóm tắt: cái gì đã sẵn, cái gì thiếu

**Đã sẵn trên remote, không cần làm gì:**
`pg_cron` · `pg_net` · `supabase_vault` + `cron_secret` · `CRON_SECRET` ·
`SUPABASE_SERVICE_ROLE_KEY` / `URL` / `ANON_KEY` · `is_admin()` với AAL2 ·
`log_audit_event()` · `audit_logs` · 1 admin có TOTP · Cloudflare preview tự động.

**Thiếu, và mỗi thứ đều nằm sau một packet:**

| Thiếu | Packet |
|---|---|
| 17 migration Shop | **B** |
| 2 bucket Shop + policy | **B** (đi cùng migration) |
| `shop-media-lifecycle` deployed | **C** |
| 2 cron job Shop | **B** (migration tạo) — kiểm sống ở **C** |
| Web có route Shop trên một URL nào đó | **A** |
| `shop_pilot_members` có người | **D** |
| Quy chế người bán v1 | **D** (chặn seller thật, không chặn hạ tầng) |
| Xác nhận biến môi trường Pages (B2) + redirect URL (B1) | **A** |
