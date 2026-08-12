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

---

## P2b.5 — PDP, public shop page, contact CTA · `<this commit>`

Two lazy bilingual routes plus a migration. Bundle **1929.5 → 1935.3 KB**
(+5.8; allocation 18 KB).

| Route | Screen | chunk gz |
|---|---|---:|
| `/shop/product/:slug` + `/vi/…` | B04 + B05 PDP | 7.5 KB |
| `/shop/store/:slug` + `/vi/…` | B06 shop page | 5.0 KB |

### Shop slug history

Q2 gave products a forwarding address; shops were left out, and the moment
`/shop/store/:slug` is a real page that is the same bug. `shop_slug_history`,
written **inside the guarded transaction** that renames — not a trigger, not
the client.

One thing deliberately unlike the product version: a retired slug resolves only
while the shop is **active**. A suspended shop answering on its old URL would
confirm it exists, which is exactly what `shop_public_shop` refuses to do on
the current one. Suspended, closed and never-existed all return the same
answer, asserted byte-for-byte.

### Variant selection

Pure, in `src/lib/shop/variantSelection.ts`, 15 assertions. The rules B04/B05
were accepted on: colour changes the photo immediately (before a size is
picked), size updates SKU/price/availability, changing colour **keeps** the
size when that combination exists and **releases** it when it does not, and
the seller never changes.

"Does not exist" and "sold out" stay separate states with separate words, and
`unknown` stock counts as available — the seller did not give a number, and
greying the option out would invent a fact.

### Contact CTA (D2)

10 assertions on `contactCta.ts`. The destination is the server-normalised
value; nothing is built from seller text. `tel:` only from E.164; `zalo.me` and
`m.me` only, over https only; **query and fragment are stripped** because that
is where a buyer's identity would end up. Lookalike hosts
(`zalo.me.evil.example`) refused. Analytics records channel **type** and public
ids — a payload assertion proves the number and the URL are not in it.

With no approved channel the page says so. No disabled button.

### Red-before-green

| Reverted | Result |
|---|---|
| `activeMediaId` ignores the variant | 2 red — including "colour changes the photo before the size is picked" |
| contact scheme allowlist opened | 1 red — `javascript:`, `data:`, `file:`, `blob:`, `http:` all pass |
| retired slug resolves for a suspended shop | 2 red — the redirect becomes an oracle for suspended shops |

Recorded honestly: breaking the PDP's **use** of `activeMediaId` left the unit
tests green, because they cover the function and not the wiring. The red proof
was done at the function. The page-level guard is the browser gate.

### Two teardown bugs the gate found in itself

1. A seed that **threw halfway** left its shop and six products behind —
   `seeded` was only assigned on success, so the `finally` had nothing to
   clean. Leftovers then broke a pgTAP file that counts publishable products
   globally, and the failures pointed at search and sort rather than at the
   real cause. Ids are now recorded **as they are created**.
2. The assignment itself was missing after the first fix, so teardown silently
   did nothing while the gate reported PASS. Caught by checking the row counts
   after a green run rather than trusting the green.

Teardown now verified: **0 products, 0 shops**.

| Gate | Result |
|---|---|
| `supabase db reset` | 350/350 |
| pgTAP | Files=33, **1241**, PASS |
| unit | **1862** passed |
| buyer browser QA | **PASS**, 5 routes × 6 widths, 35 shell types filtered vs `/tools` |
| `tsc -b` / eslint | clean / 0 errors |
| build · `BUNDLE_STRICT=1` · `build:proto` | pass |
| Total gz | 1929.5 → **1935.3** (+5.8) |
| INITIAL | 226.6 KB |
| headroom | 34.7 KB (P2b.6 allocation 5) |

Screenshots outside the repo: 375 pdp/store, 320 pdp/store, plus the P2b.4 set.

---

## P2b.6 — SEO, robots and the launch gate · `<this commit>`

Q4 says the closed-pilot Shop is **not indexed**, so the deliverable is the
switch and the proof that it is server-side — not an SSR renderer for pages
nobody is allowed to crawl yet. Bundle **1935.3 → 1934.9 KB** (−0.4; this is
Pages Functions code, which never enters the client bundle).

### The switch is at the edge

`functions/_middleware.ts` already turns `NOINDEX_PATTERNS` into an
`X-Robots-Tag: noindex, nofollow, noarchive` header before the response is
built. The five buyer paths (and their `/vi` mirrors) join it behind
`SHOP_PUBLIC_INDEXING`, which opens **only** on the exact string `"1"` —
`"true"`, `"yes"` and `""` are all asserted to leave it closed, because that is
the kind of flag someone sets to the wrong word.

