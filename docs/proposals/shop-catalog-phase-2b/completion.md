# Phase 2b — completion log

Appended per checkpoint. Nothing here is deployed, merged, pushed, or applied
to a remote database.

Branch `feat/shop-production-phase-2b`, worktree `.claude/worktrees/shop-p2b`,
base P2a `afdb9a0a`.

---

## P2b.0 — performance · `6210ece1`

Freed **54.7 KB gz** before any feature code. Target was 30 minimum / 40
preferred; backstop stays 1970 and was not raised.

| | Total gz | INITIAL | CODE | Headroom |
|---|---:|---:|---:|---:|
| P2a base | 1964.0 | 226.0 | 1580.1 | 6.0 |
| after | **1909.3** | 226.0 | 1525.4 | **60.7** |

Attribution first, per module, decoded from sourcemaps across 418 chunks:
**0 duplicated modules, 0 accidental eager imports, no prototype residue.** The
long tail was already clean, so the whole opportunity was the video stack
(297.1 KB gz).

1. `HlsPlayer.tsx` was dead — exported from a barrel, imported by nobody
   (−1.8 KB), and it was the last direct `hls.js` importer in `src/`.
2. With it gone the only importer is `@mux/playback-core`, by bare specifier,
   so a `resolve.alias` to the **light** build catches that too (−52.9 KB).

Light drops captions, alternate audio, EME/DRM, CMCD and interstitials — all
verified unused (zero caption references, no `drm_configuration`,
`playback_policy:"signed"` is a JWT not Widevine). **Proven in a real browser**:
Playwright mounted the actual `<mux-player>` against a live Mux HLS asset,
reached `currentTime` 0.57 s with no errors, while asserting the dropped
controllers were absent.

Guard: `src/components/video/__tests__/hls-light-build.test.ts` pins the alias
and enumerates all five unsupported capabilities, one test each. Red-proven.

Rejected with numbers: dropping mux-player (~110 KB, removes working
features); renaming blog content to `.json` (~384 KB "freed" by moving zero
bytes — gaming the metric).

---

## Bước 0 — projection security closure · `bd42302b`

`product_public_projection(_id, _as_seller)` goes on a public route in P2b, so
the boolean had to be proven inert. 25 assertions state the rule as an
equivalence rather than a list of roles:

> `projection(id, true)` succeeds **iff** the caller can already `SELECT` that
> product row under RLS.

Six actors asked both questions in the same session; it holds for all six.
Settled the two cases P2a never pinned down — `support` and non-pilot members
**can** read their own shop's drafts, because `products_select_member` grants
exactly that, so the flag buys nothing.

Also pinned: unknown id and forbidden id return the same error (the error code
is not an oracle); approve/publish/active-shop are three independent
conditions; admin at aal1 refused; and "no longer approved but still public" is
**unrepresentable** (`products_publish_requires_approval`).

Red-proof: authorization replaced with `NULL` → exactly 5 assertions red.

---

## P2b.1 — moderation backend · `5249967a`

Two migrations, one new pgTAP file (78), `product_moderation_events`,
`product_slug_history`, `products.requested_targets`, enum `+suspended`, and
nine RPCs.

Fixed six things P2a's `product_decide` could not do: no expected version, no
client token, string-array targets, no approve preflight, notes overwritten,
no takedown.

Three ideas kept apart — moderation decided / bytes published / publicly
visible. **Approve does not publish**: the worker's commit does, after the
bytes exist.

Structured targets reuse the shape `product_submit_preflight` already emits and
`submitProblems.ts` already focuses. Server refuses an unknown section, a
variant/media id from another product, and `index`/`position`/`nth` outright.

Q3 landed in code: approve preflight re-checks the category is **active**.
Q2 landed in code: `product_slug_update` writes the forwarding address in the
same transaction.

Red-proof, five guards removed one at a time: admin/AAL2 → 7 red;
expected-version → 1; target ownership → 1; internal-note allowlist → 2;
idempotent replay → suite aborts at `22023`. The first found a hole in the
**tests**: every non-admin assertion used `approve`, which has a second lock on
it, so the suite stayed green with the guard deleted.

