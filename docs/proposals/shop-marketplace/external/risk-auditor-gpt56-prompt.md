# Hostile SRE review brief — ThePickleHub Shop (marketplace), Phase 0 + Phase 1 vertical slice

You are a hostile staff SRE reviewing a change to a live product run by ONE person.
Find the specific failure this change causes in production. Name the mechanism, the
trigger, the user-visible symptom. Reject generic risk language ("there may be
performance implications" is worthless). If a part is genuinely safe, say so plainly
and briefly. You cannot see the repo — everything you need is below. Do not invent
file contents; if you need a fact that is not here, say "unverified assumption:".

## The product as it exists TODAY (all facts verified in-repo by the human asking you)

ThePickleHub: bilingual (Vietnamese/English) pickleball platform. ~2,000 real users
(~2,417 `profiles` rows, 1,669 with default `viewer` role). Audience ~95% Vietnamese.
Solo maintainer, one operator, no on-call rotation.

Stack:
- React 18 + TypeScript + Vite SPA, hosted on Cloudflare Pages (project
  `pickle-hub-pro`, prod branch `main`, auto-deploy on merge).
- Supabase (Postgres + Auth + Storage + Edge Functions), single prod project, no
  staging project. 336 migration files in repo; 80 active Edge Functions.
- SEO prerender for bots is a Cloudflare Pages Function (`functions/_middleware.ts`
  + `functions/_lib/render/*`) with a KV cache keyed `pr:v34:${pathname}` (query
  string NOT part of the key). Unmatched bot paths fall through to `render404()`
  (proper 404 + noindex), so a route that exists in the SPA but has no SSR handler
  is a hard 404 for Googlebot while rendering perfectly for humans. This exact
  class of silent failure has bitten the repo at least 5 times (blog posts).
- Capacitor iOS/Android shell + a separate native SwiftUI iOS app in `/apple`.
- Livestream via Mux, push via FCM, email via Resend, EN->VI news translation via
  Google Gemini.

Live production characteristics that matter:
- Supabase Auth issues ES256 JWTs but the Edge Functions gateway verifies HS256.
  Consequence: EVERY user-facing edge function must run `verify_jwt = false` in
  `supabase/config.toml` and verify the JWT internally via `supabase.auth.getUser()`.
  Setting `verify_jwt = true` 401s every logged-in user instantly.
- Admin role requires an aal2 (TOTP MFA) session once a factor is enrolled;
  enforced in `is_admin()`/`has_role()` in the DB and via a shared
  `_shared/admin-aal.ts` helper in edge functions. There is exactly ONE admin user.
- A recurring platform bug ("blob loss", open Supabase support ticket SU-429781)
  intermittently makes deployed edge functions return
  `{"code":"NOT_FOUND_FUNCTION_BLOB"}` for minutes to hours until redeployed. It has
  hit 73/75 functions at once. The automated self-heal runs on GitHub Actions and
  has died twice from Actions billing/quota exhaustion.
- Production SQL is applied by hand through the Supabase Management API query
  endpoint (no `db push`). The remote migration ledger already has >100 rows of
  drift; the daily "migration drift" CI check is chronically red. Three migrations
  are currently applied to prod but not committed to git.
- There are NO down-migrations anywhere. Rollback of schema is manual SQL.
- Restore drill: dashboard "Restore to new project" from daily backup, ~4 minutes,
  proven. IMPORTANT: Storage bucket objects are NOT included in DB backups.

## Verified facts about the relevant existing surfaces

1. **Storage buckets — all six are PUBLIC.** `avatars`, `thumbnails`, `videos`,
   `forum-images`, `og-images`, `clubs-logos` are all created with
   `INSERT INTO storage.buckets (id, name, public) VALUES (..., true)`.
   A repo-wide grep for `createSignedUrl` returns ZERO hits in `src/`,
   `supabase/functions/`, and `apple/`. There is no private-bucket + signed-URL
   pattern anywhere in this codebase.

2. **Bank account numbers are already stored, and are PUBLICLY READABLE by design.**
   Table `public.event_payment_config` (migration `20260512140000`) holds
   `bank_code`, `bank_account_number`, `bank_account_name` for event organizers.
   Its RLS SELECT policy allows anonymous read whenever the parent event is
   `status='published' AND visibility='public'`, and the migration ends with
   `GRANT SELECT ON public.event_payment_config TO anon;`. This is deliberate (a
   registrant needs the QR target), and it is the nearest copy-paste template a
   future migration author will reach for.

3. **PostgreSQL GRANT-before-RLS is this repo's single most repeated bug.**
   Documented three separate occurrences (`vi_blog_posts`, `blog_post_views`, and a
   batch of `videos`/`tournaments`/`organizations`/`livestreams`). Symptom:
   authenticated client gets `42501 permission denied for table X` even though RLS
   policies are correct, because Supabase's SQL editor runs as superuser and
   bypasses the GRANT check during manual testing. A second, later sweep found 10
   MORE tables missing grants — one of them, `push_tokens`, had been silently broken
   for four months.

4. **CI does NOT verify that a new public table has RLS enabled.** The pgTAP suite
   (`supabase/tests/rls_auth_matrix.test.sql`, `plan(23)`) has exactly one blanket
   assertion: "no public table carries policies while RLS is disabled". A brand-new
   table created with GRANTs and with NO policies and NO
   `ENABLE ROW LEVEL SECURITY` passes that assertion, because the assertion only
   fires when policies exist. The other 22 assertions are a hardcoded list of nine
   named legacy tables plus behavioural probes. No linter, no other CI job, checks
   RLS-enabled on new tables.

5. **`src/lib/payment/vietqr.ts` is render-only.** It string-builds an
   `https://img.vietqr.io/image/{BANK}-{ACCOUNT}-compact2.png?amount=&addInfo=`
   URL for an `<img>` tag. No fetch, no bank API, no webhook, no reconciliation.
   Displaying or scanning that QR produces zero server-side evidence of payment.

6. **Bundle budget is CI-enforced and nearly exhausted.** `scripts/check-bundle-size.mjs`
   in the Quality workflow enforces four gz numbers. Measured just now on the current
   tree: INITIAL 225.3 KB / 280 budget; CODE 1520.1 KB / 1800 budget;
   CONTENT (blog chunks) 383.9 KB across 51 chunks (20 KB per-chunk cap);
   **Total 1904.0 KB against a hard 1970 KB backstop — 66.0 KB of headroom**, and the
   script already prints "Total headroom low ... the next PR pays for this one". Every
   new bilingual blog post adds roughly 7.5 KB gz to that total, permanently. The
   backstop "ratchets DOWN only" by written policy.

7. **`supabase/functions/notification-send/index.ts` is an unimplemented skeleton**
   that returns `{"status":"skeleton"}`. The real notification pattern in production
   is one function invoking `send-push-notification` directly plus a direct insert
   into a `notifications` table.

8. **robots.txt** (authoritative copy generated by `functions/robots.txt.ts`)
   disallows `/admin`, `/creator`, `/auth/`, `/login`, `/account`, `/notifications`,
   `/embed/`, `/matches/`, `/join/`, various `/tools/*` and `/clb/*/quan-ly`.
   It does NOT mention `/shop`, `/seller`, `/cart`, or `/checkout`.

9. **Mobile bottom navigation has exactly 5 slots** (Home, Live, CalendarPlus,
   Tools, News) and is hidden on `/admin`, `/creator`, `/embed`.

10. **Service Level Objectives in force** (30-day rolling, `docs/slo.md`):
    (1) `/` and `/feed` return 200: 99.5%. (2) Auth round-trip: 99%.
    (3) OTP->registration insert: 99%. (4) Score save + bracket propagation:
    99.5% AND *zero lost-update incidents* — a lost bracket slot is an incident,
    not a rate. (5) Cron: 100% monitored-healthy. (6) Vietnam mobile p75:
    LCP <= 2.5s, INP <= 200ms, CLS <= 0.1. (7) Admin push delivery >= 95%.
    Error-budget policy: blowing an SLO pauses feature work in that domain.
    Written working agreement: **reliability outranks scope**.
    Current known state: Vietnam mobile CLS p75 is already "poor" (~63.7% of
    samples poor) — SLO 6 is already burning before this feature exists.

## The proposed change

A 25-section plan for "ThePickleHub Shop" — a curated multi-vendor marketplace for
pickleball gear, buyers in Vietnam, five delivery phases, roughly 30 new tables in
total across all phases.

**Scope of THIS audit:** Phase 0 (decisions/compliance, no code) plus ONE vertical
slice of Phase 1. Nothing else is being built now.

The slice, verbatim from the plan's §21:
1. `seller_applications` table and private application documents.
2. Applicant create / edit / submit / resubmit flow.
3. Admin list / detail / request-changes / approve / reject flow.
4. Creation of an approved but empty `shop` record.
5. Audit events and notifications.
6. RLS, storage-policy and integration tests.

Explicitly NOT in this slice: products, cart, checkout, payments, orders, shipping,
reviews, disputes.

Expected artifacts: 5-7 new tables (`seller_applications`,
`seller_application_documents`, `shops`, `shop_members`, `shop_addresses`,
`shop_policies`, `shop_bank_accounts`), one or more timestamped Supabase migrations,
a NEW PRIVATE storage bucket for seller identity documents accessed via short-lived
signed URLs, regenerated `src/integrations/supabase/types.ts`, lazy-loaded
`/seller/application` route(s), lazy-loaded `/admin/shop/applications` route(s),
two new Edge Functions (submit, review) that must be `verify_jwt = false` with
internal `auth.getUser()`, and pgTAP/RLS tests.

Data the slice will collect and store, for real Vietnamese sellers:
- Legal/contact identity, including national ID (CCCD) number and uploaded
  photographs of the ID document.
- Business registration documents.
- Pickup and return street addresses, phone numbers.
- Bank payout account (bank code, account number, account holder name).
- Timestamped acceptance of a marketplace policy version.

Ownership model chosen: no global `seller` app role; instead `shops.owner_user_id`
plus a `shop_members(shop_id, user_id, role)` table with a marketplace-scoped enum
`owner | manager | fulfillment | support`.

Context from the product owner's intake interview:
- He already has 1-3 real seller shops he personally knows and who are willing to try.
- He has a legal entity (a registered company).
- The status of registration with Vietnam's Ministry of Industry and Trade for
  operating an e-commerce SERVICE-PROVIDING website (a "sàn giao dịch TMĐT", i.e.
  a platform where third parties sell) is UNCONFIRMED.
- His success measure for the pilot is "a real seller is willing to list products" —
  supply first, demand later.

Payment posture for the later pilot phase (plan §10), for context only:
COD plus optional *direct seller* VietQR with manual confirmation; one seller per
order; no automatic payouts; the platform never holds funds; only "a trusted
provider callback or authorized manual reconciliation" may move an order to `paid`.

## What I want from you

Rank findings P0 / P1 / P2. For each: the mechanism, the trigger, and what the
end user (buyer, seller, admin, or Googlebot) actually SEES when it fires. Then a
one-word verdict for the first slice, and separately for the whole five-phase plan.

Push especially hard on these, and tell me if I am wrong about any of them:
1. The first-ever private bucket + signed URL in this codebase, implemented on the
   most sensitive data the platform has ever stored, by one person, with no staging
   environment. What is the specific way that leaks? What does a Supabase private
   bucket still leak even when configured correctly?
2. Vietnamese law: operating a third-party-seller marketplace before completing the
   MOIT registration, even as an invite-only pilot with three sellers. And storing
   CCCD/ID images — what filing or consent obligations does that create under
   Vietnam's personal-data regime, given the data is hosted on Supabase outside
   Vietnam? Be specific about which obligation the plan's §23 (which only mentions
   MOIT) omits.
3. Operational load on one person: dispute handling, seller support, returns,
   takedown requests for counterfeit goods, all landing on the same human who is
   already the sole on-call for livestreams, tournaments and a news pipeline.
4. Whether the "displayed VietQR != payment received" gap creates a buyer-seller
   dispute the platform cannot adjudicate, given the platform never sees the money.
5. Whether "5-7 new tables, no down-migration, applied by hand to a prod DB with a
   chronically-red drift check" is actually revertible in any meaningful sense.
6. Anything in this brief that I have framed as low-risk and you think is not.
