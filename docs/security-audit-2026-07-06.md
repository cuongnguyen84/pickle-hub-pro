# Security Audit — ThePickleHub

**Ngày:** 2026-07-06
**Commit audit:** `d7e9fdc` (origin/main, đã pull mới)
**Phạm vi:** Toàn bộ codebase — Supabase edge functions + RLS, Cloudflare Pages Functions + Workers, React frontend, Capacitor mobile, secrets & dependencies.
**Phương pháp:** Static analysis (read-only, không sửa file). 3 sub-agent audit song song + verify thủ công các finding quan trọng.

---

## Trạng thái khắc phục — ĐÃ DEPLOY PRODUCTION (2026-07-06)

Tất cả 1 Critical + 4 High đã fix và **đã lên `main` + áp dụng production**, verified.

| ID | Mô tả | Trạng thái |
|----|-------|-----------|
| 🔴 C1 | Lộ email/phone toàn bộ user (RLS profiles) | ✅ **LIVE** — khoá quyền cột PII + 7 RPC SECURITY DEFINER + 10 call-site (commit `a17054d`) |
| 🟠 H1 | `.env` bị track | ✅ **LIVE** — untrack + gitignore + `.env.example` (commit `c2abb59`) |
| 🟠 H2 | SSR blog VI không sanitize | ✅ **LIVE** — `sanitizeBlogHtml()` + cache `pr:v21` (commit `c2abb59`) |
| 🟠 H3 | Deep-link handler tin substring | ✅ **LIVE** — parse URL + allowlist scheme/host (commit `c2abb59`) |
| 🟠 H4 | 4 webhook fail-open | ✅ **LIVE** — fail-closed, 4 edge function đã redeploy (commit `a17054d`) |

**Cách triển khai C1 (zero-downtime, đã thực hiện qua Supabase Management API):**
1. Pha A — tạo 7 RPC (additive) trên prod DB. ✓
2. Pha 2 — merge C1 frontend lên main → Cloudflare Pages deploy `a17054d` success. ✓
3. Pha B — `REVOKE`/`GRANT` khoá cột PII (sau khi frontend mới live). ✓
4. Ghi nhận migration `20260706120000` vào `schema_migrations`. ✓

**Verify production:**
- `has_column_privilege('authenticated','profiles','email')` → `false`; `phone` → `false`; `contact_email` → `false`; `display_name` → `true`. ✓
- anon REST `GET /profiles?select=email` → **HTTP 401 `42501 permission denied`**. ✓
- anon `select=id,display_name` → 200; RPC `search_players` → 200. ✓

**Ghi chú H4:** verify prod — `MUX_WEBHOOK_SECRET`, `MAILCHIMP_WEBHOOK_SECRET`, `CRON_SECRET` đã set (hành vi không đổi). `SEND_EMAIL_HOOK_SECRET` **chưa set** nhưng Auth "Send Email" hook đang **tắt** (`hook_send_email_enabled=false`) nên `send-auth-email` không được gọi — thay đổi fail-closed là inert. ⚠️ **Nếu sau này bật hook đó, PHẢI set `SEND_EMAIL_HOOK_SECRET` khớp với secret của hook, nếu không auth email sẽ ngừng.**

**Việc nên làm sau (không gấp):**
- Regenerate `src/integrations/supabase/types.ts` bằng `supabase gen types` (hiện đang dùng RPC signature thêm tay — đúng nhưng nên đồng bộ lại).
- Verify `/vi/blog/<slug>` bằng `curl -A Googlebot` để chắc `sanitizeBlogHtml` không strip nhầm markup.

---

## Trạng thái Medium — ĐÃ DEPLOY PRODUCTION (2026-07-06, commit `5382fba`)

Tất cả 9 Medium đã fix, merge main, apply DB + deploy edge functions, verified.

