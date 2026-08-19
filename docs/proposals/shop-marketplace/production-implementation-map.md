# Shop marketplace — production implementation map

> Phase 0 deliverable. Written 2026-08-11 after reading CLAUDE.md,
> `docs/architecture-boundaries.md`, `shop-marketplace-plan.md`,
> `shop-marketplace-screen-tasks.md` (incl. §11 findings P1–P13),
> `shop-marketplace-product-owner-test-cases.md`, the approved
> `shop-marketplace/proposal.md`, all of `src/proto/shop/**`, and the repo's
> existing migrations / RLS helpers / edge functions / hooks / tests.
>
> **Status vocabulary** (per the production brief): `UI parity complete` ·
> `data layer complete` · `security verified locally` · `preview ready for
> Product Owner` · `production deployment pending approval`. Nothing here is
> called "production ready".
>
> **Read §11 first.** The Product Owner signed D1–D4 on 2026-08-11; those
> decisions override anything below them and anything in `proposal.md` that
> disagrees.

---

## 0. Source-of-truth reconciliation

| Question | Prototype says | Plan says | Resolution |
|---|---|---|---|
| Seller role | `shop_members` with marketplace roles | same (§6 "do not add `seller` to `app_role`") | **Agree.** No change to `app_role`. |
| KYC / bank at pilot | F07 + S10 render the fields, both **labelled out of scope** | §6 flow includes bank + documents | **Proposal §2 wins** (safer): pilot collects neither. Fields ship disabled behind a phase flag. |
| Checkout scope | one shop per checkout (B08 has no global checkout button) | §8 same | Agree. |
| VietQR | "chờ quản trị viên đối soát", never auto-verified | §10 staged | Agree; Phase 3. |
| Application steps | 6 steps, bank step omitted at pilot | 7-step flow incl. payout | Prototype's 6 steps + a **skipped** payout step. |
| Review SLA | "chưa cam kết thời gian" | not specified | Prototype wins — no invented SLA. |

**Open, needs Product Owner** (listed again in §10):

1. **Q2 from the approved proposal is still open** — the "Quy chế người bán v1"
   document does not exist in the repo. Phase 1 ships the acceptance checkbox
   **disabled with an explanatory note** rather than recording consent to a
   document that does not exist.
2. Pilot allowlist seeding: who are the first sellers, and by which identifier
   (email vs user id)?

---

## 1. Phase / PR breakdown

| Phase | PR | Scope | Depends on |
|---|---|---|---|
| 0 | this doc | Implementation map | — |
| **1** | **P1** | Pilot access gate · seller application (draft → submit → resubmit) · admin queue + review + structured change requests · application status · audit · notifications · production Seller/Admin shells | 0 |
| 2 | P2a | Shop profile, categories, products, variants/SKU, basic inventory, media upload, seller catalog, submit-for-review — **plus** the moderation state machine, guarded transitions, RLS + pgTAP P2b will use (no admin UI, no public catalog — §11 D3) | 1 |
| 2 | P2b | Admin moderation UI (approve / reject / request changes), public discovery + PDP incl. the "Liên hệ shop" CTA (§11 D2) | P2a |
| 3 | P3a | Wishlist, cart, one-shop checkout, idempotent order creation, inventory | P2 |
| 3 | P3b | Order lists/details, cancellation, deadlines, returns, disputes, reviews | P3a |
| 4 | — | Payment provider / public launch — **blocked on explicit approval** | P3 |

Phase 1 deliberately contains **no** product, cart, checkout or payment code.

---

## 2. Data model — Phase 1 only

New enums (`public`):

```
shop_application_status : draft | submitted | under_review | needs_changes
                          | approved | rejected | withdrawn
shop_state              : pending_activation | active | restricted | suspended | closed
shop_member_role        : owner | manager | fulfillment | support
```

New tables:

| Table | Purpose | Notes |
|---|---|---|
| `shop_pilot_members` | Closed-pilot allowlist | admin-managed; `user_id` PK |
| `shop_applications` | One row per application | `status`, `applicant_user_id`, structured payload columns, `internal_note`, `applicant_note`, `requested_fields text[]` |
| `shop_application_events` | Append-only history | who did what, when; never updated |
| `shops` | The shop record | `state`, `slug` unique, `owner_user_id`, `verified_method`, `verified_at` |
| `shop_members` | Staff | `(shop_id, user_id)` PK, `role` |

Deferred to Phase 2+ (named here so nobody re-invents them): `shop_addresses`,
`shop_policies`, `product_categories`, `products`, `product_variants`,
`product_media` (private original + approved public rendition — §11 D1),
`shop_contact_channels` (§11 D2), `inventory_movements`, `carts`, `orders`,
`payments`, `returns`, `disputes`, `reviews`. **`shop_bank_accounts` and
`shop_application_documents` are NOT created in Phase 1** — creating a table
for data we decided not to collect is how it starts getting collected.

### Invariants enforced in Postgres, not in the client

- VND amounts: `integer`, never float (Phase 3).
- Timestamps: `timestamptz`, UTC.
- `shops.slug` unique, generated server-side from the name + a collision suffix.
- One **non-terminal** application per user: partial unique index on
  `applicant_user_id WHERE status IN ('draft','submitted','under_review','needs_changes')`.
- Application status transitions only through `shop_application_submit` /
  `shop_application_withdraw` / `shop_application_decide` — a guarded `UPDATE`
  with the expected current status in the `WHERE` clause, so two concurrent
  moderators cannot both approve (DB-00/DB-01 lesson from
  `architecture-boundaries.md` §edge rule 4).
- Approving creates the shop **and** the owner `shop_members` row in the same
  transaction; the RPC is idempotent on re-approval.

---

## 3. API surface — Phase 1

All state transitions are `SECURITY DEFINER` RPCs. No client writes to
`shop_applications.status`, `shops.state`, or any `shop_members` row.

| Routine | Actor | Guarantees |
|---|---|---|
| `shop_pilot_has_access()` | any | `STABLE`; admin OR allowlisted |
| `shop_application_upsert_draft(payload jsonb)` | applicant | own draft only; refuses when status ≠ draft/needs_changes |
| `shop_application_submit()` | applicant | validates server-side, `draft|needs_changes → submitted`, guarded UPDATE |
| `shop_application_withdraw()` | applicant | non-terminal → `withdrawn` |
| `shop_application_decide(id, decision, applicant_note, internal_note, requested_fields)` | admin | requires `is_admin()` (⇒ AAL2); guarded on expected status; approval creates shop + owner member + audit row, all in one transaction |
| `shop_application_queue(status)` | admin | list view without exposing other applicants' rows to non-admins |

No edge function is needed in Phase 1: there is no third party to talk to and
no secret to hold. Edge functions arrive in Phase 3 (payment reconciliation).

---

## 4. RLS matrix — Phase 1

