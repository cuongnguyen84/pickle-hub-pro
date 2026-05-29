# State of ThePickleHub — handoff cho conversation mới

*Cập nhật: 29/5/2026. Đọc file này + `CLAUDE.md` + `.claude/secrets.local.md` là làm việc được ngay.*

---

## 1. Stack & context

- **Frontend:** React 18 + TypeScript + Vite + shadcn/ui + Tailwind + vite-plugin-pwa
- **Backend:** Supabase project `ajvlcamxemgbxduhiqrl` (https://ajvlcamxemgbxduhiqrl.supabase.co)
- **Hosting:** Cloudflare Pages project `pickle-hub-pro` (production branch `main`) + Cloudflare Workers
- **Mobile:** Capacitor (app ID `net.thepicklehub.app`)
- **Email:** Resend · **Push:** FCM · **AI dịch:** Google Gemini
- **Analytics:** GA4 + GSC + Ahrefs Webmaster Tools
- **Production URL:** https://www.thepicklehub.net
- **Audience:** ~95% Vietnamese, target ~1700 users

Stack chi tiết + workflow notes ở `CLAUDE.md`.

---

## 2. Người dùng + credentials

**Email:** `thecuong@gmail.com` (Cuong Nguyen — solo dev, sole admin)

**Auth user ID Cuong (`thecuong`):** `5040f0f2-f564-401c-9737-4b030b6371d7`

**Tất cả secrets:** `.claude/secrets.local.md` (gitignored).
Đã có sẵn: Supabase Management API, GitHub PAT (scope `repo`+`workflow`), Cloudflare token, DUPR partner credentials, Telegram bot.

**3 test users (Supabase Auth):**
- `testuser101@picklehub.test` — uid `164bf347-a896-41e8-b351-4bb0416193f5` (DUPR ID `YGONMK`, DIRECTOR test club)
- `testuser102@picklehub.test` — uid `e46800f5-9247-41cc-bd0d-c0ffc4d7e537` (DUPR ID `YGONMK` — duplicate do bug PR #19)
- `testuser103@picklehub.test` — uid `99db7401-9eaf-4c49-a094-8581216bf606` (DUPR ID `XJYKO7`)

Password 3 user trên KHÔNG lưu ở đâu, reset qua admin API nếu cần.

**Test club DUPR:** "The Pickle Hub Test Club" clubId `7628571463`.

---

## 3. DUPR integration — đã ship live trên prod

### Permission model (3-tier, DUPR-spec compliant)

Edge function `dupr-match-submit` chỉ chấp nhận 2 path duyệt submit:

**(A) Global admin** — `user_roles.admin` → submit bất kỳ trận nào.
- Currently chỉ 1 user: Cuong

**(B) Club organizer scoped** — `clubs.created_by` HOẶC active row trong `club_managers` của `matches.club_id`. Helper: `is_club_organizer(p_club_id, p_user_id)`.
- VD: `TAPickleball` (uid `5d3284cb-fe10-46b1-bc9a-16b3b3fd228d`) là manager CLB `Thành Đồng Pickleball` (id `2fee9eff-4b67-4d26-b49c-9aa92acd318d`) → được submit trận của CLB đó

**(C) `user_roles.creator` KHÔNG còn được submit toàn cục** — chỉ là livestream-creator marker. 3 user creator hiện tại: `admindupr`, `Cần Pickleball`, `TAPickleball` — chỉ submit được trận CLB họ quản trị.

Spec DUPR: https://dupr.gitbook.io/dupr-raas/ — em đã verify "TD/admin/match-owner only" rule. NO opponent confirmation required (đó là tầng data integrity của mình).

### Phase 2 — Opponent confirmation flow (member self-log)

Migration `20260526120000_club_match_confirmation.sql` thêm 4 cột vào `matches`:
- `confirmation_status` — enum: `pending_opponent_confirm`, `confirmed`, `auto_confirmed_admin`, `disputed`
- `confirmation_required_from uuid[]` — danh sách opponent có quyền confirm
- `confirmed_at`, `confirmed_by`

**Flow:**
1. **Member log trận** trên `/clb/:slug` → `log_club_match` RPC tạo row status `pending_opponent_confirm`, populate `confirmation_required_from = team_b_players` (member phải có mặt trong team A)
2. **Opponent confirm** ở `/match/confirm` → `confirm_club_match(p_match_id)` RPC → flip status `confirmed` + `ready_for_dupr=true`
3. **Admin/organizer submit** ở `/clb/:slug` → SubmitDuprDialog → edge function `dupr-match-submit` → DUPR API trả matchCode

**Lưu ý quan trọng:** Phase 3 đã BỎ "confirmed opponent bypass" cũ. Opponent confirm CHỈ flip status, KHÔNG trigger DUPR submit. Lý do: DUPR spec cấm "normal users" submit.

### Page route quan trọng

| Route | Purpose |
|---|---|
| `/dupr` | User connect/disconnect + rating chart 30 ngày |
| `/match/new` | Member log match wizard (alternative entry) |
| `/match/confirm` | Opponent queue chờ xác nhận tỉ số |
| `/admin/dupr` | Admin operator dashboard (DUPR ops) |
| `/admin/errors` | Admin error tracker (realtime) |

### Edge functions DUPR (chính)

`dupr-match-submit` — Create/update/delete match. **3-tier role gate** + lazy-fetch entitlement fallback nếu cache miss.
`dupr-sso-callback` — Sau SSO link, lưu token + duprId.
`dupr-webhook` — DUPR push rating update.
`dupr-entitlements` — Fetch `/subscription/active`, cache 24h.
`dupr-user-search` — Merge DUPR partner search + internal profiles.
`dupr-confirm-club-match` (KHÔNG có) — flow này dùng RPC `confirm_club_match` trực tiếp.

### Known issues

- `dupr_user_clubs` cache rỗng — chưa user nào sync club role từ DUPR. Club-bound submissions (`matchSource=CLUB`) tạm chưa hoạt động; trận đi qua private path `matchSource=PARTNER`.

---

## 4. Observability — Sentry-style error tracking đã ship

### Table + edge functions

- `client_errors` — Bảng lưu JS errors + CSP violations. RLS: admin-only read.
- `error_alert_dedup` — Dedup fingerprint để không spam Telegram.
- Edge function `log-client-event` — Public endpoint (verify_jwt=false). Browser POST tới đây.
- Edge function `errors-telegram-alert` — Cron `*/10 * * * *`. Spike alert nếu ≥3 errors cùng fingerprint trong 10 phút, dedupe 60 phút.

### Frontend wiring

`src/lib/errorReporter.ts` — `initErrorReporter()` được gọi trong `src/main.tsx` BEFORE render. Wire `window.onerror` + `unhandledrejection` qua `navigator.sendBeacon`. Dedup 5 phút client-side. Lọc noise (ResizeObserver, Script error.).

### CSP headers (trong `public/_headers`)

CSP enforce + CSP Report-Only đồng thời. Report-uri trỏ tới `log-client-event`. DUPR domains (`dashboard.dupr.com`, `uat.dupr.gg`) đã trong `frame-src` + `child-src`.

### Admin dashboard

`/admin/errors` — page với Supabase Realtime subscription. Filter type + window. Group theo fingerprint. Modal hiện full stack trace.

### Telegram bot

**Bot:** `@Tphaisupport_bot` (TPH AI Support)
- TOKEN: `8647605878:AAFnwsf7XBXV9cgzIQFy6r5ZBtXmZXxiLL4`
- CHAT_ID: `233837066` (Cuong's chat)
- Set vào Supabase secrets cho edge function
- Cũng set vào GitHub Actions secrets cho Playwright CI failure alert

### Tune threshold

Sửa trong `supabase/functions/errors-telegram-alert/index.ts`:
```ts
const SPIKE_THRESHOLD = 3;     // ngưỡng count
const SPIKE_WINDOW_MIN = 10;   // cửa sổ
const DEDUPE_WINDOW_MIN = 60;  // im sau alert
```

Pause cron: `SELECT cron.unschedule('errors-telegram-alert-10min');` trong SQL Editor.

---

## 5. Playwright Phase 1 — CI tests đã ship

### Cấu hình

- `playwright.config.ts` — 3 project (desktop / mobile Pixel-7 / SSR bot)
- Target: `PLAYWRIGHT_BASE_URL` env var, default `https://www.thepicklehub.net`
- User-Agent suffix `ThePickleHub-Playwright-CI` → filter khỏi GA4

### Tests

| File | Coverage |
|---|---|
| `tests/smoke.spec.ts` | 11 specs — 10 routes anonymous, check title không undefined, no JS console errors |
| `tests/mobile.spec.ts` | 5 specs — no horizontal scroll trên 375x812 + CTA stacking |
| `tests/seo.spec.ts` | 5 specs — Googlebot SSR meta + sitemap + robots |

**Tổng: 31 tests, run ~30s, last run 29 passed + 2 skipped.**

### GitHub Actions

`.github/workflows/playwright.yml` — trigger PR + push main + workflow_dispatch.

- PR: chạy trên Cloudflare preview deploy (auto-detect branch URL)
- Main: chạy trên production
- Fail trên main → Telegram alert qua `@Tphaisupport_bot` (secrets `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` đã set)

### Run local

```bash
cd ~/pickle-hub-pro
npm install
npx playwright install --with-deps chromium
npm run e2e            # all tests
npm run e2e:ui         # interactive UI mode
PLAYWRIGHT_BASE_URL=https://feature-branch.pickle-hub-pro.pages.dev npm run e2e  # against preview
```

---

## 6. Phase 2 — ĐÃ SHIP (29/5/2026)

Cả 6 sub-phase đã build. Mỗi spec chạy trong đúng 1 Playwright project; các phần mutating/visual tự skip khi thiếu env nên pipeline xanh hiện tại không bị phá.

**2A. Auth-gated flow tests** ✅ — `tests/auth.spec.ts` + `tests/helpers/{auth,supabase-admin}.ts`. Mint session qua admin `generateLink(magiclink)`→`verifyOtp` (KHÔNG lưu password). Cover: login state (không redirect /login), role gate (viewer bị đẩy khỏi /admin/dupr, admin vào được), HeaderDuprBadge, DUPR modal iframe `title="DUPR SSO"` (CSP), /match/confirm. NON-mutating. Skip nếu thiếu `SUPABASE_URL/SERVICE_ROLE/ANON`.

**2F. Auto-deploy guard + migration drift** ✅ — `.github/workflows/deploy-guard.yml` (push main → deploy edge fn đã đổi, honor config.toml `verify_jwt`) + `scripts/check-migration-drift.mjs` (so `supabase_migrations.schema_migrations` vs `supabase/migrations/*` qua Management API). Telegram alert on fail. `npm run drift` chạy local.

**2B. DUPR submit E2E** ✅ (gated `DUPR_E2E=1`) — `tests/dupr-e2e.spec.ts`. Admin submit singles (YGONMK vs XJYKO7) → assert matchCode numeric + Zod shape → delete cleanup. + viewer bị permission gate chặn (401/403). **Lưu ý:** leg member-log→opponent-confirm CHƯA cover vì RPC `log_club_match`/`confirm_club_match` KHÔNG có trong source tree hiện tại — thêm khi RPC ship.

**2D. Lighthouse CI** ✅ — `.lighthouserc.json` + `.github/workflows/lighthouse.yml`. a11y/SEO/CLS = hard error; perf/LCP/TBT = warn. PR chạy trên preview, cron tuần trên prod.

**2E. Contract tests** ✅ — `src/contracts/duprMatchSubmit.ts` (Zod, frontend + test import chung) + `tests/contract/edge-contracts.spec.ts` validate error envelope (snake_case `match_code`) của edge fn thật. Success-shape validate trong 2B.

**2C. Visual regression** ✅ (free, gated `VISUAL=1`) — `tests/visual.spec.ts` dùng `toHaveScreenshot`, baseline in-repo, mask vùng động. `npm run e2e:visual:update` để chụp baseline lần đầu rồi commit.

**Secrets cần set trong GitHub Actions:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN` (deploy-guard). `TELEGRAM_*` đã có.

---

## 7. Active gotchas — đọc trước khi code

### Code in source ≠ deployed
- Edge functions: `supabase functions deploy <name> --project-ref ajvlcamxemgbxduhiqrl --no-verify-jwt`
- Migrations: SQL file trong repo KHÔNG tự apply. Dùng Management API hoặc `supabase db push`.
- Cloudflare Pages: tự deploy từ main, ~2-3 phút lag

### Supabase JWT ES256/HS256 workaround
Auth issue JWTs ES256 nhưng Edge Functions gateway verify HS256. User-facing functions PHẢI có `verify_jwt = false` trong `supabase/config.toml`. Verify JWT internally qua `supabase.auth.getUser()`.

### Cloudflare Pages `_headers` vs Dashboard headers
`_headers` override dashboard-level headers. CSP đã đặt trong `_headers` rồi — đừng đặt lại trong Cloudflare Dashboard nếu không muốn conflict.

### SEO prerender (Pages Functions)
`functions/_middleware.ts` + `functions/_lib/render/` handle bot crawler SSR. Khi add blog post: 4-file sync:
1. `src/content/blog/posts/<slug>.ts`
2. `src/content/blog/metadata.ts`
3. `functions/_lib/render/index.ts` — add to `BLOG_POST_META` dict (line ~764)
4. Supabase `vi_blog_posts` INSERT

Miss bất kỳ file nào → Googlebot/Bingbot 404 dù SPA render OK.

### Response shape camelCase vs snake_case
Edge functions trả flat snake_case (`data.match_code`, `data.hashed_match_code`). KHÔNG nested `data.result.matchCode`. Đã có nhiều bug shape mismatch lịch sử.

### TheLineLayout title required
`<TheLineLayout title="..." />` PHẢI có title prop, không TypeScript runtime ko enforce → page lên prod với `<title>undefined</title>`. Playwright Phase 1 catch lỗi này.

### CSS containing block trap
`backdrop-filter` (như `.tl-nav` có `blur(14px)`) tạo containing block cho `position: fixed` descendants. Modal qua React Portal vào `document.body` để escape.

---

## 8. Cron jobs đã active

```
match-expire-daily               0 21 * * *
dupr-sync-daily                  0 20 * * *
auto-cancel-unpaid-registrations 0 * * * *
surface-quick-table-results-daily 0 6 * * *
social-poster-catchup-15min      */15 * * * *
news-translate-daily-7am-ict     */30 * * * *
zalo-token-refresh               0 */23 * * *
errors-telegram-alert-10min      */10 * * * *  ← mới ship
error-alert-dedup-gc             0 4 * * *     ← mới ship
```

Query: `SELECT jobname, schedule, active FROM cron.job;`

---

## 9. Workflow chuẩn (copy-paste cho Claude conversation mới)

### Apply migration prod
```bash
SBP=$(grep -E "^SUPABASE_ACCESS_TOKEN" /Users/cuongmit/pickle-hub-pro/.claude/secrets.local.md | awk '{print $NF}')
python3 -c "import json;print(json.dumps({'query':open('supabase/migrations/<FILE>.sql').read()}))" > /tmp/sql.json
curl -s -X POST "https://api.supabase.com/v1/projects/ajvlcamxemgbxduhiqrl/database/query" \
  -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" \
  --data-binary "@/tmp/sql.json"
```

### Deploy edge function
```bash
SBP=$(grep -E "^SUPABASE_ACCESS_TOKEN" .claude/secrets.local.md | awk '{print $NF}')
SUPABASE_ACCESS_TOKEN=$SBP npx supabase functions deploy <name> \
  --project-ref ajvlcamxemgbxduhiqrl --no-verify-jwt
```

### Push file lên repo qua GitHub API (no clone needed)
PAT mới (`ghp_v7qJk...`) đã có scope `repo` + `workflow` → push thẳng workflow files được.

```bash
GH_TOKEN=$(grep -E "^GITHUB_PAT:" .claude/secrets.local.md | awk '{print $NF}')
REPO="cuongnguyen84/pickle-hub-pro"
FILE="path/to/file"
SHA=$(curl -s -H "Authorization: Bearer $GH_TOKEN" \
  "https://api.github.com/repos/$REPO/contents/$FILE?ref=main" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('sha',''))")
python3 -c "
import json, base64
with open('LOCAL_PATH','rb') as f: b64 = base64.b64encode(f.read()).decode()
p = {'message': 'COMMIT MSG', 'content': b64, 'branch': 'main'}
if '$SHA': p['sha'] = '$SHA'
print(json.dumps(p))
" > /tmp/push.json
curl -s -X PUT -H "Authorization: Bearer $GH_TOKEN" -H "Content-Type: application/json" \
  "https://api.github.com/repos/$REPO/contents/$FILE" --data-binary "@/tmp/push.json"
```

### Test edge function manual
```bash
ANON=$(curl -s -H "Authorization: Bearer $SBP" \
  "https://api.supabase.com/v1/projects/ajvlcamxemgbxduhiqrl/api-keys?reveal=true" \
  | python3 -c "import sys,json;[print(k['api_key']) for k in json.load(sys.stdin) if k.get('type')=='legacy' and k.get('name')=='anon']")
curl -s -X POST -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  "https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/<FN_NAME>" -d '{}'
```

### Verify SEO bot view
```bash
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "https://www.thepicklehub.net/<path>" | grep -E "<title>|hreflang"
```

---

## 10. Quick links

- **Production:** https://www.thepicklehub.net
- **Repo:** https://github.com/cuongnguyen84/pickle-hub-pro
- **Supabase dashboard:** https://supabase.com/dashboard/project/ajvlcamxemgbxduhiqrl
- **Cloudflare Pages:** https://dash.cloudflare.com → Pages → `pickle-hub-pro`
- **DUPR docs:** https://dupr.gitbook.io/dupr-raas/
- **Admin error dashboard:** https://www.thepicklehub.net/admin/errors
- **Admin DUPR dashboard:** https://www.thepicklehub.net/admin/dupr
- **Confirm queue:** https://www.thepicklehub.net/match/confirm

## 11. Docs liên quan

- `CLAUDE.md` — Project rules + stack details (đọc đầu mỗi session)
- `.claude/secrets.local.md` — Tất cả credentials (KHÔNG commit)
- `docs/telegram-alerts-setup.md` — Telegram bot setup guide
- `docs/playwright-setup.md` — Playwright setup
- `docs/playwright-workflow.yml` — Workflow YAML reference
- `docs/dupr-thepicklehub-user-guide.md` — End-user guide (cho audience)
- `docs/dupr-prod-readiness.md` — DUPR Partner production checklist

---

*File này nên được update mỗi khi có thay đổi lớn về architecture / permission / observability.*