| ID | Fix | Trạng thái |
|----|-----|-----------|
| M1 | presence_heartbeats: write qua RPC `record_heartbeat`, revoke read trực tiếp | ✅ anon `select presence_heartbeats` → 401; RPC + `get_online_now` OK |
| M2 | `dupr-webhook-test-fire`: redact `DUPR_CLIENT_KEY` khỏi response | ✅ deploy v21 |
| M3 | `dupr-user-search`: bỏ search theo email + chỉ admin thấy email | ✅ deploy v10 |
| M4 | CHECK constraint chặn `javascript:`/`data:`/`vbscript:`/`file:` trên `venues.website` + `social_events.zalo_group_url` | ✅ verified: js chặn, https/scheme-less pass |
| M5 | `og-organization`: escape `logo_url` | ✅ deploy v39 |
| M6 | `registration_secrets.magic_token`: `expires_at` 400d + enforce ở `submit-match-score` | ✅ column + backfill applied, deploy v28 |
| M7 | IndexNow: constant-time compare + rate-limit per-IP (KV) | ✅ trong deploy Cloudflare `5382fba` |
| M8 | Capacitor: tắt `cleartext`/`allowMixedContent`, bỏ `*.google.com`, ATS media-only | ⚠️ cần rebuild app native mới có tác dụng (không ảnh hưởng web) |
| M9 | `request-recovery-link`: phản hồi đồng nhất pre-CAPTCHA (hết oracle); `newsletter-subscribe`: rate-limit per-IP/giờ | ✅ deploy v28 / v31 |

**Triển khai:** migration additive (RPC, expiry column, CHECK, rate-limit table) apply trước; frontend + edge deploy; rồi mới revoke presence (zero-downtime, giống C1). 4 migration đã ghi vào `schema_migrations`.

**Lưu ý M8:** thay đổi `capacitor.config.ts` + `Info.plist.patch` chỉ áp dụng khi build lại app iOS/Android (`npx cap sync` + rebuild). App đang chạy chưa đổi.

Còn lại: nhóm **Low/Info** (admin router guard, HSTS/Permissions-Policy blanket, CSP nonce, `?nocache` gate, worker size cap, JWT localStorage…) — chưa xử, không gấp.

---

## Tóm tắt điều hành

Codebase nhìn chung **có kỷ luật bảo mật tốt**: escape HTML/JSON-LD nhất quán ở tầng SSR, OTP engineering solid (hash + TTL + rate limit + CAPTCHA + budget cap), service_role key không bao giờ lộ ra client, open-redirect defense có test riêng, DUPR postMessage validate origin.

Tuy nhiên có **1 lỗ hổng CRITICAL đang live** (lộ PII email/phone toàn bộ user) cần xử lý ngay, cộng vài vấn đề High/Medium về XSS tiềm ẩn, deep-link, và fail-open webhook.

| Severity | Số lượng |
|----------|----------|
| 🔴 Critical | 1 |
| 🟠 High | 4 |
| 🟡 Medium | 9 |
| ⚪ Low / Info | ~12 |

Dependencies: `npm audit --omit=dev` → **0 lỗ hổng production**. Chỉ có esbuild/vite (dev-only, moderate) — không ảnh hưởng runtime.

---

## 🔴 CRITICAL

### C1. Bảng `profiles` lộ email + phone cho MỌI user đã đăng nhập

- **File:** `supabase/migrations/20260504100000_profiles_authenticated_view_all.sql:23-27`
- **Policy:** `CREATE POLICY "profiles_authenticated_view_all" ON public.profiles FOR SELECT TO authenticated USING (TRUE)`
- **Đã verify:** đây là policy SELECT mới nhất tác động lên bảng gốc `profiles` — không có migration nào sau đó DROP nó. View `public_profiles` (loại bỏ email) có tồn tại, nhưng policy này nằm trên **bảng gốc** nên bypass hoàn toàn view.

**Kịch bản khai thác:** bất kỳ user đăng nhập nào mở devtools chạy:
```js
supabase.from('profiles').select('id,email,phone,contact_email,zalo_user_id').limit(2000)
```
→ lấy được toàn bộ email/SĐT của ~1669 user. `src/hooks/social/useSearchPlayers.ts:31` đã select `phone` từ bảng này, xác nhận cột reachable.

