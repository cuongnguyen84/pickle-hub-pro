# GPT-5.6 devil's-advocate reply — risk-auditor (shop-marketplace)

> Chạy 2026-08-09 qua `codex exec` (`scripts/agents/ask-model.mjs` KHÔNG tồn tại trong repo).
> Model: `gpt-5.6-sol` (account default; `-m gpt-5.6` bị OpenAI từ chối:
> `The 'gpt-5.6' model is not supported when using Codex with a ChatGPT account`).
> reasoning effort: high · sandbox: read-only · web search: BẬT (model tự tra cứu luật VN).
> Prompt nguyên văn: `risk-auditor-gpt56-prompt.md`.
> Dưới đây là reply NGUYÊN VĂN, chưa lọc. Phần thẩm định/bác bỏ nằm trong proposal.

---

Verdicts:

- First vertical slice: **REJECT**
- Whole five-phase plan: **REJECT**

The slice is salvageable as a dark, data-minimized prototype. It is not safe to collect real CCCD images or bank details yet. The whole marketplace cannot operate until the current MOIT registration and operating obligations are satisfied.

## P0 — stop-ship

### P0.1 — Anonymous disclosure of seller identity and banking data can pass CI

**Mechanism:** A migration grants `anon` or `authenticated` access but omits `ENABLE ROW LEVEL SECURITY`. Your blanket pgTAP assertion passes because the table has no policies. The nearest bank-account template explicitly grants anonymous access. Independently, copying any existing bucket migration preserves `public=true`.

**Trigger:** The hand-applied migration creates `shop_bank_accounts`, `seller_applications`, or document metadata with grants but no effective RLS; or creates the document bucket as public.

**What users see:** An unauthenticated caller queries PostgREST and receives CCCD numbers, addresses, phone numbers, bank details, and storage paths. If the bucket is public, those paths resolve directly to ID photographs. Affected sellers probably see nothing—the production symptom is a silent data breach.

**Unverified assumption:** The promised new tests do not explicitly assert `relrowsecurity=true` and negative access for every new relation and every storage operation. “RLS tests” is too vague to close this defect.

Release must fail unless it proves:

- Every new public table has RLS enabled, including tables with zero policies.
- `anon` and an unrelated authenticated user cannot select or mutate any seller row.
- An unrelated user cannot list, download, sign, replace, move, or delete any seller document.
- `shop_bank_accounts` has no anonymous read policy copied from `event_payment_config`.
- Bucket `public=false` is asserted from the database, not merely assumed from application behavior.

### P0.2 — The slice starts regulated sensitive-data processing without the required data-protection work

**Mechanism:** Under the law currently in force, an image of a CCCD/identity card is sensitive personal data. Uploading it to Supabase outside Vietnam is cross-border processing. Marketplace-policy acceptance is not a substitute for specific, demonstrable personal-data consent.

**Trigger:** The first real seller uploads an ID photograph.

**What the seller sees:** Initially, likely nothing except an inadequate checkbox. When they withdraw consent, request deletion/access, or report a leak, there is no defined process. On regulatory intervention, onboarding has to be suspended; sellers see applications disabled or documents being recollected.

The omitted work is larger than §23’s MOIT item:

- Explicit, purpose-specific consent identifying the sensitive data, recipients/processors, retention, overseas processing, rights, and withdrawal mechanism.
- A personal-data processing impact-assessment dossier.
- A separate cross-border transfer impact-assessment dossier because the data is hosted abroad.
- Submission of each assessment within 60 days of first processing/transfer.
- Restricted-access rules, retention/deletion procedures, data-subject request handling, qualified protection personnel, and a breach-notification runbook.