Seller and Admin are matched by their own patterns, which `shouldNoindex`
checks **before** it looks at the flag — asserted by calling it with the flag
ON and expecting `/seller`, `/shop/sell` and `/admin/shop/products` still
noindex.

`robots.txt` gains the same Disallow set for the pilot, in both languages,
outside the block that the flag controls for the seller paths.

Opening the gate at launch is one environment variable. No redeploy of the
SPA, no code change.

### Sitemap and IndexNow

Asserted **absent**: the sitemap index references no shop segment, no sitemap
function emits a `/shop/product|store|category|search` URL, and nothing calls
IndexNow for one.

### Red-before-green

| Reverted | Result |
|---|---|
| the pilot rule inside `shouldNoindex` | 1 red — every buyer path indexable |
| a `sitemap-shop.xml` added to the index | 1 red |

The first attempt at that first proof came back **green**, and that is the
finding worth keeping: the test asserted the middleware source *contained* the
pilot check, so replacing the check with `return false` changed nothing it
looked at. Same shape as the P2b.5 note about `activeMediaId`. `shouldNoindex`
is now exported and **called** with an env, and the grep-style assertions are
reduced to the one thing a call cannot show — that the answer is read from
`env` at request time.

| Gate | Result |
|---|---|
| pgTAP | Files=33, **1241**, PASS |
| unit | **1882** passed |
| buyer browser QA | PASS, 5 routes × 6 widths |
| teardown | 0 products |
| `tsc -b` / eslint | clean / 0 errors |
| build · `BUNDLE_STRICT=1` | exit 0 |
| Total gz | **1934.9** · INITIAL 226.6 · headroom **35.1 KB** |

### Deliberately not built

A `renderShopProduct` SSR path, `Product`/`Offer` JSON-LD and
`sitemap-shop.xml`. All of them are launch-gate work: they exist to be crawled,
and nothing is being crawled. Building them now would mean shipping untested
crawler output, and the metadata a human sees is already correct through
`DynamicMeta`. The launch checklist in §0.2 of the proposal is where they
belong, and they are named there.
---

## P2b.7 — acceptance, audit and the wiring between the pieces · `<this commit>`

Not a feature checkpoint. P2b.3–P2b.6 each proved their own half; this one asks
whether the halves are connected, and it found four places where they were not.

The rule the branch earned three times over is now the gate's own rule:

> A test that protects a FUNCTION does not protect the place production calls it.

Every red proof below breaks a real call site — the middleware, the route
table, the rendered page, the publish transaction — and the reverted-function
proofs that would have passed are recorded where they happened.

### One seed, one browser, one teardown

`scripts/shop-p2b-acceptance-qa.mjs` replaces four separate gates with one run
over `scripts/qa/p2b-seed.mjs`: **20 routes × 6 widths** (320/375/390/414/768/1440),
the `/vi` twins, six end-to-end journeys, a leakage scan of both the DOM and
every REST payload the page received, and a teardown that counts.

The seed refuses to return until it has re-read the database and found what it
claims to have made — five publishable products, a public rendition, an
approved contact, a non-empty `shop_public_search`, a non-empty category count.
Ids are recorded **as they are created**, so a seed that throws halfway is
still fully cleanable.

`SHOP_QA_CHAOS=1` throws deliberately between the seed and the QA. The run
exits 1 and the teardown still reports zero across all seventeen counts — which
is the only way to know the `finally` is real.

### The teardown reported zero over three shops and ten products

The fourth teardown on this branch to lie, and the first one that lied in its
**reporting** rather than in its deleting. A PASSing run printed all zeros;
pgTAP against the same database immediately afterwards failed 73 assertions on
rows that run had left behind — `vot-shop-doi-chung-<run>` turning up in a
sort-order test that had nothing to do with it.

Two causes, both mine, both the same shape:

- Every delete was fire-and-forget. `shop_applications` was being deleted by
  `user_id` — a column that does not exist; it is `applicant_user_id` — and had
  been failing silently on every run since the fixture was written.
- Every count ended in `?? 0`, so a read that **errored** reported clean. That
  is what turns a broken teardown into a green one.

Now every delete and every count is checked, a failed count returns `-1` rather
than `0`, an **empty registry is itself a finding** (an empty registry deletes
nothing, counts nothing, and reads as flawless), and a registry-**independent**
sweep asks the database directly whether any `p2b7-*` shop survives — so a
registry that lost an id can no longer make every count above it vacuous.

| Reverted | Result |
|---|---|
| the `delete shops` line in the teardown | 6 errors · 4 shops · 4 members · 1 slug-history row · 4 contacts · 5 users, plus the stray sweep naming all three shops by slug |