Query plans on 8000 products / 20 shops: queue page 1 index scan 57 buffers
0.055 ms; keyset page 1000 **78 buffers 0.035 ms** (deep paging costs the same
as the first page); shop filter BitmapAnd 100 buffers 0.159 ms; counts seq scan
582 buffers 0.800 ms (the one to watch). Teardown 0/0.

The first attempt at those plans measured nothing — `products` pins `status`
**and** `submitted_at` on client writes, so the seed produced 8000 drafts with
NULL timestamps and every plan ran over zero rows while still "using the
index".

Bundle unchanged at 1909.3.

---

## P2b.1b — Q5 / Q6 closure · `<this commit>`

### Q5 — a pulled product does not go back on sale by itself

`suspended → approved` is forbidden. The only road back is

```
suspended → reopen → needs_changes → resubmit → pending_review → approve
```

`reopen` restores the seller's ability to **edit**, not the product's ability
to **sell** — hence not called `restore`. It requires a seller-visible reason
and ≥1 validated target, re-asserts media revocation, and never re-publishes.
`allowed_decisions` returns `["reopen"]` so no screen can offer more.

### Q6 — contact decisions get their own history

`shop_contact_moderation_events`, keyed by `contact_channel_id` + `shop_id`,
append-only, admin-read via RLS, seller reads an allowlisted projection through
`shop_contact_moderation_history()`. Idempotent on a client token. A trigger
records `resubmitted` when a seller edits an approved value, so the history has
no unexplained gaps.

**The channel type travels; the value never does.** Asserted directly: no
history row, note or notify_key contains the phone number.

### The bug this checkpoint found

The append-only trigger blocked its own `ON DELETE CASCADE`, so a contact
channel that had ever been moderated could not be deleted — which would have
taken account deletion and QA teardown with it. Caught by the **P2a profile
suite** within minutes (`shop_contact_delete` is seller-facing).

This is the P2a inventory-ledger lesson repeating. Same fix: Postgres removes
the parent before the children, so **a missing parent is the cascade**. Applied
to `product_moderation_events` too, where the trap was latent only because
sellers have no DELETE policy on products.

| Gate | Result |
|---|---|
| `supabase db reset` | 348/348, ledger parity |
| pgTAP | Files=32, **Tests=1174**, PASS (new file 53) |
| unit | **1787** passed, 10 skipped |
| `tsc -b` | clean |
| eslint | 0 errors (23 pre-existing warnings) |
| build + `BUNDLE_STRICT=1` | exit 0 |
| Total gz | **1909.3 KB** — allocation for Q5/Q6 was 1 KB, used **0** |
| INITIAL | 226.0 KB |

Deferred: notification dispatch still has no infrastructure; the contract in
`notification-contract.md` now covers contact events too.

---

## P2b.2 — Admin moderation UI · `<this commit>`

Three lazy routes, all behind `RequireAuth requiredRole="admin"` inside
`AdminMFAGate`, all `noindex`, none reachable from a buyer surface:

| Route | Screen | chunk gz |
|---|---|---:|
| `/admin/shop/products` | queue | 5.7 KB |
| `/admin/shop/products/:id` | review + decision rail | 11.4 KB |
| `/admin/shop/contacts` | contact moderation | 6.7 KB |

Everything reads the P2b.1 RPCs — no table selects — so the queue counts are
the server's, the review payload is an allowlist built in Postgres, and
`allowed_decisions` decides which buttons exist rather than the screen
guessing.

The buyer preview is the first thing on the review page, not a link. It is the
canonical projection, so a moderator cannot approve one thing and publish
another. "Đã duyệt" and "đang hiển thị" are shown as two separate facts,
because they are.

Pure logic in `src/lib/shop/moderationDecision.ts` (21 assertions): which
decisions need a note, which need targets, target identity as the whole tuple
rather than the section, and the consequence copy — including an assertion that
suspend/reopen keep saying the product does not go back on sale by itself, and
that approve does not claim instant visibility.

| Gate | Result |
|---|---|
| unit | **1809** passed (was 1788) |
| `tsc -b` | clean |
| eslint | 0 errors |
| pgTAP | unchanged, 1174 |
| build + `BUNDLE_STRICT=1` | exit 0 |
| Total gz | 1909.3 → **1921.1** (+11.8; allocation 12) |
| INITIAL | 226.0 → 226.3 |