Vietnam’s current law and implementing decree took effect on 1 January 2026. The small/startup relief does not apply when the business directly processes sensitive personal data. [Law 91/2025/QH15](https://vanban.chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroup=), [Decree 356/2025/NĐ-CP](https://vanban.chinhphu.vn/?classid=1&docid=216387&pageid=27160), [official gazette text covering the 60-day filings](https://congbao.chinhphu.vn/detail/tai-ve?id=45578&slug=91-2025-qh15).

Also: a CCCD number alone is listed as basic personal data; an image of the card is explicitly sensitive. Do not conflate the two.

Collecting bank details in this slice is unjustified. There are no payouts, products, orders, or payments. Existing public event bank accounts do not make seller banking data low-risk. Collect it only when the direct-seller payment feature actually needs it.

### P0.3 — The plan’s MOIT legal basis is obsolete, although its conclusion remains correct

As of 9 August 2026, Decrees 52/2013 and 85/2021 have been replaced by the E-Commerce Law 122/2025/QH15 and Decree 248/2026/NĐ-CP, effective 1 July 2026. [Current E-Commerce Law](https://vanban.chinhphu.vn/?docid=216503&pageid=27160), [current Decree 248](https://vanban.chinhphu.vn/?docid=218747&orggroupid=2&pageid=27160).

**Mechanism:** An intermediary e-commerce platform may operate only after MOIT confirms its registration and its operating conditions are met. The definition depends on allowing third parties to introduce or sell goods—not on whether the pilot is public, profitable, or has only three invited sellers.

**Trigger:** The first third-party product/shop presentation or selling capability is enabled before confirmation.

**What users see:** Listings or ordering are disabled following enforcement; buyers cannot order and sellers lose access to their storefront activity.

You are right that “invite-only” is not an exemption. But the Phase‑1 slice can be developed privately before registration if it exposes no listings, selling, or buyer-facing shop experience. Seller intake alone is not clearly marketplace operation. Keep the entire slice feature-flagged and non-public until counsel confirms that boundary.

The new framework also requires duties the plan apparently has not budgeted for: seller electronic identity verification, pre-display screening for illegal/counterfeit/IP-infringing goods, return handling, complaint support, regulator response, and multi-year access to transaction records. Seller e-identity verification applies from 1 January 2027; manually viewing a stored CCCD photo should not be assumed to satisfy it.

## P1 — must fix before any real pilot

### P1.1 — A correctly private bucket still creates bearer-link leakage

A correctly configured private Supabase bucket does **not** anonymously expose its object bytes. That part is safe.

It still leaks in these concrete ways:

- A signed URL contains the bucket/object path and a bearer token. Anyone possessing the complete URL can replay it until expiry.
- The URL and document reach the administrator’s browser, device, extensions, screenshots, copied support messages, and observability tooling.
- Supabase and its storage/CDN infrastructure process the object outside Vietnam; “private” means access-controlled, not invisible to the processor.
- On Supabase Smart CDN, a cached signed URL can continue serving the object after the token expires, until the cache entry expires. Supabase explicitly warns that token expiry and cache expiry are independent. [Private-bucket access model](https://supabase.com/docs/guides/storage/buckets/fundamentals), [signed-URL CDN behavior](https://supabase.com/docs/guides/storage/cdn/smart-cdn).

**Trigger:** An admin opens a document, the signed URL is cached, and that exact URL is copied or captured.  
**What the unauthorized recipient sees:** The seller’s full ID photograph, potentially after the UI claims the link has expired.

Use opaque random object keys—never CCCD numbers or real filenames. Prefer authenticated downloads evaluated on every request over reusable signed links. If signed links remain, use very short lifetimes, treat them as credentials, prevent application telemetry from recording them, and test actual post-expiry behavior.

### P1.2 — Document loss is not recoverable from the proven backup

**Mechanism:** Database backup restores document rows, but not Storage objects.

**Trigger:** Bucket deletion, bad cleanup, storage corruption, or restoration to a new project.

**What users see:** The restored application says documents exist, but admin previews/downloads return missing-object errors. Sellers must upload their identity documents again. A four-minute database restore is therefore not a four-minute recovery for this feature.

Resubmission creates the reverse problem too: replacing a metadata row does not transactionally delete the old object. The seller sees the new document while obsolete CCCD copies remain stored indefinitely.

Require an encrypted object backup, restore drill, retention schedule, and orphan reconciliation before real uploads.

### P1.3 — Both critical workflows inherit the known Edge Function blob outage

**Mechanism:** Submit and review depend on two newly deployed Edge Functions on a platform where deployed blobs disappear for minutes or hours.

**Trigger:** `NOT_FOUND_FUNCTION_BLOB` hits either function and GitHub self-heal is unavailable.

**What users see:** Sellers receive a generic submit failure or raw `NOT_FOUND_FUNCTION_BLOB`; admins can view applications but cannot request changes, approve, or reject them.

This is not theoretical availability language; it is the already-observed failure mechanism. Add synthetic probes, explicit UI recognition, a manual recovery runbook, and preferably a secured Postgres RPC fallback for state transitions.

### P1.4 — Approval can partially commit or duplicate a shop

**Mechanism:** Approval requires application status, shop, owner membership, audit event, and notification. Multiple REST calls from an Edge Function are not one database transaction. A timeout can hide a successful first attempt, causing a retry.

**Trigger:** Admin double-clicks, the response is lost, or notification delivery fails after the database writes.

**What users see:** Two shops for one application; “approved” notification while the application remains submitted; or an approved shop with no owner membership.

Use one transactional database operation with:

- A unique application-to-shop constraint.
- Conditional transition from the expected status and revision.
- Idempotency key.
- Shop/member/audit/notification-outbox writes in the same transaction.
- Notification delivery after commit from the outbox.

The review must reject stale revisions. Otherwise an admin can approve documents that the seller replaced after the review page was opened.

### P1.5 — The known missing-GRANT defect breaks the entire client flow

**Mechanism:** Correct RLS cannot grant table privileges.

**Trigger:** A new table has policies but lacks the required grants.

**What users see:** Seller edit/submit or admin list returns `42501 permission denied for table ...`; manual SQL-editor testing still succeeds.

Run integration tests as actual `anon`, ordinary authenticated user, applicant, admin-at-aal1, and admin-at-aal2—not as owner/service role.

### P1.6 — Admin authorization can silently bypass aal2

**Mechanism:** A review function authenticates with `getUser()`, then performs mutations using service role without calling the shared admin-aal helper. Service role bypasses DB RLS and `has_role()`.

**Trigger:** An attacker obtains the admin’s first-factor session but has not completed TOTP.

**What users see:** Sellers are approved, rejected, or have documents opened by an unauthorized session.

`verify_jwt=false` plus internal `getUser()` is correct for this deployment. It is insufficient for review. Require `_shared/admin-aal.ts`, and test aal1 rejection. Setting `verify_jwt=true` would instead produce immediate 401s for every logged-in user.

### P1.7 — The natural notification dependency is a false-success skeleton

**Mechanism:** `notification-send` returns `{"status":"skeleton"}` without sending anything.

**Trigger:** The new functions invoke the apparently canonical notification function.

**What users see:** Approval/request-changes succeeds, but the seller receives no push or in-app notification and continues waiting until manually checking or contacting the operator.

**Unverified assumption:** The implementation chooses `notification-send`. The plan must explicitly require the proven `notifications` insert plus `send-push-notification` pattern, preferably via an outbox.

### P1.8 — Manual production migration plus automatic app deployment has a deterministic race

**Mechanism:** Migrations are applied manually while `main` deploys automatically.

**Trigger:** The application deploy reaches Cloudflare before the manual schema operation completes.

**What users see:** The new route loads but returns missing-relation/RPC errors. Applying SQL first is safe only if every schema change is backward-compatible and the routes remain disabled until verification.

This is not meaningfully schema-revertible after real data arrives. App rollback leaves new sensitive tables and objects behind; dropping them loses data; database restore cannot recover documents; migration drift prevents reliable replay. The workable rollback is feature disablement plus a forward fix, not a down-migration.

### P1.9 — Upload handling exposes the sole administrator to hostile files and quota exhaustion

**Mechanism:** Authenticated applicants can upload renamed executables, active SVG/HTML, malicious office documents, oversized files, or many files unless both bucket and application limits are enforced.

**Trigger:** A malicious or compromised account submits a fake “business registration PDF.”

**What the admin sees:** A convincing document preview/download; opening it may compromise the only operator workstation. At volume, legitimate sellers see quota, timeout, or upload-size errors.

Require magic-byte validation, a narrow MIME allowlist, no inline active content, malware scanning or safe rendering, per-application counts, per-user quotas, maximum sizes, and randomized filenames.

### P1.10 — The whole plan creates human obligations that exceed “one operator”

The concern is correct for the whole marketplace, but overstated for this first 1–3-seller application slice.

**Mechanism:** The current e-commerce framework requires moderation before display, returns/complaint assistance, takedowns, regulator responses, and retained records. These are queues with deadlines, not occasional product work.

**Trigger:** A seller lists a counterfeit paddle, a rights holder sends a takedown, and a buyer simultaneously requests a return during a livestream incident.

**What users see:** Listings remain live too long, returns and complaints go unanswered, or unrelated livestream/tournament incidents wait while the operator handles marketplace work.

Before products launch, define intake channels, response deadlines, suspension authority, evidence retention, after-hours limits, and a second human or contracted service. Otherwise this is an organizational single point of failure.

### P1.11 — Displayed VietQR cannot adjudicate a later payment dispute

**Mechanism:** The QR renderer produces payment instructions only. The platform receives no bank event.

**Trigger:** Buyer says they transferred; seller says nothing arrived. Buyer supplies a screenshot.

**What users see:** Buyer sees “unpaid” or a cancelled order despite claiming payment; seller sees pressure to ship without funds; operator has no authoritative evidence and cannot decide who is lying.

Your invariant prevents false `paid` transitions, so it protects data integrity. It does not solve the dispute. Seller confirmation is evidence from an interested party; a screenshot is forgeable. Keep the order unpaid unless the seller confirms or a trusted provider callback/reconciliation proves receipt, and publish a policy explaining that the platform cannot verify direct bank transfers.

COD and one-seller-per-order are genuinely safer. The platform not holding funds also removes custody/payout complexity.

### P1.12 — Future public shop pages will silently disappear from Google

**Mechanism:** A public SPA route without an SSR handler becomes a hard 404 for bots.

**Trigger:** A later phase launches `/shop/...` or product URLs without adding render handlers and invalidating `pr:v34` caches.

**What Googlebot sees:** Proper 404/noindex while human buyers see a functioning marketplace. Products never enter search.

This is not a Phase‑1 seller-application problem. It becomes a launch blocker for the first public listing.

## P2

### P2.1 — Lazy loading does not protect the total bundle backstop

**Mechanism:** Lazy chunks still count against the 1,970 KB total.

**Trigger:** Forms, upload widgets, PDF/image previewing, or another dependency adds more than 66 KB gzipped.

**What users see:** Nothing in production—the Quality workflow blocks the merge/deploy. That is a delivery failure, not a live performance incident.

Do not add a PDF framework merely to preview three seller documents. Use browser-native rendering or server-generated safe previews.

### P2.2 — The private seller route is crawlable but its bot 404 is acceptable

Googlebot currently receives a 404 for `/seller/application`. That is correct for a private authenticated workflow, although `/seller/` should be added to robots.txt to avoid pointless crawling. `/admin/...` is already safely disallowed.

### P2.3 — The current CLS burn is not caused by this slice, but it is still a policy stop

A completely isolated lazy route need not worsen `/`, `/feed`, or the mobile shell. So claiming this slice necessarily causes the existing CLS failure would be dishonest.

However, the written error-budget policy already says feature work in the affected domain pauses. Shipping additional SPA UI while Vietnam mobile CLS is burning violates that agreement unless the owner explicitly defines seller routes as an isolated domain and makes no shared-layout/navigation changes.

## Genuinely safe choices

- Marketplace-scoped `shop_members` instead of a global seller role is the correct ownership model.
- `verify_jwt=false` with internal `auth.getUser()` is required and safe when combined with admin aal2 checks.
- Lazy seller/admin routes protect the initial bundle and existing-route LCP.
- An empty, non-public shop record does not itself create buyer/payment exposure.
- Render-only VietQR is safe when labeled as payment instructions, never payment evidence.
- No platform-held funds, one seller per order, and no automatic payouts substantially reduce later financial risk.
- The five-slot mobile navigation need not change for this slice.

The minimum acceptable first slice removes bank collection, avoids raw CCCD images unless counsel says they are strictly necessary, completes the two data-impact filings and consent/rights design, proves table and Storage default-deny access, adds object backup, makes approval transactional/idempotent, verifies admin aal2, and launches behind a disabled feature flag. Until then: **REJECT**.
