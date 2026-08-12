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