### 🔴 Browser QA is BLOCKED, and the first version of this gate lied

`scripts/admin-moderation-qa.mjs` drives the three routes at
320/375/390/414/768/1440 with a real admin JWT, asserting `window.innerWidth`
at every size, plus axe, keyboard, overflow, touch targets, and a check that no
storage path or signed URL reaches the DOM.

It cannot pass yet. The local stack has no `[auth.mfa]` block in
`supabase/config.toml`, so TOTP enrolment returns 422 and `AdminMFAGate`
renders **"Lỗi xác thực 2 yếu tố"** instead of the console — on every route, at
every width.

The first version of this file listed that 422 as "known pre-existing" and
**reported PASS**. It was measuring an error screen: no overflow, no small
targets, no console errors, because there was nothing on the page. That is
exactly the false green the P2a acceptance run exists to prevent, and it was
caught only by opening the 375px screenshot.

The gate now treats the MFA 422 and the missing `<main>` as HARD failures with
a stated reason, and additionally asserts the console's own `<h1>` is on the
page. It exits red, which is the correct answer today.

**Next action before P2b.3 QA can mean anything:** add `[auth.mfa.totp]`
(`enroll_enabled`/`verify_enabled`) to `supabase/config.toml`, restart the local
stack, and give the QA admin a verified factor plus a generated TOTP code so the
session reaches aal2.

One genuine pre-existing defect surfaced and is allowlisted with proof: the
shared `ErrorState` retry button renders **74×41** against DS-03's 44px rule,
reproduced identically on `/admin/shop/applications` from Phase 1. It belongs
with `PageStates.tsx`, not inside a moderation checkpoint.

### P2b.2 browser acceptance — PASS with real AAL2 · `9a61bb9e` `adacf041` `<this commit>`

**P2b.2 implementation and local browser acceptance PASS with real AAL2.**

The blocker is closed by making the local stack match production, not by
routing around the gate. `supabase/config.toml` gains `[auth.mfa.totp]` (keys
read out of `supabase init` on CLI 2.111.0, not guessed), and
`scripts/qa/totp.mjs` implements RFC 6238 in node:crypto so the harness enrols
a real factor, reads the secret in memory, computes a code, verifies, and
**asserts the JWT's own `aal` claim** rather than trusting a 200.

Nothing is mocked, nothing is bypassed, `AdminMFAGate` is untouched, no secret
is committed, and the secret differs every run.

```
before enrol : aal1 -> next aal1
after verify : aal2
queue RPC    : OK   (product_moderation_queue — requires is_admin())
```

#### The gate now proves it is looking at the right screen

Per route: the route's own `<h1>`, a **content marker** that only exists once
the screen reached its own body (`Người mua sẽ thấy gì` for review, the filter
tabs or the official empty state for the queues), a `<main>` landmark, and hard
failures on the MFA error screen. A heading alone was not enough — a page can
render its title and then fail.

`/admin/shop/applications` is carried as a **control route**. Anything reported
on both a P2b.2 route and the Phase 1 one is admin shell, not this checkpoint,
so the comparison replaces a hand-written allowlist that would have rotted the
first time somebody fixed one of them.

| Widths | 320 · 375 · 390 · 414 · 768 · 1440, `window.innerWidth` asserted at each |
|---|---|
| Result | **PASS** — 0 findings attributable to P2b.2 |
| Shell findings | 6 types, each also present on `/admin/shop/applications` |

Screenshots (outside the repo): 375 queue · 375 review · 375 contacts · 375
control. The 375 review shot shows real seeded data — title, canonical buyer
preview, and the "đã duyệt vs đang hiển thị" split.

#### What the gate found that was mine

The review screen's back link (`← Về hàng đợi`) was a bare inline anchor,
**93×17**. It is the only way out of a review and a moderator hits it on a
phone. Now a 44px inline-flex target.

#### 44px floor, and why it was 41

`h-11` is 2.75rem — 44px only while the root font-size is 16px. A physical
touch target cannot be expressed in rem and then assumed. Fixed in px at the
component layer in `ErrorState` (every buyer/seller/admin page that fails a
query) and `AdminMFAGate`'s retry. Regression test asserts the declared floor,
because jsdom reports 0×0 and a computed-box test there would pass on a
zero-height button; the real box is measured in the browser gate.