Deny by default; every table gets explicit policies **and** a `GRANT` block
(the repo's most-repeated defect class — see the missing-grants sweeps).

| Table | anon | authenticated (self) | authenticated (other) | shop member | admin |
|---|---|---|---|---|---|
| `shop_pilot_members` | — | read own row | — | — | full |
| `shop_applications` | — | read+update **own draft** | — | — | read all, decide via RPC |
| `shop_application_events` | — | read own application's events | — | — | read all; insert only via RPC |
| `shops` | read **active** public columns | — | — | read own shop | full |
| `shop_members` | — | read rows for own shops | — | read own shop's rows | full |

Negative tests that must exist before Phase 1 is "security verified locally":

1. user B cannot select user A's application
2. user B cannot update user A's application
3. applicant cannot set `status='approved'` directly
4. applicant cannot write `internal_note`
5. non-admin cannot call `shop_application_decide`
6. anon cannot read any application row
7. anon cannot read a `pending_activation` / `suspended` shop
8. applicant cannot insert into `shop_members`
9. applicant cannot insert into `shop_application_events`
10. two concurrent `decide` calls produce one shop, not two

---

## 5. Route + component map — Phase 1

| Prototype screen | Production route | Component | Hook | Backing |
|---|---|---|---|---|
| S01 `/proto/shop/sell` | `/shop/sell` | `pages/shop/SellLanding.tsx` | `useShopPilotAccess` | `shop_pilot_has_access()` |
| S02 `/proto/shop/seller/application` | `/seller/application` | `pages/shop/SellerApplication.tsx` | `useSellerApplication` | draft RPC + `useAutosaveDraft` |
| S03 `/proto/shop/seller/status` | `/seller/application/status` | `pages/shop/SellerApplicationStatus.tsx` | `useSellerApplication` | select own row |
| A02 `/proto/shop/admin/applications` | `/admin/shop/applications` | `pages/admin/shop/AdminShopApplications.tsx` | `useShopApplicationQueue` | `shop_application_queue()` |
| A03 `/proto/shop/admin/applications/:id` | `/admin/shop/applications/:id` | `pages/admin/shop/AdminShopApplicationReview.tsx` | `useShopApplication` | select + `shop_application_decide()` |
| F03 seller shell | — | `components/shop/SellerShell.tsx` | — | — |
| S04 dashboard | `/seller` | `pages/shop/SellerHome.tsx` (Phase 1: shop state + next step only) | `useMyShop` | `shops` + `shop_members` |

Route conventions honoured: lazy-loaded via `lazyRetry`, `/vi` mirror through
the `MIRRORED` array (never a hand-written pair), `route-snapshot.json`
updated, `/seller` + `/admin/shop` already in the ChatFAB and BottomNav hide
lists (shipped with the prototype PR), `NOINDEX_PATTERNS` + both robots files
extended for `/seller`.

**Shared with the prototype, moved not copied**: the visual layer
(`shop.css`, shells, primitives) is promoted out of `src/proto/shop/` into
`src/components/shop/` in Phase 1 and the prototype imports it back, so there
is exactly one implementation while the prototype stays alive for parity
review. Fixtures stay in `src/proto/shop/fixtures.ts` and are **never**
imported by production code — enforced by a test.

---

## 6. Migration strategy

- Timestamped file per the repo convention: `supabase/migrations/<UTC>_shop_phase1_*.sql`.
- Idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`)
  so a replay is safe.
- **Not applied to production.** Validation happens locally / on preview only.
- Generated types: the remote schema will not contain these tables until the
  migration is applied, so `npx supabase gen types` cannot produce them yet.
  Phase 1 therefore ships a hand-written `src/integrations/supabase/shop-schema.ts`
  carrying exactly the Phase 1 row/RPC shapes, with a header stating it is
  replaced by the generated file once the migration lands. A test asserts the
  hand-written table list matches the migration.
- Rollback: every Phase 1 object is additive. Reverse script is
  `DROP FUNCTION/TABLE/TYPE` in dependency order, shipped in the PR body.
  No existing table is altered, so `git revert` on the app code is sufficient
  to disable the feature even before the DB is reversed.

---

## 7. Observability

- `audit_logs` rows for: application submitted, decided, document/PII viewed
  (Phase 2), shop created, shop state changed. Uses the existing
  `log_audit_event` helper and the existing `event_category` CHECK — the
  migration widens that CHECK rather than inventing a new table.
- Journey instrumentation via `src/lib/journeys.ts`: `seller_onboarding`
  (start / step / submit / decided).
- No PII in logs, analytics, push payloads or URLs — asserted by a test that
  greps the notification payload builders.

---

## 8. Test strategy per phase

| Layer | Phase 1 tests |
|---|---|
| Pure logic | application state machine (`lib/shop/applicationState.ts`) — legal/illegal transitions |
| Validation | server-side field rules shared with the client form |
| RLS | `supabase/tests/shop_phase1_rls.test.sql` — the 10 negative cases in §4 |
| RPC | guarded-transition + idempotency assertions in the same pgTAP file |
| Component | queue/review/status render + permission states |
| Responsive/a11y | the existing `scripts/proto-shop-qa.mjs` gains a production mode pointed at the real routes |
| E2E | happy path (apply → submit → admin requests changes → deep link → resubmit → approve) |

**The fixture gate does not certify production.** `proto-shop-qa.mjs all` keeps
running against `/proto/shop` for prototype regression; production gets its own
run against the real routes with a seeded pilot user.

---

## 9. Feature flag / pilot access

Two layers, because a client flag alone is not access control:

1. **Server**: `shop_pilot_has_access()` gates every RLS policy and RPC.
   Not on the allowlist ⇒ the data does not exist for you.
2. **Client**: `useShopPilotAccess()` decides whether Shop entry points render
   at all, so a non-pilot user never sees a door they cannot open.

Admins always pass. The allowlist is managed from `/admin/shop` (Phase 1) and
seeded manually — no self-serve join.

---

## 10. Still needs Product Owner

| # | Decision | Blocks |
|---|---|---|
| 1 | "Quy chế người bán v1" text — does not exist in the repo | The consent checkbox in S02 step 6. Phase 1 ships it disabled with a note. |
| 2 | Pilot allowlist: which accounts, keyed how | Seeding the pilot; the mechanism ships regardless |
| 3 | Applying the Phase 1 migration to production | Everything downstream of preview |
| 4 | Whether `/seller` should be noindex-only or also robots-disallowed for `/vi/seller` | SEO surface; Phase 1 assumes both |

Items 1 and 2 do **not** block building Phase 1; item 3 is a hard stop by
instruction.

---

## 11. Product Owner decisions — D1–D4 (2026-08-11)

Signed directly by the Product Owner after Phase 1 landed on the branch. These
override anything earlier in this file, in `proposal.md`, or in
`shop-marketplace-plan.md` that contradicts them. Round 2 of `/idea` was
**deliberately skipped** — the four disagreements were resolved by decision, not
by another panel.

### D1 — Product media: private draft + public approved rendition (hybrid)

Not "all public", not "all private".

| Object | Bucket / access |
|---|---|
| Originals, `draft`, `pending`, `rejected` media | **private** |
| Approved rendition of an **approved + publishable** product | **public**, served from a separate path |
| Seller documents, moderation attachments | **private, always** — never a public rendition |

Rules that follow, and that the P2a tests must prove:

- The public PDP / CDN reads the **approved rendition path only**. It never
  reads the draft bucket, and it never uses a short-lived signed URL for
  published imagery (cache + SEO both degrade).
- `unpublish` / `reject` / `suspend` must make the public rendition
  **unreachable**, not merely unlinked.
- A seller cannot promote an object to public by editing a path or by writing a
  client-controlled `status`. Publication is a server-side transition.
- Storage/RLS tests required: guessed path, cross-shop access, unpublished
  media, and a seller attempting to write into the public prefix.

Precedent to copy: `clubs-logos` (folder-scoped `auth.uid()`, random path,
`upsert:false`). Precedent **not** to copy: `og-images` (`cacheControl:
31536000` — the Smart-CDN finding from round 1).

### D2 — PDP has a "Liên hệ shop" CTA (Phase 2, discovery/lead-gen)

Yes to the CTA — but only through **public contact channels the seller
declared and an admin approved**.

- Zalo / Messenger / a business phone are allowed **if** the seller opted that
  channel in. Account email and account phone are never exposed by default.
- Every channel row carries an `active`/`approved` state and can be disabled by
  an admin.
- Links are validated and sanitised; opening one tells the user they are
  leaving ThePickleHub.
- **No PII in the outbound URL** — not the buyer's name, phone, nor the product
  they were looking at.
- No fake internal chat. Messaging is not built, so it is not implied.
- Phase 2 is therefore discovery + lead generation. Cart and checkout stay in
  Phase 3.

### D3 — Scope: this file is the source of truth

P2a and P2b split exactly as §1 already says. Any earlier prompt or note that
folded moderation UI into P2a is wrong.

- **P2a** — shop profile, categories, products, variants/SKU, basic inventory,
  media upload, seller catalog, submit-for-review.
- **P2b** — Admin moderation UI, approve/reject/request-changes screens, public
  discovery + PDP.

P2a **still builds** the moderation state machine, the guarded server-side
transition primitives, RLS and pgTAP that P2b will consume. It does **not**
build the admin moderation screens or the public catalog.

### D4 — Prototype stays in the repo, leaves the production artifact

The prototype source, its tests, and the ability to run it are **kept**. What
changes is what ships:

- A build-time flag separates them. Production build = flag off.
- Prototype routes and imports must be removed at **compile time**. A runtime
  `if` that merely hides the route is not acceptable — the chunks would still
  ship.
- Prototype preview keeps its three noindex layers and keeps running Q01–Q04.
- The production artifact contains no prototype screen / scenario / fixture
  chunk.

The total-gz backstop stays at **1970 KB**. It is not raised for Phase 2a.
If P2a pushes past it: produce a bundle attribution, hunt accidental eager
imports, lazy-load by route, reuse existing primitives instead of adding a
dependency, and look for something to split or drop. If it is still red, stop
and report the exact delta for a separate approval. Do not edit the budget.

### P2a status (12 August 2026)

`P2a Product Owner acceptance PASS locally.`

Steps 1–11 PASS; step 12 PASS after a real Playwright viewport run at 375px
(`scripts/seller-mobile-gate.mjs`, every measured `window.innerWidth` asserted).
The multi-variant save bug acceptance uncovered is fixed and regression-locked
in `0dd7bfd0`.

Still **not** production ready, **not** deployed, **not** remote verified.

All seven increments are built on `feat/shop-production-phase-2a`. Twelve
migrations, 1018 pgTAP assertions, 33 storage-integration assertions against a
real local stack, 1740 unit tests, bundle 1965.2 KB gz against an unraised
1970 KB backstop. Full evidence, the deferred P2b list and the deployment
prerequisites are in
[`shop-catalog-phase-2a/completion.md`](../shop-catalog-phase-2a/completion.md).

Nothing has been deployed, merged, pushed, or applied to a remote database.
Three prerequisites gate any deployment decision: the media cleanup worker and
its cron are **not deployed** (without them, revoked objects stay addressable),
`shop_pilot_members` is empty, and there is no admin moderation UI until P2b —
so a pilot moderator would work through SQL.

### P2b status (12 August 2026)

`P2b Product Owner acceptance PASS locally.`

Accepted conditionally after the Product Owner's own run, then closed by three
supplemental verifications (P2b.7b) that replaced the last inferences with
observations at the call site: the variant→photo swap asserted on public object
keys in a real browser, EXIF/GPS/XMP followed on real bytes through the actual
`shop-media-lifecycle` edge function to an anonymous GET, and the X-Robots-Tag
matrix — nine route classes × six flag values plus a non-Shop control — read
off Responses returned by `onRequest`. Each is red-proven by breaking the place
production calls it.

Seven checkpoints on `feat/shop-production-phase-2b` (worktree
`.claude/worktrees/shop-p2b`), base P2a `afdb9a0a`: performance, moderation
backend, admin moderation UI, public read model, discovery/search/category,
PDP + shop page + contact CTA, pilot noindex, and P2b.7 acceptance.

Five migrations on top of P2a's twelve (350 in the ledger after a clean
`db reset`), 1241 pgTAP assertions, 2014 unit tests, and one unified browser
acceptance run — `node scripts/shop-p2b-acceptance-qa.mjs` — covering 20 routes
at 320/375/390/414/768/1440, the `/vi` twins, six end-to-end journeys, a
leakage scan of the DOM **and** every REST payload, and a teardown verified by
counting rows and Storage objects rather than by having issued the deletes.
Bundle ~1935.5 KB gz against an unraised 1970 KB backstop, INITIAL 226.8 KB.

P2b.7 found and fixed four defects in code that already had passing tests — a
mobile filter sheet that never showed the buyer's selection, two 15–17px
navigation links, and an admin route no gate had ever opened — plus a teardown
of its own that reported zero over three shops it had not deleted. Full
evidence, every red-before-green proof and the deliberate non-fixes are in
[`shop-catalog-phase-2b/completion.md`](../shop-catalog-phase-2b/completion.md).

Still **not** production ready, **not** deployed, **not** remote verified, and
**not** indexed. The three gates and everything still open in each are in
[`shop-catalog-phase-2b/deployment-readiness.md`](../shop-catalog-phase-2b/deployment-readiness.md);
the manual pack the Product Owner runs is
[`shop-catalog-phase-2b/product-owner-test-cases.md`](../shop-catalog-phase-2b/product-owner-test-cases.md).
The two P2a blockers are untouched: the media cleanup worker and its cron are
**not deployed**, and `shop_pilot_members` is empty on the remote project. The
third — no admin moderation UI — is what P2b.2 built.

## 12. Product Owner decisions — Q1–Q4 (2026-08-12)

Signed during P2b planning. These override anything earlier that disagrees, on
the same footing as D1–D4. Full reasoning and consequences:
[`shop-catalog-phase-2b/proposal.md`](../shop-catalog-phase-2b/proposal.md) §0.

### Q1 — the pilot allowlist gates ACTIONS, not reads

Keep the P2a rule. Being a `shop_members` row is what grants reads of that
shop's own data; `shop_pilot_has_access()` gates create / update / submit.

A `support` member and a member absent from `shop_pilot_members` can therefore
both read their own shop's drafts. That is not a hole in
`product_public_projection`: `products_select_member` grants the identical read,
so `_as_seller=true` buys nothing PostgREST would not already serve. Locked by
25 assertions in `supabase/tests/shop_p2b_projection_authz.test.sql`, which
state the rule as an equivalence rather than a list of roles:

> `projection(id, true)` succeeds **iff** the caller can already `SELECT` that
> product row under RLS.

### Q2 — slug changes get a history row and a 301

`product_slug_update` / `shop_slug_update` write a history row **inside the same
guarded transaction** that changes the slug. Not a trigger, not the client: a
rename that forgets its forwarding address is the failure this exists to stop.

Renderer behaviour: current → 200 · replaced → 301 to current · never
existed → 404 · deleted → 410.

### Q3 — the taxonomy belongs to the platform

Sellers pick from it; they never author it. No seller-created categories, no
editing slug/name/hierarchy, no disabled category, no category id outside the
allowlist. Admin manages it by versioned seed/migration or a controlled UI, with
audit; no hard delete while in use; slug changes use the Q2 strategy; reorder
never changes identity; disabling a category does not archive anybody's
products. A category is public only when active with at least one publishable
product, or editorially enabled.

P2b consequence: **approve preflight re-checks that the category is active**,
because a category can be disabled between submit and approve. Public filters
and counts come from the taxonomy server-side, never from seller text. No
taxonomy editor is built in P2b.

### Q4 — the closed pilot is NOT indexed

Shop routes run for QA and pilot use, but `/shop` and every public Shop route
serve `noindex, nofollow`, Shop stays out of the sitemap index, and no IndexNow
call is made. No empty SEO landing pages and no invented products, categories or
counts to make a page look populated. Canonical stays correct so opening
indexing is a flag flip.

The flag is **server/build controlled**, never client JavaScript. Admin and
Seller routes remain unconditionally noindex.

Moving to indexed requires a separate Product Owner launch gate. The measurable
signals are listed in the P2b proposal §0.2; the thresholds are the Product
Owner's to set.

### Saved products / wishlist — confirmed out of P2b

Stays in **P3a** with cart and orders, as §1 already says. Not built, not
stubbed, no schema, no non-functional Save button, and public cards and the PDP
show no save CTA while there is no behaviour behind it.

---

### Verification standard (applies from now on)

`supabase start` alone is **not** evidence of a clean database — it does not
replay every migration. Security verification means: `supabase db reset` →
confirm all migrations applied → run the full pgTAP suite → record the
assertion count. Only then may a report say "security verified locally", and
the report must state how the database was built.