Under the old code that same break printed all zeros and PASS.

**pgTAP now runs against the database the acceptance run just used**, and that
is part of the gate. It is the only check that does not trust the teardown's
own arithmetic, and it is what caught this.

### Two controls, because one shell is not two shells

P2b.4 recorded that `/clubs` was the wrong control: it has no back button, and
the back button was the header overflow, so the Shop was blamed for a site-wide
bug. The same mistake was waiting one level up. `/tools` says nothing about
`AdminLayout`, whose sidebar links are 38px tall, so every admin route reported
seven small targets belonging to a console that shipped long before the Shop.

The gate now carries `/tools` for TheLineLayout and `/admin/users` for
AdminLayout. **40 shell finding types** cancel that way. What survived was ours.

### The flake that was a race, not a defect

One run, once, reported three 14px links on a single route. Text laid out in
the fallback face is a different height from the same text in the real one, so
a footer link measured at 13px on the control and 14px on the route produces
two different finding strings and the control cancels neither. `document.fonts.ready`
before any geometry. Recorded because "it only happened once" is the reasoning
that leaves a flaky gate in place until somebody stops believing it.

### What the sweep found

Four defects, all of them in code that already had passing tests.

**1. The mobile filter sheet ignored every tap.** `FilterSheet` held its draft
in a `useRef` and passed `draftRef.current` as the `value` of controlled
inputs. A tap mutated the ref, re-rendered nothing, and React put the radio
straight back to unchecked. The filter committed correctly on Áp dụng, so the
unit tests (which cover the query arguments) and the browser gate (which read
the URL afterwards) both passed. Nobody had checked the second in between, and
in that second the control looks broken.

Confirmed in a real browser — `checked after click: false` — and fixed by
making the draft state. Five assertions, all red on the old component, one of
them covering the half that already worked and one covering the regression the
fix could have introduced (a cancelled draft reappearing on the next opening).

**2. A 15px nav link in the admin console.** `.tl-admin-side li` carried the
padding and the anchor inside it did not, so the Shop sub-nav rendered
`a 83×15`, `58×15`, `71×15`. Precisely the P2b.4 breadcrumb defect — the box a
thumb and `getBoundingClientRect()` both see — one component over. The padding
moved to the link.

**3. `← Về hàng đợi` was 77×17 on the application review screen.**
`AdminShopProductReview` had fixed this with an inline style in P2b.2;
`AdminShopApplicationReview`, a Phase 1 screen no P2b gate had ever opened,
never got it. The rule is now `.tl-shop-back` and both screens use it, so the
third review screen cannot repeat it.

**4. The route inventory found a route nobody was testing.**
`route-inventory.test.mjs` parses the actual route tables in `src/App.tsx` —
both `<Route>` and `MIRRORED` — and failed on its first run naming
`/admin/shop/applications/:id`. It is now in the sweep, which is how (3) was
found.

### The seed lied, and the journeys caught it

The fifth sighting of the privileged-write trap, in a new disguise. The seed
suspended a shop with `UPDATE public.shops SET state='suspended'` through
`psql`, having set `shop.privileged_write`. That flag governs `products` and
`product_media`. `shops_guard_privileged_columns` pins `state` on any write
where **`is_admin()`** is false, and `psql` as the `postgres` role has no JWT
and is therefore not an admin. The update was a silent no-op, and the
"suspended" shop went on serving its catalogue.

It was found by the slug journey, which asserts that a suspended shop and one
that never existed answer identically — not by anything that looked at the
seed. The suspension now goes through the admin's own client and the state is
read back afterwards.

A second fixture lie, same run: **a new contact channel starts in `draft`, not
`pending_review`**, and there is no seller-side submit — the moderator picks it
up from the Nháp tab. A queue fixture that inserts one sees an empty screen and
concludes the seed failed. The fixture now approves a channel and then edits
it, which is the only road into that queue. Recorded in the Product Owner pack
as a product question: should a seller have a "gửi duyệt" button?

### Six journeys, driven through the real RPCs