| Gate | Result |
|---|---|
| `supabase db reset` + MFA config | 348/348 |
| pgTAP | Files=32, **1174**, PASS |
| unit | **1814** passed |
| `tsc -b` / eslint | clean / 0 errors |
| build · `BUNDLE_STRICT=1` · prototype guard · `build:proto` | all pass |
| Total gz | 1921.1 → **1921.3** (+0.2 for the two touch-target fixes) |
| INITIAL | 226.3 KB |

---

## P2b.3 — Public read/search architecture · `<this commit>`

One migration, one pgTAP file (55), four public wrappers, one shared
predicate, one generated search column and four partial indexes. Bundle
**1921.3 → 1921.4 KB** (+0.1; allocation was 4 KB) — this checkpoint is
backend only.

### The leak it found

`product_public_projection` returned `media[].path = rendition_source_path` to
**both** readers. That column is the client-processed WebP in the **draft
bucket** — the object `product_publish_prepare` copies *from*. Every public
read was handed a private storage path for every photo.

P2a's assertions missed it because they searched for `draft_path` and
`/original`; this is a third column with neither name in it. And the assertion
that would have caught it was doing the opposite — it demanded the seller
preview and the public reader return an **identical** media list, which is
precisely what made the leak invisible. Fixed the way `stock_on_hand` already
was: seller-only by construction.

### Publishable, defined once

`shop_product_is_publishable()` — approved · published · shop active ·
**category active** · **at least one committed public rendition** · **at least
one live variant**. The last three are new. Without the rendition check a
product whose worker job has not run appears in a list with a broken image;
that case is now a fixture (`vot-chua-co-byte`) rather than a hope.

### No public function takes a privilege flag

`shop_public_product(slug)` · `shop_public_shop(slug)` ·
`shop_public_search(...)` · `shop_public_categories()` ·
`shop_public_contacts(...)`. Asserted twice: against the live catalog in pgTAP,
and against the migration text in `shop-schema-parity.test.ts`.

A draft slug and a slug nobody ever used return **byte-identical** answers, so
the response is not an oracle for which private slugs are real. A retired slug
belonging to a draft does **not** redirect, for the same reason.

### Search

`to_tsvector('simple', unaccent_immutable(...))` as a **generated** column plus
a partial GIN index — the repo's own two conventions, combined, with no new
extension. `simple` because there is no Vietnamese stemmer and an English one
would mangle Vietnamese; unaccent so "vot" finds "vợt", which is how people
type on a phone. `websearch_to_tsquery` so an unbalanced quote is a shrug, not
a 500 (asserted).

### The performance bug EXPLAIN caught

The first implementation computed price range, availability and cover image for
**every matching row** and then counted them, because `total` was a count over
the same CTE the page came from — the N+1 this design exists to avoid, moved
into the count where it was harder to see.

Rewritten to narrow first (ids and sort key, every filter an EXISTS the indexes
can serve), count that, then pay for per-row fields on the ≤25 rows returned.

| Query (10,000 products · 25 shops · 4 categories · 1,000 retired slugs) | Before | After |
|---|---:|---:|
| discovery, first page | 122,819 buf · 57.9 ms | **3,004 buf · 7.6 ms** |
| discovery, deep cursor (row 2,000) | 122,124 · 49.3 ms | **2,402 · 6.5 ms** |
| category page | 32,127 · 14.1 ms | 2,397 · 4.7 ms |
| text search, unaccented | 31,675 · 13.5 ms | 7,954 · 7.4 ms |
| text + category + in-stock | 11,582 · 5.2 ms | 7,031 · 4.3 ms |
| shop catalog | 8,477 · 3.7 ms | 4,356 · 3.0 ms |
| PDP by current slug | — | 390 buf · 1.25 ms |
| PDP by retired slug (301) | — | 56 buf · 0.38 ms |
| taxonomy counts | — | 3,603 · 4.7 ms |

Teardown: 0 products, 0 shops.

### Red-before-green

| Guard removed | Result |
|---|---|
| the "public bytes exist" + "live variant" filters | 1 assertion red |
| the cursor's `id` tie-breaker | **3 red — one product silently SKIPPED** |

