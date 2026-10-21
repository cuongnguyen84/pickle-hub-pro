# Fact-check vòng 1 — Backend/security claims (agent Explore, verbatim)

## A1 — TRUE
- **(a) Policy exists:** `supabase/migrations/20260511120000_social_events_foundation.sql:301-308` — `CREATE POLICY "event_registrations_insert_self" ... FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND profile_id = auth.uid())`. No column predicate on `payment_status`.
- **Broad grant:** `supabase/migrations/20260511130000_social_events_grants_and_admin_insert.sql:51` — `GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registrations TO authenticated;` (table-level, no column list).
- **(b) No later narrowing.** grep toàn bộ migrations: chỉ 2 dòng grant ở `20260511130000`, zero REVOKE về sau. Migration mới nhất trong repo là `20260802131500` (ops job health) — không đụng bảng này. Policy chưa từng bị drop (chỉ thêm `event_registrations_insert_organizer` song song).
- **(c) Không có column-level grant; CHECK cho phép 'paid':** `20260513140000_event_prepayment_required.sql:48-49` — `CHECK (payment_status IN ('unpaid','pending_payment','paid','refunded'))`. Trigger trên bảng đều AFTER (notify), không có BEFORE INSERT guard.
- **(d) Client hợp lệ KHÔNG insert trực tiếp:** 11 hit `.from("event_registrations")` trong src/ đều `.select()` trừ 1 `.update` (`SocialEventRoster.tsx:271`). Đường thật: RPC `register_event_as_member` (`RegistrationModal.tsx:563,589,663`) + edge `phone-otp-verify`.
- **Bypass target:** advisory lock `20260716090000_db01_atomic_event_capacity.sql:41-43` + `20260717200000_db01c_member_capacity_lock.sql`; RPC set payment_status server-side (`:128-140`). Direct `.insert()` skip toàn bộ.

## A2 — TRUE (kèm 1 nuance registry)
- `ls -d supabase/functions/*/` trừ `_shared` → **78** function dirs.
- CLAUDE.md:182 "50 active" — STALE.
- Registry ở `supabase/functions/auth-registry.json` (không phải _shared/), liệt kê **77** — thiếu đúng 1: **`news-social-caption`**. (Report nói registry khớp 100% → sai chi tiết này.)

## A3 — TRUE
- 13 function import `requireCronRequest`: auto-archive-tournaments, auto-cancel-unpaid-registrations, dupr-sync, errors-telegram-alert, feed-embeds-sync, feed-generate, leaderboard-compute, match-expire, mux-sync-assets, news-rewrite, news-translate, ops-job-digest, zalo-token-refresh.
- auth-registry.json đánh dấu đúng 13 function flow `cron.write.cron_secret.shared_secret` — trùng khớp tập. Mọi target `functions/v1/<name>` trong các migration pg_cron đều nằm trong 13. (ops_job_registry có executor ngoài edge — cloudflare_worker, github_actions — ngoài phạm vi requireCronRequest.)

## A4 — PARTIAL
- **Header trust confirmed:** `cf-connecting-ip` ưu tiên, fallback `x-forwarded-for`/`x-real-ip` — đều client-settable:
  - `phone-otp-send/index.ts:100-111` (`extractIp`, dùng cho per-IP OTP rate limit `:380-394`)
  - `newsletter-subscribe/index.ts:65`, `request-recovery-link/index.ts:294`, `match-create/index.ts:432-433`
  - `_shared/view-events.ts:117-121`, `_shared/client-errors.ts:191-195`
  - `geo-check/index.ts:42-48` có comment NGƯỢC: "Prefer cf-connecting-ip (set by Cloudflare, not client-spoofable)".
- **Tiền đề "không sau Cloudflare" UNVERIFIABLE từ repo.** Bằng chứng plausible: client gọi thẳng `https://ajvlcamxemgbxduhiqrl.supabase.co` (`.env.example:7`) — không qua Cloudflare của dự án. Supabase edge runtime có được front bởi Cloudflare hay không là chuyện hạ tầng, không nằm trong repo.

## A5 — FALSE (theo cách viết); chính xác phải là "plaintext trên prod HÔM NAY, code mã hóa đã ship nhưng chưa kích hoạt"
- Mã hóa tồn tại và ĐÃ wire vào function live: `_shared/token-crypto.ts` (AES-256-GCM), `_shared/dupr-token-keyring.ts`; writer `dupr-sso-callback/index.ts:192-193`, `dupr-refresh-user-token/index.ts:126-127`; reader `dupr-match-submit/index.ts:387`; backfill `dupr-token-backfill/index.ts`.
- Trạng thái plaintext ĐƯỢC GHI NHẬN, không câm: `_shared/TOKEN_ENCRYPTION_ROLLOUT.md:1-8` — "code-ready, NOT yet deployed. Requires a secret + staged deploy + backfill."
- Gate: không có secret `DUPR_TOKEN_ENC_KEY_*` → encrypt là no-op plaintext. Trạng thái at-rest phụ thuộc secret Supabase — không quan sát được từ repo.

## A6 — TRUE
`npx vitest run` 2 file → 2 failed, 8 passed:
- `src/lib/__tests__/edge-auth-registry.test.ts:41-43` — `expected 78 to have a length of 76`
- `src/lib/__tests__/edge-cors-serve.test.ts:235` — `expected Map{ …(78) } to have a size of 76 but got 78`