**Nguyên nhân gốc:** nhiều khả năng là regression vô ý từ migration nhằm fix "player search trả 0 kết quả".

**Fix:**
1. DROP policy `profiles_authenticated_view_all`, khôi phục `USING (auth.uid() = id OR is_admin())`.
2. Route "search players" qua view `public_profiles` hoặc RPC `SECURITY DEFINER` loại bỏ cột PII.
3. Defense-in-depth: `REVOKE SELECT (email, phone, contact_email) ON profiles FROM authenticated, anon`.

> **Xác minh trên production trước khi fix:** chạy `SELECT * FROM pg_policies WHERE tablename='profiles'` để chắc chắn policy này còn live (chưa bị sửa qua dashboard). Đây là ưu tiên #1 của toàn báo cáo.

---

## 🟠 HIGH

### H1. `.env` bị commit vào git
- **Đã verify:** `git ls-files` cho thấy `.env` được track. `.gitignore` **không** có dòng nào ignore `.env` (chỉ có `*.local`).
- Hiện tại `.env` chỉ chứa **anon/publishable key** (đã decode JWT: `"role":"anon"`) + URL + project ID — đều là public, nên **chưa lộ secret thật**. Rủi ro là: lần sau ai đó thêm một secret thật (service_role, Resend key…) vào `.env` sẽ bị commit ngay.
- **Fix:** thêm `.env` và `.env.*` (trừ `.env.example`) vào `.gitignore`. Cân nhắc `git rm --cached .env` và chuyển sang `.env.example` với placeholder.

### H2. SSR render blog VI không sanitize HTML (`content_html`)
- **File:** `functions/_lib/render/index.ts:1461` — `content_html` nhét thẳng vào body SSR, không qua DOMPurify.
- Client-side (`src/pages/ViBlogPost.tsx:122`) **có** `DOMPurify.sanitize(...)`, nhưng đường SSR (phục vụ bot + cache KV `pr:v6:`) bỏ qua bước này.
- **Khai thác:** nếu tài khoản admin bị chiếm hoặc pipeline dịch Gemini ghi HTML độc, `<script>`/`onerror` chạy cho mọi visitor/bot trong suốt TTL cache. CSP `unsafe-inline unsafe-eval` không chặn được.
- **Fix:** import `isomorphic-dompurify` trong render layer, sanitize `content_html` trước `normalizeImagesInHtml`; bump cache key `pr:v6:` → `pr:v7:` để purge HTML cũ.

### H3. Deep-link handler tin substring thay vì parse URL
- **File:** `src/hooks/useDeepLinkHandler.ts:106` — gate bằng `url.includes('/auth/callback')` rồi gọi thẳng `supabase.auth.setSession()` với token lấy từ URL.
- **Khai thác:** URL độc dạng `evil://x/auth/callback#access_token=...` vẫn pass substring check.
- **Fix:** `const u = new URL(url); if (u.protocol !== 'thepicklehub:' && u.hostname !== 'www.thepicklehub.net') return;` trước khi tin bất kỳ token nào.

### H4. Webhook fail-open khi thiếu secret (`send-blog-blast`)
- Nếu `MAILCHIMP_WEBHOOK_SECRET` không set trong env → code chỉ log warning rồi **tiếp tục chạy** thay vì reject. Cùng pattern ở `mux-webhook` (`MUX_WEBHOOK_SECRET`), `send-auth-email` (`SEND_EMAIL_HOOK_SECRET`), `errors-telegram-alert` (`CRON_SECRET`).
- **Khai thác:** nếu bất kỳ secret nào bị thiếu trên prod, attacker forge được payload → gửi email blast toàn bộ subscriber / forge sự kiện livestream / forge auth email (phishing qua Resend).
- **Fix:** đổi thành **fail-closed** — thiếu secret thì `return 500`. Và chạy `supabase secrets list --project-ref ajvlcamxemgbxduhiqrl` xác nhận 3 secret trên đã set.

---