The second attempt is the interesting one. The first run of that proof came
back **green**, because the fixture's products all had distinct `created_at`
and a cursor comparing on the timestamp alone still partitioned them. Two rows
sharing a timestamp — a seller publishing a batch, a worker committing several
in one transaction — is what makes the difference visible, so the fixture now
has them and a cursor walk asserts all four rows come back exactly once.

### One more thing the gate caught

`search_doc` is generated, so `unaccent_immutable()` now runs on every write to
`products`. Phase 1 granted it to `authenticated` only, and the storage
integration suite went red with "permission denied for function
unaccent_immutable" the moment the column existed. Granted to `anon` and
`service_role`; it is pure text manipulation with no data access.

| Gate | Result |
|---|---|
| `supabase db reset` | 349/349 |
| pgTAP | Files=33, **1231**, PASS |
| storage integration | 17, PASS |
| unit | **1825** passed |
| `tsc -b` / eslint | clean / 0 errors |
| build · `BUNDLE_STRICT=1` | exit 0 |
| Total gz | 1921.3 → **1921.4** (+0.1, allocation 4 KB) |
| INITIAL | 226.3 KB |

---

## P2b.4 — Discovery, search, category · `<this commit>` — **BROWSER QA NOT GREEN**

Implementation complete and unit-verified; **browser acceptance is red** and
this checkpoint is therefore NOT signed off. Details at the bottom.

Three lazy bilingual routes, one `MIRRORED` entry each (ARCH-05), all
`noindex` (Q4):

| Route | Screen | chunk gz |
|---|---|---:|
| `/shop` + `/vi/shop` | B01 home | 2.3 KB |
| `/shop/search` + `/vi/…` | B02 search | 3.5 KB |
| `/shop/category/:slug` + `/vi/…` | B03 category | 3.4 KB |
| shared | `CatalogResults` | 8.5 KB |

Discovery, category and search are **one query** with different arguments
(`shop_public_search`), so a product cannot be visible on one screen and
missing from another.

### Decisions worth keeping

- **The typing race is handled by the cache key, not an abort controller.**
  react-query keys on the full argument list, so a slow response for "vo" is
  written into the entry for "vo" and can never overwrite "vot". The debounce
  on top is about not asking the server four times, not about correctness.
- **Filters commit on Áp dụng, not on tap.** The mobile sheet is a real
  `<dialog>` — Escape, focus trap and scroll lock come from the platform.
- **Error is not empty.** A shopper told "không có sản phẩm nào" when the
  request failed stops looking; the grid says "lỗi tải dữ liệu, không phải sàn
  đang trống" and offers a retry.
- **`unknown` availability is its own answer** — the seller did not count, so
  neither "còn hàng" nor "hết hàng" is true. 12 assertions pin this, the price
  range collapse, and the refusal to render `0₫` for a product with no price.
- **`publicMediaUrl` throws** on anything that is not a bucket key, so a future
  change that starts handing a signed URL to a buyer fails in CI rather than in
  a browser.
- No cart, no save, no dead buttons — asserted against the DOM in the gate.

### Gates

| Gate | Result |
|---|---|
| pgTAP | Files=33, 1231, PASS (unchanged) |
| unit | **1837** passed (was 1825) |
| `tsc -b` / eslint | clean / 0 errors |
| build · `BUNDLE_STRICT=1` | exit 0 |
| Total gz | 1921.4 → **1929.2** (+7.8; allocation 16 KB) |
| INITIAL | 226.4 KB |

### 🔴 Browser QA is RED — four open findings

`scripts/buyer-shop-qa.mjs` runs the three routes anonymously at
320/375/390/414/768/1440, asserting `window.innerWidth`, each route's own `<h1>`
**and** a body content marker, `<main>`, axe, keyboard, overflow, touch targets,
and that no draft path, signed URL, `stock_on_hand` or cart/save affordance
reaches the DOM. `/clubs` is carried as a **control route**, so anything
reported on both is site shell rather than this checkpoint — 33 shell finding
types are filtered that way.

What remains is mine and is **not fixed**:

1. **43px past the scroller at 320** on all three routes.
2. **1px past the scroller at 375** on all three routes.
3. **`button 27×36` at 768** — under the 44px floor, not present on `/clubs`.
4. **Breadcrumb link 26×44** on category — height fixed, width still short.