| | What it pins |
|---|---|
| J1 application | non-pilot refused on screen **and** at the RPC · request-changes reaches the applicant with the field · the internal note does not · approve is idempotent (one shop on replay, not two) |
| J2 moderation | pending is not public · approve alone does **not** publish · the publication commit is what does · suspend clears the PDP, search, category and the shop page at once · reopen returns it to the seller **off sale** (Q5) |
| J3 contacts | only the approved channel is public · a pending number and a rejected URL are on no payload · editing a live value pulls it back to review and off the shelf · history is complete · the internal note is not in the seller's copy · no analytics payload carries a destination |
| J4 slugs | retired product and shop slugs forward · canonical follows · suspended and never-existed are **byte-identical** answers · one hop, same origin |
| J5 discovery | diacritic-insensitive both ways · the typing race lands on the last keystroke · back restores the query **and its results** · the cursor neither repeats nor skips · filters commit on Áp dụng and show the choice |
| J6 tenancy | a rival cannot read a non-public product or its variants · a seller cannot moderate · support cannot add a public contact · an **aal1** admin cannot decide |

### noindex, read off the response

`functions/_lib/__tests__/shop-pilot-seo-edge.test.ts` calls `onRequest` — the
export Cloudflare Pages calls — and reads `X-Robots-Tag` and the body off the
Response, on both branches. 41 assertions.

| Reverted | Result |
|---|---|
| `const isNoindex = false && shouldNoindex(pathname, env)` | **34 red** here · **0 red** in `shop-pilot-seo.test.ts` |
| `/shop` dropped from `SHOP_PUBLIC_PATTERNS` | 5 red |

The second line of that first row is the finding. The existing file calls
`shouldNoindex` and proves the rule; it cannot notice that the middleware
stopped using it.

### Media, walked as a loop

`scripts/shop-p2b-media-lifecycle.test.mjs`, on real bytes. The existing
integration test proves each step; this one walks the cycle where the
interesting failure lives — unpublish queues the live key, the seller
republishes before the worker ran, the worker drains, and the buyer gets a 404
on a product that published successfully minutes ago. The key is
`<media>-v<version>` and the version does not change, so republish re-takes
exactly the key sitting in the deletion queue.

| Reverted | Result |
|---|---|
| the `DELETE FROM shop_media_cleanup_jobs` in `product_publish_commit` | red — "a pending deletion for a key that is live again" |

Restored with `supabase db reset`; ledger back to 350/350.

Both this file and the sweep now separate a leaked **value** from a nulled
**key**. `product_public_projection` keeps one shape and nulls the seller-only
fields when `_as_seller` is false, so a buyer DTO contains
`"stock_on_hand": null`. Forbidding the string called that a leak. The
assertion is that each seller-only key is **present and null** — strictly
stronger, because it goes red if a wrapper ever passes `true`.

### Deliberately not fixed

The retired-slug redirect **drops the `/vi` prefix**:
`/vi/shop/product/<old>` lands on `/shop/product/<new>`. Every internal link in
the product hardcodes the EN path (`VenuesList.tsx`, `ClubsList.tsx`, the Shop
pages), so this is a site-wide navigation convention, not a Shop defect.
Changing it is an SEO/navigation decision, not a bug fix inside an acceptance
checkpoint. Recorded in `deployment-readiness.md` under the indexing gate,
where it has to be settled before anything is crawlable.

### Gates

| Gate | Result |
|---|---|
| `supabase db reset` | 350/350 |
| pgTAP | Files=33, **1241**, PASS — **and again on the database an acceptance run had just used** |
| unit | **1959** passed, 10 skipped |
| `tsc -b` / eslint | clean / **0 errors**, 29 warnings (all pre-existing `react-refresh` in `src/proto`) |
| acceptance QA | **PASS** — 20 routes × 6 widths, /vi twins, 6 journeys, 40 shell types filtered |
| teardown | 0 across 17 counts, and 0 again after a deliberate mid-run throw |
| storage integration | PASS |
| media lifecycle | 7 PASS |
| SEO edge | 41 PASS |
| build · `BUNDLE_STRICT=1` · `build:proto` | exit 0 |
| Total gz | 1934.9 → **1935.0** (+0.1, CSS) · INITIAL **226.6** · headroom **35.0 KB** |

Backstop **1970 KB, not raised**.

### Deliverables

- `docs/proposals/shop-catalog-phase-2b/product-owner-test-cases.md` — 16
  groups, 🔴/🟠/⚪, exact commands, and `scripts/shop-p2b-fixture.mjs up|down`
  so a person can hold the dataset open. It does not ask the Product Owner to
  re-run 1.959 unit tests by hand.
- `docs/proposals/shop-catalog-phase-2b/deployment-readiness.md` — three
  separated gates (remote preview / production pilot / indexing), each item
  with its command, file, secret, owner, rollback and required evidence. No
  checkbox that needs remote access or the Product Owner's authority is ticked.

### Status

`P2b implementation complete and verified locally, pending Product Owner manual
acceptance and deployment approval.`

Not production ready. Not deployed. Not remote verified. Not merged, not
pushed, not applied to a remote database. Indexing not enabled.