## 🟡 MEDIUM

### M1. `presence_heartbeats` — SELECT `USING (true)` cho anon + authenticated
`supabase/migrations/20260610130000_presence_rls_fix.sql:30`. Ai cũng scrape được "ai đang online, ở đâu" toàn nền tảng. Chính comment migration đã ghi nhận là trade-off tạm. Fix: chuyển write qua RPC `SECURITY DEFINER`, thu hồi SELECT trực tiếp, chỉ trả aggregate.

### M2. `dupr-webhook-test-fire` leak `DUPR_CLIENT_KEY` trong response
Trả key trong JSON cho mọi user đã login (kể cả viewer). Key này là yếu tố tin cậy duy nhất của `dupr-webhook` → lộ ra là forge được rating events. Fix: bỏ key khỏi response, giới hạn chỉ admin/service-role.

### M3. `dupr-user-search` trả email plaintext + filter `email.ilike`
Lộ PII user khác + oracle dò tài khoản. Fix: bỏ field `email` khỏi response, bỏ filter `email.ilike`.

### M4. URL do user submit render thành `href` không validate scheme
`venue.website` (`VenueDetail.tsx:266`, submit qua `VenueSubmit.tsx` không validate) và `zalo_group_url` (`SocialEventLive.tsx:778`, `SocialEventDetail.tsx:735`…). `type="url"` chỉ chặn client, bypass được qua RPC trực tiếp với payload `javascript:`. Fix: validate server-side `^https?:\/\//i` (mirror pattern `DUPR_URL_RE` sẵn có trong `_shared/dupr-validation.ts`).

### M5. `og-organization` không escape `logo_url` (og:image)
Các field khác trong file đều dùng `escapeHtml()`, riêng `logo_url` thiếu → HTML injection. `og-live`/`og-video` thiếu allowlist host cho `thumbnail_url`. Fix: escape + allowlist host.

### M6. `magic_token` (recovery đăng ký sự kiện) không có expiry/rotation
`supabase/migrations/20260512110000_registration_secrets.sql:33`. Lộ 1 lần là valid mãi mãi. Fix: thêm `expires_at`, rotate sau mỗi lần recovery thành công.

### M7. IndexNow endpoint không rate-limit
`functions/api/indexnow.ts:145` — auth chỉ bằng so sánh query-string `INDEXNOW_SECRET`. Nếu secret leak, GET path re-run full Supabase query mỗi call → quota exhaustion. Fix: Cloudflare rate-limit rule hoặc KV counter. Cũng nên dùng constant-time compare (`indexnow.ts:151`).

### M8. Capacitor config lỏng
`capacitor.config.ts` — wildcard `*.google.com` trong `allowNavigation`, `cleartext: true`, `allowMixedContent: true`. iOS `Info.plist.patch` set `NSAllowsArbitraryLoads: true` (chưa apply). Fix: thu hẹp về `accounts.google.com`, tắt cleartext/mixed content, scope ATS về `NSExceptionDomains` cho các host đã biết.

### M9. `request-recovery-link` leak signal tồn tại số điện thoại
Trả `count > 0` trước khi verify CAPTCHA → dò được SĐT nào đã đăng ký. `newsletter-subscribe` thiếu rate limit. Fix: verify CAPTCHA trước, trả response đồng nhất bất kể tồn tại hay không.

---

## ⚪ LOW / Informational