An attempt to fix (4) with `min-width: 44px` **made (1) worse**, which is
recorded in the CSS comment: a 44px minimum on an inline breadcrumb pushed the
320px layout past its scroller, and trading a small target for a broken layout
is not a fix. That change was reverted.

These are layout bugs in new code, they are reproducible at named widths, and
they are the reason this checkpoint is not signed off. **P2b.5 and P2b.6 have
not been started.**

### P2b.4 browser acceptance — PASS · `<this commit>`

**P2b.4 implementation and local browser acceptance PASS.**

Four findings were open. Diagnosing them by geometry rather than by trying CSS
changed what three of them were.

#### A diagnostic that names the culprit

`scripts/qa/overflow-diagnostic.mjs` returns the offending elements with their
path, rect and the computed properties that usually explain them, instead of
one number for the document. Deliberately not `scrollWidth`: that cannot name
anything and misses an element clipped by an ancestor.

It immediately identified `nav.tl-nav > div.tl-nav-right` — the **site
header** — not Shop code. Arithmetic at 320px: back 36 + brand 22 + auth pills
120 + nav-right 80 = 258 content, plus 4×16 gap and 2×20 padding = **362 in a
320 box**.

#### The control was wrong, which is why it read as ours

The gate controlled against `/clubs`, which has **no back button** — and the
back button is what makes the header too wide. Against `/tools`, which shipped
long before the Shop, the overflow reproduces **identically (337 vs 320)**.

Fixed at the header for every page, not patched into three Shop routes: gutters
20 → 12px and gap 16 → 8px below 380px. Nothing hidden, no control shrunk.
`/tools` and `/shop` both go from 337 to 320.

The gate's control is now `/tools`. A control that does not exercise the same
shell configuration is not a control.

#### What was actually ours

Only the **breadcrumb**, 26×44. Fixed with real padding on the anchor
(26 + 2×9 = 44) — the box a thumb and `getBoundingClientRect()` both see, not a
pseudo-element.

The first attempt added a compensating `margin-inline-start: -9px` to keep the
text flush. That put the anchor at **x = −9**: a fifth of the touch target off
the left edge of a 320px screen, and an **edge click landed outside the
window**. Caught by the new click test. The margin was dropped; a 9px indent is
a much smaller price than an unreachable target. The gate now also checks the
**left** edge, which `overflowOf` never did.

`button 27×36` at 768 turned out to be shell too — present on `/tools`.

#### The gate had been passing on an empty catalogue

The 375px screenshot showed every category count at **0** and no product card
at all: `.update({status:'approved'})` through PostgREST is silently
neutralised by the P2a privileged-column guard, and `product_media` pins
`state`/`public_path` the same way. The seed had never produced a publishable
product, so no card, price, availability label or lazy image was ever
rendered — the same false green this branch has now met three times in three
disguises.

The promotion runs as privileged SQL (the moderator's RPC and the worker's
commit, replayed), the seed **asserts** it produced publishable rows, and every
route now asserts **≥1 product card**. Verified in the screenshot: 6 products,
real prices, "Mới · Còn hàng", verified-shop badge, honest sparse-catalogue
copy.

#### Red-before-green

| Reverted | Result |
|---|---|
| header gutter fix | diagnostic red at **+43px**, naming `nav.tl-nav > div.tl-nav-right`, on control **and** shop |
| breadcrumb padding | 7 findings red (`a 26×21`) |
| seed promotion | 18 findings red ("0 product cards") |

Worth recording: with the breadcrumb reverted the **click test still passed**,
because it clicks the edge of whatever box exists. The size assertion catches a
shrunken target; the click test catches a correctly-sized target that is
unreachable. Both earned their place, for different failures.

| Gate | Result |
|---|---|
| buyer browser QA | **PASS** at 320/375/390/414/768/1440, 35 shell types filtered against `/tools` |
| breadcrumb edge click @320 | PASS |
| unit | 1837 |
| `tsc -b` / eslint | clean / 0 errors |
| build · `BUNDLE_STRICT=1` · `build:proto` | pass |
| Total gz | 1929.2 → **1929.5** (+0.3 for the CSS) |
| INITIAL | 226.5 KB |

Screenshots outside the repo: 375 home/search/category/control, 1440 search.
