# Báo cáo thay đổi — Audit & Hardening 2026-06-10

**Người thực hiện:** Claude Fable 5
**Branch:** `main` (đã deploy production qua Cloudflare Pages)
**Trạng thái CI:** tất cả xanh trên commit cuối — Cloudflare Pages, quality, smoke, codeql, deploy-guard, npm-audit ✅
**Database:** 4 migration đã áp trực tiếp vào Supabase production (`ajvlcamxemgbxduhiqrl`) + ghi vào `schema_migrations`.

> Đọc kèm `docs/audit-2026-06-10.md` (báo cáo audit gốc, đầy đủ severity/root-cause).

---

## 1. Tóm tắt 1 dòng

Audit toàn diện codebase → sửa & deploy 8 commit (3 đợt) gồm 1 CRITICAL, 4 HIGH, nhiều MEDIUM/LOW; áp 4 migration vào DB; dọn luôn 2 lỗi CI tồn đọng (lint + Playwright). Production đang chạy, mọi check xanh.

---

## 2. Commit đã lên `main` (theo thứ tự)

| Commit | Nội dung |
|---|---|
| `bb7e5a0` | Đợt 1: push-auth (CRITICAL), geo-check IP, indexnow host filter + 4 slug, PostgREST search escaping |
| `ad4bbd9` | Báo cáo audit gốc |
| `044d197` | Merge đợt 1 |
| `f302b28` | Đợt 2: timeout middleware, QuickTableView, DOMPurify, useMemo, 3 migration, console drop, CRON_SECRET, SSRF, hex-slug, N+1 |
| `e1d7b35` | Merge đợt 2 |
| `cb24d80` | Sửa lỗi ESLint chặn Quality gate |
| `12742fe` | CSP cho AdSense (sửa Playwright smoke + bug ads không load thật) |
| `45cb648` | Sửa regression RLS presence (khôi phục SELECT cho upsert) |

---

## 3. Thay đổi CODE (đã deploy)

### CRITICAL
- **`supabase/functions/send-push-notification`** — trước: bất kỳ request có header `Authorization` (kể cả rác) đều gửi push tới mọi user. Nay: chỉ chấp nhận **service-role bearer** (caller nội bộ) HOẶC **JWT admin**. Đã xác nhận 2 caller nội bộ (`mark-payment-claimed`, `auto-cancel-unpaid-registrations`) dùng service-role nên không hỏng.

### HIGH
- **`functions/_middleware.ts`** — bot prerender bọc `Promise.race` 8s → fallback SPA shell, hết treo 5xx đốt crawl budget.
- **`src/pages/QuickTableView.tsx`** — `loadData` bọc `useCallback` (sửa polling hỏng + listener churn); realtime reload debounce 500ms chống query storm.

### MEDIUM
- **`src/pages/ViBlogPost.tsx`** — `DOMPurify.sanitize` HTML blog VI (chống stored XSS). Đã thêm dependency `isomorphic-dompurify`.
- **`src/pages/Match.tsx`** — `setState`-trong-`useMemo` → `useEffect`.
- **`functions/api/indexnow.ts`** — thêm 4 slug EN thiếu; filter URL POST theo host `www.thepicklehub.net`.
- **PostgREST search escaping** — helper chung `src/lib/escapePostgrestSearch.ts`, áp dụng ở `usePaginatedSearch`, `useSearchVenues`, `useCreatorData`, `Match.tsx` (chống vỡ query khi gõ ký tự đặc biệt).

### LOW
- **`vite.config.ts`** — drop `console.log/debug/info` ở prod (giữ `warn/error`).
- **`functions/_middleware.ts`** — bỏ branch chết `/vi/live`, `/vi/rankings`.
- **`supabase/functions/geo-check`** — ưu tiên `cf-connecting-ip`, validate/encode IP (chống spoof geo-block).
- **`supabase/functions/errors-telegram-alert`** — gate `CRON_SECRET` tùy chọn (chưa kích hoạt, xem mục 5).
- **`workers/news-fetcher`** — chặn `feed_url` non-https/private-host (defense-in-depth SSRF). *Lưu ý: worker này deploy riêng qua `wrangler`, CHƯA deploy — xem mục 5.*
- **`src/hooks/social/usePlayerProfile.ts`** — ưu tiên match username chính xác, fallback slug deterministic.
- **`src/hooks/useQuickTable.ts`** — song song hóa 2 vòng lặp N+1 update player.

### Sửa lỗi CI tồn đọng (bonus)
- **CSP (`public/_headers` + `_middleware.ts`)** — thêm domain AdSense vào `script-src/frame-src/child-src`. Đây vừa là fix Playwright smoke (fail trên mọi route vì CSP violation log console.error), **vừa là bug thật**: ads chưa từng load được trên production do bị CSP chặn từ các PR #219-#222.
- **ESLint** — sửa `prefer-const`, escape thừa trong regex Telegram, thêm dep ổn định vào useCallback.