- **Admin routing:** 16/18 route admin không có guard ở router-level, chỉ self-gate qua `<AdminLayout>` (hiện fail-closed đúng). Fragile — 1 page tương lai quên bọc `AdminLayout` là ship không bảo vệ. Nên enforce `<RequireAuth requiredRole="admin">` ở tầng router cho toàn bộ `/admin/*`.
- **HSTS** chỉ set programmatically ở path SSR, không có blanket rule trong `public/_headers`. Thêm vào block `/*`.
- **Permissions-Policy** chỉ áp cho `/`, không phải `/*`. Chuyển vào block `/*`.
- **CSP** dùng `script-src 'unsafe-inline' 'unsafe-eval'` — làm yếu backstop XSS. Cân nhắc nonce/hash (AdSense/GTM cho phép).
- **`?nocache=1`** cho phép bot-UA-spoof force fresh render, bypass KV → tăng tải DB. Gate sau secret/header hoặc rate-limit.
- **Workers `pro-tour-scraper`** allowlist chỉ host-regex, thiếu private-IP/localhost denylist (news-fetcher có `isSafePublicFeedUrl`). Port denylist tương tự. Thêm cap byte-size trước `.text()` cho mọi external fetch.
- **`venues.website`/RSS `source_url`** render href thiếu validate scheme (`javascript:`). Low vì source admin-curated.
- **OTP IP-based rate-limit** fail-open khi DB lỗi (1/4 layer); CAPTCHA + per-phone + budget cap vẫn giữ.
- **JWT trong localStorage** (Supabase default) — SPA tradeoff chuẩn; vector là XSS → càng nhấn mạnh H2/M4.
- **Referee live-scoring UI** không check permission client-side, nhưng RLS `can_edit_quick_table_scores` enforce server-side đúng — chỉ là UX gap (silent fail).
- **npm:** esbuild `<=0.24.2` + vite (moderate, **dev-only**). Không ảnh hưởng production. Update khi tiện: `npm audit fix`.

---

## ✅ Làm đúng (giữ nguyên)

- Escape nhất quán: `buildHtml()` trong `functions/_lib/html.ts` funnel mọi title/meta/JSON-LD qua `escapeHtml`/`escapeJsonLd` — verified không ngoại lệ across `index.ts`, `match-seo.ts`, `social-event.ts`, `venues.ts`.
- Không có `innerHTML`, `document.write`, `eval(`, `new Function(` ở đâu trong `src/`/`functions/`/`workers/`.
- Chỉ anon key ở client; không có string `service_role` trong `src/`. Workers giữ service_role qua `wrangler secret put`, không commit.
- `src/lib/auth/safeRedirect.ts` — open-redirect defense chuẩn (chặn `//evil.com`, `javascript:`, `data:`, backslash), có test suite riêng.
- `mux-create-livestream` re-check role creator/admin server-side. `AdminNews.tsx` gate qua `is_admin()`.
- Phone OTP: `crypto.getRandomValues`, SHA-256 at rest, 5-min TTL, max 3 attempts, Turnstile, daily SMS budget circuit breaker.
- `pro-tour-scraper /scrape` yêu cầu HMAC-SHA256 signature. `news-fetcher` có SSRF denylist `isSafePublicFeedUrl`.
- DUPR SSO iframe validate `event.origin`. Feed embeds Instagram rebuild iframe src từ shortcode regex vào origin hardcoded (không phải raw oEmbed injection).
- `vite.config.ts` `build.sourcemap: false`. CORS `*` nhưng không `Allow-Credentials` + dùng bearer token (không cookie) → an toàn.

---

## Thứ tự ưu tiên xử lý

1. **C1** — Fix RLS `profiles` (verify `pg_policies` trên prod trước). ⚠️ Live PII leak.
2. **H4** — `supabase secrets list` xác nhận 3 secret; đổi 4 webhook sang fail-closed.
3. **H1** — Thêm `.env` vào `.gitignore`.
4. **H2** — Sanitize `content_html` ở SSR + bump cache `pr:v7:`.
5. **H3** — Fix deep-link handler dùng `new URL()`.
6. **M1–M3** — presence RLS, DUPR key leak, dupr-user-search email.
7. **M4–M9** — URL scheme validation, og escape, magic_token expiry, indexnow rate-limit, Capacitor config, recovery-link oracle.
8. Low/Info — hardening cơ hội (headers, admin router guard, worker size cap).

> Lưu ý: audit này là **static analysis**. Các finding trên RLS/secret cần verify trạng thái thực tế trên production Supabase (policy có thể đã sửa qua dashboard mà chưa có migration). Không có finding nào được test bằng cách khai thác live.