---

## 4. Thay đổi DATABASE (đã áp vào production + verify)

Áp qua Supabase Management API, đã ghi vào `supabase_migrations.schema_migrations`.

| Migration | Nội dung | Verify |
|---|---|---|
| `20260610100000_admin_analytics_guard` | 5 RPC analytics (`get_user_stats`...) chuyển plpgsql + guard `has_role(admin)` | ✅ non-admin gọi → raise `forbidden`; 5 fn đều có guard |
| `20260610120000_merge_ghost_phone_ownership` | `merge_my_ghost_by_phone` yêu cầu `p_phone` == phone trên profile của caller (chống chiếm ghost-profile) | ✅ guard `phone_not_verified` có mặt |
| `20260610110000_presence_heartbeats_rls` | (bản đầu) siết RLS presence | ⚠️ gây regression — xem dưới |
| `20260610130000_presence_rls_fix` | **Corrective**: khôi phục SELECT/INSERT/UPDATE cho presence, **chặn DELETE** | ✅ anon upsert OK (cả 2 nhánh), anon DELETE bị chặn |

**Sự cố presence RLS (đã xử lý):** bản `...110000` revoke SELECT của anon để giấu dữ liệu presence, nhưng client heartbeat dùng upsert (`INSERT ON CONFLICT DO UPDATE`) — Postgres cần SELECT để đọc dòng conflict → **làm hỏng toàn bộ heartbeat**. Phát hiện qua test trực tiếp `SET ROLE anon`. Đã ra migration `...130000` khôi phục, giữ lại được 1 cải thiện: **anon không còn xóa được session người khác**.

---

## 5. ⚠️ Việc CẦN ANH KIỂM TRA / QUYẾT ĐỊNH

1. **Rotate `SUPABASE_ACCESS_TOKEN`** (`sbp_...`) — đã lộ trong log phiên làm việc. Đổi trong Supabase dashboard.

2. **Test luồng claim ghost-profile** — migration `merge_ghost_phone_ownership` giả định: khi user claim, `profiles.phone` của họ đã được set = số phone đã verify OTP. Nếu luồng thực tế gọi RPC **trước khi** set phone vào profile → sẽ báo `phone_not_verified`. Cần test thực tế ở `/social` (đăng ký guest rồi login claim). Nếu sai giả định, báo em chỉnh.

3. **Presence read vẫn mở (residual)** — anon/authenticated vẫn SELECT được bảng presence (ai online + page_path). Để đóng hẳn cần chuyển write sang RPC `record_heartbeat` (SECURITY DEFINER) + revoke toàn bộ truy cập bảng trực tiếp + sửa `usePresenceHeartbeat.ts`. Em chưa làm vì cần đổi client + deploy. Nói em nếu muốn làm nốt.

4. **`news-fetcher` SSRF guard chưa deploy** — code đã lên git nhưng worker này deploy riêng: `cd workers/news-fetcher && wrangler deploy`.

5. **`CRON_SECRET` cho telegram-alert chưa kích hoạt** — để bật: set secret `CRON_SECRET` trong Supabase + thêm header `x-cron-secret` vào cron caller. Chưa set thì vẫn chạy như cũ (backward compatible).

6. **Bundle size** — DOMPurify đẩy bundle vượt budget 15.6KB (1815.6/1800) — chỉ *advisory*, không chặn build. Cân nhắc lazy-load DOMPurify nếu muốn về dưới budget.

7. **Migration history drift (pre-existing)** — `schema_migrations` trên remote dừng ở `20260528100000`, trong khi repo có thể có file migration sau mốc đó chưa ghi sổ. Không phải do em, nhưng nếu chạy `supabase db push` sau này có thể cố áp lại. Nên rà soát trước khi dùng `db push`.

---

## 6. Đã verify

- Local trước mỗi push: `tsc --noEmit` 0 lỗi, ESLint changed-files 0 error, **425/425 vitest pass**, `vite build` OK.
- CI trên commit cuối: tất cả check xanh (trừ không có).
- Cloudflare: deploy `45cb648` thành công, production trả 200 (bot UA).
- DB: từng migration test bằng `SET ROLE anon`/`authenticated` để xác nhận hành vi RLS + guard.

## 7. Branch giữ lại
- `dupr-wip-20260610` — code DUPR dở dang của anh (PR7), nguyên vẹn.
- `audit/2026-06-10`, `audit/2026-06-10-round2` — snapshot từng đợt.
